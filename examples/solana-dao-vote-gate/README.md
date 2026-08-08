# Solana DAO vote-gate (reference integration)

A minimal, self-contained Anchor program proving a **third party** can gate an on-chain
vote on poh-kit verified-human status — no dependency on poh-kit's Rust crate, no CPI, no
IDL coupling. Just an address-derivation convention any Solana program can compute (see
[`@poh-kit/solana`](../../packages/solana)).

## The gate

`cast_vote` accepts a vote only if the signer's VERIFIED_HUMAN attestation PDA —
`[b"attestation", voter, [0], [0u8; 32]]` under whichever attestations program the
proposal was created against — exists and is owned by that program. Anchor's `seeds` +
`seeds::program` account constraint forces the passed account's *address* to be exactly
the voter's own PDA (nobody can vote using someone else's attestation); the handler then
confirms the account is non-empty and owned by the right program.

Also Sybil/double-vote resistant for free: each `Ballot` is itself a PDA seeded by
`[proposal, voter]`, so Anchor's `init` constraint rejects a second vote from the same
wallet outright.

## Verified end-to-end (2026-08-08)

`anchor test` runs all three cases against a real local validator — not asserted, actually
run and passing:

```
✔ accepts a vote from a verified-human wallet
✔ rejects a vote from a wallet with no attestation
✔ rejects a second vote from the same already-verified wallet
```

`mock-attestations` (`programs/mock-attestations/`) is a **test fixture only** — it mints
PDAs at the identical address poh-kit's real attestations program uses for VERIFIED_HUMAN,
so the test suite has something real to point at. poh-kit's actual attestations program has
no local or devnet deployment yet to clone onto a test validator (see the poh-kit repo
root's Status table). `vote-gate` has zero code dependency on which one is real — switching
from the mock to poh-kit's real deployed program ID at `initialize_proposal` time requires
no code change.

## Usage

```bash
npm install
anchor test          # local validator, both programs, full gate + double-vote test
```

To deploy against a real cluster (once poh-kit's attestations program has a real
deployment to point at):

```bash
anchor deploy --provider.cluster devnet   # then mainnet, once ready
```

`Anchor.toml`'s default `cluster = "localnet"` is deliberate — see the comment there before
changing it; `anchor test` deploying placeholder program IDs to a real network on every
run is the failure mode it's protecting against.

## Estimated cost

`vote-gate.so` compiles to **222,336 bytes** (measured 2026-08-08). At Solana's rent-exempt
rate (6,960 lamports/byte for the 2-year-exempt case), a mainnet deploy of a program this
size costs roughly **1.55 SOL** in locked rent — check current SOL/USD before budgeting, it
moves daily. A per-attestation VERIFIED_HUMAN record is far cheaper: 114 bytes
(`AttestationRecord` in the real attestations program) ≈ 0.00079 SOL each.
