// SPDX-License-Identifier: MIT OR Apache-2.0
import { PublicKey } from "@solana/web3.js";
import { AttestationKind } from "@poh-kit/core";

/**
 * `context_hash` for VERIFIED_HUMAN attestations is a fixed all-zero 32-byte
 * value — humanity isn't scoped to a proposal or round the way VOTED /
 * SUPPORTED_PROPOSAL attestations are. This is what makes the PDA fully
 * deterministic from just a wallet address and the program ID.
 *
 * Must match `functions/lib/chain/solana-adapter.js`'s
 * `buildAttestationContext({ type: "VERIFIED_HUMAN" })` in the Foundation
 * backend exactly — that is the source of truth this constant mirrors.
 */
const VERIFIED_HUMAN_CONTEXT_HASH = new Uint8Array(32);

/**
 * Derive the soulbound attestation PDA for `[holder, attestationType, contextHash]`.
 *
 * Mirrors the seed scheme in `contracts/solana/programs/attestations/src/lib.rs`
 * exactly: `[b"attestation", holder, [attestationType], contextHash]`. Any Solana
 * program or client can call this — no API key, no network round-trip. Existence
 * of the returned account (owned by `programId`) is the attestation.
 *
 * @param holder - Wallet whose attestation to look up.
 * @param attestationType - One of {@link AttestationKind}. Solana's program
 *   rejects RECEIVED_SHARE (3) — that ordinal is EVM-only.
 * @param contextHash - 32 bytes. Use {@link deriveVerifiedHumanPda} instead of
 *   calling this directly for VERIFIED_HUMAN — it supplies the right constant.
 * @param programId - The deployed attestations program ID (devnet or mainnet).
 */
export function deriveAttestationPda(
  holder: PublicKey,
  attestationType: AttestationKind,
  contextHash: Uint8Array,
  programId: PublicKey,
): [PublicKey, number] {
  if (contextHash.length !== 32) {
    throw new Error(`deriveAttestationPda: contextHash must be 32 bytes, got ${contextHash.length}`);
  }
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("attestation"),
      holder.toBuffer(),
      Buffer.from([attestationType]),
      Buffer.from(contextHash),
    ],
    programId,
  );
}

/**
 * Derive the VERIFIED_HUMAN attestation PDA for a wallet — the one most
 * integrations need. Convenience wrapper around {@link deriveAttestationPda}
 * with the fixed context hash already supplied.
 *
 * @example
 * ```ts
 * const [pda] = deriveVerifiedHumanPda(wallet, ATTESTATIONS_PROGRAM_ID);
 * const info = await connection.getAccountInfo(pda);
 * const isVerified = info !== null && info.owner.equals(ATTESTATIONS_PROGRAM_ID);
 * ```
 */
export function deriveVerifiedHumanPda(holder: PublicKey, programId: PublicKey): [PublicKey, number] {
  return deriveAttestationPda(holder, AttestationKind.VERIFIED_HUMAN, VERIFIED_HUMAN_CONTEXT_HASH, programId);
}
