# Security notes

TxGuardian is a security tool. The codebase reflects that — every architectural choice has a defensive rationale. This document collects them in one place.

## Threat model

TxGuardian's job is to inspect *adversarial* inputs: transactions a user has been tricked into pasting or signing. Every byte we parse is treated as untrusted.

Scope:
- **In-scope:** transaction inputs, RPC responses, on-chain account data, on-chain string fields (memo, account labels), LLM outputs.
- **Out-of-scope:** the user's wallet (we never touch keys), the RPC provider's correctness (we use it but verify shape), the LLM provider's correctness (we constrain its output schema and never trust its claims about risk).

## Defensive principles

### 1. The SDK never signs or sends
The SDK has zero signing or sending paths. There is no wallet integration in the analyzer; the only wallet integration possible is read-only (pubkey only) on the future scanner UI. Compromising TxGuardian cannot move funds.

### 2. Deterministic verdict is always valid
The rule engine runs first. The LLM runs second, and only as a translator. An LLM failure (network, API key, rate limit, hallucination) returns the deterministic verdict with empty `explanation`/`whatThisDoes`. **An LLM cannot produce a wrong verdict**, only an unhelpful one.

The recommendation field is enum-locked to the deterministic riskLevel before the LLM runs — the LLM has no path to mutating it.

### 3. Untrusted input handling (W011)

Every stage validates before interpreting:

| Stage | Validation |
|---|---|
| API route | Body must be JSON, `transaction` must be a string of length 1–8192. Per-IP rate limit (30/10s). |
| Parser | Hard cap of 4096 bytes after base64 decode (real Solana txs ≤ 1232). Tolerates URL-safe base64. Rejects empty or oversized. Decode errors caught, rethrown as `ParseError` — no raw web3.js stack leaks. |
| ALT resolution | Per-table errors swallowed individually; `altResolved=false` flag surfaces the partial state. Rules degrade gracefully. |
| Decoder | `noUncheckedIndexedAccess` enforces handling of out-of-bounds account indices in malformed input. Each instruction decoder tolerates short data. |
| Memo handling | **Memo content is never quoted in summaries.** The memo program's data is utf-8 controlled by the transaction author; quoting it verbatim would be a prompt-injection vector into the LLM and a social-engineering vector into the user. We surface byte length only. |
| LLM input | Pre-decoded instruction summaries only — never raw bytes, never raw account labels. Decoder strips memo content before this step. |
| LLM output | Zod-locked schema with `.max()` length caps on every string. Schema does NOT include `recommendation` — the LLM can't produce one even if it tried. |
| API response | `jsonSafe()` recursively converts BigInts (in evidence) and Uint8Arrays so `JSON.stringify` cannot crash on adversarially-crafted evidence. |

### 4. Defense in depth around the LLM

- **System prompt** explicitly forbids inventing risks, mentioning programs not in the input, or quoting user-controlled text verbatim.
- **Schema** caps string lengths and array sizes — even if the model ignored the prompt, output is bounded.
- **Recommendation locked** before LLM runs.
- **Cache** keyed by deterministic inputs only — no LLM-generated content participates in the cache key.
- **Temperature 0.2** for stability and reproducibility across demo retries.

### 5. Server-only secrets

`RPC_URL` and `GOOGLE_GENERATIVE_AI_API_KEY` are read only in:
- `apps/web/lib/rpc.ts`
- `apps/web/app/api/analyze/route.ts`
- `apps/web/app/api/fixtures/route.ts`
- `packages/sdk/src/explain.ts` (server-only — the file imports `@ai-sdk/google`, do not import from client components)

These never appear in client bundles. If you import any of these from a client component, the build will fail or the secret will leak — verify before deploying.

### 6. Drainer blocklist — two-tier feed

The drainer flag has two data sources:

**Hardcoded (`constants.ts` `KNOWN_DRAINERS`)** — intentionally short. Every entry must include a verifiable public source citation. An empty list is better than an unsourced one — false positives on the drainer flag would erode user trust in the most-severe verdict.

**On-chain (`txguardian_registry` Anchor program, devnet)** — anyone can submit a flag; an admin keypair (multisig in v1) confirms or revokes; the SDK reads confirmed entries via `getProgramAccounts` with a memcmp filter at the `status` byte offset. The drainer rule consults both sources and tags `evidence.source` with `"hardcoded"` or `"onchain"`.

Threats specific to the on-chain feed:
- **Spam submissions** — anyone can pay the rent for a pending attestation. Mitigation: pending entries are NEVER read by the SDK. Only `confirmed` status (set by admin) flows into rule output.
- **Admin compromise** — current MVP uses a single admin keypair. If compromised, an attacker could attest false-positives or revoke real drainers. Mitigation in v1: multisig, with rotation via the existing `update_admin` instruction.
- **Untrusted reason text** — submitters can put any 64-byte string in the `reason` field. The reason is **never** quoted into LLM prompts (it's not in flag descriptions, only in evidence). The `/registry` UI labels it as user-controlled. Do not act on a reason field as authoritative.
- **RPC tampering** — a malicious RPC could lie about which attestations exist. Mitigation: clients should pin to a trusted RPC provider (Helius, QuickNode) and document the program ID; future v1 versions could add Merkle-proof verification.

### 7. Demo fixtures are safe

Demo transactions in `apps/web/lib/fixtures.ts`:
- Use deterministic Keypair seeds (`Uint8Array(32).fill(N)`) so no real keys are involved.
- Are serialized with `requireAllSignatures: false, verifySignatures: false`.
- Are never sent on-chain — they exist purely to exercise the analyzer.

## Reporting

For real security issues, please open a private security advisory on the repo (post-hackathon when the repo is public).

## Hackathon scope caveats

A few things are explicitly v1+ work, not MVP:
- `TOCTOU_PATTERN` is documented in the schema but not actively detected. Generic detection requires per-program decoders; runtime detection ships when the browser extension lands.
- `SIMULATION_SPOOF` is a **static intent check**, not a sim-vs-intent diff. The honest framing is "verify the destination matches what your wallet shows" — we surface the intent, the user verifies. A future version can pre-fetch token accounts and re-simulate to compute true balance deltas.
- The drainer blocklist is empty by design at MVP — see "Drainer blocklist" above.
