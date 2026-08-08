//! Solana DAO vote-gate — reference integration for poh-kit's attestations program.
//!
//! Minimal, self-contained example proving a THIRD PARTY can gate an on-chain vote on
//! poh-kit verified-human status without depending on poh-kit's Rust crate at all — only
//! on the address-derivation convention any Solana program can compute (see
//! `packages/solana` at the repo root, or `contracts/solana/programs/attestations`).
//!
//! The gate: `cast_vote` accepts a vote only if the signer's VERIFIED_HUMAN attestation
//! PDA — `[b"attestation", voter, [0], [0u8; 32]]` under the attestations program recorded
//! on the proposal — exists and is owned by that program. No CPI, no IDL dependency on the
//! attestations program: this is a pure address-derivation + account-existence check,
//! which is exactly what "any Solana program can read it for free" means in practice.
//!
//! Also Sybil/double-vote resistant for free: the ballot PDA is seeded by
//! `[proposal, voter]`, so Anchor's `init` constraint fails outright on a second vote
//! attempt from the same wallet on the same proposal.
use anchor_lang::prelude::*;

declare_id!("9oBNuHzFAm2tUtGRpQFUkNfKoy6Tz9uquwDfnvzMRdGi");

#[program]
pub mod vote_gate {
    use super::*;

    /// Create a proposal, pinned to a specific attestations program deployment
    /// (devnet during development, mainnet-beta once poh-kit's program is live there).
    ///
    /// `proposal_id` is a caller-chosen 32-byte identifier (e.g. SHA-256 of the
    /// question text) — NOT the raw question, which is stored separately but
    /// never used as a seed. Solana's `create_program_address` hard-caps every
    /// individual seed at 32 bytes; a freeform question string breaks that the
    /// moment it's longer than 32 characters. This mirrors the same
    /// fixed-size-context-over-freeform-content pattern the real attestations
    /// program uses for `context_hash`.
    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        // Consumed by the `seeds = [...]` constraint on `InitializeProposal`,
        // not read here directly — that's what the leading underscore signals.
        _proposal_id: [u8; 32],
        question: String,
        attestations_program: Pubkey,
    ) -> Result<()> {
        require!(question.len() <= 200, VoteGateError::QuestionTooLong);

        let proposal = &mut ctx.accounts.proposal;
        proposal.authority = ctx.accounts.authority.key();
        proposal.attestations_program = attestations_program;
        proposal.question = question;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.bump = ctx.bumps.proposal;
        Ok(())
    }

    /// Cast a vote. Fails with `NotVerifiedHuman` unless the caller holds a live
    /// VERIFIED_HUMAN attestation from the program recorded on the proposal. Fails
    /// with Anchor's standard "account already in use" if this wallet already voted
    /// on this proposal.
    pub fn cast_vote(ctx: Context<CastVote>, vote_yes: bool) -> Result<()> {
        let attestation = &ctx.accounts.verified_human_attestation;

        // `seeds` + `seeds::program` on the account constraint already forced this
        // account's ADDRESS to be exactly the voter's own VERIFIED_HUMAN PDA under
        // the recorded attestations program — nobody can pass someone else's
        // attestation. This second check confirms the account was actually
        // INITIALIZED (by that program, since only it can sign for that PDA via
        // invoke_signed with these exact seeds) rather than merely being an empty,
        // system-owned slot that happens to sit at the derived address.
        require!(!attestation.data_is_empty(), VoteGateError::NotVerifiedHuman);
        require_keys_eq!(
            *attestation.owner,
            ctx.accounts.proposal.attestations_program,
            VoteGateError::NotVerifiedHuman
        );

        let ballot = &mut ctx.accounts.ballot;
        ballot.voter = ctx.accounts.voter.key();
        ballot.proposal = ctx.accounts.proposal.key();
        ballot.vote_yes = vote_yes;
        ballot.bump = ctx.bumps.ballot;

        let proposal = &mut ctx.accounts.proposal;
        if vote_yes {
            proposal.yes_votes = proposal.yes_votes.saturating_add(1);
        } else {
            proposal.no_votes = proposal.no_votes.saturating_add(1);
        }
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(proposal_id: [u8; 32])]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Proposal::SIZE,
        seeds = [b"proposal", authority.key().as_ref(), proposal_id.as_ref()],
        bump,
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    /// CHECK: this is the actual verified-human gate. `seeds` + `seeds::program`
    /// force the address to be exactly the voter's own VERIFIED_HUMAN attestation
    /// PDA under `proposal.attestations_program` — see `cast_vote` for the
    /// existence + ownership checks that complete the gate. Never read further,
    /// never mutated: this program has no CPI dependency on the attestations
    /// program's IDL.
    #[account(
        seeds = [b"attestation", voter.key().as_ref(), &[0u8], &[0u8; 32]],
        bump,
        seeds::program = proposal.attestations_program,
    )]
    pub verified_human_attestation: UncheckedAccount<'info>,

    #[account(
        init,
        payer = voter,
        space = 8 + Ballot::SIZE,
        seeds = [b"ballot", proposal.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub ballot: Account<'info, Ballot>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Proposal {
    pub authority: Pubkey,
    pub attestations_program: Pubkey,
    pub question: String,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub bump: u8,
}

impl Proposal {
    /// authority(32) + attestations_program(32) + question(4 + 200 max)
    /// + yes_votes(8) + no_votes(8) + bump(1)
    pub const SIZE: usize = 32 + 32 + (4 + 200) + 8 + 8 + 1;
}

#[account]
pub struct Ballot {
    pub voter: Pubkey,
    pub proposal: Pubkey,
    pub vote_yes: bool,
    pub bump: u8,
}

impl Ballot {
    /// voter(32) + proposal(32) + vote_yes(1) + bump(1)
    pub const SIZE: usize = 32 + 32 + 1 + 1;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum VoteGateError {
    #[msg("question must be 200 characters or fewer")]
    QuestionTooLong,
    #[msg("no live VERIFIED_HUMAN attestation found for this wallet")]
    NotVerifiedHuman,
}
