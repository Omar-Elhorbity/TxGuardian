# TxGuardian

> Pre-sign transaction safety copilot for Solana — open SDK + on-chain registry + Next.js scanner.

TxGuardian closes the gap between **what a wallet preview says** and **what a transaction's instructions actually authorize**. A deterministic rule engine — backed by an on-chain attestation registry — decides what's risky. An AI translator turns the verdict into plain English. No signing surface, no key access.

Built solo for the **Dev3pack Global Hackathon** (Cairo Hub), May 9–11 2026.

---

## What it ships

- **`@txguardian/sdk`** — TypeScript SDK. One function: `analyze(options)` → `TxRiskResult`. Framework-agnostic, embeddable in wallets, dApps, signing services.
- **`txguardian_registry`** — Anchor program (Rust) deployed on Solana devnet. The on-chain feed for the drainer/risk blocklist.
- **`@txguardian/web`** — Next.js (App Router) scanner deployed on Vercel. The public proof of value, plus a developer playground, SDK docs, and a live registry view.

## On-chain registry (Solana program)

The drainer blocklist isn't hardcoded — it lives on-chain. Anyone can submit a flag; an admin keypair (multisig in v1) confirms or revokes; the SDK reads confirmed entries via `getProgramAccounts` at scan time.

| Field | Value |
|---|---|
| **Cluster** | Devnet |
| **Program ID** | `Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7` |
| **Explorer** | [solana.com/explorer](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet) |
| **Source** | [`programs/txguardian-registry`](programs/txguardian-registry) |
| **Framework** | Anchor 0.32.1, Rust |

Read the live feed at [`/registry`](apps/web/app/registry/page.tsx) once the app is running.

## Architecture

```
User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├─ Parser     (legacy + v0 + ALT + Token-2022)
                                          ├─ Decoder    (instruction summaries; memo stripped)
                                          ├─ Simulator  (replaceRecentBlockhash, sigVerify=false)
                                          ├─ Registry   (on-chain getProgramAccounts) ─────┐
                                          ├─ Rules      (deterministic — source of truth) ←┘
                                          ├─ Scorer     (severity → 0–100 → recommendation)
                                          └─ Translator (Claude Haiku 4.5 — never decides risk)
```

The deterministic engine is the source of truth on **risk**. The LLM only translates — it cannot raise, lower, or invent flags, and the recommendation is enum-locked to the deterministic level. See [SECURITY.md](SECURITY.md) for the full defensive posture.

## Risk flags shipping at MVP

| Flag | Severity | Detects |
|---|---|---|
| `KNOWN_DRAINER_PROGRAM` | High | Program in the hardcoded list **or** a confirmed on-chain registry entry. `evidence.source` distinguishes them. |
| `FULL_TOKEN_APPROVAL` | High | Unbounded SPL Token / Token-2022 Approve, or `SetAuthority(AccountOwner)` |
| `SIMULATION_SPOOF` | High | Static token Transfer/TransferChecked to non-signer destination — verify against wallet preview |
| `UNKNOWN_PROGRAM` | Medium | Program not in well-known allowlist |
| `MULTI_INSTRUCTION_COMPLEXITY` | Medium | 5+ non-ComputeBudget instructions |
| `UNUSUAL_FEE` | Low | Priority fee ≥ 1M micro-lamports/CU (bonus) |
| `TOCTOU_PATTERN` | Medium | Schema reserved — runtime detection in v1 (browser extension) |

## Repo layout

```
TxGuardian/
├── programs/txguardian-registry/   # Anchor program (Rust)
│   ├── src/
│   │   ├── lib.rs              # entry, declare_id!, instruction wiring
│   │   ├── state.rs            # Registry + Attestation accounts
│   │   ├── errors.rs
│   │   ├── events.rs
│   │   └── instructions/       # initialize, submit, attest, revoke, update_admin
│   └── Cargo.toml
│
├── packages/sdk/                   # @txguardian/sdk (TypeScript)
│   └── src/
│       ├── index.ts            # analyze() entry point + public re-exports
│       ├── parser.ts           # legacy + v0 + ALT resolution + Token-2022
│       ├── decode.ts           # instruction → human summary; memo content stripped
│       ├── simulate.ts         # connection.simulateTransaction wrapper
│       ├── registry.ts         # on-chain feed reader (getProgramAccounts + memcmp)
│       ├── rules/              # 6 deterministic rule modules
│       ├── scorer.ts           # severity → 0–100 + riskLevel + recommendation
│       ├── explain.ts          # Vercel AI SDK + Zod, translator-only
│       ├── constants.ts        # KNOWN_PROGRAMS, KNOWN_DRAINERS, helpers
│       └── types.ts
│
├── apps/web/                       # @txguardian/web (Next.js)
│   ├── app/
│   │   ├── scan/page.tsx       # The scanner
│   │   ├── registry/page.tsx   # Live on-chain registry view
│   │   ├── docs/page.tsx
│   │   ├── playground/page.tsx
│   │   ├── about/page.tsx
│   │   └── api/
│   │       ├── analyze/route.ts
│   │       └── fixtures/route.ts
│   ├── components/             # RiskBadge, FlagCard, ExplanationBox, etc.
│   └── lib/                    # rpc, fixtures, json-safe
│
├── tests/                          # Anchor TS tests (mocha + chai)
├── scripts/                        # setup-solana-toolchain.sh, seed-registry.ts
├── .devcontainer/                  # auto-install Solana + Anchor on Codespace start
├── Anchor.toml
├── Cargo.toml                      # Rust workspace root
└── package.json                    # pnpm workspace root
```

## Local setup

Requires **Node 20+**, **pnpm 9+**, and (for the Rust program) **Rust stable + Solana CLI 1.18.x + Anchor 0.32.x**. The provided `.devcontainer/` and `scripts/setup-solana-toolchain.sh` install everything in a fresh Codespace.

```bash
# 1. Install JS deps
pnpm install

# 2. Configure env (server-side only — never client)
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — set RPC_URL and ANTHROPIC_API_KEY

# 3. Run the web app
pnpm dev
# Open http://localhost:3000
```

For the on-chain side (deploying your own copy or seeding the registry):

```bash
# Install the Solana toolchain (idempotent)
bash scripts/setup-solana-toolchain.sh

# Build + test the program
anchor build
anchor test

# Seed the live registry with demo entries
pnpm seed-registry
```

See [DEPLOY.md](DEPLOY.md) for the full deploy recipe.

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | **Use Helius or QuickNode dev key.** Public RPCs rate-limit and will break the demo. |
| `ANTHROPIC_API_KEY` | LLM translator | Required for Full mode. Fast mode works without it. |

## Demo flow (90-second pitch)

1. Open `/scan`
2. Click **"Danger sample"** — auto-loads a fixture with `Token::Approve(amount=u64::MAX, delegate=<unknown>)`
3. Result: red verdict, multiple flags including the on-chain registry match, plain-English explanation
4. Open **`/registry`** — show the live on-chain feed, the program ID, the Solana Explorer link
5. Click **"Safe sample"** — clean SOL transfer, green verdict, no flags
6. Cut to `/docs` — show the 5-line SDK integration: `pnpm add @txguardian/sdk`

## Documents

- [DESIGN.md](DESIGN.md) — design system: tokens, components, accessibility floor
- [IA.md](IA.md) — information architecture: SDK + on-chain program + app
- [SECURITY.md](SECURITY.md) — threat model + defensive principles
- [DEPLOY.md](DEPLOY.md) — devnet deploy recipe + common errors
- [PHASES.md](PHASES.md) — running build journal (phase-by-phase)

## License

MIT
