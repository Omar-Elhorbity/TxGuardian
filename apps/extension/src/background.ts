/**
 * Service worker — the LOCAL ENGINE HOST.
 *
 * Runs the @txguardian/sdk engine in the service worker on every signing
 * request. The transaction never leaves the user's browser (modulo
 * whatever the user's chosen RPC sees for simulation + on-chain registry
 * lookups, which the user controls). TxGuardian's server is never
 * contacted. The verdict is computed in code the user can audit and that
 * matches a SHA256 published next to the download.
 *
 * The optional AI translator (Phase 3) uses the user's own Gemini key and
 * calls Google directly — TxGuardian never sees the key, the prose, or
 * the transaction.
 */

import { Connection } from "@solana/web3.js";
import {
  analyze,
  ParseError,
  type TxRiskResult,
} from "@txguardian/sdk";
import {
  MSG_NAMESPACE,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type TxRiskResultLike,
} from "./types";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_RPC_URL,
  HOSTED_SITE_URL,
  STORAGE_KEY_LLM_ENABLED,
  STORAGE_KEY_LLM_KEY,
  STORAGE_KEY_LLM_MODEL,
  STORAGE_KEY_RPC,
  STORAGE_KEY_SHOW_WELCOME,
} from "./config";

/**
 * Engine depth: "full" runs rules + simulation + on-chain registry
 * lookups. The on-chain registry adds one getProgramAccounts call to the
 * user's RPC, cached for 60s by the SDK so a burst of signing requests
 * doesn't fan out.
 */
const SDK_MODE: "fast" | "full" = "full";

console.log("[TxGuardian] service worker booted (local engine)");

// ─── First-run onboarding ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: `${HOSTED_SITE_URL}/extension` });
    void chrome.storage.local.set({ [STORAGE_KEY_SHOW_WELCOME]: true });
  }
});

// ─── Message handler ────────────────────────────────────────────────────

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

  void handleAnalyze(req).then((res) => sendResponse(res));
  return true; // keep the channel open for async response
});

// ─── Config resolution ──────────────────────────────────────────────────

interface ResolvedConfig {
  rpcUrl: string;
  llmEnabled: boolean;
  llmKey: string | null;
  llmModel: string;
}

async function resolveConfig(): Promise<ResolvedConfig> {
  let localStored: Record<string, unknown> = {};
  try {
    localStored = await chrome.storage.local.get([
      STORAGE_KEY_RPC,
      STORAGE_KEY_LLM_ENABLED,
      STORAGE_KEY_LLM_MODEL,
    ]);
  } catch {
    // fall through with defaults
  }

  // chrome.storage.session holds the LLM key (cleared on browser close).
  let llmKey: string | null = null;
  try {
    const sessionStored =
      typeof chrome.storage.session !== "undefined"
        ? await chrome.storage.session.get([STORAGE_KEY_LLM_KEY])
        : {};
    const k = sessionStored[STORAGE_KEY_LLM_KEY];
    if (typeof k === "string" && k.trim().length > 0) {
      llmKey = k.trim();
    }
  } catch {
    llmKey = null;
  }

  return {
    rpcUrl: trimOrDefault(localStored[STORAGE_KEY_RPC], DEFAULT_RPC_URL),
    llmEnabled: localStored[STORAGE_KEY_LLM_ENABLED] === true,
    llmKey,
    llmModel: trimOrDefault(
      localStored[STORAGE_KEY_LLM_MODEL],
      DEFAULT_LLM_MODEL,
    ),
  };
}

function trimOrDefault(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

// ─── Analyze handler ────────────────────────────────────────────────────

async function handleAnalyze(
  req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  const cfg = await resolveConfig();
  return analyzeLocally(req, cfg);
}

// ─── Local engine ───────────────────────────────────────────────────────

/**
 * Cached Connection so we don't reconstruct it for every signing request
 * (avoids re-initializing the underlying HTTP keep-alive pool). Re-create
 * if the user changes their RPC URL.
 */
let cachedConnection: { url: string; conn: Connection } | null = null;

function getConnection(rpcUrl: string): Connection {
  if (cachedConnection && cachedConnection.url === rpcUrl) {
    return cachedConnection.conn;
  }
  const conn = new Connection(rpcUrl, "confirmed");
  cachedConnection = { url: rpcUrl, conn };
  return conn;
}

async function analyzeLocally(
  req: AnalyzeRequest,
  cfg: ResolvedConfig,
): Promise<AnalyzeResponse> {
  try {
    const connection = getConnection(cfg.rpcUrl);
    // AI translation is opt-in (user's key from chrome.storage.session).
    // If LLM is enabled but the key is missing, we silently skip — the
    // popup is responsible for telling the user to enter their key.
    const useAi = cfg.llmEnabled && cfg.llmKey !== null;
    const result = await analyze({
      transaction: req.base64,
      connection,
      mode: SDK_MODE,
      ...(useAi
        ? { aiApiKey: cfg.llmKey!, model: cfg.llmModel }
        : {}),
    });
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: true,
      result: toResultLike(result),
    };
  } catch (err) {
    const msg =
      err instanceof ParseError
        ? `Could not parse transaction: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: false,
      error: msg,
    };
  }
}

/**
 * Convert the SDK's TxRiskResult into the lean TxRiskResultLike shape the
 * page-context modal expects. Strips non-postMessage-friendly fields
 * (BigInts in `evidence`, the `simulation` delta object).
 */
function toResultLike(r: TxRiskResult): TxRiskResultLike {
  return {
    riskLevel: r.riskLevel,
    score: r.score,
    flags: r.flags.map((f) => ({
      id: f.id,
      severity: f.severity,
      label: f.label,
      description: f.description,
      ...(f.evidence
        ? {
            evidence: sanitizeEvidence(f.evidence) as Record<string, unknown>,
          }
        : {}),
    })),
    recommendation: r.recommendation,
    explanation: r.explanation,
    whatThisDoes: r.whatThisDoes,
    decodedInstructions: r.decodedInstructions.map((d) => ({
      index: d.index,
      programId: d.programId,
      programName: d.programName,
      summary: d.summary,
    })),
    mode: r.mode,
  };
}

/**
 * Recursively coerce evidence values into structured-clone-friendly types.
 * BigInt is supported by structured clone since ES2020, but to be defensive
 * (and to match what the hosted /api/analyze does via jsonSafe), convert
 * BigInts and Uint8Arrays to strings.
 */
function sanitizeEvidence(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "bigint") return input.toString();
  if (input instanceof Uint8Array) {
    let s = "";
    for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]!);
    return btoa(s);
  }
  if (Array.isArray(input)) return input.map(sanitizeEvidence);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = sanitizeEvidence(v);
    }
    return out;
  }
  return input;
}
