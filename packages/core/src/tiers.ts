// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Trust-tier vocabulary for Proof-of-Humanity enrollments.
//
// Self Protocol attestation IDs (see @selfxyz/core ATTESTATION_ID):
//   1 = PASSPORT           — ICAO ePassport (NFC chip + Groth16 ZK)
//   2 = BIOMETRIC_ID_CARD  — biometric ID card (NFC chip + ZK)
//   3 = AADHAAR            — recognized by Self, not yet supported here
//   4 = SELFRICA_ID_CARD   — biometric ID card (NFC chip + ZK)
// poh-kit v1 supports 1 (passport) and 2/4 (id cards); 3 (Aadhaar) is
// intentionally unmapped in v1 and returns null → treated as unsupported.
//
// Tiers: high — NFC+ZK passport; medium — NFC+ZK id card or OCR document;
// low — manual review. A tier-T member belongs to every group whose minTier
// rank ≤ rank(T), so "high" users are in the low, medium, and high groups.

export const TIER_RANK = { low: 1, medium: 2, high: 3 } as const;
export type TrustTier = keyof typeof TIER_RANK;
export const TIERS: readonly TrustTier[] = ["low", "medium", "high"];

export function meetsTier(tier: TrustTier, minTier: TrustTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}

export function proofTypeForAttestation(attestationId: number): string | null {
  if (attestationId === 1) return "self-passport";
  if (attestationId === 2 || attestationId === 4) return "self-id-card";
  return null;
}

export function trustTierFor(proofType: string): TrustTier {
  if (proofType === "self-passport" || proofType === "mdl-iso18013") return "high";
  if (proofType === "self-id-card" || proofType === "ocr-document") return "medium";
  return "low";
}
