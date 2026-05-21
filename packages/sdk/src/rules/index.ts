import type {
  DecodedInstruction,
  ParsedTransaction,
  SimulationDelta,
  TxRiskFlag,
} from "../types";
import type { DecodedTokenOp } from "../decode";
import type { OnChainAttestation } from "../registry";
import { detectKnownDrainer } from "./drainer";
import { detectUnknownPrograms } from "./unknown";
import { detectComplexity } from "./complexity";
import { detectFullApproval } from "./approval";
import { detectSpoofRisk } from "./spoof";
import { detectUnusualFee } from "./fee";

export interface RuleContext {
  parsed: ParsedTransaction;
  decoded: DecodedInstruction[];
  tokenOps: DecodedTokenOp[];
  simulation?: SimulationDelta;
  /** Optional signer pubkey (base58) for context-aware checks. */
  signer?: string;
  /**
   * Confirmed on-chain attestations from the TxGuardian registry program,
   * fetched best-effort in full mode. Empty array (not undefined) means
   * "fetched and got nothing or fetch failed." Rules treat both the same way.
   */
  onChainAttestations?: OnChainAttestation[];
}

export type Rule = (ctx: RuleContext) => TxRiskFlag | TxRiskFlag[] | null;

/**
 * The active rule list. Order is significant only for UI display — scoring
 * is independent of order.
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
 * Run every rule against the context and collect flags. Defensive:
 *  - any rule that throws is treated as no-op (rules should not throw, but
 *    we never want a single rule failure to block the whole engine);
 *  - duplicate flags (same id + same description) are collapsed before
 *    returning, so a buggy rule that accidentally emits N identical flags
 *    cannot N-multiply the score in scorer.ts (the scorer sums severity
 *    weights additively — duplicates would corrupt the verdict).
 */
export function runRules(ctx: RuleContext): TxRiskFlag[] {
  const raw: TxRiskFlag[] = [];
  for (const rule of RULES) {
    try {
      const result = rule(ctx);
      if (!result) continue;
      if (Array.isArray(result)) raw.push(...result);
      else raw.push(result);
    } catch {
      // Swallow — a single broken rule must not derail the engine.
    }
  }
  return dedupeFlags(raw);
}

/**
 * Collapse duplicates by (id + description). Two flags with identical user-
 * visible text are the same finding even if their `evidence` objects differ
 * slightly. Order is preserved (first occurrence wins) so UI ordering is
 * stable. This is a safety net — rules should dedupe at their source.
 */
function dedupeFlags(flags: TxRiskFlag[]): TxRiskFlag[] {
  const seen = new Set<string>();
  const out: TxRiskFlag[] = [];
  for (const f of flags) {
    const key = `${f.id}::${f.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
