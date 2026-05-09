use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::AttestationRevoked;
use crate::state::{Attestation, Registry, STATUS_CONFIRMED, STATUS_REVOKED};

pub fn handler(ctx: Context<Revoke>, _target_program: Pubkey) -> Result<()> {
    let attestation = &mut ctx.accounts.attestation;
    require!(
        attestation.status != STATUS_REVOKED,
        RegistryError::AlreadyRevoked
    );

    let was_confirmed = attestation.status == STATUS_CONFIRMED;
    attestation.status = STATUS_REVOKED;
    attestation.updated_at = Clock::get()?.unix_timestamp;

    if was_confirmed {
        let registry = &mut ctx.accounts.registry;
        registry.confirmed_count = registry.confirmed_count.saturating_sub(1);
    }

    emit!(AttestationRevoked {
        target_program: attestation.target_program,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct Revoke<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        mut,
        seeds = [b"attestation", target_program.as_ref()],
        bump = attestation.bump
    )]
    pub attestation: Account<'info, Attestation>,
    pub admin: Signer<'info>,
}
