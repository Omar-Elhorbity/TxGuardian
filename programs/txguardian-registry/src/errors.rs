use anchor_lang::prelude::*;

#[error_code]
pub enum RegistryError {
    #[msg("Operation requires admin authority.")]
    Unauthorized,
    #[msg("Severity must be 1 (low), 2 (medium), or 3 (high).")]
    InvalidSeverity,
    #[msg("Attestation is already confirmed.")]
    AlreadyConfirmed,
    #[msg("Attestation is already revoked.")]
    AlreadyRevoked,
}
