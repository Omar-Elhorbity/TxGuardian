/**
 * Content script (ISOLATED world). Two responsibilities:
 *
 *   1. Inject src/page.ts into the page DOM as a <script> tag with
 *      chrome.runtime.getURL("page.js"). Chrome runs script tags
 *      appended to the page in MAIN world automatically — guaranteed
 *      MAIN-world execution with the extension's URL as the base.
 *
 *   2. Bridge messages between the page (window.postMessage) and the
 *      service worker (chrome.runtime.sendMessage).
 *
 * Runs at document_start so the page script is injected before any of
 * the dApp's own scripts execute.
 */

import {
  isExtensionMessage,
  MSG_NAMESPACE,
  type AnalyzeRequest,
  type AnalyzeResponse,
} from "./types";

console.debug("[TxGuardian] content-script bridge active");

// --- 1. Inject the page script into MAIN world ------------------------------

(function injectPageScript(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page.js");
  script.type = "text/javascript";
  // Run as soon as it's parsed; remove from DOM after to keep it tidy.
  // The script's effects (event listeners, patches) persist.
  script.onload = () => script.remove();
  script.onerror = (err) =>
    console.error("[TxGuardian] failed to inject page.js", err);

  // Append to documentElement (not body — body may not exist yet at
  // document_start) so it runs immediately.
  (document.head || document.documentElement).prepend(script);
})();

// --- 2. Message bridge ------------------------------------------------------

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
