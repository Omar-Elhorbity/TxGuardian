//! TxGuardian Risk Attestation Registry
//!
//! On-chain feed for the TxGuardian SDK's drainer / risk blocklist. The
//! registry has one curator (`admin`) who confirms or revokes submissions;
//! anyone can submit a flag in `pending` state. The SDK reads `confirmed`
//! attestations via `getProgramAccounts` and folds them into its rule
//! engine alongside the hardcoded fallback.
//!
//! See [SECURITY.md](../../SECURITY.md) for the full threat model. In
//! short: the on-chain feed is signed by a known admin keypair (multisig
//! in v1); pending submissions never affect SDK output.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

// Live devnet program id (set by `anchor keys sync` on first build).
// Explorer: https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet
declare_id!("Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7");

#[program]
pub mod txguardian_registry {
    use super::*;

    /// Bootstraps the singleton Registry PDA. Permissionless to call but
    /// only succeeds once — the PDA cannot be re-initialized.
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, admin)
    }

    /// Submit a program for review. Anyone can call. Creates the
    /// Attestation PDA in `pending` state. Submitter pays rent.
    pub fn submit(
        ctx: Context<Submit>,
        target_program: Pubkey,
        severity: u8,
        reason: [u8; 64],
    ) -> Result<()> {
        instructions::submit::handler(ctx, target_program, severity, reason)
    }

    /// Curator-only. Move an attestation from `pending` to `confirmed`.
    pub fn attest(ctx: Context<Attest>, target_program: Pubkey) -> Result<()> {
        instructions::attest::handler(ctx, target_program)
    }

    /// Curator-only. Move any attestation to `revoked`. Used to clean up
    /// false positives or stale entries.
    pub fn revoke(ctx: Context<Revoke>, target_program: Pubkey) -> Result<()> {
        instructions::revoke::handler(ctx, target_program)
    }

    /// Curator-only. Rotate the admin pubkey (e.g. multisig migration).
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::update_admin::handler(ctx, new_admin)
    }

    // ─── Verified-program (positive attestation) flow ───────────────────
    // Mirrors the drainer flow above but populates a separate set of
    // accounts (PDA seed = [b"verified", target.as_ref()]). The SDK reads
    // these via fetchVerifiedAttestations and the detectUnknownPrograms
    // rule uses them to suppress UNKNOWN_PROGRAM flags for programs the
    // community has positively reviewed.

    /// Submit a program for positive review. Anyone can call.
    pub fn submit_verified(
        ctx: Context<SubmitVerified>,
        target_program: Pubkey,
        note: [u8; 64],
    ) -> Result<()> {
        instructions::submit_verified::handler(ctx, target_program, note)
    }

    /// Curator-only. Confirm a verified attestation (pending → confirmed).
    pub fn attest_verified(
        ctx: Context<AttestVerified>,
        target_program: Pubkey,
    ) -> Result<()> {
        instructions::attest_verified::handler(ctx, target_program)
    }

    /// Curator-only. Revoke a verified attestation (any → revoked).
    pub fn revoke_verified(
        ctx: Context<RevokeVerified>,
        target_program: Pubkey,
    ) -> Result<()> {
        instructions::revoke_verified::handler(ctx, target_program)
    }
}
