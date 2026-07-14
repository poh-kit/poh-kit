# poh-kit

**Layered Proof-of-Humanity for Ethereum applications.**
Self Protocol (ZK ePassport) + Semaphore (anonymous group signaling), combined into a single, chain-agnostic, EVM-first TypeScript library.

---

## Why poh-kit?

The Ethereum ecosystem has two powerful privacy primitives that are rarely combined in practice:

- **[Self Protocol](https://github.com/selfxyz/self)** — prove humanity + nationality + age from an ICAO ePassport's NFC chip, via a ZK-SNARK over the country signing certificate. Enrollment-grade Sybil resistance.
- **[Semaphore](https://github.com/semaphore-protocol/semaphore)** — prove anonymous membership in a group and cast an unlinkable signal (vote, endorsement, comment). Voting-grade anonymity.

Today, developers building ZK-enabled DAOs, voting platforms, grant rounds, and civic governance apps pick one or the other — and lose half the security property they actually need. `poh-kit` provides a **canonical integration** that combines enrollment-grade Sybil resistance with voting-grade anonymity, with a typed TypeScript integration surface, tier-gated group construction, and identity contracts deployed on both EVM and Solana.

---

## Status

| Component | Status | Description |
|---|---|---|
| `@poh-kit/core` | ✅ | Trust tiers, attestation ordinals, Semaphore identity helpers |
| `@poh-kit/verifier` | ✅ | Self passport verification + tier-gated anonymous signals, pluggable storage |
| `@poh-kit/gaas-client` | ✅ | Typed client for the hosted verification API ([spec](./docs/api/poh-verification-api.yaml)) |
| `contracts/evm` | ✅ | Identity contracts — deployed on Optimism Sepolia |
| `contracts/solana` | ✅ | Anchor identity programs — deployed on devnet |
| `examples/evm-hardhat` | ✅ | Runnable end-to-end flow with a real Semaphore proof |
| `@poh-kit/react` | Skeleton | Enrollment/signaling hooks — v1.1 |

All packages are **MIT / Apache 2.0 dual-licensed**.

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
│              Caller secret* ─► Semaphore Identity            │
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

\* `createIdentity(secret?)` takes a caller-supplied secret — you choose its
custody (e.g. derive it from a WebAuthn passkey). poh-kit does not implement the
passkey/WebAuthn step itself.

See [docs/architecture.md](./docs/architecture.md) for a full walkthrough.

---

## Quick Start

The core flow: create a Semaphore identity, expand tier groups from verified
records, and verify a tier-gated anonymous signal. This is trimmed from the
runnable example — see [examples/evm-hardhat](./examples/evm-hardhat) for the
full flow, including on-chain contracts and a replay-rejection check.

```ts
import { createIdentity } from "@poh-kit/core";
import {
  buildGroups, verifySemaphoreSignal,
  InMemoryGroupStore, InMemoryNullifierStore, InMemoryUsedSignalStore,
} from "@poh-kit/verifier";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";

// 1. Create a Semaphore identity (bound to a passport-derived nullifier
//    via `@poh-kit/verifier`'s `createSelfVerifier` in production)
const alice = createIdentity("alice-secret");
const nullifiers = new InMemoryNullifierStore();
await nullifiers.put({
  nullifier: "demo-null-alice", commitment: alice.commitment,
  proofType: "self-passport", attestationId: 1,
  verifiedAt: new Date().toISOString(),
  disclosures: [{ kind: "humanity" }], subject: "alice", trustTier: "medium",
});

// 2. Build tier-expanded Semaphore groups from verified identities
const groups = new InMemoryGroupStore();
const built = await buildGroups(nullifiers, groups);

// 3. Cast and verify a tier-gated anonymous signal
const group = new Group(built.medium.commitments.map((c) => BigInt(c)));
const proof = await generateProof(alice.identity, group, "approve", "proposal-42");
const used = new InMemoryUsedSignalStore();
const result = await verifySemaphoreSignal(
  { proof, minTier: "medium", scope: "proposal-42" },
  { groups, usedSignals: used },
);
console.log(result); // { ok: true, ... }
```

Run it end-to-end, with real deployed-style contracts on a local chain:

```bash
cd examples/evm-hardhat && npm install && npm run e2e
```

---

## Open protocol, trusted service

Everything in this repository — `@poh-kit/core`, `@poh-kit/verifier`,
`@poh-kit/gaas-client`, the EVM and Solana identity contracts, and the
example — is MIT/Apache-2.0. Foundation operates a hosted, multi-tenant
verification service on top of the `gaas-client` API spec; that service (key
issuance, billing, tenant management, hosting) is Foundation's commercial
offering and is not part of this repository. You can point `gaas-client` at
your own deployment of the spec instead.

---

## Roadmap

The roadmap below is **dependency-ordered**, not time-bound.

- **v1 (shipped)** — `@poh-kit/core`, `@poh-kit/verifier`, `@poh-kit/gaas-client`, identity contracts on EVM (Optimism Sepolia) and Solana (devnet), a runnable end-to-end example, CI
- **v1.1** — `@poh-kit/react` hooks for enrollment and anonymous signaling
- **Later** — documentation site, external security review, mainnet contract deployments

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

To give feedback:
- Open an issue at https://github.com/poh-kit/poh-kit/issues
- Reach out on PSE Discord — look for `@dagangilat`

## Security

See [SECURITY.md](./SECURITY.md) for the vulnerability-reporting process.

---

## License

Dual-licensed under **MIT** and **Apache 2.0**. See [LICENSE-MIT](./LICENSE-MIT) and [LICENSE-APACHE](./LICENSE-APACHE).

---

## Credits

`poh-kit` stands on the shoulders of:

- **[Self Protocol](https://github.com/selfxyz/self)** — ePassport ZK proofs
- **[Semaphore](https://github.com/semaphore-protocol/semaphore)** (Privacy Stewards of Ethereum) — anonymous group signaling
- **[Circom](https://github.com/iden3/circom)** & **[snarkjs](https://github.com/iden3/snarkjs)** — ZK circuit compilation and proof generation

Neither Self Protocol nor Semaphore endorse `poh-kit` — this is an independent integration effort. We aim to contribute improvements back upstream where appropriate.
