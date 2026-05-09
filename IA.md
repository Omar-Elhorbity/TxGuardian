# TxGuardian — UX Information Architecture
**SDK + Monitoring App | Dev3pack Hackathon 2026**

---

## Overview

TxGuardian is two things that work together: a **TypeScript SDK** that any Solana dApp or wallet can import to get structured risk data before signing, and a **Monitoring App** (Next.js on Vercel) that acts as the public-facing proof of value — a standalone tool where any Phantom DeFi user can inspect a transaction and get an instant safety verdict.

This document defines the Information Architecture (IA) for both surfaces: what exists, what users interact with, how data flows, and why each piece is there.

---

## Part 1 — SDK Architecture

### 1.1 What the SDK does

The SDK is a TypeScript npm package (`@txguardian/sdk`) that accepts a raw Solana transaction or a base64-encoded serialized transaction, runs it through a rule engine and an AI summary layer, and returns a structured `TxRiskResult` object.

Any developer can drop it into their wallet integration or dApp with one import. They get the risk data back as typed JSON — no opinionated UI attached.

### 1.2 SDK Input / Output contract

**Input — `AnalyzeOptions`**

| Field | Type | Required | Description |
|---|---|---|---|
| `transaction` | `string` (base64) OR `VersionedTransaction` OR legacy `Transaction` | Yes | Serialized or deserialized Solana transaction. v0 (Versioned) and legacy both supported. |
| `connection` | `Connection` | Yes | Solana RPC connection (devnet or mainnet). Recommended: Helius or QuickNode for ALT and simulation calls. |
| `publicKey` | `PublicKey` | Optional | Signer public key for context-aware checks. |
| `mode` | `"fast"` \| `"full"` | Optional (default: `"fast"`) | Fast = rule checks only (no LLM, no simulation). Full = rules + simulation + AI explanation. |

**Output — `TxRiskResult`**

```ts
type RiskLevel = "safe" | "caution" | "danger";

interface TxRiskFlag {
  id: string;                   // e.g. "SIMULATION_SPOOF", "UNKNOWN_PROGRAM"
  severity: "low" | "medium" | "high";
  label: string;                // Short human-readable flag name
  description: string;          // One-sentence technical description
}

interface TxRiskResult {
  riskLevel: RiskLevel;         // Overall verdict (deterministic, derived from flags)
  score: number;                // 0–100 (higher = more risk)
  flags: TxRiskFlag[];          // List of detected risk signals
  explanation: string;          // Plain-English LLM translation (full mode only)
  recommendation: string;       // "Safe to sign" / "Proceed with caution" / "Do not sign"
  whatThisDoes: string[];       // Decoded instruction summary for the user (full mode only)
  simulationResult?: object;    // Raw Solana simulation output (optional)
  analyzedAt: string;           // ISO timestamp
}
```

### 1.3 SDK Internal layers

```
SDK Entry Point  (analyze())
    │
    ├── 1. PARSER
    │       Deserializes transaction. MUST handle:
    │         - Legacy Transaction (Transaction.from)
    │         - VersionedTransaction v0 (VersionedTransaction.deserialize)
    │         - Address Lookup Table resolution: fetch every ALT referenced
    │           in tx.message.addressTableLookups, then call
    │           message.getAccountKeys({ addressLookupTableAccounts }) so
    │           rules see the FULL account list, not just static keys.
    │         - Both SPL Token programs:
    │             * TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (classic)
    │             * TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb (Token-2022)
    │         - ComputeBudget instructions are normal — filter from complexity counts.
    │       Output: normalized {instructions, accountKeys, programIds, signers}
    │
    ├── 2. RULE ENGINE
    │       Runs deterministic checks against known risky patterns.
    │       Each rule is a pure function: (parsed, context) => TxRiskFlag | null.
    │       See Part 3 for the active rule set.
    │
    ├── 3. SCORER
    │       Aggregates flag severity weights → normalized 0–100 score.
    │       Derives RiskLevel: 0–24 safe, 25–59 caution, 60–100 danger.
    │       The deterministic engine is the single source of truth on RISK.
    │
    └── 4. AI EXPLAINER  (full mode only — server-side via Vercel AI SDK)
            Role: TRANSLATOR, not detector. The LLM never decides whether
            something is risky — it only renders the deterministic flag list
            into prose a retail user understands.

            Input to model: { riskLevel, score, flags[], decodedInstructions[] }.
            Never the raw transaction bytes. Instructions pre-decoded server-side.

            Implementation:
              - generateObject() from `ai`, with a Zod schema (.max() length-capped).
              - Model: claude-haiku-4-5 (fast + cheap default). Sonnet 4.6 toggle in /playground.
              - temperature: 0.2 (drop to 0.1 if outputs drift).
              - System prompt forbids inventing flags or programs not in input.
              - Recommendation field is enum-locked, must mirror riskLevel.
              - Cache by transaction hash → same tx in, same explanation out.
                Saves cost on demo retries and makes the demo deterministic.
```

### 1.4 SDK file structure (monorepo)

```
packages/
  sdk/
    src/
      index.ts          ← Public API: analyze(), TxRiskResult type
      parser.ts         ← Legacy + v0 deserialization, ALT resolution, Token-2022 awareness
      rules/
        index.ts        ← Rule engine orchestrator (runRules → TxRiskFlag[])
        drainer.ts      ← KNOWN_DRAINER_PROGRAM (blocklist match)
        unknown.ts      ← UNKNOWN_PROGRAM (inverse allowlist)
        complexity.ts   ← MULTI_INSTRUCTION_COMPLEXITY (post-ComputeBudget filter)
        approval.ts     ← FULL_TOKEN_APPROVAL (covers both SPL Token + Token-2022)
        spoof.ts        ← SIMULATION_SPOOF (Tier 2 — intent vs simulation delta)
      scorer.ts         ← Risk score aggregation
      explain.ts        ← AI Explainer (Vercel AI SDK + Zod, server-side only)
      constants.ts      ← KNOWN_PROGRAMS allowlist, KNOWN_DRAINERS blocklist
      types.ts          ← All TypeScript types/interfaces
    package.json
    tsconfig.json
```

`explain.ts` is server-only — it imports `@ai-sdk/anthropic` and reads `ANTHROPIC_API_KEY` from env. Never bundle into a client component.

---

## Part 2 — Monitoring App Architecture

The Monitoring App is a Next.js App Router project deployed on Vercel. It has two audiences: **end users** (Phantom DeFi traders who want to check a transaction before signing) and **developers** (who want to try the SDK before integrating it).

### 2.1 Site map

```
/ (Home)
    ├── /scan               ← Core feature: transaction scanner
    │       ├── Paste mode  ← User pastes base64 or raw transaction
    │       └── Wallet mode ← Simulate via connected Phantom wallet (devnet)
    │
    ├── /result/:id         ← Risk result detail page (shareable link)
    │
    ├── /docs               ← SDK documentation (quickstart, API reference)
    │       ├── /docs/quickstart
    │       ├── /docs/api-reference
    │       └── /docs/risk-flags
    │
    ├── /playground         ← Interactive SDK playground (dev audience)
    │
    └── /about              ← What TxGuardian is, persona, roadmap
```

### 2.2 Page-level IA

---

#### `/` — Home

**Purpose:** Communicate the product clearly in under 5 seconds; funnel users to /scan.

**Content blocks:**
1. **Hero** — One-sentence value prop + primary CTA ("Check a transaction →")
2. **Problem statement** — "Before you sign, do you really know what's happening?" with one real attack scenario (intent-vs-outcome mismatch / "simulation spoofing")
3. **How it works** — 3 steps: Paste transaction → We analyze → You decide
4. **Risk example** — Static (not animated — performance) mock result card showing a danger-level transaction with flags and plain-English explanation
5. **SDK callout** — "Building on Solana? Embed TxGuardian in your dApp" → /docs
6. **Footer** — Links to /docs, GitHub, /about

---

#### `/scan` — Transaction Scanner

**Purpose:** Core product experience — the primary user journey.

**Layout:** Single focused view, no sidebar, minimal navigation.

**States and content:**

| State | Content |
|---|---|
| Empty | Input area (paste textarea + wallet connect option), mode toggle (Fast / Full), scan CTA, fixture buttons (Try a sample) |
| Analyzing | Loading skeleton — "Simulating transaction…", "Running risk checks…", "Generating explanation…" (only the third step shows in Full mode) |
| Result — Safe | Green badge, score, flags list (empty or low), explanation, "Safe to proceed" recommendation |
| Result — Caution | Yellow badge, score, flagged items with descriptions, explanation, "Review carefully" |
| Result — Danger | Red badge, score, high-severity flags highlighted, explanation, "Do not sign — here's why" |
| Error | Clear error message with recovery action (retry, check RPC, check format) |

**Mode toggle (Fast / Full):**
- **Fast** — Rule engine only. No simulation, no LLM. Sub-200ms response. Good default for scanning many txs.
- **Full** — Rules + simulation + AI explanation. ~1–2s response. Used in the demo and `/playground`.

**UI components in the result view:**
- **Risk badge** — Large, color-coded (green/yellow/red), with score 0-100, stable icon per state
- **Flags list** — Card-based, each flag shows: icon, label, severity chip, one-sentence description, expandable detail
- **AI explanation box** — Plaintext, readable at a glance, no jargon (full mode only)
- **Recommendation bar** — Sticky bottom bar: action label + "Continue anyway" (ghost button) + "Reject" (primary button)
- **Raw data toggle** — Collapsible: shows raw simulation output and decoded instruction list for developer users

---

#### `/result/:id` — Shareable Result

**Purpose:** Allow users to share a scan result link (e.g. in Discord/X to warn others about a contract).

**Content:** Same result view as /scan result state, minus the input. Read-only. Includes share button, copy link, and social share (X/Twitter).

Storage: result objects keyed by deterministic hash of the transaction bytes — same tx always resolves to same `:id`, naturally dedupes.

---

#### `/docs` — SDK Documentation

**Purpose:** Developer onboarding — reduce time-to-integrate to under 10 minutes.

**Content:**
- **Quickstart** — Install, initialize, call `analyze()`, handle result (code snippet, <20 lines)
- **API Reference** — Full `AnalyzeOptions`, `TxRiskResult`, `TxRiskFlag` type docs
- **Risk Flags Reference** — Table of all flag IDs (active + roadmap), severity levels, what triggers them, and how to handle each
- **Integration examples** — Next.js (App Router), plain React, wallet adapter pattern

---

#### `/playground` — Developer Playground

**Purpose:** Live interactive demo of the SDK for technical visitors.

**Content:**
- Sample transaction selector (dropdown of pre-loaded risky / safe transaction fixtures)
- Mode toggle (fast / full)
- Model toggle (Haiku 4.5 / Sonnet 4.6) for showing AI quality differences
- Live JSON output of `TxRiskResult`
- Code panel showing the exact `analyze()` call used
- "Deploy your own" CTA → Vercel one-click deploy

---

#### `/about` — Product Context

**Purpose:** Build trust; show product thinking; useful for judges and accelerator reviewers.

**Content:**
- Problem context (Solana phishing stats, simulation spoofing research link)
- Persona story — "Omar the DeFi Grinder" (user persona, informal)
- Architecture overview (SDK + App diagram)
- Roadmap: Now (web app + SDK), Next (wallet browser extension), Later (dApp SDK embeddable widget + enterprise API)
- Team / builder info

---

### 2.3 Navigation structure

**Primary nav (desktop):** Logo | Scan | Docs | Playground | About | [GitHub icon] | [Connect Wallet]

**Mobile nav:** Bottom tab bar — Scan · Docs · About · GitHub

**Sticky bottom bar on /scan result:** Recommendation + action buttons (always visible above fold on mobile)

---

### 2.4 Data flow (end-to-end)

```
User (browser)
    │  pastes base64 tx or connects wallet
    ▼
Next.js Frontend (/scan)
    │  POST /api/analyze  { transaction, mode, publicKey? }
    ▼
Next.js API Route (Vercel serverless function)
    │  - Reads RPC_URL (Helius or QuickNode dev key) from env
    │  - Reads ANTHROPIC_API_KEY from env (full mode only)
    │  - Calls SDK: analyze(options)
    │      └── Parser → Rule Engine → Scorer → (AI Explainer if full mode)
    │                                              └── Vercel AI SDK
    │                                                  generateObject() + Zod
    │                                                  → explanation, recommendation,
    │                                                    whatThisDoes
    │  - Cache layer: result keyed by sha256(transactionBytes + mode)
    │      → repeat scans of the same tx return cached result, no LLM call
    ▼
TxRiskResult (JSON)
    │  returned to frontend
    ▼
Result UI (risk badge, flags, explanation, recommendation bar)
```

**RPC + dependencies note:**
- Free public RPCs (`api.mainnet-beta.solana.com`) rate-limit aggressively and will break the demo. **Helius or QuickNode dev keys are required**, configured via `RPC_URL` in `.env.local`.
- ALT fetches and `simulateTransaction` are the two RPC-heavy operations. Cache ALT lookups in-memory per request.
- `simulateTransaction` is called with `{ replaceRecentBlockhash: true, sigVerify: false }` so demo fixtures don't need valid signatures.

---

### 2.5 Component inventory

| Component | Where used | Purpose |
|---|---|---|
| `RiskBadge` | /scan, /result | Color-coded risk level + score + stable icon |
| `FlagCard` | /scan, /result | Individual risk flag with severity + description |
| `ExplanationBox` | /scan, /result | LLM plain-text explanation |
| `RecommendationBar` | /scan | Sticky action bar — sign / reject |
| `TxInput` | /scan | Textarea for paste mode (monospace) |
| `WalletButton` | Nav, /scan | Phantom wallet connect |
| `RiskSkeleton` | /scan (loading) | Skeleton matching result layout |
| `CodeBlock` | /docs, /playground | Syntax-highlighted code snippets |
| `RiskFlagsTable` | /docs | Full flag reference table |
| `SampleTxPicker` | /scan, /playground | Buttons for pre-loaded fixture transactions |

---

## Part 3 — Risk Flags Reference

These are the flags grounded in known Solana attack patterns. Not all ship in the hackathon MVP — scope was cut deliberately to keep 48h achievable solo while preserving the SDK's flag schema for v1.

### Shipping at MVP (5 active rules)

| Flag ID | Severity | Tier | What it detects |
|---|---|---|---|
| `KNOWN_DRAINER_PROGRAM` | High | 1 | Program address matches known wallet drainer blocklist. Hardcoded set sourced from public security disclosures. |
| `FULL_TOKEN_APPROVAL` | High | 1 | Token approval covers entire wallet balance (`amount = u64::MAX`) or `SetAuthority(AccountOwner)`. Checks **both** SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) and Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`). Includes suspicious delegation as a sub-case. |
| `UNKNOWN_PROGRAM` | Medium | 1 | Inverse allowlist: instruction targets a program not in `KNOWN_PROGRAMS` (System, Token, Token-2022, ATA, Memo, ComputeBudget, Stake, Jupiter v6, Orca, Raydium, Marinade, Drift, Kamino, Tensor, MagicEden). |
| `MULTI_INSTRUCTION_COMPLEXITY` | Medium | 1 | 5+ non-ComputeBudget instructions — hard for a user to verify visually. |
| `SIMULATION_SPOOF` | High | 2 | Static instruction stream contains SPL `Transfer`/`TransferChecked`/`Approve` to a non-signer, but `simulateTransaction` returns empty/zero token balance deltas for the signer. Framed as **intent–outcome mismatch flagging**, not silver-bullet spoof detection — false positives possible (conditional branches, deeper reverts). |

### Bonus (if time permits)

| Flag ID | Severity | Effort | What it detects |
|---|---|---|---|
| `UNUSUAL_FEE` | Low | 1–2h | Priority fee unusually high relative to a hardcoded median by tx type. Adds visible breadth to the UI; low-signal but cheap. |

### Documented for v1 (schema present, detection deferred)

| Flag ID | Severity | Why deferred |
|---|---|---|
| `TOCTOU_PATTERN` | Medium | Detecting clock-sensitive instructions reliably requires per-program decoders that don't exist generically. SDK exposes the flag schema; runtime detection ships in v1. |

The MVP scope intentionally drops `SUSPICIOUS_ACCOUNT_DELEGATION` as a standalone rule — it's folded into `FULL_TOKEN_APPROVAL` as a sub-case (delegation to a non-program account triggers the same flag). One less rule file, no loss of coverage.

---

## Part 4 — Roadmap (for pitch / /about page)

| Phase | Scope | Timeline |
|---|---|---|
| **MVP (Hackathon)** | Web app + SDK package, **5 active risk flags + 2 documented**, AI translator (Haiku 4.5), Vercel deploy | May 9–11 2026 |
| **v1 — Extension** | Phantom-compatible browser extension that shows TxGuardian inline in the signing popup. Activates `TOCTOU_PATTERN` runtime detection. | Post-hackathon |
| **v2 — Embed SDK** | `<TxGuardianWidget />` React component for dApps to embed pre-sign risk checks | Month 2–3 |
| **v3 — Enterprise API** | REST API for wallets, custodians, and exchanges — rate-limited, authenticated, SLA | Month 4–6 |
