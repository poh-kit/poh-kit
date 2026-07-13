// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Storage adapters — the open/closed boundary of poh-kit. The verifier is
// written against these three interfaces; hosts bring their own persistence
// (Foundation's production impl is Firestore and stays in its private repo).
import type { IdentityProofRecord, TrustTier } from "@poh-kit/core";

export interface NullifierStore {
  get(nullifier: string): Promise<IdentityProofRecord | null>;
  put(record: IdentityProofRecord): Promise<void>;
  /** Every attached commitment with its tier — input to group building. */
  listCommitments(): Promise<Array<{ commitment: string; trustTier: TrustTier }>>;
}

export interface CachedGroup {
  tier: TrustTier;
  commitments: string[];
  memberCount: number;
  /** Merkle root as decimal string. */
  root: string;
}

export interface GroupStore {
  get(tier: TrustTier): Promise<CachedGroup | null>;
  put(tier: TrustTier, group: CachedGroup): Promise<void>;
}

/** Tracks spent signal nullifiers per scope (e.g. per proposal). */
export interface UsedSignalStore {
  has(scope: string, nullifier: string): Promise<boolean>;
  markUsed(scope: string, nullifier: string): Promise<void>;
}

/** Injectable logger so hosts control observability; defaults to silent. */
export interface PohLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}
export const silentLogger: PohLogger = { warn: () => {} };
