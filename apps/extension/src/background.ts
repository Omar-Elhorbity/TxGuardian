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
 */

import {
  MSG_NAMESPACE,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type TxRiskResultLike,
} from "./types";

/**
 * Where to send analyze requests. Defaults to the local Next.js dev server.
 *
 * To point at your deployed instance:
 *   1. Edit this constant
 *   2. Make sure manifest.config.ts host_permissions includes the new host
 *   3. Rebuild the extension (`pnpm --filter @txguardian/extension build`)
 *   4. Reload the unpacked extension in chrome://extensions
 */
const ANALYZE_ENDPOINT = "http://localhost:3000/api/analyze";

/** Mode passed to the API. "full" = simulation + on-chain registry + AI translator. */
const ANALYZE_MODE: "fast" | "full" = "full";

console.debug("[TxGuardian] service worker booted, endpoint:", ANALYZE_ENDPOINT);

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

async function handleAnalyze(
  req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  try {
    const res = await fetch(ANALYZE_ENDPOINT, {
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
