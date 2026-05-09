#!/usr/bin/env bash
# Idempotent installer for the Solana toolchain pinned to the versions
# TxGuardian's Anchor program builds against:
#
#   - Rust stable (1.79+)
#   - Solana CLI 1.18.26
#   - Anchor CLI 0.30.1 (via avm)
#
# Run on a fresh Codespace or any Ubuntu 22.04+ machine. Safe to re-run.
#
# Usage:
#   bash scripts/setup-solana-toolchain.sh

set -euo pipefail

SOLANA_VERSION="v1.18.26"
ANCHOR_VERSION="0.30.1"
RUST_MIN_VERSION="1.79.0"

echo "==> TxGuardian Solana toolchain installer"
echo "    Solana CLI: ${SOLANA_VERSION}"
echo "    Anchor CLI: ${ANCHOR_VERSION}"
echo "    Rust min:   ${RUST_MIN_VERSION}"
echo

# --- 1. Build deps (Ubuntu / Debian)
if command -v apt-get >/dev/null 2>&1; then
  echo "==> Installing build dependencies (apt)..."
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends \
    build-essential pkg-config libssl-dev libudev-dev \
    curl git ca-certificates clang cmake protobuf-compiler
fi

# --- 2. Rust
if ! command -v rustup >/dev/null 2>&1; then
  echo "==> Installing rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
fi
rustup default stable
rustup update stable
echo "    rustc: $(rustc --version)"

# --- 3. Solana CLI
if ! command -v solana >/dev/null 2>&1; then
  echo "==> Installing Solana CLI ${SOLANA_VERSION}..."
  sh -c "$(curl -sSfL https://release.solana.com/${SOLANA_VERSION}/install)"
fi
# Persist PATH for this and future shells
SOLANA_BIN="${HOME}/.local/share/solana/install/active_release/bin"
if ! grep -q "${SOLANA_BIN}" "${HOME}/.bashrc" 2>/dev/null; then
  echo "export PATH=\"${SOLANA_BIN}:\$PATH\"" >> "${HOME}/.bashrc"
fi
export PATH="${SOLANA_BIN}:${PATH}"
echo "    solana: $(solana --version)"

# --- 4. Anchor (via avm)
if ! command -v avm >/dev/null 2>&1; then
  echo "==> Installing Anchor version manager (avm)..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
fi
avm install "${ANCHOR_VERSION}"
avm use "${ANCHOR_VERSION}"
echo "    anchor: $(anchor --version)"

# --- 5. Devnet keypair (only if missing)
KEYPAIR_PATH="${HOME}/.config/solana/id.json"
if [ ! -f "${KEYPAIR_PATH}" ]; then
  echo "==> Generating a new local keypair at ${KEYPAIR_PATH}..."
  solana-keygen new --no-bip39-passphrase -o "${KEYPAIR_PATH}"
fi

# --- 6. Point at devnet
solana config set --url devnet >/dev/null
echo "    cluster: devnet"
echo "    address: $(solana address)"
echo "    balance: $(solana balance || echo '0 SOL')"

cat <<'NEXT'

==============================================================
✓ Toolchain installed.

Next steps (run manually):

  # 1. Airdrop devnet SOL (retry if rate-limited; 5 SOL is plenty)
  solana airdrop 5

  # 2. Build the program. First build creates the keypair under
  #    target/deploy/txguardian_registry-keypair.json.
  anchor build

  # 3. Sync the program id from the keypair into Anchor.toml and
  #    declare_id! in lib.rs.
  anchor keys sync

  # 4. Rebuild with the synced id, then deploy to devnet.
  anchor build
  anchor deploy --provider.cluster devnet

  # 5. Capture the program id from the deploy output and paste it
  #    here when you come back to Claude Code:
  solana address -k target/deploy/txguardian_registry-keypair.json

==============================================================
NEXT
