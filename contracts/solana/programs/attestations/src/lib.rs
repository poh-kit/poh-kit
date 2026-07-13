//! Foundation — attestations program.
//!
//! Issues and revokes soulbound attestation PDAs representing verified-human
//! status and governance participation events. Attestations are non-transferable
//! on-chain records anchored to a holder's public key.
//!
//! The authority (signer) is the Foundation API keypair — holders never sign.
//! This follows the server-custody model used across all Foundation on-chain writes.
//!
//! Attestation types:
//!   0 = VERIFIED_HUMAN    — holder passed proof-of-humanity
//!   1 = VOTED             — holder cast a vote in a governance round
//!   2 = SUPPORTED_PROPOSAL — holder signed a supporter petition
//!
//! Instructions:
//!   `issue_attestation(holder, attestation_type, context_hash)` — creates PDA
//!   `revoke_attestation()` — closes PDA, returns rent to authority

use anchor_lang::prelude::*;

// Placeholder ID — replaced with the real keypair after `anchor build`.
// Keypair at target/deploy/attestations-keypair.json (git-ignored; back up separately).
// Must stay in sync with Anchor.toml [programs.devnet].
declare_id!("GQrFse7NiB6QdqtagGayNYwrr8zn4W4uWhji57VkKGky");

pub const ATTESTATION_VERIFIED_HUMAN: u8 = 0;
pub const ATTESTATION_VOTED: u8 = 1;
pub const ATTESTATION_SUPPORTED_PROPOSAL: u8 = 2;

/// Maximum valid attestation_type value (inclusive).
pub const MAX_ATTESTATION_TYPE: u8 = 2;

#[program]
pub mod attestations {
    use super::*;

    /// Issue a soulbound attestation for a holder.
    ///
    /// Creates a PDA seeded by `[b"attestation", holder, attestation_type, context_hash]`.
    /// The same combination can only be attested once — deduplication is enforced
    /// by Solana's account model. The authority (Foundation API keypair) is the payer
    /// and signer; the holder is stored but never required to sign.
    pub fn issue_attestation(
        ctx: Context<IssueAttestation>,
        holder: Pubkey,
        attestation_type: u8,
        context_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            attestation_type <= MAX_ATTESTATION_TYPE,
            AttestationError::InvalidAttestationType
        );

        let record = &mut ctx.accounts.record;
        record.holder = holder;
        record.attestation_type = attestation_type;
        record.context_hash = context_hash;
        record.issued_at = Clock::get()?.unix_timestamp;
        record.issuer = ctx.accounts.authority.key();
        record.bump = ctx.bumps.record;
        Ok(())
    }

    /// Revoke a soulbound attestation.
    ///
    /// Closes the PDA and returns the rent lamports to the authority.
    /// The `close` constraint on the account handles the lamport transfer
    /// and zeroing of the account data automatically.
    pub fn revoke_attestation(_ctx: Context<RevokeAttestation>) -> Result<()> {
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(holder: Pubkey, attestation_type: u8, context_hash: [u8; 32])]
pub struct IssueAttestation<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AttestationRecord::SIZE,
        seeds = [
            b"attestation",
            holder.as_ref(),
            &[attestation_type],
            context_hash.as_ref(),
        ],
        bump,
    )]
    pub record: Account<'info, AttestationRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [
            b"attestation",
            record.holder.as_ref(),
            &[record.attestation_type],
            record.context_hash.as_ref(),
        ],
        bump = record.bump,
    )]
    pub record: Account<'info, AttestationRecord>,

    #[account(mut, constraint = authority.key() == record.issuer @ AttestationError::Unauthorized)]
    pub authority: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

/// Soulbound attestation record. 106 bytes of state + 8-byte discriminator = 114 bytes.
#[account]
pub struct AttestationRecord {
    /// The public key of the attestation holder.
    pub holder: Pubkey,
    /// Attestation type: 0=VERIFIED_HUMAN, 1=VOTED, 2=SUPPORTED_PROPOSAL.
    pub attestation_type: u8,
    /// Application-level context hash (e.g. SHA-256 of round ID or proposal ID).
    pub context_hash: [u8; 32],
    /// Unix timestamp (seconds) when the attestation was issued.
    pub issued_at: i64,
    /// The Foundation API keypair that issued this attestation.
    pub issuer: Pubkey,
    /// PDA bump byte. Cached so re-derivation is a single-op CPU check.
    pub bump: u8,
}

impl AttestationRecord {
    /// Byte size of the account fields (excluding the 8-byte Anchor discriminator).
    ///
    /// holder(32) + attestation_type(1) + context_hash(32) + issued_at(8) + issuer(32) + bump(1) = 106
    pub const SIZE: usize = 32 + 1 + 32 + 8 + 32 + 1; // 106
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum AttestationError {
    #[msg("attestation_type must be 0 (VERIFIED_HUMAN), 1 (VOTED), or 2 (SUPPORTED_PROPOSAL)")]
    InvalidAttestationType,
    #[msg("only the original issuer may revoke this attestation")]
    Unauthorized,
}
