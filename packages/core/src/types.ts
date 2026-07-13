// SPDX-License-Identifier: MIT OR Apache-2.0
import type { TrustTier } from "./tiers.js";

/** Selective-disclosure item. Bounded categorical values only — never raw PII. */
export interface DisclosureItem {
  kind: "humanity" | "age" | "jurisdiction";
  value?: string;
}

/** One verified identity: one passport → one nullifier → one record. */
export interface IdentityProofRecord {
  nullifier: string;
  /** Semaphore identity commitment, "" until one is attached. */
  commitment: string;
  proofType: string;
  attestationId: number;
  /** ISO-8601. */
  verifiedAt: string;
  disclosures: DisclosureItem[];
  /** Caller-defined stable subject key (e.g. an app user id). Opaque to poh-kit. */
  subject: string;
  trustTier: TrustTier;
}
