//! Test fixture ONLY — not part of the reference integration itself.
//!
//! `vote-gate` is meant to gate on poh-kit's real, already-existing attestations
//! program (`contracts/solana/programs/attestations` in the poh-kit repo root, or
//! its mainnet deployment once live). That program hasn't been deployed anywhere
//! yet as of this scaffold, so there's nothing to `--clone` onto a local test
//! validator for `anchor test`.
//!
//! This program exists purely so the test suite has SOMETHING real to point
//! `attestations_program` at: it creates a PDA at the identical
//! `[b"attestation", holder, [0], [0u8; 32]]` address the real program uses for
//! VERIFIED_HUMAN, so `vote-gate`'s address-derivation + ownership check can be
//! exercised genuinely, end to end, on a local validator. `vote-gate` itself has
//! zero code dependency on this program or the real one — it only checks an
//! address and an owner, so swapping this mock for poh-kit's real deployed
//! program ID in production requires no code change, only a different
//! `attestations_program` argument at `initialize_proposal` time.
use anchor_lang::prelude::*;

declare_id!("3FipGhhsY9nT6ByjoU37p8YBdck2LWtRkvLuA8JejtvE");

#[program]
pub mod mock_attestations {
    use super::*;

    /// Creates a VERIFIED_HUMAN-shaped attestation PDA for `holder`. Deliberately
    /// has none of the real program's authority checks or other attestation
    /// types — it only needs to exist and be owned by this program ID.
    pub fn issue_verified_human(ctx: Context<IssueVerifiedHuman>, holder: Pubkey) -> Result<()> {
        ctx.accounts.record.holder = holder;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(holder: Pubkey)]
pub struct IssueVerifiedHuman<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32,
        seeds = [b"attestation", holder.as_ref(), &[0u8], &[0u8; 32]],
        bump,
    )]
    pub record: Account<'info, MockAttestationRecord>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct MockAttestationRecord {
    pub holder: Pubkey,
}
