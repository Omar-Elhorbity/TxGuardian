use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::VerifiedRevoked;
use crate::state::{Registry, VerifiedAttestation, STATUS_REVOKED};

/// Curator-only. Move a verified attestation to `revoked`. Used when a
/// previously-attested program is later found to be compromised or
/// abandoned. Once revoked, the SDK no longer suppresses the
/// UNKNOWN_PROGRAM flag for it.
pub fn handler(ctx: Context<RevokeVerified>, _target_program: Pubkey) -> Result<()> {
    let v = &mut ctx.accounts.verified;
    require!(v.status != STATUS_REVOKED, RegistryError::AlreadyRevoked);

    v.status = STATUS_REVOKED;
    v.updated_at = Clock::get()?.unix_timestamp;

    emit!(VerifiedRevoked {
        target_program: v.target_program,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct RevokeVerified<'info> {
    #[account(
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [b"verified", target_program.as_ref()],
        bump = verified.bump
    )]
    pub verified: Account<'info, VerifiedAttestation>,
    pub admin: Signer<'info>,
}
