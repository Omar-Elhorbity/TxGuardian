# TxGuardian browser extension

Pre-sign verdict overlay for Solana wallets. Sits between Phantom and the dApp, intercepts every signing request, runs analysis through `/api/analyze`, shows a verdict modal, lets the user approve or reject before the wallet's own prompt appears.

Manifest V3, Chrome / Chromium-based browsers (Brave, Arc, Edge). Not published to the Chrome Web Store — install unpacked.

## Architecture

```
dApp page
  ↓ calls window.phantom.solana.signTransaction(tx)
  ↓
[ src/page.ts ]   ← runs in MAIN world at document_start
  ↓ patched method intercepts
  ↓ serializes tx → base64
  ↓ window.postMessage
  ↓
[ src/content.ts ] ← runs in ISOLATED world
  ↓ chrome.runtime.sendMessage
  ↓
[ src/background.ts ] ← service worker
  ↓ POST /api/analyze
  ↓ returns TxRiskResult
  ↓
[ src/content.ts ] → window.postMessage
[ src/page.ts ]    → showVerdictModal (Shadow DOM overlay)
  ↓ user clicks Approve or Reject
  ↓ Approve → calls original Phantom signTransaction → returns
  ↓ Reject  → throws { code: 4001 } → dApp sees standard rejection
```

Two patches cover all signing paths:

- **Direct Phantom API** — `window.phantom.solana.signTransaction` / `signAllTransactions` / `signAndSendTransaction` (and `window.solana.*` legacy alias)
- **Wallet Standard** — wraps every `solana:signTransaction` and `solana:signAndSendTransaction` feature on each registered wallet. Catches dApps using `@solana/wallet-adapter-react`.

## Install

1. Build the extension:

   ```bash
   pnpm install                                  # if you haven't already
   pnpm --filter @txguardian/extension build
   # → outputs to apps/extension/dist/
   ```

2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).

3. Toggle **Developer mode** on (top right).

4. Click **Load unpacked** → select `apps/extension/dist`.

5. The extension is now active on every page.

## Configuration

The extension hits `http://localhost:3000/api/analyze` by default. To point at your deployed instance:

1. Edit `apps/extension/src/background.ts`:

   ```ts
   const ANALYZE_ENDPOINT = "https://your-deployment.vercel.app/api/analyze";
   ```

2. Edit `apps/extension/manifest.config.ts` to add the host:

   ```ts
   host_permissions: [
     "https://your-deployment.vercel.app/*",
     // ... keep the others
   ],
   ```

3. Rebuild and reload:

   ```bash
   pnpm --filter @txguardian/extension build
   ```

   Then in `chrome://extensions` click the **reload** icon on the TxGuardian card.

## How to use

1. Open any dApp (Jupiter, Drift, etc. — use devnet versions).
2. Connect Phantom as normal.
3. Trigger a transaction (swap, stake, mint).
4. **The TxGuardian modal appears before Phantom's prompt** with the verdict.
5. **Approve** → Phantom's normal signing prompt opens (final confirmation).
6. **Reject** → dApp sees a standard `code: 4001` user-rejected error.

Both Approve and Reject leave Phantom in control of the actual signing — TxGuardian never touches keys.

## Development

```bash
pnpm --filter @txguardian/extension dev
# Vite watches src/ and rebuilds dist/ on change.
# In chrome://extensions, click reload on the TxGuardian card after each rebuild.
```

For end-to-end testing:

```bash
# Terminal 1: Next.js dev server (must be running for the extension's API calls)
pnpm dev

# Terminal 2: Extension dev build
pnpm --filter @txguardian/extension dev
```

Then visit any Solana dApp, trigger a transaction, observe the modal.

## Coverage notes

- **Phantom** — fully covered.
- **Solflare, Backpack, Glow, etc.** — covered via Wallet Standard interception.
- **Mobile browsers / Phantom in-app browser** — extensions don't run in mobile. No coverage.
- **dApps with strict CSP that block content scripts** — rare on Solana dApps but possible. The MV3 `world: "MAIN"` content script bypasses most CSPs.
- **Iframe signers** — covered via `all_frames: true` in the manifest.
- **`signAndSendTransaction` (Phantom shorthand)** — covered.

## Known limitations (v1)

- The endpoint URL is a build-time constant. v2 will add a popup for runtime configuration.
- No telemetry / aggregate stats. Each scan happens in isolation.
- Hardcoded to "full" mode — always runs simulation + on-chain registry + AI translator. Adds ~1–2s latency to every signing flow.
- The modal's "Approve" still routes through Phantom's own signing prompt, so users see two confirmation steps. By design — Phantom is the final keyholder.

## Bundle size

`pnpm --filter @txguardian/extension build` produces ~30 KB total (page.ts + content.ts + background.ts + modal.ts, minified). No React, no Solana SDK in the page bundle — only what's needed for serialization, messaging, and rendering.
