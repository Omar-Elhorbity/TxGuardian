pub mod initialize;
pub mod submit;
pub mod attest;
pub mod revoke;
pub mod update_admin;

// Verified-program (positive attestation) flow — counterpart to the
// drainer flow above. Same lifecycle (submit → attest / revoke), different
// PDA seed prefix ("verified") so accounts coexist without collision.
pub mod submit_verified;
pub mod attest_verified;
pub mod revoke_verified;

pub use initialize::*;
pub use submit::*;
pub use attest::*;
pub use revoke::*;
pub use update_admin::*;
pub use submit_verified::*;
pub use attest_verified::*;
pub use revoke_verified::*;
