/**
 * Shared constants used by both the service worker and the popup. Kept in
 * its own file so importing into the popup doesn't drag in service-worker
 * side effects (event listener registrations).
 */

// ─── Canonical site ─────────────────────────────────────────────────────

/** Canonical hosted site (used for the install/onboarding tab + popup links). */
export const HOSTED_SITE_URL = "https://tx-guardian-web.vercel.app";

// ─── RPC config ─────────────────────────────────────────────────────────

/**
 * Default Solana RPC. Devnet is the safe default because the on-chain
 * registry is on devnet and most TxGuardian-relevant dApps users explore
 * initially are devnet-based. Users can override to a mainnet RPC
 * (Helius / QuickNode / Triton / Alchemy / etc) via the popup.
 */
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

/** chrome.storage.local key holding the user-configured RPC URL. */
export const STORAGE_KEY_RPC = "rpcUrl";

// ─── LLM translator config (optional, user's own key) ───────────────────

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

/** Selected LLM model. Locked to Gemini for v1; future-proof. */
export const STORAGE_KEY_LLM_MODEL = "llmModel";
export const DEFAULT_LLM_MODEL = "gemini-2.5-flash";

// ─── First-run / what's-new flag ────────────────────────────────────────

/**
 * When set to `true`, the popup shows a one-time welcome panel. Set by
 * the service worker on first install. Cleared when the user dismisses
 * the panel.
 */
export const STORAGE_KEY_SHOW_WELCOME = "showWelcomePanel";
