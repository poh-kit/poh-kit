// SPDX-License-Identifier: MIT OR Apache-2.0
import { describe, expect, it } from "vitest";
import { Group } from "@semaphore-protocol/group";
import { InMemoryGroupStore, InMemoryNullifierStore } from "./memory.js";
import { buildGroups } from "./groups.js";
import { createIdentity } from "@poh-kit/core";

function record(subject: string, tier: "low" | "medium" | "high", commitment: string) {
  return {
    nullifier: `null-${subject}`, commitment, proofType: "self-passport",
    attestationId: 1, verifiedAt: new Date(0).toISOString(),
    disclosures: [{ kind: "humanity" as const }], subject, trustTier: tier,
  };
}

describe("buildGroups", () => {
  it("expands membership downward: high ∈ {low,medium,high}, low ∈ {low}", async () => {
    const nullifiers = new InMemoryNullifierStore();
    const groups = new InMemoryGroupStore();
    const hi = createIdentity("hi").commitment;
    const lo = createIdentity("lo").commitment;
    await nullifiers.put(record("hi", "high", hi));
    await nullifiers.put(record("lo", "low", lo));

    const built = await buildGroups(nullifiers, groups);
    expect(built.low.commitments).toEqual(expect.arrayContaining([hi, lo]));
    expect(built.low.memberCount).toBe(2);
    expect(built.medium.commitments).toEqual([hi]);
    expect(built.high.commitments).toEqual([hi]);
  });

  it("caches each tier group with a root matching a fresh Semaphore Group", async () => {
    const nullifiers = new InMemoryNullifierStore();
    const groups = new InMemoryGroupStore();
    const c = createIdentity("x").commitment;
    await nullifiers.put(record("x", "medium", c));

    const built = await buildGroups(nullifiers, groups);
    const expected = new Group([BigInt(c)]);
    expect(built.medium.root).toBe(expected.root.toString());
    expect((await groups.get("medium"))?.root).toBe(built.medium.root);
  });

  it("skips records with empty commitments", async () => {
    const nullifiers = new InMemoryNullifierStore();
    const groups = new InMemoryGroupStore();
    await nullifiers.put(record("nc", "high", ""));
    const built = await buildGroups(nullifiers, groups);
    expect(built.high.memberCount).toBe(0);
  });
});
