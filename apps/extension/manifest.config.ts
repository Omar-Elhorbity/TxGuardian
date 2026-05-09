import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

/**
 * MV3 manifest for the TxGuardian extension.
 *
 * Two content scripts:
 *   - src/page.ts (world: "MAIN"): patches window.phantom.solana and the
 *     Wallet Standard registration event in the page's own JS context.
 *     Cannot use chrome.* APIs.
 *   - src/content.ts (world: "ISOLATED"): bridges page <-> service worker
 *     via window.postMessage and chrome.runtime.sendMessage.
 *
 * host_permissions covers the analyze endpoint (default: localhost:3000).
 * Update the URL when you deploy and rebuild.
 */
export default defineManifest({
  manifest_version: 3,
  name: "TxGuardian",
  version: pkg.version,
  description:
    "Pre-sign safety verdict for Solana transactions. Inspects what your wallet is about to sign.",
  permissions: ["storage"],
  host_permissions: [
    "http://localhost:3000/*",
    "https://*.vercel.app/*",
    "https://api.devnet.solana.com/*",
    "https://api.mainnet-beta.solana.com/*",
  ],
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/page.ts"],
      run_at: "document_start",
      world: "MAIN",
      all_frames: true,
    },
    {
      matches: ["<all_urls>"],
      js: ["src/content.ts"],
      run_at: "document_start",
      world: "ISOLATED",
      all_frames: true,
    },
  ],
  action: {
    default_title: "TxGuardian",
  },
});
