/**
 * Shared message types passed across the three contexts:
 *   page (MAIN world) <-> content script (ISOLATED) <-> service worker.
 *
 * All cross-context messages have a unique `id` so request/response pairs
 * can be matched. Page <-> content uses window.postMessage; content <->
 * background uses chrome.runtime.sendMessage.
 */

export const MSG_NAMESPACE = "TXG";

export type MessageType =
  | "ANALYZE_REQUEST" // page -> content -> background
  | "ANALYZE_RESPONSE"; // background -> content -> page

export interface AnalyzeRequest {
  type: "ANALYZE_REQUEST";
  ns: typeof MSG_NAMESPACE;
  id: string;
  /** Base64-serialized transaction, no signatures. */
  base64: string;
  /** Origin of the dApp page — used only for display in the modal
   *  header. Never persisted; never sent anywhere else. */
  origin: string;
}

export interface AnalyzeResponse {
  type: "ANALYZE_RESPONSE";
  ns: typeof MSG_NAMESPACE;
  id: string;
  ok: boolean;
  /** Present when ok=true. Mirror of the SDK's TxRiskResult. */
  result?: TxRiskResultLike;
  /** Present when ok=false. */
  error?: string;
  /**
   * Which engine produced the response. Present on both success and
   * failure paths. Lets the modal render the correct provenance badge
   * ("Verdict computed locally" vs "Verdict from hosted analyzer") and
   * give mode-aware error guidance.
   */
  engineMode?: "local" | "hosted";
}

/**
 * Subset of @txguardian/sdk's TxRiskResult — duplicated here to avoid
 * importing the full SDK into the extension bundle. Keep in sync.
 */
export interface TxRiskResultLike {
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

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isExtensionMessage(
  data: unknown,
): data is AnalyzeRequest | AnalyzeResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { ns?: unknown }).ns === MSG_NAMESPACE
  );
}
