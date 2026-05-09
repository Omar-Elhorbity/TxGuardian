use anchor_lang::prelude::*;

use crate::state::Registry;

pub fn handler(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.admin = admin;
    registry.submission_count = 0;
    registry.confirmed_count = 0;
    registry.bump = ctx.bumps.registry;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Registry::INIT_SPACE,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
