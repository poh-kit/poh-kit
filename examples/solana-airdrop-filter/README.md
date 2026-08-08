# Solana airdrop Sybil-filter (reference integration)

Filters a candidate wallet list down to wallets holding a live VERIFIED_HUMAN attestation
from poh-kit's attestations program. Every check is a pure on-chain read via
[`@poh-kit/solana`](../../packages/solana) — no poh-kit API key required.

## Scope — read before using this for a real airdrop

This filters for **"has this wallet completed proof-of-humanity"**, not **"is this the
only wallet this human controls."** One-human-one-claim uniqueness is enforced upstream,
at verification time (the Semaphore nullifier binds one human to one identity commitment).
This script only reads what's already on-chain — it doesn't and can't re-derive that
invariant from the wallet list alone.

## Usage

```bash
npm install
npm run filter -- \
  --wallets ./candidates.example.json \
  --program <ATTESTATIONS_PROGRAM_ID> \
  --cluster devnet \
  --out eligible.csv
```

- `--wallets` — path to a JSON array of base58 wallet address strings.
- `--program` — the deployed attestations program ID (devnet while testing; the mainnet-beta
  ID once live — see the poh-kit repo root README's Status table).
- `--cluster` — `devnet` (default) or `mainnet-beta`, or a full RPC URL.
- `--out` — optional CSV output path (`wallet,pda`); omit to print to stdout.

## How it works

For each candidate wallet, the script derives the VERIFIED_HUMAN attestation PDA
(`deriveVerifiedHumanPda`) and batches existence + ownership checks via
`getMultipleAccountsInfo` (100 wallets per RPC call), rather than one round-trip per
wallet — the difference between checking 10,000 candidates in ~100 requests instead of
10,000.
