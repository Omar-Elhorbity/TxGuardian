/**
 * Page-context script. Self-contained — no value imports — so it builds
 * to a single file. Loaded into MAIN world by the ISOLATED content script
 * via a <script src="chrome.runtime.getURL('page.js')"> tag.
 *
 * Patches every signing entry point we know about, BEFORE the dApp's
 * wallet adapter has bound any references.
 *
 * Signing flow when patched:
 *
 *   dApp → window.phantom.solana.signTransaction(tx)
 *           ↓
 *           our wrapper
 *           ↓
 *           serialize tx → request analysis (postMessage to content script)
 *           ↓
 *           await analysis result
 *           ↓
 *           show modal (Shadow DOM), await user click
 *           ↓
 *           if approve → call original signTransaction → return signature
 *           if reject → throw → dApp sees standard wallet rejection
 *
 * No chrome.* APIs available here. All cross-context comms via window.
 */

// ============================================================================
// Shared message envelope (inlined — keep in sync with src/types.ts)
// ============================================================================

const MSG_NAMESPACE = "TXG";

interface AnalyzeRequest {
  type: "ANALYZE_REQUEST";
  ns: typeof MSG_NAMESPACE;
  id: string;
  base64: string;
  origin: string;
}

interface AnalyzeResponse {
  type: "ANALYZE_RESPONSE";
  ns: typeof MSG_NAMESPACE;
  id: string;
  ok: boolean;
  result?: TxRiskResultLike;
  error?: string;
}

interface TxRiskResultLike {
  riskLevel: "safe" | "caution" | "danger";
  score: number;
  flags: Array<{
    id: string;
    severity: "low" | "medium" | "high";
    label: string;
    description: string;
    evidence?: Record<string, unknown>;
  }>;
  recommendation: "Safe to sign" | "Proceed with caution" | "Do not sign";
  explanation: string;
  whatThisDoes: string[];
  decodedInstructions: Array<{
    index: number;
    programId: string;
    programName: string;
    summary: string;
  }>;
  mode: "fast" | "full";
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isExtensionMessage(
  data: unknown,
): data is AnalyzeRequest | AnalyzeResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { ns?: unknown }).ns === MSG_NAMESPACE
  );
}

// ============================================================================
// Wallet provider patches
// ============================================================================

type AnyTx = unknown;

interface PhantomProvider {
  signTransaction?: (tx: AnyTx) => Promise<unknown>;
  signAllTransactions?: (txs: AnyTx[]) => Promise<unknown[]>;
  signAndSendTransaction?: (
    tx: AnyTx,
    opts?: unknown,
  ) => Promise<{ signature: string }>;
  __txgPatched?: boolean;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  }
}

console.log("[TxGuardian] page-context injection active");

// Window marker — type `window.__TXG_LOADED__` in DevTools console to
// verify the page script ran, without needing to see the log output.
(window as unknown as { __TXG_LOADED__?: boolean }).__TXG_LOADED__ = true;

function whenAvailable<T>(
  getter: () => T | undefined,
  cb: (value: T) => void,
  timeoutMs = 10_000,
): void {
  const start = Date.now();
  const tick = () => {
    const value = getter();
    if (value !== undefined) {
      cb(value);
      return;
    }
    if (Date.now() - start > timeoutMs) return;
    setTimeout(tick, 100);
  };
  tick();
}

function rejectionError(): Error {
  const err = new Error("User rejected the request via TxGuardian.");
  (err as Error & { code?: number }).code = 4001;
  return err;
}

function patchProvider(provider: PhantomProvider, label: string): void {
  if (provider.__txgPatched) return;
  provider.__txgPatched = true;
  console.log(`[TxGuardian] patching ${label}`);

  if (typeof provider.signTransaction === "function") {
    const orig = provider.signTransaction.bind(provider);
    provider.signTransaction = async (tx: AnyTx) => {
      console.log("[TxGuardian] intercepted signTransaction");
      const decision = await analyzeAndAwait([tx]);
      if (decision === "reject") throw rejectionError();
      return orig(tx);
    };
  }

  if (typeof provider.signAllTransactions === "function") {
    const orig = provider.signAllTransactions.bind(provider);
    provider.signAllTransactions = async (txs: AnyTx[]) => {
      console.log("[TxGuardian] intercepted signAllTransactions");
      const decision = await analyzeAndAwait(txs);
      if (decision === "reject") throw rejectionError();
      return orig(txs);
    };
  }

  if (typeof provider.signAndSendTransaction === "function") {
    const orig = provider.signAndSendTransaction.bind(provider);
    provider.signAndSendTransaction = async (tx: AnyTx, opts?: unknown) => {
      console.log("[TxGuardian] intercepted signAndSendTransaction");
      const decision = await analyzeAndAwait([tx]);
      if (decision === "reject") throw rejectionError();
      return orig(tx, opts);
    };
  }
}

whenAvailable(
  () => window.phantom?.solana,
  (provider) => patchProvider(provider, "window.phantom.solana"),
);
whenAvailable(
  () => window.solana,
  (provider) => patchProvider(provider, "window.solana"),
);

// ============================================================================
// Wallet Standard registration interception
// ============================================================================

interface WalletStandardWallet {
  features?: Record<string, unknown> & {
    "solana:signTransaction"?: {
      signTransaction: (...args: unknown[]) => Promise<unknown>;
    };
    "solana:signAndSendTransaction"?: {
      signAndSendTransaction: (...args: unknown[]) => Promise<unknown>;
    };
  };
  __txgPatched?: boolean;
}

function patchWalletStandard(wallet: WalletStandardWallet): void {
  if (wallet.__txgPatched || !wallet.features) return;
  wallet.__txgPatched = true;
  console.log(
    "[TxGuardian] patching wallet (Wallet Standard):",
    Object.keys(wallet.features),
  );

  const signFeature = wallet.features["solana:signTransaction"];
  if (signFeature?.signTransaction) {
    const orig = signFeature.signTransaction.bind(signFeature);
    signFeature.signTransaction = async (...args: unknown[]) => {
      const inputs = args[0] as Array<{ transaction?: Uint8Array }>;
      const txs = (inputs ?? [])
        .map((i) => i.transaction)
        .filter((t): t is Uint8Array => t instanceof Uint8Array);
      const decision = await analyzeAndAwait(txs);
      if (decision === "reject") throw rejectionError();
      return orig(...args);
    };
  }

  const sendFeature = wallet.features["solana:signAndSendTransaction"];
  if (sendFeature?.signAndSendTransaction) {
    const orig = sendFeature.signAndSendTransaction.bind(sendFeature);
    sendFeature.signAndSendTransaction = async (...args: unknown[]) => {
      const inputs = args[0] as Array<{ transaction?: Uint8Array }>;
      const txs = (inputs ?? [])
        .map((i) => i.transaction)
        .filter((t): t is Uint8Array => t instanceof Uint8Array);
      const decision = await analyzeAndAwait(txs);
      if (decision === "reject") throw rejectionError();
      return orig(...args);
    };
  }
}

const walletStandardApi = {
  register(wallet: WalletStandardWallet): () => void {
    patchWalletStandard(wallet);
    return () => {
      // No-op unregister.
    };
  },
};

window.addEventListener(
  "wallet-standard:register-wallet",
  (event) => {
    console.log("[TxGuardian] wallet-standard:register-wallet event");
    type RegisterEvent = CustomEvent<
      (api: typeof walletStandardApi) => void
    >;
    const { detail } = event as RegisterEvent;
    if (typeof detail !== "function") return;
    detail(walletStandardApi);
  },
  false,
);

window.dispatchEvent(
  new CustomEvent("wallet-standard:app-ready", {
    detail: walletStandardApi,
  }),
);
console.log("[TxGuardian] dispatched wallet-standard:app-ready");

// ============================================================================
// Analyze + show modal pipeline
// ============================================================================

type Decision = "approve" | "reject";

type ModalState =
  | { kind: "loading"; origin: string }
  | { kind: "verdict"; origin: string; verdict: TxRiskResultLike }
  | { kind: "unavailable"; origin: string };

async function analyzeAndAwait(txs: AnyTx[]): Promise<Decision> {
  if (txs.length === 0) return "approve";

  for (const tx of txs) {
    const base64 = await serializeAny(tx);
    if (!base64) {
      console.warn("[TxGuardian] could not serialize a tx; allowing through");
      continue;
    }

    // Show the loading modal immediately so the user knows we're holding
    // their signing request. The dApp's await is held while we work.
    const modal = openModal({ kind: "loading", origin: window.location.host });
    const verdict = await requestAnalysis(base64);

    // Update the same modal in place — no reflow / re-mount.
    if (!verdict) {
      modal.update({ kind: "unavailable", origin: window.location.host });
    } else {
      modal.update({
        kind: "verdict",
        origin: window.location.host,
        verdict,
      });
    }

    const decision = await modal.awaitDecision();
    if (decision === "reject") return "reject";
  }
  return "approve";
}

async function serializeAny(tx: AnyTx): Promise<string | null> {
  try {
    if (tx instanceof Uint8Array) return uint8ToB64(tx);
    const candidate = tx as {
      serialize?: (opts?: unknown) => Uint8Array | ArrayBufferLike;
    };
    if (typeof candidate.serialize !== "function") return null;
    let bytes: Uint8Array;
    try {
      bytes = candidate.serialize() as Uint8Array;
    } catch {
      bytes = candidate.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }) as Uint8Array;
    }
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    return uint8ToB64(bytes);
  } catch (err) {
    console.warn("[TxGuardian] serialize failed", err);
    return null;
  }
}

function uint8ToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return btoa(s);
}

function requestAnalysis(base64: string): Promise<TxRiskResultLike | null> {
  return new Promise((resolve) => {
    const id = newId();
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, 15_000);
    function onMessage(event: MessageEvent): void {
      if (event.source !== window) return;
      if (!isExtensionMessage(event.data)) return;
      const msg = event.data as AnalyzeResponse;
      if (msg.type !== "ANALYZE_RESPONSE" || msg.id !== id) return;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(msg.ok && msg.result ? msg.result : null);
    }
    window.addEventListener("message", onMessage);
    const req: AnalyzeRequest = {
      type: "ANALYZE_REQUEST",
      ns: MSG_NAMESPACE,
      id,
      base64,
      origin: window.location.origin,
    };
    window.postMessage(req, window.location.origin);
  });
}

// ============================================================================
// In-page modal (Shadow DOM, vanilla, no React)
// ============================================================================

const MODAL_HOST_ID = "txguardian-modal-host";

interface ModalHandle {
  /** Replace the modal contents in place without re-mounting. */
  update(state: ModalState): void;
  /** Promise that resolves when the user picks an action or dismisses. */
  awaitDecision(): Promise<Decision>;
}

/**
 * Opens an empty modal shell, returns a handle for updating its contents
 * and awaiting a user decision. The shell mounts immediately (slide-up
 * animation runs once) so subsequent .update() calls just swap the body.
 */
function openModal(initial: ModalState): ModalHandle {
  // Tear down any pre-existing modal (defensive — sequential awaits should
  // prevent re-entrancy, but rapid signing flows could race).
  document.getElementById(MODAL_HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = MODAL_HOST_ID;
  host.style.cssText =
    "all: initial; position: fixed; inset: 0; z-index: 2147483647;";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = MODAL_CSS;
  shadow.appendChild(style);

  const scrim = document.createElement("div");
  scrim.className = "scrim";
  shadow.appendChild(scrim);

  const cardSlot = document.createElement("div");
  cardSlot.className = "card-slot";
  scrim.appendChild(cardSlot);

  let resolveDecision: ((d: Decision) => void) | null = null;
  const decisionPromise = new Promise<Decision>((resolve) => {
    resolveDecision = resolve;
  });

  function decide(decision: Decision): void {
    if (!resolveDecision) return;
    const r = resolveDecision;
    resolveDecision = null;
    document.removeEventListener("keydown", onKey);
    // Slide-down animation before unmount
    scrim.classList.add("closing");
    setTimeout(() => {
      host.remove();
      r(decision);
    }, 140);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      decide("reject");
      return;
    }
    if (e.key === "Enter") {
      // Enter triggers the primary action of the current state. For loading,
      // ignore. For verdict/unavailable, primary depends on level.
      const primary = shadow.querySelector<HTMLButtonElement>(
        "[data-action='primary']",
      );
      if (primary && !primary.disabled) {
        e.preventDefault();
        e.stopPropagation();
        primary.click();
      }
    }
  }
  document.addEventListener("keydown", onKey);

  function rebind(): void {
    shadow
      .querySelector<HTMLButtonElement>("[data-action='approve']")
      ?.addEventListener("click", () => decide("approve"));
    shadow
      .querySelector<HTMLButtonElement>("[data-action='reject']")
      ?.addEventListener("click", () => decide("reject"));
    shadow
      .querySelector<HTMLButtonElement>("[data-action='close']")
      ?.addEventListener("click", () => decide("reject"));
    // Autofocus the safer default — Reject for verdict/unavailable; nothing
    // for loading.
    const focusTarget =
      shadow.querySelector<HTMLButtonElement>(
        "[data-action='reject']",
      ) ?? shadow.querySelector<HTMLButtonElement>("[data-action='close']");
    focusTarget?.focus();
  }

  function update(state: ModalState): void {
    cardSlot.innerHTML = renderCard(state);
    rebind();
  }

  update(initial);

  return {
    update,
    awaitDecision: () => decisionPromise,
  };
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function severityClass(s: "low" | "medium" | "high"): string {
  return `sev sev-${s}`;
}

function levelLabel(l: "safe" | "caution" | "danger"): string {
  return l === "safe" ? "Safe" : l === "caution" ? "Caution" : "Danger";
}

// Inline SVG icons — no asset deps. Stroke-style to match Lucide aesthetic.
const ICON_SHIELD_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
const ICON_ALERT_TRIANGLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const ICON_SHIELD_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/></svg>`;
const ICON_INFO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
const ICON_CHEVRON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

function levelIcon(l: "safe" | "caution" | "danger"): string {
  if (l === "safe") return ICON_SHIELD_CHECK;
  if (l === "caution") return ICON_ALERT_TRIANGLE;
  return ICON_SHIELD_X;
}

function renderCard(state: ModalState): string {
  switch (state.kind) {
    case "loading":
      return renderLoading(state.origin);
    case "verdict":
      return renderVerdict(state.origin, state.verdict);
    case "unavailable":
      return renderUnavailable(state.origin);
  }
}

function renderHeader(origin: string): string {
  return `
    <header>
      <div class="brand">
        <span class="dot"></span>
        <span class="brand-name">TxGuardian</span>
      </div>
      <div class="origin-chip" title="${escapeHTML(origin)}">${escapeHTML(origin)}</div>
      <button class="close" data-action="close" aria-label="Close">×</button>
    </header>`;
}

function renderLoading(origin: string): string {
  return `
    <div class="card loading-card" role="dialog" aria-modal="true" aria-busy="true" aria-label="Analyzing transaction">
      ${renderHeader(origin)}
      <div class="loading-body">
        <div class="loading-icon">${ICON_INFO}</div>
        <div class="loading-title">Analyzing transaction…</div>
        <div class="loading-subtitle">
          Running the rule engine, checking the on-chain registry, and translating to plain English.
        </div>
        <div class="progress">
          <div class="progress-bar"></div>
        </div>
      </div>
    </div>
  `;
}

function renderUnavailable(origin: string): string {
  return `
    <div class="card" role="dialog" aria-modal="true">
      ${renderHeader(origin)}
      <div class="verdict level-caution">
        <div class="verdict-icon">${ICON_ALERT_TRIANGLE}</div>
        <div class="verdict-text">
          <div class="verdict-label">Analyzer unavailable</div>
          <div class="verdict-meta">
            <span>Could not reach TxGuardian's analyzer.</span>
          </div>
        </div>
      </div>
      <div class="body">
        <p class="explanation">
          The wallet's own confirmation will still appear next. Proceed only if you trust this dApp and the transaction it's asking you to sign.
        </p>
      </div>
      <footer>
        <button class="btn primary" data-action="reject" data-action-also="primary">Reject</button>
        <button class="btn ghost" data-action="approve">Continue anyway</button>
      </footer>
    </div>
  `;
}

function renderVerdict(origin: string, v: TxRiskResultLike): string {
  const isDanger = v.riskLevel === "danger";
  const isSafe = v.riskLevel === "safe";

  // Action labels + visual hierarchy by risk level
  const approveLabel = isDanger ? "Sign anyway" : isSafe ? "Approve & sign" : "Approve & sign";
  const rejectLabel = isDanger ? "Reject" : "Cancel";
  // For Danger: Reject is primary (visual), Approve is ghost.
  // For Safe/Caution: Approve is primary, Cancel is secondary.
  const approveClass = isDanger ? "btn ghost" : "btn primary";
  const rejectClass = isDanger ? "btn primary" : "btn secondary";
  // The "primary" data attribute drives the Enter-key default.
  const approvePrimaryAttr = !isDanger ? "data-action-also='primary'" : "";
  const rejectPrimaryAttr = isDanger ? "data-action-also='primary'" : "";

  const explanationHTML = v.explanation
    ? `<section class="block">
        <div class="block-label">Plain-English summary</div>
        <p class="explanation">${escapeHTML(v.explanation)}</p>
      </section>`
    : "";

  const whatHTML =
    v.whatThisDoes.length === 0
      ? ""
      : `<section class="block">
          <div class="block-label">What this transaction does</div>
          <ul class="bullets">
            ${v.whatThisDoes.map((s) => `<li>${escapeHTML(s)}</li>`).join("")}
          </ul>
        </section>`;

  const flagsHTML =
    v.flags.length === 0
      ? ""
      : `<section class="block">
          <div class="block-label">Flags · ${v.flags.length}</div>
          <div class="flags">
            ${v.flags
              .map((f) => {
                const evidence = f.evidence
                  ? `<details class="evidence">
                      <summary>Show evidence</summary>
                      <pre>${escapeHTML(JSON.stringify(f.evidence, null, 2))}</pre>
                    </details>`
                  : "";
                return `
                  <article class="flag flag-${escapeHTML(f.severity)}">
                    <div class="flag-head">
                      <span class="${escapeHTML(severityClass(f.severity))}">${escapeHTML(f.severity)}</span>
                      <strong>${escapeHTML(f.label)}</strong>
                    </div>
                    <p>${escapeHTML(f.description)}</p>
                    ${evidence}
                  </article>`;
              })
              .join("")}
          </div>
        </section>`;

  const ixHTML =
    v.decodedInstructions.length === 0
      ? ""
      : `<details class="ix-panel">
          <summary>
            <span class="block-label">Decoded instructions · ${v.decodedInstructions.length}</span>
            <span class="ix-chevron">${ICON_CHEVRON}</span>
          </summary>
          <ol class="ix-list">
            ${v.decodedInstructions
              .map(
                (ix) => `
                <li>
                  <div class="ix-summary">${escapeHTML(ix.summary)}</div>
                  <div class="ix-meta">${escapeHTML(ix.programName)} · ${escapeHTML(shortAddr(ix.programId))}</div>
                </li>`,
              )
              .join("")}
          </ol>
        </details>`;

  const safeAffirmation = isSafe && v.flags.length === 0
    ? `<div class="affirmation">
        <span class="affirmation-icon">${ICON_SHIELD_CHECK}</span>
        <span>No risks detected. The transaction matches routine patterns and the wallet's own confirmation will follow.</span>
      </div>`
    : "";

  return `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-verdict-label">
      ${renderHeader(origin)}

      <div class="verdict level-${escapeHTML(v.riskLevel)}">
        <div class="verdict-icon">${levelIcon(v.riskLevel)}</div>
        <div class="verdict-text">
          <div id="txg-verdict-label" class="verdict-label">${escapeHTML(levelLabel(v.riskLevel))}</div>
          <div class="verdict-meta">
            <span class="score">${v.score} <span class="score-dim">/ 100</span></span>
            <span class="dotsep">·</span>
            <span>${v.flags.length} flag${v.flags.length === 1 ? "" : "s"}</span>
          </div>
          <div class="recommendation">${escapeHTML(v.recommendation)}</div>
        </div>
      </div>

      <div class="body">
        ${safeAffirmation}
        ${explanationHTML}
        ${whatHTML}
        ${flagsHTML}
        ${ixHTML}
      </div>

      <footer>
        <button class="${rejectClass}" data-action="reject" ${rejectPrimaryAttr}>${rejectLabel}</button>
        <button class="${approveClass}" data-action="approve" ${approvePrimaryAttr}>${approveLabel}</button>
      </footer>
    </div>
  `;
}

function shortAddr(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

const MODAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.scrim {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 19, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: scrim-in 160ms ease-out;
}

.scrim.closing {
  animation: scrim-out 140ms ease-in forwards;
}

@keyframes scrim-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scrim-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

.card-slot {
  width: 100%;
  max-width: 520px;
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #171c1f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #eef2f3;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.02);
  animation: card-in 220ms cubic-bezier(0.2, 0, 0, 1);
}

.scrim.closing .card {
  animation: card-out 140ms ease-in forwards;
}

@keyframes card-in {
  from { transform: translateY(16px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}
@keyframes card-out {
  from { transform: translateY(0)    scale(1);    opacity: 1; }
  to   { transform: translateY(8px)  scale(0.98); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .scrim, .scrim.closing, .card, .scrim.closing .card { animation: none; }
}

/* ----- Header -------------------------------------------------------------- */
header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
.brand .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #3e8f96;
  box-shadow: 0 0 0 3px rgba(62, 143, 150, 0.18);
}
.brand-name {
  color: #eef2f3;
}

.origin-chip {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #a7b0b5;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.close {
  background: transparent;
  border: 0;
  color: #a7b0b5;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}
.close:hover { color: #eef2f3; background: rgba(255, 255, 255, 0.06); }

/* ----- Verdict block ------------------------------------------------------- */
.verdict {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.verdict-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.verdict-icon svg {
  width: 22px;
  height: 22px;
}

.verdict-text { min-width: 0; flex: 1; }

.verdict-label {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.verdict-meta {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #a7b0b5;
}
.verdict-meta .dotsep { color: #7f8a90; }
.verdict-meta .score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #eef2f3;
}
.verdict-meta .score-dim {
  font-weight: 400;
  color: #7f8a90;
  margin-left: 1px;
}

.recommendation {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 500;
}

.level-safe    .verdict-label,
.level-safe    .recommendation,
.level-safe    .verdict-icon { color: #4d8f66; }
.level-safe    .verdict-icon { background: rgba(77, 143, 102, 0.16); }
.level-safe                  { background: linear-gradient(180deg, rgba(77,143,102,0.10), rgba(77,143,102,0.02)); }

.level-caution .verdict-label,
.level-caution .recommendation,
.level-caution .verdict-icon { color: #d0a34b; }
.level-caution .verdict-icon { background: rgba(208, 163, 75, 0.18); }
.level-caution               { background: linear-gradient(180deg, rgba(208,163,75,0.10), rgba(208,163,75,0.02)); }

.level-danger  .verdict-label,
.level-danger  .recommendation,
.level-danger  .verdict-icon { color: #c35b63; }
.level-danger  .verdict-icon { background: rgba(195, 91, 99, 0.18); }
.level-danger                { background: linear-gradient(180deg, rgba(195,91,99,0.12), rgba(195,91,99,0.02)); }

/* ----- Body --------------------------------------------------------------- */
.body { padding: 16px 20px; }
.body > * + * { margin-top: 18px; }

.affirmation {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(77, 143, 102, 0.10);
  border: 1px solid rgba(77, 143, 102, 0.22);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: #c8d8cf;
}
.affirmation-icon {
  flex-shrink: 0;
  color: #4d8f66;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
}
.affirmation-icon svg { width: 18px; height: 18px; }

.block-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #7f8a90;
  margin-bottom: 8px;
  font-weight: 500;
}

.explanation {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #eef2f3;
}

.bullets {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.55;
  color: #a7b0b5;
}
.bullets li {
  padding-left: 14px;
  position: relative;
}
.bullets li + li { margin-top: 4px; }
.bullets li::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #4a5358;
}

/* ----- Flags -------------------------------------------------------------- */
.flags { display: flex; flex-direction: column; gap: 8px; }
.flag {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1d2327;
  border-radius: 10px;
  padding: 11px 12px;
  position: relative;
  transition: border-color 120ms;
}
.flag:hover { border-color: rgba(255, 255, 255, 0.14); }

.flag-high   { border-left: 3px solid #c35b63; padding-left: 13px; }
.flag-medium { border-left: 3px solid #d0a34b; padding-left: 13px; }
.flag-low    { border-left: 3px solid #5a8fcb; padding-left: 13px; }

.flag-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}
.flag p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: #a7b0b5;
}

.sev {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 7px;
  line-height: 1;
}
.sev-low    { background: rgba(90, 143, 203, 0.16); color: #6ea0d6; }
.sev-medium { background: rgba(208, 163, 75, 0.18); color: #dfb55c; }
.sev-high   { background: rgba(195, 91, 99, 0.18); color: #d97580; }

.evidence {
  margin-top: 8px;
  font-size: 11.5px;
}
.evidence summary {
  cursor: pointer;
  color: #7f8a90;
  user-select: none;
  padding: 2px 0;
}
.evidence summary:hover { color: #a7b0b5; }
.evidence pre {
  margin: 6px 0 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: #a7b0b5;
  overflow-x: auto;
  white-space: pre;
}

/* ----- Decoded instructions panel ----------------------------------------- */
.ix-panel {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
}
.ix-panel summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.ix-panel summary::-webkit-details-marker { display: none; }
.ix-panel summary .block-label { margin: 0; }
.ix-chevron {
  width: 14px;
  height: 14px;
  color: #7f8a90;
  transition: transform 160ms ease;
  display: grid;
  place-items: center;
}
.ix-chevron svg { width: 14px; height: 14px; }
.ix-panel[open] .ix-chevron { transform: rotate(180deg); }

.ix-list {
  list-style: none;
  margin: 0;
  padding: 0 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ix-list li {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
  font-size: 13px;
}
.ix-list li:first-child { border-top: 0; padding-top: 4px; }
.ix-summary { color: #eef2f3; line-height: 1.45; }
.ix-meta {
  margin-top: 2px;
  font-size: 11px;
  color: #7f8a90;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* ----- Footer + buttons --------------------------------------------------- */
footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.15);
  position: sticky;
  bottom: 0;
}

.btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 16px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 120ms, color 120ms, border-color 120ms, transform 120ms;
}
.btn:active { transform: translateY(1px); }
.btn.primary { background: #3e8f96; color: #0a1416; font-weight: 600; }
.btn.primary:hover { background: #4fa3aa; }
.btn.secondary { background: #1d2327; color: #eef2f3; border-color: rgba(255, 255, 255, 0.08); }
.btn.secondary:hover { background: #232a2f; }
.btn.ghost { background: transparent; color: #7f8a90; }
.btn.ghost:hover { background: #1d2327; color: #a7b0b5; }

button:focus-visible {
  outline: 2px solid #3e8f96;
  outline-offset: 2px;
}

/* ----- Loading state ------------------------------------------------------ */
.loading-card { min-height: 200px; }
.loading-body {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}
.loading-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: #3e8f96;
  background: rgba(62, 143, 150, 0.14);
  border-radius: 10px;
  margin-bottom: 6px;
  animation: pulse 1.4s ease-in-out infinite;
}
.loading-icon svg { width: 22px; height: 22px; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.loading-title {
  font-size: 15px;
  font-weight: 600;
  color: #eef2f3;
}
.loading-subtitle {
  font-size: 12.5px;
  color: #a7b0b5;
  line-height: 1.55;
  max-width: 360px;
}
.progress {
  margin-top: 14px;
  width: 200px;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}
.progress-bar {
  position: absolute;
  inset: 0;
  width: 40%;
  background: #3e8f96;
  border-radius: 999px;
  animation: indeterminate 1.4s ease-in-out infinite;
}
@keyframes indeterminate {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* ----- Card scrollbar (subtle) ------------------------------------------- */
.card::-webkit-scrollbar { width: 8px; }
.card::-webkit-scrollbar-track { background: transparent; }
.card::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}
.card::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.14); }
`;
