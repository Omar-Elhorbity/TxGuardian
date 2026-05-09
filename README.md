# TxGuardian

> Pre-sign transaction safety copilot for Solana — open SDK + Next.js scanner.

TxGuardian closes the gap between **what a wallet preview says** and **what a transaction's instructions actually authorize**. Five deterministic rules decide what's risky; an AI translator turns the verdict into plain English. No signing surface, no key access.

Built solo for the **Dev3pack Global Hackathon** (Cairo Hub), May 9–11 2026.

---

## What it ships

- **`@txguardian/sdk`** — TypeScript SDK. One function: `analyze(options)` → `TxRiskResult`. Framework-agnostic, embeddable in wallets, dApps, signing services.
- **`@txguardian/web`** — Next.js (App Router) scanner deployed on Vercel. The public proof of value, plus a developer playground and SDK docs.

## Architecture

```
User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├─ Parser  (legacy + v0 + ALT + Token-2022)
                                          ├─ Decoder (instruction summaries; memo stripped)
                                          ├─ Rules   (5 active rules — source of truth on risk)
                                          ├─ Scorer  (severity → 0–100 → riskLevel + recommendation)
                                          └─ AI Translator (Claude Haiku 4.5 — never decides risk)
```

The deterministic engine is the source of truth on **risk**. The LLM only translates — it cannot raise, lower, or invent flags, and the recommendation is enum-locked to the deterministic level. See [SECURITY.md](SECURITY.md) for the full defensive posture.

## Risk flags shipping at MVP

| Flag | Severity | Detects |
|---|---|---|
| `KNOWN_DRAINER_PROGRAM` | High | Program in the curated drainer blocklist |
| `FULL_TOKEN_APPROVAL` | High | Unbounded SPL Token / Token-2022 Approve, or `SetAuthority(AccountOwner)` |
| `SIMULATION_SPOOF` | High | Static token Transfer/TransferChecked to non-signer destination — verify against wallet preview |
| `UNKNOWN_PROGRAM` | Medium | Program not in well-known allowlist |
| `MULTI_INSTRUCTION_COMPLEXITY` | Medium | 5+ non-ComputeBudget instructions |
| `UNUSUAL_FEE` | Low | Priority fee ≥ 1M micro-lamports/CU (bonus) |
| `TOCTOU_PATTERN` | Medium | Schema reserved — runtime detection in v1 |

## Repo layout

```
TxGuardian/
├── packages/sdk/           # @txguardian/sdk — framework-agnostic TS SDK
│   └── src/
│       ├── index.ts        # analyze() entry point + public re-exports
│       ├── parser.ts       # legacy + v0 + ALT resolution + Token-2022
│       ├── decode.ts       # instruction → human summary; memo content stripped
│       ├── simulate.ts     # connection.simulateTransaction wrapper
│       ├── rules/          # 6 deterministic rule modules
│       ├── scorer.ts       # severity → 0–100 + riskLevel + recommendation
│       ├── explain.ts      # Vercel AI SDK + Zod, translator-only
│       ├── constants.ts    # KNOWN_PROGRAMS, KNOWN_DRAINERS, helpers
│       └── types.ts
│
└── apps/web/               # @txguardian/web — Next.js scanner
    ├── app/
    │   ├── page.tsx        # /
    │   ├── scan/page.tsx   # The scanner
    │   ├── docs/page.tsx
    │   ├── playground/page.tsx
    │   ├── about/page.tsx
    │   └── api/
    │       ├── analyze/route.ts   # POST: rate-limited, jsonSafe()'d
    │       └── fixtures/route.ts  # GET: deterministic demo fixtures
    ├── components/         # RiskBadge, FlagCard, ExplanationBox, etc.
    ├── lib/                # rpc, fixtures, json-safe
    └── app/globals.css     # Design tokens (CSS variables)
```

## Local setup

Requires **Node 20+** and **pnpm 9+**.

```bash
# 1. Install
pnpm install

# 2. Configure env (server-side only — never client)
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — set RPC_URL and ANTHROPIC_API_KEY

# 3. Run
pnpm dev
# Open http://localhost:3000
```

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | **Use Helius or QuickNode dev key.** Public RPCs rate-limit and will break the demo. |
| `ANTHROPIC_API_KEY` | LLM translator | Required for Full mode. Fast mode works without it. |

## Demo flow (90-second pitch)

1. Open `/scan`
2. Click **"Danger sample"** — auto-loads a fixture with `Token::Approve(amount=u64::MAX, delegate=<unknown>)`
3. Result appears: red verdict, score 87+, three flags, plain-English explanation
4. Click **"Safe sample"** — clean SOL transfer, green verdict, no flags
5. Cut to `/docs` — show the 5-line SDK integration

## Documents

- [DESIGN.md](DESIGN.md) — design system: tokens, components, accessibility floor
- [IA.md](IA.md) — information architecture: SDK + app
- [SECURITY.md](SECURITY.md) — threat model + defensive principles
- [PHASES.md](PHASES.md) — running build journal (phase-by-phase)

## License

MIT
