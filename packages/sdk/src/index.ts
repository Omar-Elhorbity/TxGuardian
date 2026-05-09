import type { AnalyzeOptions, TxRiskResult } from "./types";
import { parseTransaction, toVersionedTransaction } from "./parser";
import { decodeAll } from "./decode";
import { simulateSafely } from "./simulate";
import { runRules } from "./rules/index";
import { scoreFlags } from "./scorer";
import { explainCached } from "./explain";

/**
 * Public SDK entry point. Analyzes a Solana transaction and returns a
 * structured risk verdict.
 *
 * Mode:
 *   - "fast" (default): rules only — sub-200ms typical. No LLM, no simulation.
 *   - "full": rules + simulation + AI translator. ~1–2s typical.
 *
 * The deterministic verdict (riskLevel, score, flags, recommendation) is
 * ALWAYS valid even if the AI step fails. AI failures degrade to empty
 * `explanation` and `whatThisDoes` rather than throwing.
 */
export async function analyze(
  options: AnalyzeOptions,
): Promise<TxRiskResult> {
  const mode = options.mode ?? "fast";

  const parsed = await parseTransaction(
    options.transaction,
    options.connection,
  );
  const { decoded, tokenOps } = decodeAll(parsed.instructions);

  let simulation;
  if (mode === "full") {
    try {
      const vtx = toVersionedTransaction(options.transaction);
      simulation = await simulateSafely(vtx, options.connection);
    } catch {
      // Simulation is best-effort; never block the verdict on it.
      simulation = undefined;
    }
  }

  const flags = runRules({
    parsed,
    decoded,
    tokenOps,
    ...(simulation !== undefined ? { simulation } : {}),
    ...(options.publicKey ? { signer: options.publicKey.toBase58() } : {}),
  });

  const { score, riskLevel, recommendation } = scoreFlags(flags);

  let explanation = "";
  let whatThisDoes: string[] = [];
  if (mode === "full") {
    try {
      const ai = await explainCached({
        riskLevel,
        score,
        flags,
        decoded,
        ...(options.model ? { model: options.model } : {}),
      });
      explanation = ai.explanation;
      whatThisDoes = ai.whatThisDoes;
    } catch {
      // AI failure must not block the verdict.
      explanation = "";
      whatThisDoes = [];
    }
  }

  return {
    riskLevel,
    score,
    flags,
    explanation,
    recommendation,
    whatThisDoes,
    decodedInstructions: decoded,
    ...(simulation !== undefined ? { simulation } : {}),
    analyzedAt: new Date().toISOString(),
    mode,
  };
}

// Public type re-exports — what consumers should import.
export type {
  RiskLevel,
  Severity,
  FlagId,
  TxRiskFlag,
  TxRiskResult,
  DecodedInstruction,
  AnalyzeOptions,
  ParsedTransaction,
  ParsedInstruction,
  SimulationDelta,
} from "./types";

// Public utility re-exports.
export { parseTransaction, ParseError, toVersionedTransaction } from "./parser";
export { decodeAll, decodeInstruction } from "./decode";
export { runRules } from "./rules/index";
export { scoreFlags } from "./scorer";
export {
  KNOWN_PROGRAMS,
  KNOWN_DRAINERS,
  isKnownProgram,
  isTokenProgram,
  lookupProgramName,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "./constants";
