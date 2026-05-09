/**
 * Page-context injection. Runs in the dApp's own JavaScript world at
 * document_start, BEFORE the dApp's wallet adapter has bound any
 * references. We monkey-patch every signing entry point we know about.
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
 *           show modal (Phase 17), await user click
 *           ↓
 *           if approve → call original signTransaction → return signature
 *           if reject → throw → dApp sees standard wallet rejection
 *
 * No chrome.* APIs available here. All cross-context comms via window.
 */

import {
  isExtensionMessage,
  MSG_NAMESPACE,
  newId,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type TxRiskResultLike,
} from "./types";
import { showVerdictModal } from "./modal";

type AnyTx = unknown; // VersionedTransaction | Transaction; we duck-type

interface PhantomProvider {
  signTransaction?: (tx: AnyTx) => Promise<unknown>;
  signAllTransactions?: (txs: AnyTx[]) => Promise<unknown[]>;
  signAndSendTransaction?: (
    tx: AnyTx,
    opts?: unknown,
  ) => Promise<{ signature: string }>;
  /** Marker so we don't double-patch on hot-reload or repeat injections. */
  __txgPatched?: boolean;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider; // legacy alias
  }
}

console.debug("[TxGuardian] page-context injection active");

// --- Patch installation ------------------------------------------------------

/**
 * Wait for a wallet provider to appear, then patch it. Phantom is usually
 * available immediately at document_start, but other wallets / late-loading
 * scripts may set it later. Polls every 100ms for up to 10s, then gives up.
 */
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

function patchProvider(provider: PhantomProvider, label: string): void {
  if (provider.__txgPatched) return;
  provider.__txgPatched = true;
  console.debug(`[TxGuardian] patching ${label}`);

  if (typeof provider.signTransaction === "function") {
    const orig = provider.signTransaction.bind(provider);
    provider.signTransaction = async (tx: AnyTx) => {
      console.debug("[TxGuardian] intercepted signTransaction");
      const decision = await analyzeAndAwait([tx]);
      if (decision === "reject") {
        throw rejectionError();
      }
      return orig(tx);
    };
  }

  if (typeof provider.signAllTransactions === "function") {
    const orig = provider.signAllTransactions.bind(provider);
    provider.signAllTransactions = async (txs: AnyTx[]) => {
      console.debug("[TxGuardian] intercepted signAllTransactions");
      const decision = await analyzeAndAwait(txs);
      if (decision === "reject") {
        throw rejectionError();
      }
      return orig(txs);
    };
  }

  if (typeof provider.signAndSendTransaction === "function") {
    const orig = provider.signAndSendTransaction.bind(provider);
    provider.signAndSendTransaction = async (tx: AnyTx, opts?: unknown) => {
      console.debug("[TxGuardian] intercepted signAndSendTransaction");
      const decision = await analyzeAndAwait([tx]);
      if (decision === "reject") {
        throw rejectionError();
      }
      return orig(tx, opts);
    };
  }
}

function rejectionError(): Error {
  // Mirrors the shape of Phantom's own rejection so dApps' error handling
  // treats this the same as the user clicking Cancel in Phantom's prompt.
  const err = new Error("User rejected the request via TxGuardian.");
  // Phantom uses code 4001 for user-rejected (EIP-1193 convention).
  (err as Error & { code?: number }).code = 4001;
  return err;
}

// Direct providers: window.phantom.solana and the legacy window.solana alias.
whenAvailable(
  () => window.phantom?.solana,
  (provider) => patchProvider(provider, "window.phantom.solana"),
);
whenAvailable(
  () => window.solana,
  (provider) => patchProvider(provider, "window.solana"),
);

// --- Wallet Standard registration interception ------------------------------

/**
 * Wallets that follow the Wallet Standard register themselves by dispatching
 * a `wallet-standard:register-wallet` event with a callback. We intercept
 * the registered wallet and wrap its `solana:signTransaction` feature.
 *
 * This catches dApps using @solana/wallet-adapter-react which discovers
 * wallets via this protocol, even when they DON'T directly touch
 * window.phantom.solana.
 */
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
  console.debug(
    "[TxGuardian] patching wallet (Wallet Standard):",
    Object.keys(wallet.features),
  );

  const signFeature = wallet.features["solana:signTransaction"];
  if (signFeature?.signTransaction) {
    const orig = signFeature.signTransaction.bind(signFeature);
    signFeature.signTransaction = async (...args: unknown[]) => {
      // Wallet Standard's signTransaction takes an array of input objects;
      // each input has { transaction: Uint8Array }.
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

// Per the @wallet-standard/app protocol:
//   - Wallets dispatch 'wallet-standard:register-wallet' with their own
//     callback as `detail`. We invoke that callback with our register API
//     so they hand us the wallet object.
//   - We dispatch 'wallet-standard:app-ready' with our register API as
//     `detail`. Wallets that loaded BEFORE we attached our listener catch
//     this and call the API to (re-)register.

const walletStandardApi = {
  register(wallet: WalletStandardWallet): () => void {
    patchWalletStandard(wallet);
    return () => {
      // No-op unregister — we never tear down patches.
    };
  },
};

// 1. Listen for future registrations.
window.addEventListener(
  "wallet-standard:register-wallet",
  (event) => {
    console.debug("[TxGuardian] wallet-standard:register-wallet event");
    type RegisterEvent = CustomEvent<
      (api: typeof walletStandardApi) => void
    >;
    const { detail } = event as RegisterEvent;
    if (typeof detail !== "function") return;
    detail(walletStandardApi);
  },
  false,
);

// 2. Trigger an "app-ready" event so wallets registered before our listener
//    re-announce themselves to us. MUST include the api as detail per spec.
window.dispatchEvent(
  new CustomEvent("wallet-standard:app-ready", {
    detail: walletStandardApi,
  }),
);
console.debug("[TxGuardian] dispatched wallet-standard:app-ready");

// --- Analyze + show modal pipeline ------------------------------------------

/**
 * For each tx, request analysis via postMessage (relayed by content.ts) then
 * show the modal and await the user's decision. If ANY tx in a batch rejects
 * (or fails to analyze), we treat the whole batch as rejected — same UX
 * Phantom uses for batch sign rejections.
 */
async function analyzeAndAwait(
  txs: AnyTx[],
): Promise<"approve" | "reject"> {
  if (txs.length === 0) return "approve"; // nothing to analyze, nothing to block

  for (const tx of txs) {
    const base64 = await serializeAny(tx);
    if (!base64) {
      console.warn("[TxGuardian] could not serialize a tx; allowing through");
      continue;
    }
    const verdict = await requestAnalysis(base64);
    if (!verdict) {
      // Analysis failed (network, no response, etc.). Show a degraded modal
      // that lets the user proceed at their own risk.
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

/**
 * Serialize anything that quacks like a transaction into base64.
 */
async function serializeAny(tx: AnyTx): Promise<string | null> {
  try {
    if (tx instanceof Uint8Array) {
      return uint8ToB64(tx);
    }
    const candidate = tx as {
      serialize?: (opts?: unknown) => Uint8Array | Buffer;
    };
    if (typeof candidate.serialize !== "function") return null;
    let bytes: Uint8Array;
    try {
      bytes = candidate.serialize() as Uint8Array;
    } catch {
      // Legacy Transaction needs explicit options to serialize unsigned.
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
  // Avoid spread on large arrays; loop is safer.
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return btoa(s);
}

function requestAnalysis(
  base64: string,
): Promise<TxRiskResultLike | null> {
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
