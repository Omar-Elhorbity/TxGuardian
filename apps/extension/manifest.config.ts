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
 *   - src/background.ts: LOCAL ENGINE HOST. Bundles @txguardian/sdk and
 *     runs the deterministic engine in the service worker. Hosted /api/
 *     analyze is an opt-in fallback only.
 *
 *   - src/popup.html + src/popup.ts: action popup. Manages engine mode
 *     (local vs hosted), RPC URL, and (Phase 3) the optional AI translator.
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
    "Pre-sign safety verdict for every Solana transaction your wallet is about to sign. Runs entirely on your device — your transactions stay in your browser.",
  homepage_url: "https://tx-guardian-web.vercel.app",
  icons: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  permissions: ["storage"],
  // host_permissions covers:
  //   1. Default Solana RPCs (devnet + mainnet + testnet) for local-mode
  //      simulation + on-chain registry lookups.
  //   2. Common third-party Solana RPC providers (Helius, QuickNode, Triton,
  //      Alchemy) — covers the 95% of users who'll override to a paid RPC.
  //   3. The hosted analyzer endpoint, used only when the user selects
  //      "hosted fallback" mode in the popup.
  //   4. localhost:3000 for local development against pnpm dev.
  //
  // Users who configure a custom RPC outside these patterns need to grant
  // permission at runtime via chrome.permissions.request() — handled in
  // Phase 4's popup UX work. For v2 launch the four families above cover
  // the realistic configuration space.
  host_permissions: [
    "http://localhost:3000/*",
    "https://api.devnet.solana.com/*",
    "https://api.testnet.solana.com/*",
    "https://api.mainnet-beta.solana.com/*",
    "https://*.helius-rpc.com/*",
    "https://*.quiknode.pro/*",
    "https://*.rpcpool.com/*",
    "https://*.alchemy.com/*",
    "https://*.vercel.app/*",
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
