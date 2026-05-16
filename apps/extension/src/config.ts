/**
 * Shared constants used by both the service worker and the popup. Kept in
 * its own file so importing into the popup doesn't drag in service-worker
 * side effects (event listener registrations).
 */

/**
 * Hosted production analyzer. Self-hosters can point at their own deployment
 * via the popup's endpoint override.
 */
export const DEFAULT_ANALYZE_ENDPOINT =
  "https://tx-guardian-web.vercel.app/api/analyze";

/** chrome.storage.local key holding the user-configured endpoint URL. */
export const STORAGE_KEY_ENDPOINT = "analyzeEndpoint";

/** Canonical hosted site (used for the install/onboarding tab + popup links). */
export const HOSTED_SITE_URL = "https://tx-guardian-web.vercel.app";
