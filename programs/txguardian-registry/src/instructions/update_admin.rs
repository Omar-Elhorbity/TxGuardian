use anchor_lang::prelude::*;

use crate::errors::RegistryError;
use crate::events::AdminUpdated;
use crate::state::Registry;

pub fn handler(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    let old_admin = registry.admin;
    registry.admin = new_admin;

    emit!(AdminUpdated {
        old_admin,
        new_admin,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    pub admin: Signer<'info>,
}
