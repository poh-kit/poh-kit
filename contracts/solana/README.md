# @poh-kit/contracts-solana

Anchor (0.31.1) identity programs — the Solana side of the PoH primitive:

| Program | Devnet ID | Purpose |
|---|---|---|
| `identity_registry` | `EgWb3fdVLp7Qon3p1UEAA3iwrbCGu4ro56MY7hrBFaoV` | Voter account: populations (UN-M49) + H3 cells |
| `identity_commitments` | `2eLQB1hoLv7nXvu1RYWFZw6eSkVjzUZEYeLDWpms1WkC` | One-time commitment-hash anchor (PDA-deduped) |
| `attestations` | see `declare_id!` | Soulbound attestations, ordinals 0-3 matching ../evm |

Declared program IDs match the live devnet deployments and must not be changed
without a redeploy. Foundation's e-voting pillar programs (governance / share /
market) are intentionally NOT part of poh-kit — they are voting business logic,
not the proof-of-personhood primitive.

Build: `anchor build` (Anchor 0.31.1 + Solana CLI). Quick check: `cargo check`.
