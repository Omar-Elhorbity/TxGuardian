# TxGuardian

Pre-sign transaction safety for Solana. Four shipping surfaces, one engine.

TxGuardian closes the gap between **what a wallet preview says** and **what a transaction's instructions actually authorize**. A deterministic rule engine — backed by a Solana program holding a community-curated drainer/risk feed — decides what's risky. An AI translator turns the verdict into plain English. No signing surface, no key access.

## Live

- **Web scanner:** [tx-guardian-web.vercel.app](https://tx-guardian-web.vercel.app)
- **Browser extension:** see [Install the extension](#install-the-extension) below
- **On-chain registry (devnet):** [`Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7`](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet)

## What ships

- **Web scanner** (`apps/web`) — Next.js public scanner. Paste a transaction, connect a wallet, sign-and-send.
- **Browser extension** (`apps/extension`) — Chrome/Brave/Arc Manifest V3. Sits between any Solana dApp and your wallet, intercepts every signing request, shows the verdict before the wallet's prompt.
- **TypeScript SDK** (`packages/sdk`) — `@txguardian/sdk`. One function: `analyze(options) → TxRiskResult`. Framework-agnostic, embeddable in wallets, dApps, signing services.
- **On-chain registry** (`programs/txguardian-registry`) — Anchor program (Rust) deployed on Solana devnet. The decentralized drainer/risk feed. Anyone can submit, an admin keypair attests, the SDK reads at scan time.

## On-chain registry

| Field | Value |
|---|---|
| Cluster | Devnet |
| Program ID | `Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7` |
| Explorer | [solana.com/explorer](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet) |
| Source | [`programs/txguardian-registry`](programs/txguardian-registry) |
| Framework | Anchor 0.32, Rust |

## Architecture

```
Web scanner   ┐
Extension     ┤── POST /api/analyze ── @txguardian/sdk
Embedded SDK  ┘                          ├─ Parser     (legacy + v0 + ALT + Token-2022)
                                         ├─ Decoder    (instruction summaries; memo stripped)
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
| `TOCTOU_PATTERN` | Medium | Schema reserved. Generic runtime detection requires per-program decoders and is not currently implemented. |

## Repo layout

```
TxGuardian/
├── programs/txguardian-registry/   # Anchor program (Rust, devnet)
│   └── src/                        # state, errors, events, 5 instructions
│
├── packages/sdk/                   # @txguardian/sdk (TypeScript)
│   └── src/                        # parser, decode, simulate, registry, rules,
│                                   # scorer, explain, constants, types
│
├── apps/web/                       # Next.js scanner (public-facing)
│   ├── app/
│   │   ├── page.tsx                # /
│   │   ├── scan/page.tsx           # /scan — paste/sample + sign-and-send
│   │   ├── extension/page.tsx      # /extension — install guide + zip download
│   │   ├── registry/page.tsx       # /registry — live on-chain feed
│   │   ├── docs/page.tsx
│   │   ├── about/page.tsx
│   │   ├── privacy/page.tsx        # /privacy — extension privacy policy
│   │   ├── playground/page.tsx
│   │   ├── demo-sign/page.tsx      # extension test surface
│   │   ├── icon.svg                # favicon (auto-emitted by Next)
│   │   ├── apple-icon.png          # Apple touch icon
│   │   └── api/
│   │       ├── analyze/route.ts
│   │       ├── fixtures/route.ts
│   │       └── registry/route.ts
│   └── components/
│
├── apps/extension/                 # Browser extension (Manifest V3)
│   ├── src/
│   │   ├── page.ts                 # MAIN-world wallet patches + modal
│   │   ├── content.ts              # ISOLATED bridge (page <-> service worker)
│   │   ├── background.ts           # Service worker — POSTs /api/analyze
│   │   ├── popup.html + popup.ts   # Toolbar popup: endpoint config + status
│   │   ├── config.ts               # Default endpoint + storage keys
│   │   └── types.ts
│   ├── public/icons/               # 16/32/48/128 PNG + source SVG
│   ├── scripts/zip-dist.mjs        # Builds the downloadable extension zip
│   ├── manifest.config.ts
│   ├── vite.config.ts
│   └── dist/                       # Tracked in git for load-unpacked
│
├── tests/                          # Anchor TS tests (9 cases)
├── scripts/                        # toolchain installer, registry seed, tx builder
├── .devcontainer/                  # Codespace auto-setup
└── Anchor.toml + Cargo.toml + pnpm-workspace.yaml
```

## Local setup

Requires **Node 20+** and **pnpm 9+**. For the Rust program: **Rust stable + Solana CLI 1.18.x + Anchor 0.32.x** (the `scripts/setup-solana-toolchain.sh` installer handles this).

```bash
# 1. Install
pnpm install

# 2. Env
cp .env.example apps/web/.env.local
# Set RPC_URL (Helius/QuickNode dev key recommended) and GOOGLE_GENERATIVE_AI_API_KEY

# 3. Run the web app
pnpm dev
# → http://localhost:3000
```

For the Anchor program (only needed if redeploying / seeding):

```bash
bash scripts/setup-solana-toolchain.sh
anchor build
anchor test                # 9 cases
pnpm seed-registry         # populates the live registry with demo entries
```

## Install the extension

Manifest V3 (Chrome / Brave / Arc / Edge). Defaults to the hosted analyzer at `tx-guardian-web.vercel.app` — zero configuration.

1. Download [`txguardian-extension.zip`](https://tx-guardian-web.vercel.app/txguardian-extension.zip) and extract it
2. `chrome://extensions` → toggle **Developer mode**
3. Click **Load unpacked** → select the extracted folder

Walkthrough with screenshots at [`/extension`](https://tx-guardian-web.vercel.app/extension). Privacy details at [`/privacy`](https://tx-guardian-web.vercel.app/privacy).

**Build from source** (for development or auditing):

```bash
pnpm --filter @txguardian/extension package
# → produces apps/extension/dist/ + apps/web/public/txguardian-extension.zip
# Then chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | Helius / QuickNode dev key. Public RPCs rate-limit. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | LLM translator (Gemini 2.5 Flash) | Required for Full mode. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Fast mode works without it. |

## Try it

- **`/scan`** — paste any Solana transaction (base64 or base58) or pick the **Danger sample**, connect a wallet, and read the verdict. The danger sample triggers an on-chain registry match — expand the flag to see `evidence.source: "onchain"`.
- **`/registry`** — live view of the on-chain feed, with a link to the program on Solana Explorer.
- **`/extension`** — install guide. After loading the extension, `/demo-sign` triggers a real signing intercept against any wallet.
- **`/docs`** — SDK integration (five lines) plus the rule and registry reference.

## License

MIT
