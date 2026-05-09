import type {
  DecodedInstruction,
  ParsedTransaction,
  SimulationDelta,
  TxRiskFlag,
} from "../types.js";
import type { DecodedTokenOp } from "../decode.js";
import { detectKnownDrainer } from "./drainer.js";
import { detectUnknownPrograms } from "./unknown.js";
import { detectComplexity } from "./complexity.js";
import { detectFullApproval } from "./approval.js";
import { detectSpoofRisk } from "./spoof.js";
import { detectUnusualFee } from "./fee.js";

export interface RuleContext {
  parsed: ParsedTransaction;
  decoded: DecodedInstruction[];
  tokenOps: DecodedTokenOp[];
  simulation?: SimulationDelta;
  /** Optional signer pubkey (base58) for context-aware checks. */
  signer?: string;
}

export type Rule = (ctx: RuleContext) => TxRiskFlag | TxRiskFlag[] | null;

/**
 * The full active rule list shipped at MVP. Order is significant only for UI
 * display — scoring is independent of order.
 *
 * Rules MUST be pure functions. Rules MUST NOT throw — return null on any
 * unexpected input. Rules MAY return multiple flags (e.g. multiple unknown
 * programs detected), but should consolidate where it improves UX clarity.
 */
const RULES: Rule[] = [
  detectKnownDrainer,
  detectFullApproval,
  detectSpoofRisk,
  detectUnknownPrograms,
  detectComplexity,
  detectUnusualFee,
];

/**
 * Run every rule against the context and collect flags. Defensive: any rule
 * that throws is treated as no-op (rules should not throw, but we never
 * want a single rule failure to block the whole engine).
 */
export function runRules(ctx: RuleContext): TxRiskFlag[] {
  const flags: TxRiskFlag[] = [];
  for (const rule of RULES) {
    try {
      const result = rule(ctx);
      if (!result) continue;
      if (Array.isArray(result)) flags.push(...result);
      else flags.push(result);
    } catch {
      // Swallow — a single broken rule must not derail the engine.
    }
  }
  return flags;
}
