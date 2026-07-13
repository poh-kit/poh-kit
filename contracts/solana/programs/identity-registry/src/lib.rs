use anchor_lang::prelude::*;

declare_id!("EgWb3fdVLp7Qon3p1UEAA3iwrbCGu4ro56MY7hrBFaoV"); // synced to target/deploy/identity_registry-keypair.json

#[program]
pub mod identity_registry {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>, authority: Pubkey) -> Result<()> {
        ctx.accounts.config.authority = authority;
        Ok(())
    }

    pub fn create_voter_account(
        ctx: Context<CreateVoterAccount>,
        user_id: String,
        voter_pubkey: Pubkey,
        document_hash: [u8; 32],
        biometric_hash: [u8; 32],
        populations: Vec<u32>,
        h3_cells: Vec<u64>,
    ) -> Result<()> {
        require!(user_id.len() <= 64, IdentityError::InvalidVoter);
        require!(populations.contains(&1u32), IdentityError::MissingGlobalPopulation);
        let v = &mut ctx.accounts.voter_account;
        v.user_id = user_id;
        v.public_key = voter_pubkey;
        v.document_hash = document_hash;
        v.biometric_hash = biometric_hash;
        v.populations = populations;
        v.h3_cells = h3_cells;
        v.verified = true;
        v.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn set_voter_populations(
        ctx: Context<SetVoterPopulations>,
        populations: Vec<u32>,
        h3_cells: Vec<u64>,
    ) -> Result<()> {
        require!(populations.contains(&1u32), IdentityError::MissingGlobalPopulation);
        let v = &mut ctx.accounts.voter_account;
        v.populations = populations;
        v.h3_cells = h3_cells;
        Ok(())
    }
}

// VoterAccount lives HERE (its owning program) so Account::owner() resolves to
// this program's id. identity-registry does not depend on common-population
// (it stores identity; it doesn't check eligibility).
#[account]
pub struct VoterAccount {
    pub user_id: String,
    pub public_key: Pubkey,
    pub document_hash: [u8; 32],
    pub biometric_hash: [u8; 32],
    pub populations: Vec<u32>, // always includes 1 (global)
    pub h3_cells: Vec<u64>,
    pub verified: bool,
    pub created_at: i64,
}

impl VoterAccount {
    /// Byte size for `init`/`realloc`. Caller passes expected max counts.
    pub fn space(max_pops: usize, max_cells: usize, user_id_len: usize) -> usize {
        8 + 4 + user_id_len + 32 + 32 + 32 + 4 + 4 * max_pops + 4 + 8 * max_cells + 1 + 8
    }
}

#[account]
pub struct RegistryConfig {
    pub authority: Pubkey,
}

#[error_code]
pub enum IdentityError {
    #[msg("Invalid voter for this account")]
    InvalidVoter,
    #[msg("Caller is not the registrar authority")]
    Unauthorized,
    #[msg("populations must include the global code (1)")]
    MissingGlobalPopulation,
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(init, payer = payer, space = 8 + 32, seeds = [b"config"], bump)]
    pub config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user_id: String)]
pub struct CreateVoterAccount<'info> {
    #[account(
        init,
        payer = registrar,
        space = VoterAccount::space(16, 8, 64),
        seeds = [b"voter", user_id.as_bytes()],
        bump
    )]
    pub voter_account: Account<'info, VoterAccount>,
    #[account(
        seeds = [b"config"],
        bump,
        constraint = config.authority == registrar.key() @ IdentityError::Unauthorized,
    )]
    pub config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub registrar: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(populations: Vec<u32>, h3_cells: Vec<u64>)]
pub struct SetVoterPopulations<'info> {
    #[account(
        mut,
        seeds = [b"voter", voter_account.user_id.as_bytes()],
        bump,
        realloc = VoterAccount::space(populations.len(), h3_cells.len(), voter_account.user_id.len()),
        realloc::payer = registrar,
        realloc::zero = false,
    )]
    pub voter_account: Account<'info, VoterAccount>,
    #[account(
        seeds = [b"config"],
        bump,
        constraint = config.authority == registrar.key() @ IdentityError::Unauthorized,
    )]
    pub config: Account<'info, RegistryConfig>,
    #[account(mut)]
    pub registrar: Signer<'info>,
    pub system_program: Program<'info, System>,
}
