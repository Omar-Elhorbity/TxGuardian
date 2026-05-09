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
