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

type ModalInput =
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
    const verdict = await requestAnalysis(base64);
    if (!verdict) {
      const decision = await showVerdictModal({
        kind: "unavailable",
        origin: window.location.host,
      });
      if (decision === "reject") return "reject";
      continue;
    }
    const decision = await showVerdictModal({
      kind: "verdict",
      origin: window.location.host,
      verdict,
    });
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

function showVerdictModal(input: ModalInput): Promise<Decision> {
  return new Promise((resolve) => {
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

    const root = document.createElement("div");
    root.className = "scrim";
    root.innerHTML =
      input.kind === "verdict"
        ? renderVerdict(input.origin, input.verdict)
        : renderUnavailable(input.origin);
    shadow.appendChild(root);

    function close(decision: Decision): void {
      host.remove();
      resolve(decision);
    }

    shadow
      .querySelector<HTMLButtonElement>("[data-action='approve']")
      ?.addEventListener("click", () => close("approve"));
    shadow
      .querySelector<HTMLButtonElement>("[data-action='reject']")
      ?.addEventListener("click", () => close("reject"));
    shadow
      .querySelector<HTMLButtonElement>("[data-action='close']")
      ?.addEventListener("click", () => close("reject"));

    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        close("reject");
      }
    }
    document.addEventListener("keydown", onKey);
  });
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

function levelClass(l: "safe" | "caution" | "danger"): string {
  return `level level-${l}`;
}

function levelLabel(l: "safe" | "caution" | "danger"): string {
  return l === "safe" ? "Safe" : l === "caution" ? "Caution" : "Danger";
}

function renderVerdict(origin: string, v: TxRiskResultLike): string {
  const flagsHTML =
    v.flags.length === 0
      ? `<div class="empty">No flags raised.</div>`
      : v.flags
          .map(
            (f) => `
          <article class="flag">
            <div class="flag-head">
              <span class="${escapeHTML(severityClass(f.severity))}">${escapeHTML(f.severity)}</span>
              <strong>${escapeHTML(f.label)}</strong>
            </div>
            <p>${escapeHTML(f.description)}</p>
          </article>`,
          )
          .join("");

  const whatHTML =
    v.whatThisDoes.length === 0
      ? ""
      : `<section class="block">
        <div class="block-label">What this transaction does</div>
        <ul class="bullets">
          ${v.whatThisDoes.map((s) => `<li>${escapeHTML(s)}</li>`).join("")}
        </ul>
      </section>`;

  const explanationHTML = v.explanation
    ? `<section class="block"><p class="explanation">${escapeHTML(v.explanation)}</p></section>`
    : "";

  const isDanger = v.riskLevel === "danger";
  const approveLabel = isDanger ? "Sign anyway" : "Approve & sign";
  const rejectLabel = isDanger ? "Reject" : "Cancel";
  const approveClass = isDanger ? "btn ghost" : "btn primary";
  const rejectClass = isDanger ? "btn primary" : "btn secondary";

  return `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-title">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${escapeHTML(origin)}</span>
        </div>
        <button class="close" data-action="close" aria-label="Close">×</button>
      </header>

      <div class="verdict ${escapeHTML(levelClass(v.riskLevel))}">
        <div class="verdict-label">${escapeHTML(levelLabel(v.riskLevel))}</div>
        <div class="verdict-meta">
          <span>${v.score} / 100</span>
          <span class="dotsep">·</span>
          <span>${v.flags.length} flag${v.flags.length === 1 ? "" : "s"}</span>
          <span class="dotsep">·</span>
          <span>${escapeHTML(v.recommendation)}</span>
        </div>
      </div>

      <div class="body">
        ${explanationHTML}
        ${whatHTML}
        ${
          v.flags.length > 0
            ? `<section class="block">
                <div class="block-label">Flags</div>
                <div class="flags">${flagsHTML}</div>
              </section>`
            : ""
        }
      </div>

      <footer>
        <button class="${rejectClass}" data-action="reject">${rejectLabel}</button>
        <button class="${approveClass}" data-action="approve">${approveLabel}</button>
      </footer>
    </div>
  `;
}

function renderUnavailable(origin: string): string {
  return `
    <div class="card" role="dialog" aria-modal="true">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${escapeHTML(origin)}</span>
        </div>
        <button class="close" data-action="close" aria-label="Close">×</button>
      </header>
      <div class="body">
        <div class="block-label">Analyzer unavailable</div>
        <p class="explanation">
          TxGuardian could not reach the analyzer service. The wallet's own
          confirmation will still appear next. Proceed only if you trust this
          dApp.
        </p>
      </div>
      <footer>
        <button class="btn primary" data-action="reject">Reject</button>
        <button class="btn ghost" data-action="approve">Continue anyway</button>
      </footer>
    </div>
  `;
}

const MODAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.scrim {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 19, 0.78);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fade 120ms ease-out;
}

@keyframes fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.card {
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #171c1f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #eef2f3;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.brand .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #3e8f96;
}
.brand .origin {
  font-weight: 400;
  color: #7f8a90;
  font-size: 12px;
  margin-left: 4px;
}

.close {
  background: transparent;
  border: 0;
  color: #a7b0b5;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.close:hover { color: #eef2f3; background: rgba(255, 255, 255, 0.06); }

.verdict {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.verdict-label {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.verdict-meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #a7b0b5;
}
.verdict-meta .dotsep { color: #7f8a90; }

.level-safe    .verdict-label { color: #4d8f66; }
.level-safe                   { background: rgba(77, 143, 102, 0.10); }
.level-caution .verdict-label { color: #d0a34b; }
.level-caution                { background: rgba(208, 163, 75, 0.10); }
.level-danger  .verdict-label { color: #c35b63; }
.level-danger                 { background: rgba(195, 91, 99, 0.10); }

.body { padding: 16px 20px; }

.block + .block { margin-top: 18px; }
.block-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #7f8a90;
  margin-bottom: 8px;
}

.explanation {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
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
.bullets li::before {
  content: "·";
  position: absolute;
  left: 4px;
  color: #7f8a90;
}

.flags { display: flex; flex-direction: column; gap: 8px; }
.flag {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1d2327;
  border-radius: 10px;
  padding: 10px 12px;
}
.flag-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.flag p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #a7b0b5;
}

.sev {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 8px;
}
.sev-low    { background: rgba(90, 143, 203, 0.15); color: #5a8fcb; }
.sev-medium { background: rgba(208, 163, 75, 0.16); color: #d0a34b; }
.sev-high   { background: rgba(195, 91, 99, 0.16); color: #c35b63; }

.empty {
  font-size: 13px;
  color: #7f8a90;
  font-style: italic;
}

footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 120ms, color 120ms, border-color 120ms;
}
.btn.primary { background: #3e8f96; color: #0a1416; font-weight: 600; }
.btn.primary:hover { background: #4fa3aa; }
.btn.secondary { background: #1d2327; color: #eef2f3; border-color: rgba(255, 255, 255, 0.08); }
.btn.secondary:hover { background: #232a2f; }
.btn.ghost { background: transparent; color: #a7b0b5; }
.btn.ghost:hover { background: #1d2327; color: #eef2f3; }

button:focus-visible {
  outline: 2px solid #3e8f96;
  outline-offset: 2px;
}
`;
