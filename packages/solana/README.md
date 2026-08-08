# `@poh-kit/solana`

Solana-specific helpers for the attestations program. The one thing this package exists
for: **checking whether a wallet is verified-human is a pure on-chain read — no API key,
no network dependency on poh-kit's own infrastructure.**

## Why this is a separate package from `@poh-kit/core`

`@poh-kit/core` is chain-agnostic (poh-kit also runs on EVM via a chain-adapter). Pulling
`@solana/web3.js` into core would force it on every consumer, including EVM-only ones. This
package is the Solana-specific layer on top.

## The mechanism

VERIFIED_HUMAN attestations use a fixed, all-zero 32-byte `context_hash` — humanity isn't
scoped to a proposal or round the way `VOTED` / `SUPPORTED_PROPOSAL` attestations are. That
makes the attestation's on-chain address fully deterministic from just a wallet address and
the attestations program ID:

```
PDA = findProgramAddress(
  [b"attestation", wallet, [0 /* VERIFIED_HUMAN */], [0x00; 32]],
  ATTESTATIONS_PROGRAM_ID,
)
```

If that account exists and is owned by the attestations program, the wallet is verified.
Any Solana program or off-chain script can check this directly.

## Usage

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import { hasVerifiedHuman } from "@poh-kit/solana";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const ATTESTATIONS_PROGRAM_ID = new PublicKey("<deployed program ID>");

const verified = await hasVerifiedHuman(connection, walletPubkey, ATTESTATIONS_PROGRAM_ID);
```

For an Anchor program that wants to gate an instruction on-chain (no RPC call from your
own program — Solana runtime resolves the account), derive the PDA client-side with
`deriveVerifiedHumanPda` and pass it as an account in the instruction; constrain it in the
`#[derive(Accounts)]` struct to be owned by the attestations program. See
`examples/solana-dao-vote-gate/` for a complete, minimal example.

## API

- `deriveVerifiedHumanPda(wallet, programId): [PublicKey, number]` — the PDA and its bump.
- `deriveAttestationPda(wallet, attestationType, contextHash, programId)` — general form,
  for `VOTED` / `SUPPORTED_PROPOSAL` attestations that carry a real (non-zero) context hash.
- `hasVerifiedHuman(connection, wallet, programId): Promise<boolean>` — derives + fetches +
  checks ownership in one call.

## Source of truth

The seed scheme mirrors `contracts/solana/programs/attestations/src/lib.rs` exactly. If
that program's seeds ever change, this package's tests (`pda.test.ts`) pin a real computed
PDA against the currently-deployed devnet program ID — a mismatch there is the signal.
