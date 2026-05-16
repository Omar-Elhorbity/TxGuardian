# TxGuardian

A browser extension that intercepts every Solana signing request and shows a pre-sign safety verdict before your wallet's prompt appears.

TxGuardian closes the gap between **what a wallet preview says** and **what a transaction's instructions actually authorize**. A deterministic rule engine — backed by a Solana program holding a community-curated drainer/risk feed — decides what's risky. An AI translator turns the verdict into plain English. No signing surface, no key access.

## Live

- **Browser extension:** [tx-guardian-web.vercel.app/extension](https://tx-guardian-web.vercel.app/extension) — one-click download
- **Engine demo:** [tx-guardian-web.vercel.app/scan](https://tx-guardian-web.vercel.app/scan) — try the engine on any Solana signature or base64 transaction
- **On-chain registry (devnet):** [`Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7`](https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet)

## What ships

- **Browser extension** (`apps/extension`) — Manifest V3 for Chrome / Brave / Arc / Edge. The primary surface. Sits between every Solana dApp and your wallet, intercepts every signing request, shows the verdict overlay before your wallet's prompt.
- **TypeScript SDK** (`packages/sdk`) — `@txguardian/sdk`. The same engine the extension uses, packaged as a one-function library. For wallets, dApps, and signing services that want to embed pre-sign checks directly.
- **On-chain registry** (`programs/txguardian-registry`) — Anchor program (Rust) deployed on Solana devnet. The decentralized drainer/risk feed. Anyone can submit, an admin keypair attests, the SDK reads at scan time.
- **Engine demo** (`apps/web/scan`) — public web demo for trying the engine on any transaction. Accepts a Solana signature (fetched from RPC) or a raw base64 transaction. Useful for post-hoc analysis and for evaluating the engine without installing anything.

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
Extension          ─┐
                    ├── HTTP /api/analyze ──┐
Web demo (/scan)   ─┘                       │
                                            ├── @txguardian/sdk  (the engine)
Third-party        ─── direct npm import ───┘
integrations                                ├─ Parser     (legacy + v0 + ALT + Token-2022)
                                            ├─ Decoder    (instruction summaries; memo stripped)
                                            ├─ Simulator  (replaceRecentBlockhash, sigVerify=false)
                                            ├─ Registry   (on-chain getProgramAccounts) ─────┐
                                            ├─ Rules      (deterministic — source of truth) ←┘
                                            ├─ Scorer     (severity → 0–100 → recommendation)
                                            └─ Translator (Gemini 2.5 Flash — never decides risk)
```

Three consumer types, two paths into one engine. The extension and the web demo speak HTTP to the analyzer route (so secrets stay server-side); third-party integrators import the SDK directly into their own Node or browser runtime.

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

## Install the extension

Manifest V3 (Chrome / Brave / Arc / Edge). Defaults to the hosted analyzer at `tx-guardian-web.vercel.app` — zero configuration, no API keys to set.

1. Download [`txguardian-extension.zip`](https://tx-guardian-web.vercel.app/txguardian-extension.zip) and extract it
2. `chrome://extensions` → toggle **Developer mode**
3. Click **Load unpacked** → select the extracted folder

Then open [`/demo-sign`](https://tx-guardian-web.vercel.app/demo-sign) to verify the extension is intercepting signing requests on this page.

Walkthrough with screenshots at [`/extension`](https://tx-guardian-web.vercel.app/extension). Privacy details at [`/privacy`](https://tx-guardian-web.vercel.app/privacy).

## Try the engine without installing

The same engine that powers the extension runs on the public demo at [`/scan`](https://tx-guardian-web.vercel.app/scan). Three input modes in one box:

- Pick a **sample** (Safe / Caution / Danger) to see the verdict shape
- Paste a **Solana Explorer signature** (88-char base58) — the server fetches the transaction from RPC and runs the analyzer; useful for post-hoc analysis of any past tx
- Paste a **base64 transaction** if you have one

Useful for evaluating the engine, reproducing what a drainer victim signed, or testing your SDK integration without bundling anything.

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
# → produces apps/extension/dist/ + apps/web/public/txguardian-extension.zip
# Then chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```

The extension popup lets you override the analyzer endpoint at runtime — point it at `http://localhost:3000/api/analyze` to test against your local dev server without rebuilding.

### Required env

| Var | Purpose | Notes |
|---|---|---|
| `RPC_URL` | Solana JSON-RPC endpoint | Helius / QuickNode dev key. Public RPCs rate-limit. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | LLM translator (Gemini 2.5 Flash) | Required for Full mode. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Fast mode works without it. |

## License

MIT
