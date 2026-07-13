// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Trust-tier vocabulary for Proof-of-Humanity enrollments.
//
// Self Protocol attestation IDs:
//   1 = ICAO ePassport (NFC chip + Groth16 ZK)
//   2 = EU biometric ID card (NFC chip + ZK)
//   4 = Aadhaar / other biometric ID (NFC chip + ZK)
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
