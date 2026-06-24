# TxGuardian

**See what you're signing. We don't.**

A Solana browser extension that checks every signing request in your browser before your wallet's prompt appears. The whole verdict engine ships inside the extension — your transactions never leave your browser. Deterministic rules decide what's risky; an optional AI translator (your Gemini key, called directly from your browser) turns the verdict into plain English.

## Privacy posture

| Configuration | TxGuardian server | Your RPC | Google (Gemini) |
|---|---|---|---|
| **Extension** | Never contacted | Sees the tx for simulation + registry lookup | Never contacted |
| Extension + AI translator (your key) | Never contacted | (as above) | Sees decoded summaries (your key) |
| Web demo at `/scan` | Sees the full tx | (via our server) | (via our server, our key) |

The default extension setup contacts neither our server nor any LLM provider. Verdicts compute on your device against a Solana RPC of your choice. Full breakdown at [`/privacy`](https://tx-guardian-web.vercel.app/privacy).

## Live

- **Browser extension:** [tx-guardian-web.vercel.app/extension](https://tx-guardian-web.vercel.app/extension) — one-click download (~50 KB zip)
- **Engine demo:** [tx-guardian-web.vercel.app/scan](https://tx-guardian-web.vercel.app/scan) — try the engine on any Solana signature or base64 transaction (runs on our server, since the web doesn't have an extension)
- **On-chain registry (devnet):** [`Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7`](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet)

## What ships

- **Browser extension** (`apps/extension`) — Manifest V3 for Chrome / Brave / Arc / Edge. The product. Bundles the engine in its service worker. ~134 KB gzipped.
- **TypeScript SDK** (`packages/sdk`) — `@txguardian/sdk`. The engine, runtime-agnostic — browser, Node, edge. The extension imports it; so does the hosted demo route; so can wallets, dApps, and signing services.
- **On-chain registry** (`programs/txguardian-registry`) — Anchor program (Rust) deployed on Solana devnet. Decentralized drainer + verified-program feeds. Anyone can submit; an admin keypair attests; the engine reads both at scan time.
- **Engine demo** (`apps/web/scan`) — public web demo for evaluating the engine without installing. Server-side because there's no extension on the page.

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
EXTENSION  (bundles the engine; default install)
┌──────────────────────────────────────────────────────────────────┐
│  page.ts (MAIN world)                                            │
│    intercepts signTransaction → postMessage                      │
│           ↓                                                      │
│  service worker                                                  │
│    runs @txguardian/sdk on-device:                              │
│      Parser    (legacy + v0 + ALT + Token-2022)                  │
│      Decoder   (instruction summaries; memo stripped)            │
│      Simulator (user's RPC)                                      │
│      Registry  (user's RPC — drainer + verified feeds)           │
│      Rules     (deterministic)                                   │
│      Scorer    (severity → 0–100 → recommendation)               │
│    optional Translator → Google Gemini (user's key, direct)      │
│           ↓                                                      │
│  Shadow-DOM modal · user decides · wallet has the final say     │
└──────────────────────────────────────────────────────────────────┘

WEB DEMO  (server-side fallback for users without a setup)
┌──────────────────────────────────────────────────────────────────┐
│  /scan, /playground  ──→  POST /api/analyze  (same engine)      │
└──────────────────────────────────────────────────────────────────┘
```

The verdict is deterministic. The LLM only writes the prose explanation; it can't raise, lower, or invent flags, and the recommendation is enum-locked to the engine's `riskLevel`.

The engine is `@txguardian/sdk` — TypeScript, runtime-agnostic (browser, Node, edge). Inside this monorepo; not yet published to npm.

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
├── apps/web/                       # Next.js site (extension download, demo, docs)
│   ├── app/
│   │   ├── page.tsx                # / — extension-led landing page
│   │   ├── extension/page.tsx      # /extension — primary product page + zip download
│   │   ├── scan/page.tsx           # /scan — engine demo: sample / base64 / signature
│   │   ├── demo-sign/page.tsx      # /demo-sign — verify installed extension intercepts
│   │   ├── registry/page.tsx       # /registry — live on-chain feed
│   │   ├── playground/page.tsx     # /playground — raw TxRiskResult JSON for SDK eval
│   │   ├── docs/page.tsx
│   │   ├── about/page.tsx
│   │   ├── privacy/page.tsx        # /privacy — extension privacy policy
│   │   ├── icon.svg                # favicon (auto-emitted by Next)
│   │   ├── apple-icon.png          # Apple touch icon
│   │   ├── opengraph-image.tsx     # OG card for link previews
│   │   └── api/
│   │       ├── analyze/route.ts    # POST: base64 tx OR base58 signature
│   │       ├── fixtures/route.ts
│   │       └── registry/route.ts
│   └── components/
│
├── apps/extension/                 # Browser extension (Manifest V3, the product)
│   ├── src/
│   │   ├── page.ts                 # MAIN-world wallet patches + verdict modal
│   │   ├── content.ts              # ISOLATED bridge (page <-> service worker)
│   │   ├── background.ts           # Service worker — runs the local engine
│   │   ├── popup.html + popup.ts   # Toolbar popup: engine mode + RPC + AI key
│   │   ├── config.ts               # Storage keys + defaults
│   │   └── types.ts
│   ├── public/icons/               # 16/32/48/128 PNG + source SVG
│   ├── scripts/zip-dist.mjs        # Builds the downloadable zip + SHA256
│   ├── manifest.config.ts
│   ├── vite.config.ts
│   └── dist/                       # Tracked in git for load-unpacked
│
├── tests/                          # Anchor TS tests (9 cases)
├── scripts/                        # toolchain installer, registry seed, tx builder
├── .devcontainer/                  # Codespace auto-setup
└── Anchor.toml + Cargo.toml + pnpm-workspace.yaml
```

## Install the extension

Manifest V3. Works in Chrome / Brave / Arc / Edge. Runs locally by default; no accounts, no API keys.

1. Download [`txguardian-extension.zip`](https://tx-guardian-web.vercel.app/txguardian-extension.zip) and extract it
2. `chrome://extensions` → toggle **Developer mode**
3. Click **Load unpacked** → select the extracted folder

Verify it's intercepting at [`/demo-sign`](https://tx-guardian-web.vercel.app/demo-sign). Full install guide at [`/extension`](https://tx-guardian-web.vercel.app/extension) (with the SHA256 of the published zip for verification). Privacy details at [`/privacy`](https://tx-guardian-web.vercel.app/privacy).

## Try the engine without installing

The public demo at [`/scan`](https://tx-guardian-web.vercel.app/scan) runs the same engine server-side. Accepts:

- A sample (Safe / Caution / Danger)
- A Solana Explorer signature (88-char base58) — fetched from RPC and analyzed post-hoc
- A raw base64 transaction

## Local setup (for contributors / self-hosting)

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

**Build the extension from source** (for development or auditing):

```bash
pnpm --filter @txguardian/extension package
# → apps/extension/dist/  (load-unpacked target)
# → apps/web/public/txguardian-extension.zip + .sha256.txt
```

The popup lets you override the RPC and bring your own Gemini key — no rebuild needed. The engine always runs locally.

**Tests** (Vitest, runs in CI):

```bash
pnpm --filter @txguardian/sdk test
```

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | Helius / QuickNode dev key. Public RPCs rate-limit. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | LLM translator (Gemini 2.5 Flash) | Required for Full mode. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Fast mode works without it. |

## License

MIT
