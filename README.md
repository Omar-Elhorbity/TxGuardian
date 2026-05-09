# TxGuardian

> Pre-sign transaction safety copilot for Solana — SDK + Next.js scanner.

TxGuardian is two things that work together:

- **`@txguardian/sdk`** — a TypeScript SDK that takes a base64 Solana transaction and returns a structured risk verdict (deterministic rules + AI translation).
- **`@txguardian/web`** — a Next.js (App Router) scanner deployed on Vercel, demonstrating the SDK end-to-end.

## Why

Solana wallet drainers exploit the gap between **what a wallet preview says** and **what the transaction's instructions actually authorize**. TxGuardian closes that gap with a deterministic rule engine and a plain-English AI translator that runs **before** the user signs.

## Architecture

```
User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├── Parser (legacy + v0 + ALT + Token-2022)
                                          ├── Rule Engine (5 active rules)
                                          ├── Scorer (deterministic 0–100)
                                          └── AI Explainer (Claude Haiku 4.5, translator only)
```

The deterministic engine is the source of truth on **risk**. The LLM only translates — it never decides what is risky.

## Risk flags shipping at MVP

| Flag | Severity | Detects |
|---|---|---|
| `KNOWN_DRAINER_PROGRAM` | High | Program address in known drainer blocklist |
| `FULL_TOKEN_APPROVAL` | High | Unbounded SPL Token / Token-2022 approval or `SetAuthority` |
| `UNKNOWN_PROGRAM` | Medium | Program not in well-known allowlist |
| `MULTI_INSTRUCTION_COMPLEXITY` | Medium | 5+ non-ComputeBudget instructions |
| `SIMULATION_SPOOF` | High | Static instruction intent doesn't match simulation deltas |

Plus `UNUSUAL_FEE` (low-severity bonus) and `TOCTOU_PATTERN` documented as v1 roadmap.

## Repo layout

```
TxGuardian/
├── packages/sdk/       # @txguardian/sdk — TypeScript SDK, framework-agnostic
└── apps/web/           # @txguardian/web — Next.js scanner
```

## Local development

```bash
# Install (Node 20+, pnpm 9+)
pnpm install

# Copy env template and fill in keys (RPC + Anthropic)
cp .env.example apps/web/.env.local

# Run the web app
pnpm dev
```

The SDK is consumed via pnpm workspace — no publish step needed in dev.

## Required env

See [.env.example](.env.example). At minimum:
- `RPC_URL` — Helius or QuickNode dev key. Public RPCs will rate-limit and break the demo.
- `ANTHROPIC_API_KEY` — required for Full mode (AI explanation). Fast mode works without it.

## Documents

- [DESIGN.md](DESIGN.md) — design system (tokens, components, accessibility)
- [IA.md](IA.md) — information architecture (SDK + app)
- [PHASES.md](PHASES.md) — build phase log

## License

MIT
