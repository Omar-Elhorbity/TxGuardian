use anchor_lang::prelude::*;

/// Singleton registry account. Stores the curator admin and aggregate
/// counters. PDA seed: [b"registry"].
#[account]
#[derive(InitSpace)]
pub struct Registry {
    /// Curator authority. Can attest, revoke, and rotate itself.
    pub admin: Pubkey,
    /// Total submissions ever received (monotonic).
    pub submission_count: u64,
    /// Currently confirmed (non-revoked) attestations.
    pub confirmed_count: u64,
    /// PDA bump.
    pub bump: u8,
}

/// One per flagged target program. PDA seed:
/// [b"attestation", target_program.as_ref()] — guarantees uniqueness per
/// program and lets the SDK derive the address without indexing.
#[account]
#[derive(InitSpace)]
pub struct Attestation {
    /// The Solana program being flagged.
    pub target_program: Pubkey,
    /// 1=low, 2=medium, 3=high. Validated on submit.
    pub severity: u8,
    /// 0=pending, 1=confirmed, 2=revoked.
    pub status: u8,
    /// First account that paid rent for this attestation.
    pub submitter: Pubkey,
    /// Admin that confirmed (or revoked). Default Pubkey while pending.
    pub attested_by: Pubkey,
    /// Unix timestamp at submission.
    pub created_at: i64,
    /// Unix timestamp at last status change.
    pub updated_at: i64,
    /// Free-form short reason. Null-padded UTF-8. Treated as untrusted text
    /// by the SDK — never quoted verbatim in any LLM context.
    pub reason: [u8; 64],
    /// PDA bump.
    pub bump: u8,
}

// --- Status constants ---
pub const STATUS_PENDING: u8 = 0;
pub const STATUS_CONFIRMED: u8 = 1;
pub const STATUS_REVOKED: u8 = 2;

// --- Severity constants ---
pub const SEVERITY_LOW: u8 = 1;
pub const SEVERITY_MEDIUM: u8 = 2;
pub const SEVERITY_HIGH: u8 = 3;

/// Positive attestation — "this program has been reviewed and is safe."
///
/// Counterpart to `Attestation` (which is the drainer / risk feed). Same
/// admin-curated lifecycle (anyone submits as pending, admin confirms or
/// revokes), but consumed by the SDK to SUPPRESS the UNKNOWN_PROGRAM flag
/// rather than to raise one. Together they turn the registry from a
/// decentralized blocklist into a decentralized both-list.
///
/// PDA seed: [b"verified", target_program.as_ref()] — different prefix
/// from `Attestation` so the two coexist without collision and migration
/// for existing on-chain accounts is unnecessary.
#[account]
#[derive(InitSpace)]
pub struct VerifiedAttestation {
    /// The Solana program being verified as safe.
    pub target_program: Pubkey,
    /// 0=pending, 1=confirmed, 2=revoked. Reuses the status constants.
    pub status: u8,
    /// First account that paid rent.
    pub submitter: Pubkey,
    /// Admin that confirmed (or revoked). Default Pubkey while pending.
    pub attested_by: Pubkey,
    /// Unix timestamp at submission.
    pub created_at: i64,
    /// Unix timestamp at last status change.
    pub updated_at: i64,
    /// Free-form short note (project name, audit reference, etc).
    /// UNTRUSTED text — handled the same way as `Attestation.reason`:
    /// never quoted verbatim in LLM contexts, never used as a code-path key.
    pub note: [u8; 64],
    /// PDA bump.
    pub bump: u8,
}
