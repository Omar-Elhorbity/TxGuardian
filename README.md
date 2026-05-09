# TxGuardian

Pre-sign transaction safety for Solana. Open SDK, on-chain attestation registry, web scanner.

TxGuardian closes the gap between **what a wallet preview says** and **what a transaction's instructions actually authorize**. A deterministic rule engine — backed by a Solana program holding a community-curated drainer/risk feed — decides what's risky. An AI translator turns the verdict into plain English. No signing surface, no key access.

## Components

- **`@txguardian/sdk`** — TypeScript SDK. One function: `analyze(options) → TxRiskResult`. Framework-agnostic, embeddable in wallets, dApps, signing services.
- **`txguardian_registry`** — Anchor program (Rust) deployed on Solana devnet. The on-chain feed for the drainer/risk blocklist.
- **`@txguardian/web`** — Next.js scanner. Public-facing tool, developer playground, SDK docs, live registry view.

## On-chain registry

The drainer blocklist isn't hardcoded. It lives on-chain — anyone can submit a flag, an admin keypair confirms or revokes, the SDK reads confirmed entries via `getProgramAccounts` at scan time.

| Field | Value |
|---|---|
| Cluster | Devnet |
| Program ID | `Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7` |
| Explorer | [solana.com/explorer](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet) |
| Source | [`programs/txguardian-registry`](programs/txguardian-registry) |
| Framework | Anchor 0.32, Rust |

## Architecture

```
User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├─ Parser     (legacy + v0 + ALT + Token-2022)
                                          ├─ Decoder    (instruction summaries; memo content stripped)
                                          ├─ Simulator  (replaceRecentBlockhash, sigVerify=false)
                                          ├─ Registry   (on-chain getProgramAccounts) ─────┐
                                          ├─ Rules      (deterministic — source of truth) ←┘
                                          ├─ Scorer     (severity → 0–100 → recommendation)
                                          └─ Translator (Gemini 2.5 Flash — never decides risk)
```

The deterministic engine is the source of truth on **risk**. The LLM only translates — it cannot raise, lower, or invent flags, and the recommendation is enum-locked to the deterministic level.

## Risk flags

| Flag | Severity | Detects |
|---|---|---|
| `KNOWN_DRAINER_PROGRAM` | High | Program in the hardcoded list **or** a confirmed on-chain registry entry. `evidence.source` distinguishes them. |
| `FULL_TOKEN_APPROVAL` | High | Unbounded SPL Token / Token-2022 Approve, or `SetAuthority(AccountOwner)` |
| `SIMULATION_SPOOF` | High | Static token Transfer/TransferChecked to non-signer destination — verify against wallet preview |
| `UNKNOWN_PROGRAM` | Medium | Program not in well-known allowlist |
| `MULTI_INSTRUCTION_COMPLEXITY` | Medium | 5+ non-ComputeBudget instructions |
| `UNUSUAL_FEE` | Low | Priority fee ≥ 1M micro-lamports/CU |
| `TOCTOU_PATTERN` | Medium | Schema reserved — runtime detection is roadmap work |

## Repo layout

```
TxGuardian/
├── programs/txguardian-registry/   # Anchor program (Rust)
│   ├── src/
│   │   ├── lib.rs                # entry, declare_id!, instruction wiring
│   │   ├── state.rs              # Registry + Attestation accounts
│   │   ├── errors.rs
│   │   ├── events.rs
│   │   └── instructions/         # initialize, submit, attest, revoke, update_admin
│   └── Cargo.toml
│
├── packages/sdk/                   # @txguardian/sdk (TypeScript)
│   └── src/
│       ├── index.ts              # analyze() entry point + public re-exports
│       ├── parser.ts             # legacy + v0 + ALT resolution + Token-2022
│       ├── decode.ts             # instruction → human summary; memo stripped
│       ├── simulate.ts           # connection.simulateTransaction wrapper
│       ├── registry.ts           # on-chain feed reader (getProgramAccounts + memcmp)
│       ├── rules/                # 6 deterministic rule modules
│       ├── scorer.ts             # severity → 0–100 + riskLevel + recommendation
│       ├── explain.ts            # Vercel AI SDK + Zod, translator-only
│       ├── constants.ts          # KNOWN_PROGRAMS, KNOWN_DRAINERS, helpers
│       └── types.ts
│
├── apps/web/                       # @txguardian/web (Next.js)
│   ├── app/
│   │   ├── scan/page.tsx         # The scanner
│   │   ├── registry/page.tsx     # Live on-chain registry view
│   │   ├── docs/page.tsx
│   │   ├── playground/page.tsx
│   │   ├── about/page.tsx
│   │   └── api/
│   │       ├── analyze/route.ts
│   │       └── fixtures/route.ts
│   ├── components/               # RiskBadge, FlagCard, ExplanationBox, etc.
│   └── lib/                      # rpc, fixtures, json-safe
│
├── tests/                          # Anchor TS tests
├── scripts/                        # toolchain installer, registry seed, tx builder
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
# Edit apps/web/.env.local — set RPC_URL and GOOGLE_GENERATIVE_AI_API_KEY

# 3. Run the web app
pnpm dev
# Open http://localhost:3000
```

For the on-chain side (deploying your own copy or seeding the registry):

```bash
bash scripts/setup-solana-toolchain.sh   # installs Solana CLI + Anchor
anchor build
anchor test                               # 9 cases
pnpm seed-registry                        # populates the live registry
```

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | Use Helius or QuickNode dev key. Public RPCs rate-limit. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | LLM translator (Gemini 2.5 Flash) | Required for Full mode. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Fast mode works without it. |

## Quick tour

1. Open `/scan`
2. Click **Danger sample** — auto-loads a transaction with `Token::Approve(amount=u64::MAX)`
3. Result: red verdict, multiple flags including the on-chain registry match, plain-English explanation
4. Open `/registry` — live on-chain feed, the program ID, the Explorer link
5. Click **Safe sample** — clean SOL transfer, green verdict
6. `/docs` — five-line SDK integration

## License

MIT
