/**
 * Content script (ISOLATED world). Bridges page context (window.postMessage)
 * and the service worker (chrome.runtime.sendMessage).
 *
 * Runs at document_start so messages from the page-injected script are
 * caught from the first signing attempt.
 */

import {
  isExtensionMessage,
  MSG_NAMESPACE,
  type AnalyzeRequest,
  type AnalyzeResponse,
} from "./types";

console.debug("[TxGuardian] content-script bridge active");

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isExtensionMessage(event.data)) return;
  const msg = event.data;
  if (msg.type !== "ANALYZE_REQUEST") return;

  const req = msg as AnalyzeRequest;
  let response: AnalyzeResponse;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "ANALYZE_REQUEST",
      ns: MSG_NAMESPACE,
      id: req.id,
      base64: req.base64,
      origin: req.origin,
    });
    response = result as AnalyzeResponse;
    // chrome.runtime.sendMessage can return undefined if the worker is
    // dead; surface that as an explicit failure so page.ts shows the
    // 'unavailable' modal.
    if (!response) {
      response = {
        type: "ANALYZE_RESPONSE",
        ns: MSG_NAMESPACE,
        id: req.id,
        ok: false,
        error: "Service worker did not respond.",
      };
    }
  } catch (err) {
    response = {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  window.postMessage(response, window.location.origin);
});
