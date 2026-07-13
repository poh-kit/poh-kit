# poh-kit Architecture

## Design goals

1. **Composable** — combine Self Protocol (enrollment) and Semaphore (signaling) cleanly without leaking information across layers
2. **Chain-agnostic** — the core library has no chain dependency; verifier helpers work both on-chain (Solidity/Anchor) and off-chain (Node.js)
3. **Privacy by construction** — no PII ever leaves the device; nullifier unlinkability preserved across proposals
4. **Developer-first** — typed packages, a runnable EVM example, an OpenAPI spec for the hosted service

## Layered model

poh-kit separates the identity lifecycle into three distinct layers:

### Layer 1 — Enrollment (Self Protocol)

**Goal:** prove that the user is a real, unique human.

- User reads an ICAO ePassport via the Self mobile app's NFC flow
- Self's Circom circuit verifies the passport chip's Country Signing Certificate Authority (CSCA) signature inside a ZK-SNARK
- Output: a **nullifier** (unique per passport) and a set of **selective disclosures** (humanity, age bucket, jurisdiction)
- The nullifier is the Sybil-resistance primitive — one passport, one identity, forever
- Shipped in `@poh-kit/verifier`: `createSelfVerifier` / `verifyPassportProof` verify the Self proof against the Celo hub and write an `IdentityProofRecord` to a `NullifierStore`. Duplicate-nullifier submissions are idempotent — a re-verify of the same passport returns the existing record rather than erroring.

### Layer 2 — Identity Binding (Semaphore)

**Goal:** bind the proven humanity to a long-lived, privacy-preserving identity.

- The user's Semaphore identity `{ trapdoor, nullifier }` is created via `@poh-kit/core`'s `createIdentity(secret?)` — deterministic when a secret is supplied (e.g. derived from a WebAuthn-protected device secret; poh-kit does not implement the WebAuthn step itself), random otherwise
- On successful Layer 1 verification, the Semaphore identity commitment `Poseidon(trapdoor, nullifier)` is attached to the stored `IdentityProofRecord` and anchored on-chain (`IdentityCommitments` on EVM and Solana)
- The Semaphore identity **never leaves the device** — only the commitment is public

### Layer 3 — Anonymous Signaling

**Goal:** cast votes/signals that are unlinkable both to the passport and across proposals.

- `buildGroups` reads every attached commitment from a `NullifierStore` and constructs one Semaphore `Group` per trust tier, caching each in a `GroupStore`
- **Tier expansion**: tiers are ranked (`TIER_RANK`), and a member of tier T is included in every group whose minimum tier rank is ≤ rank(T) — so a `high`-tier member appears in the `low`, `medium`, and `high` groups. This makes tier-gated verification a single group lookup instead of a runtime tier check per signal.
- For each proposal, the user generates a Semaphore group-membership proof with an `externalNullifier` set to the proposal's scope string
- `verifySemaphoreSignal` checks the proof against the tier-appropriate cached group, then checks a `UsedSignalStore` for replay before accepting — the proof reveals nothing except "I am in the group" and "I have not signaled in this scope before"
- Two signals by the same user across two scopes are **cryptographically unlinkable**, even with full database access

## Data model

```ts
interface IdentityProofRecord {
  nullifier: string;        // from Layer 1 (passport-unique)
  commitment: string;       // from Layer 2 (Semaphore identity), decimal string
  proofType: "self-passport" | "manual-review";
  attestationId: number;    // Self ATTESTATION_ID enum value
  verifiedAt: string;       // ISO-8601
  disclosures: DisclosureItem[];
  subject: string;          // opaque host-defined key (not a voter/user ID)
  trustTier: TrustTier;     // "low" | "medium" | "high"
}

interface DisclosureItem {
  kind: "humanity" | "age" | "jurisdiction";
  value?: unknown;
}
```

## Integration surface: the three store interfaces

`@poh-kit/verifier` is written against three storage interfaces (in
`packages/verifier/src/stores.ts`) rather than a concrete database — this is
the intentional open/closed boundary. Hosts bring their own persistence;
poh-kit ships in-memory reference implementations (`InMemoryNullifierStore`,
`InMemoryGroupStore`, `InMemoryUsedSignalStore`) for tests and examples, and
Foundation's production implementation (Firestore-backed) stays in its
private repo.

| Interface | Responsibility |
|---|---|
| `NullifierStore` | Persists `IdentityProofRecord`s keyed by passport nullifier; lists all attached commitments (input to `buildGroups`) |
| `GroupStore` | Caches the built `CachedGroup` (members, member count, Merkle root) per trust tier |
| `UsedSignalStore` | Tracks spent signal nullifiers per scope, so a signal can't be replayed within the same proposal |

Production hardening order for hosts wiring this up: durable `UsedSignalStore`
first (replay protection is the security-critical path), then `GroupStore`
caching (correctness under concurrent writes), then `NullifierStore` (least
time-sensitive, since passport verification is already idempotent per
nullifier).

## Fallback path (out of `poh-kit` scope, referenced for completeness)

Not every user has an ePassport. Foundation's full identity architecture
includes a **manual-review fallback** using liveness detection, gated by a
human reviewer. This fallback is **out of scope for poh-kit** — it is
Foundation-specific infrastructure because (a) it's not a ZK primitive, (b) it
has BIPA/GDPR implications that must be handled per-deployment, and (c) it
doesn't benefit the wider ecosystem the same way the chain-agnostic poh-kit
does.

## What lives where

| Directory | Status | Maps to README row |
|---|---|---|
| `packages/core` | ✅ | `@poh-kit/core` |
| `packages/verifier` | ✅ | `@poh-kit/verifier` |
| `packages/gaas-client` | ✅ | `@poh-kit/gaas-client` |
| `packages/react` | Skeleton | `@poh-kit/react` |
| `contracts/evm` | ✅ | `contracts/evm` |
| `contracts/solana` | ✅ | `contracts/solana` |
| `examples/evm-hardhat` | ✅ | `examples/evm-hardhat` |
| `docs/api/poh-verification-api.yaml` | ✅ | Consumed by `@poh-kit/gaas-client`; spec for the hosted service |

## What poh-kit does NOT include

- **Key management** — KMS, HSM, key rotation — deployment-specific
- **Blockchain indexing** — use Graph Protocol, Covalent, or Solana's `getProgramAccounts` directly
- **Governance semantics** — quorum, delegation, proposal types — that's application-level
- **The fallback biometric path** — see note above
- **The hosted verification service itself** — `@poh-kit/gaas-client` is a typed client for it; the service (tenant management, billing, key issuance) is Foundation's commercial offering, not part of this repo
- **`@poh-kit/react` hooks** — package exists as a skeleton; enrollment/signaling hooks land in v1.1
