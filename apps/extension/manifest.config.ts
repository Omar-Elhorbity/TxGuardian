import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

/**
 * MV3 manifest.
 *
 * Architecture:
 *   - src/content.ts (ISOLATED world content_script): bridges page <->
 *     service worker AND injects src/page.ts via a <script> tag with
 *     chrome.runtime.getURL(). Chrome runs the resulting script in
 *     MAIN world automatically (because it's appended to the page DOM
 *     as a regular script element).
 *
 *   - src/page.ts: NOT a content_script. It's a web-accessible asset
 *     that runs in MAIN world via the script tag injected by content.ts.
 *     Self-contained — no value imports — so it builds to a single file
 *     with no chunk splitting.
 *
 *   - src/background.ts: service worker, calls /api/analyze.
 *
 *   - src/popup.html + src/popup.ts: action popup. Lets the user
 *     override the analyzer endpoint and run a connectivity check.
 *
 * This avoids the @crxjs/vite-plugin world: "MAIN" content_script bug
 * where the auto-generated loader's dynamic import resolves against the
 * dApp's URL (not the extension's), 404s, and silently fails.
 */
export default defineManifest({
  manifest_version: 3,
  name: "TxGuardian — Solana transaction safety",
  version: pkg.version,
  description:
    "Pre-sign safety verdict for every Solana transaction your wallet is about to sign. Deterministic checks, plain-English explanation.",
  homepage_url: "https://tx-guardian-web.vercel.app",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
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
      js: ["src/content.ts"],
      run_at: "document_start",
      all_frames: true,
    },
  ],
  web_accessible_resources: [
    {
      resources: ["page.js"],
      matches: ["<all_urls>"],
    },
  ],
  action: {
    default_title: "TxGuardian",
    default_popup: "src/popup.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },
});
