use anchor_lang::prelude::*;

use crate::events::VerifiedSubmitted;
use crate::state::{Registry, VerifiedAttestation, STATUS_PENDING};

/// Submit a program for positive review ("this program is safe"). Anyone
/// can call. Creates the VerifiedAttestation PDA in `pending` state; the
/// admin later confirms via `attest_verified`. Submitter pays rent.
pub fn handler(
    ctx: Context<SubmitVerified>,
    target_program: Pubkey,
    note: [u8; 64],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let v = &mut ctx.accounts.verified;
    v.target_program = target_program;
    v.status = STATUS_PENDING;
    v.submitter = ctx.accounts.submitter.key();
    v.attested_by = Pubkey::default();
    v.created_at = now;
    v.updated_at = now;
    v.note = note;
    v.bump = ctx.bumps.verified;

    // Submissions to the verified feed share the same submission counter
    // as drainer submissions — both represent community activity on the
    // registry. confirmed_count remains drainer-only by convention.
    let registry = &mut ctx.accounts.registry;
    registry.submission_count = registry.submission_count.saturating_add(1);

    emit!(VerifiedSubmitted {
        target_program,
        submitter: v.submitter,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(target_program: Pubkey)]
pub struct SubmitVerified<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = submitter,
        space = 8 + VerifiedAttestation::INIT_SPACE,
        seeds = [b"verified", target_program.as_ref()],
        bump
    )]
    pub verified: Account<'info, VerifiedAttestation>,
    #[account(mut)]
    pub submitter: Signer<'info>,
    pub system_program: Program<'info, System>,
}
