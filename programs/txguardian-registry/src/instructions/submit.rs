use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::AttestationSubmitted;
use crate::state::{Attestation, Registry, SEVERITY_HIGH, SEVERITY_LOW, STATUS_PENDING};

pub fn handler(
    ctx: Context<Submit>,
    target_program: Pubkey,
    severity: u8,
    reason: [u8; 64],
) -> Result<()> {
    require!(
        severity >= SEVERITY_LOW && severity <= SEVERITY_HIGH,
        RegistryError::InvalidSeverity
    );

    let now = Clock::get()?.unix_timestamp;
    let attestation = &mut ctx.accounts.attestation;
    attestation.target_program = target_program;
    attestation.severity = severity;
    attestation.status = STATUS_PENDING;
    attestation.submitter = ctx.accounts.submitter.key();
    attestation.attested_by = Pubkey::default();
    attestation.created_at = now;
    attestation.updated_at = now;
    attestation.reason = reason;
    attestation.bump = ctx.bumps.attestation;

    let registry = &mut ctx.accounts.registry;
    registry.submission_count = registry.submission_count.saturating_add(1);

    emit!(AttestationSubmitted {
        target_program,
        submitter: attestation.submitter,
        severity,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct Submit<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = submitter,
        space = 8 + Attestation::INIT_SPACE,
        seeds = [b"attestation", target_program.as_ref()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    #[account(mut)]
    pub submitter: Signer<'info>,
    pub system_program: Program<'info, System>,
}
