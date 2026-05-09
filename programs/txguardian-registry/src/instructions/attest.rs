use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::AttestationConfirmed;
use crate::state::{Attestation, Registry, STATUS_CONFIRMED};

pub fn handler(ctx: Context<Attest>, _target_program: Pubkey) -> Result<()> {
    let attestation = &mut ctx.accounts.attestation;
    require!(
        attestation.status != STATUS_CONFIRMED,
        RegistryError::AlreadyConfirmed
    );

    attestation.status = STATUS_CONFIRMED;
    attestation.attested_by = ctx.accounts.admin.key();
    attestation.updated_at = Clock::get()?.unix_timestamp;

    let registry = &mut ctx.accounts.registry;
    registry.confirmed_count = registry.confirmed_count.saturating_add(1);

    emit!(AttestationConfirmed {
        target_program: attestation.target_program,
        attested_by: ctx.accounts.admin.key(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct Attest<'info> {
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
