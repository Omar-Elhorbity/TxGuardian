use anchor_lang::prelude::*;

#[event]
pub struct AttestationSubmitted {
    pub target_program: Pubkey,
    pub submitter: Pubkey,
    pub severity: u8,
}

#[event]
pub struct AttestationConfirmed {
    pub target_program: Pubkey,
    pub attested_by: Pubkey,
}

#[event]
pub struct AttestationRevoked {
    pub target_program: Pubkey,
}

#[event]
pub struct AdminUpdated {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

// --- Verified-program (positive attestation) events ----------------------

#[event]
pub struct VerifiedSubmitted {
    pub target_program: Pubkey,
    pub submitter: Pubkey,
}

#[event]
pub struct VerifiedConfirmed {
    pub target_program: Pubkey,
    pub attested_by: Pubkey,
}

#[event]
pub struct VerifiedRevoked {
    pub target_program: Pubkey,
}
