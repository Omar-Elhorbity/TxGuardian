/**
 * Service worker — the LOCAL ENGINE HOST.
 *
 * Two analysis modes, selectable from the popup:
 *
 *   `local` (default): runs the @txguardian/sdk engine right here in the
 *   service worker. The transaction never leaves the user's browser
 *   (modulo whatever the user's chosen RPC sees for simulation + on-chain
 *   registry lookups, which the user controls). TxGuardian's server is
 *   never contacted. This is the version that makes the marketing line
 *   "we sell security" a verifiable architectural property — the verdict
 *   is computed in code the user can audit and that matches a hash on
 *   the website.
 *
 *   `hosted` (opt-in fallback): same as v1 behavior. POSTs the transaction
 *   to TxGuardian's hosted /api/analyze for users who don't want to bring
 *   their own RPC. Kept for one-click convenience; not the default.
 *
 * The page-context modal doesn't know or care which mode produced the
 * verdict — the AnalyzeResponse shape is identical either way. The popup
 * (Phase 4) surfaces the active mode to the user.
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
  DEFAULT_ANALYZE_ENDPOINT,
  DEFAULT_ENGINE_MODE,
  DEFAULT_RPC_URL,
  HOSTED_SITE_URL,
  STORAGE_KEY_ENDPOINT,
  STORAGE_KEY_MODE,
  STORAGE_KEY_RPC,
  type EngineMode,
} from "./config";

/**
 * Mode passed to the SDK in local mode. "fast" = rules + decoder + scorer
 * (no simulation, no on-chain registry lookup, no LLM). "full" = +
 * simulation + on-chain registry lookups. Default is "full" so local-mode
 * verdicts have the same fidelity as the hosted version (sans LLM, which
 * comes in Phase 3).
 *
 * The on-chain registry lookup adds one getProgramAccounts call to the
 * user's RPC. Cached for 60s by the SDK so a burst of signing requests
 * doesn't fan out.
 */
const SDK_MODE: "fast" | "full" = "full";

console.log("[TxGuardian] service worker booted (local-engine v2)");

// ─── First-run onboarding ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: `${HOSTED_SITE_URL}/extension` });
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
  mode: EngineMode;
  rpcUrl: string;
  analyzerEndpoint: string;
}

async function resolveConfig(): Promise<ResolvedConfig> {
  try {
    const stored = await chrome.storage.local.get([
      STORAGE_KEY_MODE,
      STORAGE_KEY_RPC,
      STORAGE_KEY_ENDPOINT,
    ]);
    return {
      mode:
        stored[STORAGE_KEY_MODE] === "hosted"
          ? "hosted"
          : DEFAULT_ENGINE_MODE,
      rpcUrl: trimOrDefault(stored[STORAGE_KEY_RPC], DEFAULT_RPC_URL),
      analyzerEndpoint: trimOrDefault(
        stored[STORAGE_KEY_ENDPOINT],
        DEFAULT_ANALYZE_ENDPOINT,
      ),
    };
  } catch {
    return {
      mode: DEFAULT_ENGINE_MODE,
      rpcUrl: DEFAULT_RPC_URL,
      analyzerEndpoint: DEFAULT_ANALYZE_ENDPOINT,
    };
  }
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
  if (cfg.mode === "hosted") {
    return analyzeViaHostedAnalyzer(req, cfg.analyzerEndpoint);
  }
  return analyzeLocally(req, cfg.rpcUrl);
}

// ─── Local engine path ──────────────────────────────────────────────────

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
  rpcUrl: string,
): Promise<AnalyzeResponse> {
  try {
    const connection = getConnection(rpcUrl);
    const result = await analyze({
      transaction: req.base64,
      connection,
      mode: SDK_MODE,
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
 * Convert the SDK's TxRiskResult (rich type with BigInt evidence values,
 * Connection-specific simulation deltas, etc.) into the lean
 * TxRiskResultLike shape the page-context modal expects. Strips
 * non-postMessage-friendly fields (BigInts in `evidence`, the `simulation`
 * delta object). The modal renders flags, score, recommendation, the AI
 * fields, and decoded instructions — that's all that crosses the boundary.
 *
 * The page-context modal already uses structured clone via postMessage, so
 * the values that DO cross need to be plain-data. We let the modal-side
 * shape act as the source of truth for the message contract.
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
    // base64-encode small byte arrays (these are typically pubkey or hash bytes)
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

// ─── Hosted fallback path (v1 behavior, kept for opt-in) ────────────────

async function analyzeViaHostedAnalyzer(
  req: AnalyzeRequest,
  endpoint: string,
): Promise<AnalyzeResponse> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: req.base64,
        mode: SDK_MODE,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      return {
        type: "ANALYZE_RESPONSE",
        ns: MSG_NAMESPACE,
        id: req.id,
        ok: false,
        error:
          (json as { error?: string } | null)?.error ??
          `Hosted analyzer returned HTTP ${res.status}`,
      };
    }
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: true,
      result: json as TxRiskResultLike,
    };
  } catch (err) {
    return {
      type: "ANALYZE_RESPONSE",
      ns: MSG_NAMESPACE,
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
