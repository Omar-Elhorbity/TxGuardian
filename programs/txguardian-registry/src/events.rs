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
