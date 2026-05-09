# Deploying the on-chain program (devnet)

This is the manual step that bridges Phase 10 (program written + tested locally) and Phase 11 (SDK reads from devnet). Do it in your Codespace.

## TL;DR

```bash
# 1. Toolchain (~5 min on a cold Codespace)
bash scripts/setup-solana-toolchain.sh

# 2. Funded devnet wallet (retry the airdrop if rate-limited)
solana airdrop 5

# 3. Build → sync the program id → rebuild → deploy
anchor build
anchor keys sync           # rewrites Anchor.toml + declare_id! to the real keypair
anchor build
anchor deploy --provider.cluster devnet

# 4. Capture the program id (paste this into Claude when you're back)
solana address -k target/deploy/txguardian_registry-keypair.json
```

## What each step does

### `setup-solana-toolchain.sh`
Idempotent installer pinning Solana CLI 1.18.26 + Anchor 0.30.1 + Rust stable. Generates a devnet keypair at `~/.config/solana/id.json` if you don't have one. Sets the cluster to devnet. Safe to re-run.

### `solana airdrop 5`
Devnet faucet, 5 SOL. A program deploy is ~2 SOL. If the faucet rate-limits, retry — or use a fallback:
- https://faucet.solana.com (web)
- Helius / QuickNode dashboards usually have a devnet faucet
- A quick re-run usually works after a minute

### `anchor build` (first time)
Compiles the program AND generates a fresh keypair at `target/deploy/txguardian_registry-keypair.json`. Until you run `anchor keys sync`, the on-disk program id (in `Anchor.toml` and `declare_id!`) is the placeholder `Fg6PaFp...`.

### `anchor keys sync`
Reads the auto-generated keypair, writes its public key into `Anchor.toml [programs.devnet]` and `declare_id!()` in `lib.rs`. After this, your on-chain program id is the real one.

### `anchor build` (second time)
Recompiles with the synced id baked in. Anchor enforces this — if the bytecode's `declare_id!` doesn't match what you're deploying as, deploy fails.

### `anchor deploy --provider.cluster devnet`
Uploads the program to devnet. Output includes the program id. Verify on Solana Explorer:

```
https://explorer.solana.com/address/<your-program-id>?cluster=devnet
```

### `solana address -k target/deploy/txguardian_registry-keypair.json`
Prints the program id. **Paste this output back to Claude** so Phase 11 can wire it into the SDK.

## Optional: initialize the registry

Once deployed, you can immediately bootstrap the singleton Registry PDA so the SDK has something to read:

```bash
# Construct + send the initialize instruction with your wallet as admin.
# Easiest path: use the Anchor TS test runner against devnet.
anchor run init-registry  # (if we ship a script — currently you'd write a one-off)
```

Or just submit a few attestations from the `/registry` page once Phase 12 ships — the page builds an unsigned tx you can sign in Phantom or with `solana` CLI.

## Common errors

### `Error: GLIBC_2.39 not found`
Your Codespace's base image is older than Ubuntu 24.04. Anchor 0.30.1 needs only GLIBC 2.31, so this shouldn't happen — but if you've upgraded to Anchor 0.31+, that's the cause. Solution: either downgrade Anchor (`avm use 0.30.1`) or rebuild the Codespace on a newer image.

### `Error: SBF program not found at target/deploy/...`
You skipped `anchor keys sync` between the two builds, or the keypair file got deleted. Fix:
```bash
rm -rf target/deploy/*
anchor build
anchor keys sync
anchor build
```

### Deploy hangs forever
RPC's having a bad day. Cancel, switch to a different RPC briefly:
```bash
solana config set --url https://api.devnet.solana.com  # or a Helius devnet URL
anchor deploy --provider.cluster devnet
```

### `Error: Account does not exist <program-id>`
Deploy succeeded but RPC is lagging. Wait 30s and re-query:
```bash
solana program show <program-id> --url devnet
```

## When you're done

Send Claude these:
1. **Program id** (the address from step 4 above)
2. **A devnet Explorer link** (proof of deployment)

I'll wire it into `packages/sdk/src/registry.ts`, the README, and the web app.
