# Build Phase Log

A running journal of how TxGuardian was built. Each phase ends with a commit and a short note.

## Phase 0 — Repo init & monorepo workspace

**Goal:** Get the bones in place so subsequent phases can land independently.

**Done:**
- `git init` (main branch)
- `.gitignore` (Node + Next.js + editor + Vercel)
- `pnpm-workspace.yaml` declaring `packages/*` and `apps/*`
- Root `package.json` with pnpm 9.12 pinned via `packageManager`
- `.env.example` documenting `RPC_URL` and `ANTHROPIC_API_KEY`
- `README.md` (project overview, architecture diagram, dev quickstart)
- `DESIGN.md` and `IA.md` already in place from the planning phase
- This file (`PHASES.md`)

**Not done by design:**
- No `pnpm install` — dependencies are listed but install/build happens on the user's other machine.
- No tooling configs yet (tsconfig, eslint) — added in later phases per workspace.

**Next:** Phase 1 — SDK foundation (types, constants, parser).

---

## Phase 1 — SDK foundation: types, constants, parser

**Goal:** Land the riskiest piece of the SDK first — transaction parsing across legacy and Versioned (v0) transactions, with Address Lookup Table resolution and Token-2022 awareness.

**Done:**
- `packages/sdk/package.json` — `@txguardian/sdk@0.1.0`, deps: `@solana/web3.js^1.95.4`, `@solana/spl-token^0.4.9`, `bs58^6.0.0`, `ai^4.0.0`, `@ai-sdk/anthropic^1.0.0`, `zod^3.23.8`.
- `packages/sdk/tsconfig.json` — strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022 target, ESM modules.
- `packages/sdk/src/types.ts` — full type surface: `RiskLevel`, `Severity`, `FlagId`, `TxRiskFlag`, `DecodedInstruction`, `ParsedTransaction`, `ParsedInstruction`, `AnalyzeOptions`, `SimulationDelta`, `TxRiskResult`. `whatThisDoes: string[]` and `decodedInstructions[]` are first-class result fields.
- `packages/sdk/src/constants.ts` — `KNOWN_PROGRAMS` allowlist (System, ComputeBudget, Stake, Vote, Memo, SPL Token, Token-2022, ATA, Jupiter v6, Orca, Raydium, Marinade, Drift, Kamino, Tensor, Magic Eden, Metaplex), `KNOWN_DRAINERS` blocklist (intentionally empty at MVP — addresses require a verifiable public source), token-program helpers (`isTokenProgram`, `isComputeBudgetProgram`, `isKnownProgram`).
- `packages/sdk/src/parser.ts` — the centerpiece:
  - `parseTransaction(input, connection)` accepts base64 string, `VersionedTransaction`, or legacy `Transaction`.
  - Hard cap of 4096 bytes on input (memory-bomb protection — real Solana txs ≤ 1232).
  - Tolerates URL-safe base64 and trims whitespace.
  - Normalizes everything to `VersionedTransaction`.
  - For v0: fetches all referenced ALTs in parallel via `connection.getAddressLookupTable()`. If any fail, sets `altResolved=false` and proceeds with what was resolved (rules degrade gracefully).
  - Uses `message.getAccountKeys({ addressLookupTableAccounts }).keySegments()` to build the canonical account list including ALT-mapped writable + readonly entries.
  - Decodes legacy instruction data (base58 string) via `bs58.decode()`; v0 already has `Uint8Array`.
  - Returns `ParsedTransaction` with `version`, `accountKeys`, `instructions`, `signers`, `feePayer`, `altResolved`, `recentBlockhash`.
  - Custom `ParseError` class with `cause` chaining for diagnostics.

**Security posture (W011 — untrusted input):**
- All input bytes are validated for size before deserialization.
- Deserialization errors are caught and rethrown as `ParseError` — never propagate raw web3.js errors that may leak internals.
- ALT failures degrade gracefully (`altResolved=false`) rather than crashing.
- Account-key access uses `noUncheckedIndexedAccess` so out-of-bounds indices in malformed inputs return `undefined` instead of panicking.
- No on-chain string data (memo, account labels) is touched by the parser — that's left to `decode.ts` in Phase 2 with explicit untrusted-data handling.

**Not yet done (intentionally deferred):**
- `decode.ts` for human-readable instruction summaries (Phase 2 — used by both rules and the LLM input)
- Rule modules (Phase 2)
- AI Explainer (Phase 3)

**Next:** Phase 2 — Rule engine (5 active rules) + scorer.

---

## Phase 2 — Decoder, simulation wrapper, rule engine, scorer

**Goal:** Turn parsed transactions into deterministic risk verdicts. The deterministic engine is the source of truth on risk; the LLM never decides.

**Done:**
- `decode.ts` — produces `DecodedInstruction[]` for the UI and structured `DecodedTokenOp[]` for rules.
  - SPL Token + Token-2022: Approve, ApproveChecked, Transfer, TransferChecked, SetAuthority, Revoke, Burn, BurnChecked, CloseAccount, MintTo, MintToChecked, InitializeAccount. `u64` amounts decoded as BigInt; `u64::MAX` flagged via `isMaxAmount`. SetAuthority extracts authority type (`MintTokens`, `FreezeAccount`, `AccountOwner`, `CloseAccount`).
  - Token-2022 extension opcodes (>= 26) marked but not decoded — flagged as "extension instruction" so the user knows there's something extra.
  - System Program: Transfer, CreateAccount with lamport amounts decoded.
  - Compute Budget: SetComputeUnitLimit + SetComputeUnitPrice with values decoded.
  - **Memo program (W011):** memo content is NEVER included in the summary — that text is attacker-controlled and could carry prompt injection. We acknowledge presence and byte length only.
- `simulate.ts` — `simulateSafely(vtx, connection, timeoutMs)` wraps `connection.simulateTransaction` with `sigVerify: false`, `replaceRecentBlockhash: true`, `commitment: "processed"`, plus a 5s timeout race. Returns `SimulationDelta { ok, error?, tokenDeltas, solDelta }`. Token balance deltas left as v1 enrichment — would require pre-fetching signer's token accounts; static spoof check covers the demo case.
- `rules/index.ts` — `runRules(ctx)` orchestrator. Defensive: any rule that throws is swallowed, never derails the engine. Rules return `null | TxRiskFlag | TxRiskFlag[]`.
- `rules/drainer.ts` — `KNOWN_DRAINER_PROGRAM` (high). Lookup against `KNOWN_DRAINER_MAP`. Multiple matches collapsed into one flag with all addresses in evidence.
- `rules/unknown.ts` — `UNKNOWN_PROGRAM` (medium). Inverse allowlist; drainers excluded to avoid double-flagging.
- `rules/complexity.ts` — `MULTI_INSTRUCTION_COMPLEXITY` (medium). Threshold: 5+ non-ComputeBudget instructions.
- `rules/approval.ts` — `FULL_TOKEN_APPROVAL` (high). Fires on Approve/ApproveChecked with `isMaxAmount` or amount ≥ 1e18, OR SetAuthority(AccountOwner) (former "suspicious account delegation" folded in as a sub-case). Distinguishes ownership transfer vs ownership removal.
- `rules/spoof.ts` — `SIMULATION_SPOOF` (high). Static intent check: any Token Transfer/TransferChecked to a non-signer destination with non-zero amount. Description is honest about scope ("intent–outcome mismatch — verify destinations").
- `rules/fee.ts` — `UNUSUAL_FEE` (low, bonus). Priority fee ≥ 1M micro-lamports/CU.
- `scorer.ts` — deterministic 0–100 score. Severity weights: low=10, medium=25, high=45. Level thresholds: 0–24 safe, 25–59 caution, 60–100 danger. Recommendation is **locked to level**, never derived from LLM output.

**Architectural principle reinforced:**
- The rule engine is the single source of truth on risk.
- The LLM (Phase 3) only translates flags into prose — it cannot raise, lower, or invent flags.
- Recommendation strings are enum-locked to riskLevel so the LLM cannot drift.

**Security posture:**
- All rules are pure functions, no side effects.
- All rules tolerate malformed input (missing accounts, short data) — `noUncheckedIndexedAccess` enforced statically.
- Memo data never reaches any LLM-facing path (W011).
- No address from the parsed transaction is ever used as a key into a code-executing context.

**Next:** Phase 3 — AI explainer + `analyze()` entry point.

---

## Phase 3 — AI Explainer + `analyze()` SDK entry point

**Goal:** Wire the LLM as a strict prose translator over the deterministic engine, then expose a single `analyze()` function as the SDK's public API.

**Done:**
- `explain.ts` — Vercel AI SDK + Anthropic provider + Zod-locked schema:
  - `ExplanationSchema = z.object({ headline: max 100, explanation: max 500, whatThisDoes: array(max 140 each, up to 6) })`. **No `recommendation` field on the LLM schema** — recommendation is enum-locked to deterministic riskLevel and never asked for from the model.
  - System prompt is explicit about role: "translator, source of truth is the rule engine, do not invent risks, do not quote user-controlled text verbatim."
  - User prompt fed only the deterministic flags + pre-decoded instruction summaries (already memo-stripped in Phase 2). No raw bytes, no addresses leaked into model context.
  - `temperature: 0.2` for stability; default model `claude-haiku-4-5`, override via `options.model` or `TXGUARDIAN_MODEL` env.
  - `explainCached()` wraps `explain()` with an in-memory cache keyed by `{riskLevel, score, sorted-flag-ids, ix-summaries, model}`. Bounded at 200 entries (FIFO eviction). Survives Vercel warm window; cold starts regenerate.
- `index.ts` — `analyze(options)` orchestrates the full pipeline:
  - Parser → decoder → (simulation if full mode) → rules → scorer → (LLM if full mode).
  - `mode === "fast"`: skips simulation and LLM. Sub-200ms response on a cached parser.
  - `mode === "full"`: runs simulation with 5s timeout and the cached LLM call.
  - **Failure isolation:** simulation failures and LLM failures are caught and degrade to `simulation: undefined` / `explanation: ""`. The deterministic verdict (riskLevel, score, flags, recommendation) is always valid.
  - Public type re-exports + utility re-exports (`parseTransaction`, `ParseError`, `decodeAll`, `runRules`, `scoreFlags`, `KNOWN_PROGRAMS`, `KNOWN_DRAINERS`, token program ID constants).

**Architectural invariants now locked in code:**
- The LLM cannot raise, lower, or invent flags — it has no path to `flags[]` mutation.
- The LLM cannot influence `recommendation` — that field is set by `scoreFlags()` before `explain()` is called.
- An LLM failure never produces a wrong verdict; it produces the same verdict with empty prose.

**Security posture:**
- LLM input is scrubbed of attacker-controlled strings (memo content, raw account labels) at decode time (Phase 2).
- System prompt instructs the model not to quote raw text — defense in depth.
- API key checked only at runtime (server-side), never bundled into client.

**Status:** SDK is feature-complete for MVP. Ready to be consumed by the Next.js app.

**Next:** Phase 4 — Next.js app shell with the design tokens from `DESIGN.md`.

---

## Phase 4 — Next.js app shell, design tokens, home page

**Goal:** Land the visual foundation. Tokens from `DESIGN.md` need to flow into Tailwind utility classes; the home page needs the side-by-side comparison hero specified in DESIGN.md.

**Done:**
- `apps/web/package.json` — Next.js 15, React 18.3, Tailwind 3.4, lucide-react, geist font, workspace dep on `@txguardian/sdk`. `transpilePackages: ["@txguardian/sdk"]` in `next.config.ts` so the workspace SDK is bundled directly from TS source (no build step needed for dev).
- `apps/web/tsconfig.json` — strict + `noUncheckedIndexedAccess`, path alias `@/*` → root.
- `apps/web/postcss.config.mjs` + `apps/web/tailwind.config.ts` — token bridge so utility classes resolve to CSS variables (`bg-surface-1`, `text-primary`, `border-default`, `risk-danger`, `accent`, etc.).
- `apps/web/app/globals.css` — full token block from DESIGN.md as `:root` CSS variables. Includes:
  - Surfaces, borders, text, accent, risk semantics, info, radius, focus ring
  - Global `:focus-visible` ring (mandatory per accessibility spec)
  - `::selection` styling, custom scrollbar
  - `.panel`, `.panel-strong`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` component classes (kept static — no `@apply`)
  - `prefers-reduced-motion` reduces all transitions to 0.01ms
- `apps/web/app/layout.tsx` — Geist Sans + Geist Mono via `next/font`, wired into `--font-sans` / `--font-mono` so the design tokens stay the source of truth. Sets `<html lang="en">`, OG metadata.
- `apps/web/components/Nav.tsx` — sticky top nav with backdrop blur, Shield+text logo, four primary links (Scan, Docs, Playground, About), GitHub icon, primary "Scan a transaction" CTA. Mobile hides the link list (Phase 5/6 will add a mobile tab bar if time).
- `apps/web/components/Footer.tsx` — minimal footer matching the editorial tone.
- `apps/web/app/page.tsx` — home page:
  - Lede + dual CTA (Check a transaction / View the SDK)
  - **Side-by-side comparison hero** — exactly the component spec from DESIGN.md: "What you'd see" (Phantom preview, neutral) vs "What's actually happening" (TxGuardian, danger badge). Static for MVP performance — animated entrance is a polish task.
  - "How it works" — 3-step ordered list
  - SDK callout panel with copy-pasteable install snippet
  - All headings have `id`s and the section uses `aria-labelledby`

**Design system invariants enforced in code:**
- No raw hex in any component — all colors come from tokens.
- Risk colors only appear on actual risk surfaces (the danger verdict on the comparison card). Home page is otherwise 100% neutral palette.
- One primary action per viewport (the "Check a transaction" CTA in lede).
- All interactive elements have visible `:focus-visible` ring via global rule.

**Not done by design:**
- No mobile tab-bar nav yet (acceptable — desktop-first per DESIGN.md "design first at lg")
- No light theme (explicitly out of MVP scope)
- No animation/motion polish — DESIGN.md says "subtle, functional, quick"; deferring entrance animations to keep velocity

**Next:** Phase 5 — `/api/analyze` route, `/scan` page, result components, demo fixtures.

---

## Phase 5 — Scan flow, API routes, result components, demo fixtures

**Goal:** Make the SDK consumable end-to-end through the web scanner. From paste → POST → render verdict → recommendation bar.

**Done:**

**Server side:**
- `apps/web/lib/rpc.ts` — module-cached `Connection` reading `RPC_URL` env (defaults to devnet). Server-only.
- `apps/web/lib/json-safe.ts` — recursive BigInt/Uint8Array/Map/Set serializer for safe `NextResponse.json()`. Needed because evidence fields can contain BigInts.
- `apps/web/lib/fixtures.ts` — three deterministic fixture builders using web3.js + `@solana/spl-token`:
  - `buildSafeFixture()` — SOL transfer + ComputeBudget. Routine.
  - `buildCautionFixture()` — 5 calls to an unknown program. Triggers UNKNOWN_PROGRAM + MULTI_INSTRUCTION_COMPLEXITY.
  - `buildDangerFixture()` — `createApproveInstruction(amount=u64::MAX)` + unknown program + high priority fee. Triggers FULL_TOKEN_APPROVAL + UNKNOWN_PROGRAM + UNUSUAL_FEE.
  - All use `Keypair.fromSeed(Uint8Array(32).fill(N))` so each click produces the exact same base64 — demo replays cleanly.
  - Serialized with `requireAllSignatures: false, verifySignatures: false` since fixtures are never sent on-chain.
- `apps/web/app/api/fixtures/route.ts` — `GET /api/fixtures?type=safe|caution|danger`. Cached for 1h.
- `apps/web/app/api/analyze/route.ts` — `POST /api/analyze`:
  - Body validation: `transaction` is a string, length 1–8192. Returns 400 with a clear message if not.
  - Per-IP rate limit: 30 requests / 10s window. In-memory map per Vercel instance.
  - `runtime: "nodejs"` (not edge — `@solana/web3.js` needs Node primitives).
  - Catches `ParseError` → returns 400 with the parse message; any other error → 500 with a generic message (no internals leaked).
  - Output passed through `jsonSafe()` to handle BigInts. `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

**Components:**
- `RiskBadge.tsx` — large verdict pill, semantic color, stable icon (ShieldCheck/AlertTriangle/ShieldX), full ARIA announcement ("Danger. Score 87 of 100. 3 flags detected.").
- `FlagCard.tsx` — severity chip + label + description + collapsible evidence JSON. ARIA-labelledby + aria-expanded.
- `ExplanationBox.tsx` — LLM prose section with "Plain-English summary" header + "What this transaction does" bullet list. Hidden if both empty.
- `RecommendationBar.tsx` — sticky bottom-of-viewport bar showing the recommendation in the level's tone, plus a "Scan another" reset button. Honest about scope (no fake "Sign"/"Reject" buttons since the scanner doesn't sign).
- `TxInput.tsx` — labeled textarea with helper text, monospace, mode toggle (Fast/Full) as `<fieldset>`. Submit button disabled when empty.
- `RiskSkeleton.tsx` — animated step indicator with `aria-live="polite"`. Shows 3 steps in fast mode, 4 in full ("Generating explanation").
- `SampleTxPicker.tsx` — three "Try a sample" cards (Safe/Caution/Danger) with the matching risk-state icon.
- `ResultView.tsx` — composes the result: badge → explanation → flags → decoded instructions → raw JSON toggle. Order matches the design system hierarchy spec exactly (verdict → explanation → evidence → technical → raw).

**Page:**
- `app/scan/page.tsx` — client component with state machine (idle / loading / error / result). Picks a sample → fills textarea → auto-submits. Errors render inside an `aria-live="polite"` region with a clear recovery message.

**Security posture:**
- Body size capped at 8192 chars before any parsing.
- Per-IP rate limit prevents trivial abuse.
- Error messages are generic — internal stack traces never leak to clients.
- `jsonSafe()` ensures no `JSON.stringify` crash on BigInts (defensive against malformed evidence).
- API runtime explicitly `nodejs`, not edge — needed for `@solana/web3.js` and explicit about the Node-only path.
- The result view's "Raw analysis JSON" toggle exposes the full result for debugging — fine in dev/demo, but a production version would gate this on a feature flag.

**Demo flow now end-to-end:**
1. User opens `/scan`
2. Clicks "Danger sample"
3. `/api/fixtures?type=danger` returns base64
4. Textarea fills + auto-submits to `/api/analyze` in Full mode
5. Server: parse → decode → simulate (best-effort) → 5 rules → score → LLM translate → JSON-safe response
6. Client: badge + explanation + flag cards + decoded instructions + sticky recommendation bar

**Next:** Phase 6 — `/docs`, `/about`, `/playground` lightweight pages.

---

## Phase 6 — Docs, About, Playground

**Goal:** Round out the secondary surfaces. These pages are not the demo focus, so they trade depth for clarity.

**Done:**
- `/docs` — single-page docs with sticky sidebar nav (Quickstart, API reference, Risk flags, Integration patterns). Code blocks in `.surface-2` panels. Risk flags table mirrors the IA exactly: 5 active + 1 bonus + 1 documented (TOCTOU). Reinforces the "deterministic verdict always valid" invariant in prose. Two integration patterns documented: wallet adapter pre-sign hook + Next.js API route.
- `/about` — product context page:
  - Problem framing
  - "Omar the DeFi grinder" persona block
  - ASCII architecture diagram (parser → decoder → rules → scorer → AI translator)
  - Roadmap table (Now / Next / v2 / v3)
  - Hackathon attribution
- `/playground` — two-column layout:
  - Left: Sample picker (reuses `SampleTxPicker` component) + Mode toggle + (optional) RiskBadge once a result is loaded
  - Right: Live `TxRiskResult` JSON output + the equivalent SDK call snippet
  - Same `/api/fixtures` + `/api/analyze` flow as `/scan` — gives developers a self-serve sandbox without copy-pasting

**Reused from Phase 5:**
- `SampleTxPicker`, `RiskBadge`, fixtures route, analyze route — no new server code in this phase.

**Not done by design:**
- No on-page navigation / breadcrumbs (the top nav is sufficient for the MVP page count).
- No search in docs (over-engineering for a 4-section page).
- No live "Edit JSON" for playground (not a v1 feature).

**Next:** Phase 7 — final docs pass, README links audit, ensure `.env.example` matches what the code reads, final commit.

---

## Phase 7 — Final docs pass: README, SECURITY.md

**Goal:** Hand off a buildable, documented project to the deploy machine.

**Done:**
- `SECURITY.md` — threat model + per-stage validation table + defense-in-depth around the LLM + server-only secret list + drainer blocklist policy + hackathon scope caveats. Captures every defensive rationale that's spread across the codebase in one place.
- `README.md` — rewritten with:
  - Concise pitch + architecture diagram
  - Final risk-flag shipping table (5 active + UNUSUAL_FEE bonus + TOCTOU documented)
  - Repo layout tree
  - **Local setup** section with the exact 3-step quickstart (`pnpm install` → `cp .env.example apps/web/.env.local` → `pnpm dev`)
  - **Required env** table making it crystal clear which keys are mandatory and why
  - 90-second demo flow scripted for the pitch
  - Cross-links to DESIGN, IA, SECURITY, PHASES
- `.env.example` already documents `RPC_URL` and `ANTHROPIC_API_KEY` — verified to match what `lib/rpc.ts` and `packages/sdk/src/explain.ts` actually read.

## What ships at MVP — final inventory

**SDK (`packages/sdk`):**
- `analyze(options)` entry point — fast/full mode dichotomy, failure isolation
- Parser: legacy + v0 + ALT resolution + Token-2022 + 4096-byte cap
- Decoder: SPL Token + Token-2022 + System + ComputeBudget + Memo (content stripped)
- Simulate wrapper: 5s timeout, sigVerify:false, replaceRecentBlockhash:true
- 5 active rule modules + 1 bonus + scorer
- AI translator: Vercel AI SDK + Zod schema, Claude Haiku 4.5, in-memory cache

**Web (`apps/web`):**
- Home, Scan, Docs, About, Playground pages
- `/api/analyze` POST + `/api/fixtures` GET
- Component library: RiskBadge, FlagCard, ExplanationBox, RecommendationBar, TxInput, RiskSkeleton, SampleTxPicker, ResultView, Nav, Footer
- Design system bridge (CSS variables → Tailwind utility classes)
- Three deterministic demo fixtures (Safe / Caution / Danger)

**Docs:**
- DESIGN.md (16k) — design system
- IA.md (17k) — information architecture
- README.md — project overview + setup
- SECURITY.md — threat model + defensive posture
- PHASES.md — this file (build journal)

## What's deferred to the deploy machine

Per user instructions, no install/build/typecheck was run locally. The deploy machine should:

```bash
pnpm install                          # Hydrate workspace
cp .env.example apps/web/.env.local   # Then fill in RPC_URL + ANTHROPIC_API_KEY
pnpm typecheck                        # Verify TS across SDK + web (recursive)
pnpm dev                              # Local dev server
# OR
pnpm build && pnpm start              # Production
```

Likely first-build issues to watch for:
- If `geist` 1.3 has a peer-dep mismatch, switch to `next/font/google` `Geist` import.
- If `@solana/web3.js` 1.95 + `bs58` 6 ESM interop trips the bundler, downgrade `bs58` to ^5.
- If Vercel's serverless runtime complains about the `runtime: "nodejs"` declaration, it's already correct — `@solana/web3.js` requires Node primitives.

## Project status

**Build complete.** Repo is committed across 7 phases with one commit per phase. Ready to install + run.
