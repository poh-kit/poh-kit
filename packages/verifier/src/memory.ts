// SPDX-License-Identifier: MIT OR Apache-2.0
import type { IdentityProofRecord, TrustTier } from "@poh-kit/core";
import type { CachedGroup, GroupStore, NullifierStore, UsedSignalStore } from "./stores.js";

export class InMemoryNullifierStore implements NullifierStore {
  private records = new Map<string, IdentityProofRecord>();
  async get(nullifier: string) { return this.records.get(nullifier) ?? null; }
  async put(record: IdentityProofRecord) { this.records.set(record.nullifier, record); }
  async listCommitments() {
    return [...this.records.values()]
      .filter((r) => r.commitment !== "")
      .map((r) => ({ commitment: r.commitment, trustTier: r.trustTier }));
  }
}

export class InMemoryGroupStore implements GroupStore {
  private groups = new Map<TrustTier, CachedGroup>();
  async get(tier: TrustTier) { return this.groups.get(tier) ?? null; }
  async put(tier: TrustTier, group: CachedGroup) { this.groups.set(tier, group); }
}

export class InMemoryUsedSignalStore implements UsedSignalStore {
  private used = new Set<string>();
  async has(scope: string, nullifier: string) { return this.used.has(`${scope}:${nullifier}`); }
  async markUsed(scope: string, nullifier: string) { this.used.add(`${scope}:${nullifier}`); }
}
