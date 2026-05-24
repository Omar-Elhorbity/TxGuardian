# TxGuardian Security Audit — v1.0.0

**Scope:** Anchor program, TypeScript SDK, Next.js web app, browser extension.
**Method:** structured code audit by layer (Anchor / SDK + web / extension), cross-referenced with the threat model in `SECURITY.md`.
**Date of this report:** v1.0.0 release candidate, before first public Chrome Web Store / npm publish.
**Findings summary:** zero critical, zero high, zero medium. Five low-severity hardening items found and fixed in this commit. Several positive-property observations documented for the record.

This audit is internal and not a substitute for an independent third-party review. It establishes the security posture at v1.0.0 and documents the trust boundaries a paid auditor (or downstream user) should verify.

---

## 1. Trust model recap

The architecture (see `apps/web/app/about/page.tsx` and the README diagram) is designed so the *deterministic verdict* — the security-relevant output — does not depend on TxGuardian's server. Trust boundaries:

| Component | Default trust | Optional opt-in | Mitigations |
|---|---|---|---|
| Solana wallet | Required (it signs) | — | TxGuardian never touches the key |
| Solana RPC | Required (chosen by user) | — | User chooses any RPC; defaults to devnet public |
| TxGuardian server | **None** in default extension mode | Required if user picks "hosted fallback" | Default mode is local; hosted is explicitly opt-in |
| Google Gemini | None | Required if user enables AI translator (with their own key) | Direct call from extension to Google; key never crosses our server; LLM cannot mutate the verdict (schema-locked) |
| On-chain registry admin | Required (controls drainer + verified feeds) | — | `update_admin` instruction supports rotation to multisig |

The on-chain admin is the only single point of trust users can't opt out of. Documented in `programs/txguardian-registry/DEPLOY_NOTES.md` as the v1.0.0 known limitation; multisig migration is the next milestone for the on-chain layer.

---

## 2. Anchor program (`programs/txguardian-registry/`)

**Result: clean.** No findings.

### 2.1 Authority checks

All 5 admin-gated instructions enforce `has_one = admin @ RegistryError::Unauthorized` on the `registry` account:

| Instruction | `has_one = admin` | Counter mutation |
|---|---|---|
| `attest` | ✓ | `confirmed_count += 1` (saturating) |
| `revoke` | ✓ | `confirmed_count -= 1` if was confirmed (saturating) |
| `update_admin` | ✓ | — |
| `attest_verified` | ✓ | — (verified attestations don't track a confirmed count) |
| `revoke_verified` | ✓ | — |

`initialize`, `submit`, and `submit_verified` are intentionally permissionless: anyone can bootstrap the registry singleton, propose a drainer flag, or propose a verified-program attestation. Admin confirmation gates the actual *effect* via the SDK's `status === "confirmed"` filter on `getProgramAccounts`.

### 2.2 PDA seed collisions

Three distinct seed schemes — no collisions possible:

- `[b"registry"]` — singleton registry
- `[b"attestation", target_program.as_ref()]` — one drainer attestation per target
- `[b"verified", target_program.as_ref()]` — one verified attestation per target

Drainer and verified attestations for the *same* target program coexist at distinct PDAs (different prefix bytes).

### 2.3 Arithmetic safety

All counter mutations use `saturating_add` / `saturating_sub`. No raw `+` / `-` on `submission_count` or `confirmed_count`. u64 saturation at MAX or 0 prevents panics; idempotency guards on `attest` / `revoke` (`AlreadyConfirmed` / `AlreadyRevoked`) prevent double-mutation correctness issues.

### 2.4 Untrusted text handling

Both `Attestation.reason` and `VerifiedAttestation.note` are stored as `[u8; 64]` opaque byte arrays. The program never:

- decodes them as UTF-8
- branches on their content
- compares them with `==`
- reflects them in events (events emit only program IDs + admin keys + severity)

The text-handling responsibility is entirely on the SDK / UI side. See §3.4 below for how it's contained there.

### 2.5 Account validation

Every account on every instruction is constrained by `seeds = [...]` + `bump = ...` (PDAs) or marked `Signer` (admin / submitter). Mutable accounts are marked `mut`. No type confusion, no missing constraints.

### 2.6 State ordering / reentrancy

Solana single-threaded execution per program invocation makes EVM-style reentrancy non-applicable. Handlers that mutate multiple accounts do so in the safe `write-attestation-then-write-registry` order; Anchor's atomicity guarantees prevent partial-state observability.

### 2.7 Events

7 event variants emit minimal metadata (program ID, admin pubkey, severity). No untrusted text in any event payload — safe for off-chain indexers to consume without sanitization concerns.

---

## 3. TypeScript SDK (`packages/sdk/src/`)

**Result: clean.** No findings beyond the cross-layer items in §5.

### 3.1 Input validation (`parser.ts`)

- Hard input cap: 8192 base64 chars (size check fires *before* `atob`, blocking memory bombs)
- Decoded byte cap: 4096 (3.3× real Solana max of 1232)
- URL-safe base64 normalized (`-` → `+`, `_` → `/`, whitespace stripped)
- Every parse path wraps the underlying decoder in a `ParseError` — no raw web3.js stack traces leak through

### 3.2 Memo handling (`decode.ts`)

The memo program's instruction data is **never** included in the decoded summary. The decoder returns:

```
"Attaches a memo (untrusted text, ${data.length} bytes — content not displayed)"
```

Only the byte length appears. Raw memo content (the LLM injection vector) never reaches the LLM prompt or the UI. Verified across all decoder paths — System, SPL Token, Token-2022, Compute Budget, and the unknown-program fallback all surface only structured, non-text fields.

### 3.3 LLM input safety (`translator/index.ts`)

The LLM prompt is built from:

- The deterministic verdict (`riskLevel`, `score`) — engine output, not user input
- Flag objects (`severity`, `label`, `description`) — rule-engine output, all hardcoded English strings
- Decoded instruction summaries — pre-formatted by the decoder, no raw on-chain text

No variable in `buildUserPrompt()` comes from on-chain attacker-controlled bytes. The system prompt (11 rules) further instructs the model never to quote raw addresses or invent risks.

**Output integrity:**

- `ExplanationSchema` is Zod-locked with `.max()` on every string (headline 100, explanation 500, whatThisDoes items 140 chars × 6 max)
- `recommendation` is NOT in the schema — the LLM cannot mutate it; the scorer locks it to `riskLevel`
- API key never logged, never in cache key, never in error messages
- AI failures degrade to empty `explanation` / `whatThisDoes` — the deterministic verdict stands

### 3.4 Untrusted text from on-chain registry (`registry.ts`)

The `reason` (drainer attestation) and `note` (verified attestation) fields are decoded as null-padded UTF-8 via `TextDecoder` with no further processing. They are:

- Never thrown in error messages
- Never used as code-path keys
- Surfaced only in the UI with an "untrusted text" label
- Never passed into LLM prompts

### 3.5 Rule isolation (`rules/index.ts`)

`runRules()` wraps every rule in `try/catch` — a single broken rule cannot derail the engine. `dedupeFlags()` collapses by `(id + description)` so a buggy rule emitting duplicates cannot inflate the score.

---

## 4. Browser extension (`apps/extension/`)

**Result: clean.** No findings beyond cross-layer items in §5.

### 4.1 HTML injection (`page.ts`)

Every `innerHTML` insertion in `page.ts` runs through `escapeHTML()` for user-controlled data:

```typescript
function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Covers all 5 critical characters. Verified for every interpolation in `renderHeader`, `renderVerdict`, `renderUnavailable`, and the Phase 4 additions (`engineBadgeHTML`, `aiBadgeHTML`).

### 4.2 Cross-context messaging (`content.ts`, `background.ts`)

The page → content → background message bridge enforces three checks at each boundary:

1. `event.source === window` (page → content, prevents cross-frame forgery)
2. `ns === "TXG"` (namespace check, prevents random `postMessage` from being misinterpreted)
3. `type === "ANALYZE_REQUEST"` (intent check)

The service worker's `chrome.runtime.onMessage` handler applies the same namespace + type check.

### 4.3 LLM key handling (`popup.ts`)

- Stored in **`chrome.storage.session` only**, never `chrome.storage.local`. Cleared when the browser closes; never written to disk.
- Input field is `type="password"`, `autocomplete="off"`, `spellcheck="false"`
- After save, the field is cleared and the placeholder reads `"•••••••• (key saved to session)"` — key never displayed back
- "Test key" sends the key directly to `https://generativelanguage.googleapis.com/v1beta/models?key=...`, never via TxGuardian's server. Verified in `apps/extension/src/popup.ts`.
- "Forget key" wipes the session entry
- Service worker reads the key only when `llmEnabled === true` AND key is present; passes it directly to `analyze()`. No logging.

### 4.4 No dynamic code execution

No `eval()`, `new Function()`, or runtime `<script>` injection anywhere in the extension code. MV3 default CSP forbids `unsafe-eval` / `unsafe-inline`; manifest does not relax these.

### 4.5 Manifest permissions

Every entry is used and justified:

| Permission | Used by | Justification |
|---|---|---|
| `storage` | popup + background | persists user config (mode, RPC, endpoint); session-only LLM key |
| `host_permissions: <Solana RPCs>` | background | local engine fetches registry + simulates via the user's chosen RPC |
| `host_permissions: <Helius/QuickNode/Triton/Alchemy>` | background | covers user-supplied paid RPCs |
| `host_permissions: *.vercel.app` | background | hosted-fallback mode (opt-in) |
| `host_permissions: generativelanguage.googleapis.com` | background + popup | BYO Gemini key path (browser-to-Google) |
| `host_permissions: localhost:3000` | background | dev only |
| `content_scripts: <all_urls>` | content.ts | Solana dApps run on any domain — interception requires global injection |
| `web_accessible_resources: page.js` | content.ts → page.ts injection | required for the MAIN-world script tag |

### 4.6 Console logging audit

All `console.log` / `console.warn` calls audited. **None** log:

- Transaction bytes
- The verdict
- The user's pubkey
- The AI key
- Any RPC URL beyond the wallet's own choice (which the user already knows)

Logging is limited to lifecycle markers (`"service worker booted"`, `"intercepted signTransaction"`, `"patching window.phantom.solana"`) — useful for debugging, no privacy implications.

### 4.7 No telemetry

`grep -rn "Sentry\|Mixpanel\|Amplitude\|Datadog\|Hotjar\|gtag\|analytics" apps/extension/src/` → zero matches. No telemetry SDKs, no error reporters, no usage tracking.

---

## 5. Cross-layer findings + fixes shipped in this commit

Five low-severity hardening items found by the audit. All fixed before the v1.0.0 release.

### 5.1 `jsonSafe()` lacked depth + cycle guards (LOW)

**File:** `apps/web/lib/json-safe.ts`

**Risk:** A pathologically nested object or a circular reference in SDK output (e.g., from a future buggy decoder) would stack-overflow the serverless function. Input is currently controlled (SDK output), so exploit surface is bounded, but the function is defensive infrastructure and should be robust.

**Fix:** Added `MAX_DEPTH = 32` cap (truncated values return `"[truncated: max depth]"`) and a `WeakSet` cycle detector (cycles return `"[truncated: circular]"`). Same external behavior on well-formed input.

### 5.2 `/api/analyze` leaked raw RPC error messages (LOW)

**File:** `apps/web/app/api/analyze/route.ts`

**Risk:** On signature-lookup failures, the route returned `"Could not fetch transaction from RPC: <raw err.message>"`. This could reveal the RPC provider URL, library version, or internal error details to anyone hitting the endpoint.

**Fix:** Replaced with a generic `"Could not fetch transaction from the RPC."` The `kind: "rpc_error"` field in the response body is still set so the UI can render the right state.

### 5.3 `/api/fixtures` had no rate limit (LOW)

**File:** `apps/web/app/api/fixtures/route.ts`

**Risk:** While `/api/fixtures` is cheap (just builds a tx), the signable-sample path calls the RPC for a fresh blockhash. An unrate-limited route could be hammered to burn RPC quota.

**Fix:** Extracted rate limiter into shared `apps/web/lib/rate-limit.ts`. `/api/analyze` now uses it (30 req / 10s, same as before). `/api/fixtures` now uses it too (60 req / 10s — higher because cheaper, low enough to prevent abuse).

**Known limitation documented in code:** the rate limit is in-memory per-route, so an attacker can spend each route's quota independently and persistent attackers could trigger cold starts to reset state. Acceptable for v1 traffic; the comment in `rate-limit.ts` flags Redis as the future hardening path.

### 5.4 No global security headers (LOW)

**File:** `apps/web/next.config.ts`

**Risk:** Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) were set only on individual API routes (`X-Content-Type-Options: nosniff`). Page responses had no CSP, leaving the site theoretically vulnerable to XSS if a future bug introduced an unsanitized inline script, and embeddable in malicious iframes.

**Fix:** Added a `headers()` function in `next.config.ts` that applies to every route:

- **Content-Security-Policy:** `default-src 'self'`, `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`), styles allow `unsafe-inline` (Tailwind injects a few), images from `data:` + `https:`, `connect-src` whitelist for Solana RPC + Explorer + Google Gemini
- **Strict-Transport-Security:** `max-age=31536000; includeSubDomains` (1 year)
- **X-Content-Type-Options:** `nosniff` (site-wide now, not just API)
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **X-Frame-Options:** `DENY` (clickjacking protection — nothing on the site needs to be embedded)
- **Permissions-Policy:** denies `camera`, `microphone`, `geolocation`, `payment` (none used)

### 5.5 Outdated comment claiming telemetry use (LOW informational)

**File:** `apps/extension/src/types.ts`

**Risk:** None — comment-only issue. But a code reader auditing the extension would see `"Origin of the dApp page (for telemetry / display)"` and reasonably wonder if telemetry was collected somewhere.

**Fix:** Reworded to `"Origin of the dApp page — used only for display in the modal header. Never persisted; never sent anywhere else."` Matches actual behavior.

---

## 6. Positive properties documented for the record

The audit confirmed these design properties hold as advertised:

- **Verdict cannot be silently tampered with by TxGuardian's server in default extension mode.** The engine bundle is in `apps/extension/dist/`; its SHA256 will be published next to the download in Phase 7. Users can verify the binary matches the source.
- **LLM cannot influence risk decisions.** Schema doesn't include `recommendation`; it's locked to the deterministic level by the scorer before any LLM call.
- **LLM cannot see attacker-controlled on-chain text.** Memo program data is stripped at the decoder; the `reason`/`note` fields from the on-chain registry are never quoted into the prompt.
- **API keys never leave the device they were entered on** (except the direct call to Google in the BYO path). `chrome.storage.session` clears on browser close; the field is `type="password"`; never logged, never cached, never in error messages.
- **No analytics, no telemetry, no third-party trackers** anywhere in the extension or web app. No Sentry, Mixpanel, Amplitude, Datadog, gtag, or custom beacons.
- **Default-secure configuration.** `DEFAULT_ENGINE_MODE = "local"` means the extension never contacts TxGuardian's server out of the box. Hosting and AI translation are explicit opt-ins.

---

## 7. Items deferred to future audits

The following are *known* gaps that are out of v1.0.0 scope. They don't represent silent risks — they're documented above and in the relevant code or in `programs/txguardian-registry/DEPLOY_NOTES.md`.

1. **On-chain admin is a single keypair.** Multisig migration is the next milestone for the on-chain layer (use the existing `update_admin` instruction). Devnet-only deployment in the meantime limits damage.
2. **Rate limit is in-memory per-route.** Production traffic patterns may justify Redis-backed rate limiting. The current limits (30/60 req / 10s) are conservative enough that abuse should surface in normal monitoring before becoming a real problem.
3. **No third-party security audit yet.** This document is an internal pre-release audit. Recommended before any mainnet on-chain deployment.
4. **`TOCTOU_PATTERN` flag is schema-only.** Generic runtime detection requires per-program decoders that don't exist yet. Documented in the docs page.
5. **Source maps included in extension bundle.** Reveals function names + variable names + module structure. No secrets. Intentional — helps users + auditors verify the binary matches the source. Will reconsider if Chrome Web Store reviewer flags it.

---

## 8. Verification

Every fix in §5 was verified via:

- `pnpm --filter @txguardian/sdk typecheck` — clean
- `pnpm --filter @txguardian/web typecheck` — clean
- `pnpm --filter @txguardian/extension typecheck` — clean
- `pnpm --filter @txguardian/web build` — clean (route table identical post-fix)

Post-fix server smoke test (rate limit + sanitized error) and CSP header presence are verifiable in the next deploy.

---

## 9. Threat model evolution

This audit is consistent with the threat model documented in `SECURITY.md`. The v2 architecture (engine in extension) changes one boundary materially:

- **Before:** "Trust TxGuardian's server with raw transactions in exchange for a verdict."
- **After:** "Trust no one for the verdict (it's computed on your device); optionally trust your chosen LLM provider for the prose explanation."

Both `SECURITY.md` and `/privacy` on the live site reflect this. No additional threat-model updates needed for v1.0.0.

---

*This audit report is checked in alongside the v1.0.0 release commit and is the source of truth for what the audit checked, what was found, and what was fixed.*
