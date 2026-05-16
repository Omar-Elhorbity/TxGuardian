/**
 * Service worker. Receives analyze requests from content scripts, forwards
 * them to the TxGuardian /api/analyze endpoint, returns the verdict.
 *
 * The fetch happens here (not in the content script) for two reasons:
 *   1. Service workers in MV3 with host_permissions can fetch any declared
 *      URL without CORS restrictions — we don't have to add CORS headers
 *      to /api/analyze.
 *   2. Centralizing API access lets us add caching, rate limiting, or
 *      auth headers in one place later.
 *
 * The analyzer endpoint can be overridden by the user via the popup
 * (chrome.storage.local key "analyzeEndpoint"). When unset we fall back
 * to DEFAULT_ANALYZE_ENDPOINT, the official hosted instance.
 */

import {
  MSG_NAMESPACE,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type TxRiskResultLike,
} from "./types";
import {
  DEFAULT_ANALYZE_ENDPOINT,
  HOSTED_SITE_URL,
  STORAGE_KEY_ENDPOINT,
} from "./config";

/** Mode passed to the API. "full" = simulation + on-chain registry + AI translator. */
const ANALYZE_MODE: "fast" | "full" = "full";

console.log("[TxGuardian] service worker booted");

// Open the install/onboarding page on first install. Updates are silent.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: `${HOSTED_SITE_URL}/extension` });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    typeof message !== "object" ||
    message === null ||
    (message as { ns?: unknown }).ns !== MSG_NAMESPACE
  ) {
    return false;
  }
  const req = message as AnalyzeRequest;
  if (req.type !== "ANALYZE_REQUEST") return false;

  // Async response; return true to keep the channel open.
  void handleAnalyze(req).then((res) => sendResponse(res));
  return true;
});

async function resolveEndpoint(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_ENDPOINT);
    const value = stored[STORAGE_KEY_ENDPOINT];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // Fall through to default — never block analysis on storage failure.
  }
  return DEFAULT_ANALYZE_ENDPOINT;
}

async function handleAnalyze(
  req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  const endpoint = await resolveEndpoint();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: req.base64,
        mode: ANALYZE_MODE,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      return {
        type: "ANALYZE_RESPONSE",
        ns: MSG_NAMESPACE,
        id: req.id,
        ok: false,
        error:
          (json as { error?: string } | null)?.error ??
          `Analyzer returned HTTP ${res.status}`,
      };
    }
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: true,
      result: json as TxRiskResultLike,
    };
  } catch (err) {
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
