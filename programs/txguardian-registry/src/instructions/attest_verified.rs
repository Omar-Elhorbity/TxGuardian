use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::VerifiedConfirmed;
use crate::state::{Registry, VerifiedAttestation, STATUS_CONFIRMED};

/// Curator-only. Move a verified attestation from `pending` to `confirmed`.
/// Once confirmed, the target program is treated as community-reviewed
/// and the SDK suppresses the UNKNOWN_PROGRAM flag for it.
pub fn handler(ctx: Context<AttestVerified>, _target_program: Pubkey) -> Result<()> {
    let v = &mut ctx.accounts.verified;
    require!(v.status != STATUS_CONFIRMED, RegistryError::AlreadyConfirmed);

    v.status = STATUS_CONFIRMED;
    v.attested_by = ctx.accounts.admin.key();
    v.updated_at = Clock::get()?.unix_timestamp;

    emit!(VerifiedConfirmed {
        target_program: v.target_program,
        attested_by: ctx.accounts.admin.key(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct AttestVerified<'info> {
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
