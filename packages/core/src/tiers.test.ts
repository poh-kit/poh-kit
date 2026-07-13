import { describe, expect, it } from "vitest";
import { TIER_RANK, TIERS, meetsTier, proofTypeForAttestation, trustTierFor } from "./tiers.js";

describe("tier ranks", () => {
  it("orders low < medium < high", () => {
    expect(TIER_RANK.low).toBeLessThan(TIER_RANK.medium);
    expect(TIER_RANK.medium).toBeLessThan(TIER_RANK.high);
    expect(TIERS).toEqual(["low", "medium", "high"]);
  });
  it("meetsTier expands membership downward", () => {
    expect(meetsTier("high", "low")).toBe(true);
    expect(meetsTier("high", "high")).toBe(true);
    expect(meetsTier("low", "medium")).toBe(false);
  });
});

describe("proofTypeForAttestation", () => {
  it("maps Self attestation ids", () => {
    expect(proofTypeForAttestation(1)).toBe("self-passport");
    expect(proofTypeForAttestation(2)).toBe("self-id-card");
    expect(proofTypeForAttestation(4)).toBe("self-id-card");
  });
  it("rejects unknown ids", () => {
    expect(proofTypeForAttestation(0)).toBeNull();
    expect(proofTypeForAttestation(99)).toBeNull();
  });
});

describe("trustTierFor", () => {
  it("NFC+ZK passport is high; id-card and OCR are medium; fallback low", () => {
    expect(trustTierFor("self-passport")).toBe("high");
    expect(trustTierFor("mdl-iso18013")).toBe("high");
    expect(trustTierFor("self-id-card")).toBe("medium");
    expect(trustTierFor("ocr-document")).toBe("medium");
    expect(trustTierFor("manual-review")).toBe("low");
    expect(trustTierFor("unknown")).toBe("low");
  });
});
