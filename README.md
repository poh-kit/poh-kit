# poh-kit

**Layered Proof-of-Humanity for Ethereum applications.**
Self Protocol (ZK ePassport) + Semaphore (anonymous group signaling) + WebAuthn, combined into a single, chain-agnostic, EVM-first TypeScript library.

> ⚠️ **Early draft.** This repository is the skeleton for a grant application to the Ethereum Foundation Ecosystem Support Program. No production code yet — only the architecture, roadmap, and integration surface. See [docs/architecture.md](./docs/architecture.md) and the [grant application](../ethereum-foundation-pse-application.md) for full context.

---

## Why poh-kit?

The Ethereum ecosystem has two powerful privacy primitives that are rarely combined in practice:

- **[Self Protocol](https://github.com/selfxyz/self)** — prove humanity + nationality + age from an ICAO ePassport's NFC chip, via a ZK-SNARK over the country signing certificate. Enrollment-grade Sybil resistance.
- **[Semaphore](https://github.com/semaphore-protocol/semaphore)** — prove anonymous membership in a group and cast an unlinkable signal (vote, endorsement, comment). Voting-grade anonymity.

Today, developers building ZK-enabled DAOs, voting platforms, grant rounds, and civic governance apps pick one or the other — and lose half the security property they actually need. `poh-kit` provides a **canonical integration** that combines enrollment-grade Sybil resistance with voting-grade anonymity, with documented circuits, reproducible benchmarks, and a clean TypeScript integration surface.

---

## Status

| Package | Status | Description |
|---|---|---|
| `@poh-kit/core` | ✅ (partial) | Trust tiers, attestation ordinals, identity-proof types — identity helpers land next |
| `@poh-kit/verifier` | Skeleton | Server-side Groth16 verification helpers (on-chain + off-chain) |
| `@poh-kit/react` | Skeleton | React hooks for enrollment and anonymous signaling flows |
| `@poh-kit/examples/evm-hardhat` | Skeleton | Runnable EVM example — full stack, local chain, end-to-end flow |
| contracts/evm | ✅ | IdentityRegistry, IdentityCommitments, Attestations — deployed on OP Sepolia |
| contracts/solana | ✅ | Anchor identity programs — registry, commitments, attestations (devnet) |

All packages will be **MIT / Apache 2.0 dual-licensed** on first release.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                        User Device                          │
│                                                              │
│  Passport NFC ──► Self Protocol ──► ZK Proof (Groth16)       │
│                                         │                    │
│                                         ▼                    │
│                              Nullifier + Commitment          │
│                                         │                    │
│                 WebAuthn Passkey ─► Semaphore Identity       │
│                                         │                    │
│                                         ▼                    │
│                            Identity Commitment               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     Verifier / Chain                         │
│                                                              │
│  verifyPassportProof ─► identity_proofs (nullifier unique)   │
│                                         │                    │
│                                         ▼                    │
│                        Semaphore Merkle Group                │
│                                         │                    │
│                                         ▼                    │
│  Anonymous Signal (vote) ──► Group Membership Proof          │
└──────────────────────────────────────────────────────────────┘
```

See [docs/architecture.md](./docs/architecture.md) for a full walkthrough.

---

## Aspirational Quick Start

*(Draft API — not yet implemented. Feedback welcome on ergonomics.)*

```ts
import { createIdentity, verifyPassport } from "@poh-kit/core";
import { castAnonymousSignal } from "@poh-kit/core";

// 1. User enrolls via Self Protocol (scans passport NFC)
const { nullifier, commitment } = await verifyPassport({
  selfProof,
  disclosures: ["humanity", "age >= 18"],
});

// 2. Bind to a Semaphore identity (derived from WebAuthn secret)
const identity = await createIdentity({ seed: webAuthnSecret });

// 3. Add to the proposal's Merkle group
await group.addMember(identity.commitment);

// 4. Cast an anonymous vote
const proof = await castAnonymousSignal({
  identity,
  group,
  signal: "vote: option-a",
  externalNullifier: proposalId,
});
```

---

## Roadmap

The roadmap below is **dependency-ordered**, not time-bound. See the [grant application](../ethereum-foundation-pse-application.md) for full context on each milestone.

- **M1 — Kickoff**: project charter, repo scaffolding, threat model outline, benchmark methodology draft
- **M2 — Benchmark + Reference Alpha**: mobile proving benchmark dataset, `@poh-kit/core` + `@poh-kit/verifier` alpha, first EVM example running end-to-end, first upstream documentation PRs
- **M3 — Threat Model + Docs + Upstream**: threat model v1.0, documentation site live, external security review, ≥3 merged upstream PRs to Semaphore/Self
- **M4 — Release + Paper + Final Report**: `poh-kit` v1.0 tagged, workshop paper submitted, external security review published

---

## Contributing

Not yet accepting PRs — this is a pre-funding skeleton. Once funded, the contributing guide will go here and PRs will be welcome.

To give pre-funding feedback:
- Open an issue at https://github.com/foundation-vote/poh-kit/issues
- Reach out on PSE Discord — look for `@dagangilat`
- Ethereum Research forum post: *(link to be added after announcement)*

---

## License

Dual-licensed under **MIT** and **Apache 2.0**. See [LICENSE-MIT](./LICENSE-MIT) and [LICENSE-APACHE](./LICENSE-APACHE).

---

## Credits

`poh-kit` stands on the shoulders of:

- **[Self Protocol](https://github.com/selfxyz/self)** — ePassport ZK proofs
- **[Semaphore](https://github.com/semaphore-protocol/semaphore)** (Privacy Stewards of Ethereum) — anonymous group signaling
- **[SimpleWebAuthn](https://github.com/MasterKale/SimpleWebAuthn)** — passkey-gated device binding
- **[Circom](https://github.com/iden3/circom)** & **[snarkjs](https://github.com/iden3/snarkjs)** — ZK circuit compilation and proof generation

Neither Self Protocol nor Semaphore endorse `poh-kit` — this is an independent integration effort. We aim to contribute improvements back upstream where appropriate.
