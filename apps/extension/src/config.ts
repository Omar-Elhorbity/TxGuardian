/**
 * Shared constants used by both the service worker and the popup. Kept in
 * its own file so importing into the popup doesn't drag in service-worker
 * side effects (event listener registrations).
 */

// ─── Canonical site ─────────────────────────────────────────────────────

/** Canonical hosted site (used for the install/onboarding tab + popup links). */
export const HOSTED_SITE_URL = "https://tx-guardian-web.vercel.app";

// ─── Engine mode (local vs hosted fallback) ─────────────────────────────

/**
 * Engine modes:
 *  - `local`  — default. The deterministic engine runs inside the service
 *               worker. TxGuardian's server is never contacted; verdicts
 *               compute on the user's device against their configured RPC.
 *  - `hosted` — optional fallback. Posts the transaction to TxGuardian's
 *               hosted /api/analyze for users who don't want to bring an
 *               RPC of their own. Pre-Phase-2 default; now opt-in.
 */
export type EngineMode = "local" | "hosted";
export const DEFAULT_ENGINE_MODE: EngineMode = "local";

/** chrome.storage.local key holding the user-selected engine mode. */
export const STORAGE_KEY_MODE = "engineMode";

// ─── RPC config (local-mode only) ───────────────────────────────────────

/**
 * Default Solana RPC for local-mode analysis. Devnet is the safe default
 * because the on-chain registry is on devnet and most TxGuardian-relevant
 * dApps users explore initially are devnet-based. Users can override to a
 * mainnet RPC (Helius / QuickNode / Triton / Alchemy / etc) via the popup.
 */
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

/** chrome.storage.local key holding the user-configured RPC URL. */
export const STORAGE_KEY_RPC = "rpcUrl";

// ─── Hosted-fallback config (only used when mode === "hosted") ──────────

/**
 * Hosted analyzer endpoint. Active only when mode is set to "hosted" in
 * the popup. Self-hosters can point at their own deployment.
 */
export const DEFAULT_ANALYZE_ENDPOINT =
  "https://tx-guardian-web.vercel.app/api/analyze";

/** chrome.storage.local key holding the user-configured analyzer URL. */
export const STORAGE_KEY_ENDPOINT = "analyzeEndpoint";

// ─── LLM translator config (Phase 3 — scaffolded here for forward-compat) ──

/**
 * Whether the AI translator is enabled. Defaults to false — the
 * deterministic verdict alone is the security signal; AI prose is
 * decorative.
 */
export const STORAGE_KEY_LLM_ENABLED = "llmEnabled";

/**
 * User-supplied Gemini API key. **Stored only in `chrome.storage.session`,
 * never in `chrome.storage.local`.** Session storage is cleared when the
 * browser closes; this is intentional — we never want a key to persist
 * to disk in plaintext.
 */
export const STORAGE_KEY_LLM_KEY = "llmKey";

/** Selected LLM model. Locked to Gemini for v1 per the plan; future-proof. */
export const STORAGE_KEY_LLM_MODEL = "llmModel";
export const DEFAULT_LLM_MODEL = "gemini-2.5-flash";
