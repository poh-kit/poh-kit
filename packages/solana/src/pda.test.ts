// SPDX-License-Identifier: MIT OR Apache-2.0
import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { AttestationKind } from "@poh-kit/core";
import { deriveAttestationPda, deriveVerifiedHumanPda } from "./pda.js";

// The devnet-deployed attestations program ID (Anchor.toml [programs.devnet]).
const PROGRAM_ID = new PublicKey("GQrFse7NiB6QdqtagGayNYwrr8zn4W4uWhji57VkKGky");

// System Program's own pubkey, reused only as a fixed, well-known test wallet —
// not a real user. Its role here is just "a deterministic 32-byte address".
const TEST_WALLET = new PublicKey("11111111111111111111111111111111");

describe("deriveVerifiedHumanPda", () => {
  it("matches the on-chain program's seed derivation exactly", () => {
    // Computed independently with @solana/web3.js against PROGRAM_ID + TEST_WALLET
    // and a 32-byte all-zero context hash — see the module doc for how this was
    // verified. A mismatch here means the seed scheme in pda.ts has drifted from
    // contracts/solana/programs/attestations/src/lib.rs.
    const [pda, bump] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    expect(pda.toBase58()).toBe("8eLmNnkcjwomkhxYjePF6FvRAAcTpxidBbkUC5gbUnpR");
    expect(bump).toBe(248);
  });

  it("is deterministic — same inputs always derive the same PDA", () => {
    const [a] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    const [b] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    expect(a.equals(b)).toBe(true);
  });

  it("differs per wallet", () => {
    const other = new PublicKey("So11111111111111111111111111111111111111112");
    const [a] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    const [b] = deriveVerifiedHumanPda(other, PROGRAM_ID);
    expect(a.equals(b)).toBe(false);
  });

  it("differs per program ID (devnet vs. mainnet deploys don't collide)", () => {
    const otherProgram = new PublicKey("So11111111111111111111111111111111111111112");
    const [a] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    const [b] = deriveVerifiedHumanPda(TEST_WALLET, otherProgram);
    expect(a.equals(b)).toBe(false);
  });

  it("is the AttestationKind.VERIFIED_HUMAN case of the general derivation", () => {
    const [viaConvenience] = deriveVerifiedHumanPda(TEST_WALLET, PROGRAM_ID);
    const [viaGeneral] = deriveAttestationPda(
      TEST_WALLET,
      AttestationKind.VERIFIED_HUMAN,
      new Uint8Array(32),
      PROGRAM_ID,
    );
    expect(viaConvenience.equals(viaGeneral)).toBe(true);
  });
});

describe("deriveAttestationPda", () => {
  it("rejects a context hash that isn't 32 bytes", () => {
    expect(() =>
      deriveAttestationPda(TEST_WALLET, AttestationKind.VERIFIED_HUMAN, new Uint8Array(16), PROGRAM_ID),
    ).toThrow(/32 bytes/);
  });

  it("VOTED and SUPPORTED_PROPOSAL derive different PDAs for the same wallet+context", () => {
    const ctx = new Uint8Array(32).fill(7);
    const [voted] = deriveAttestationPda(TEST_WALLET, AttestationKind.VOTED, ctx, PROGRAM_ID);
    const [supported] = deriveAttestationPda(TEST_WALLET, AttestationKind.SUPPORTED_PROPOSAL, ctx, PROGRAM_ID);
    expect(voted.equals(supported)).toBe(false);
  });
});
