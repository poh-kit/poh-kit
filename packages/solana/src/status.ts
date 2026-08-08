// SPDX-License-Identifier: MIT OR Apache-2.0
import type { Connection, PublicKey } from "@solana/web3.js";
import { deriveVerifiedHumanPda } from "./pda.js";

/**
 * The single call most integrations actually want: does this wallet hold a
 * live VERIFIED_HUMAN attestation? One RPC call, no API key, no gaas-client
 * dependency — a pure on-chain read anyone can make.
 *
 * @param connection - Any `@solana/web3.js` Connection pointed at the cluster
 *   the attestations program is deployed to (devnet during development,
 *   mainnet-beta once live).
 * @param wallet - The wallet to check.
 * @param programId - The deployed attestations program ID.
 * @returns `true` only if the PDA exists AND is owned by `programId` —
 *   ownership is checked, not just existence, so a same-address collision
 *   from an unrelated account can't spoof a positive.
 */
export async function hasVerifiedHuman(
  connection: Connection,
  wallet: PublicKey,
  programId: PublicKey,
): Promise<boolean> {
  const [pda] = deriveVerifiedHumanPda(wallet, programId);
  const info = await connection.getAccountInfo(pda);
  return info !== null && info.owner.equals(programId);
}
