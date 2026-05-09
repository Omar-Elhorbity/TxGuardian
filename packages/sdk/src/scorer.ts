import type { RiskLevel, Severity, TxRiskFlag } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 10,
  medium: 25,
  high: 45,
};

/**
 * Map a flag list to a deterministic 0–100 score and a RiskLevel.
 *
 * - Each flag contributes its severity weight.
 * - Score is clamped to 100.
 * - Level thresholds: 0–24 safe, 25–59 caution, 60–100 danger.
 *
 * The recommendation is locked to the level — never derived from the LLM.
 * If the deterministic engine says "danger", the recommendation is
 * "Do not sign" regardless of what the explainer produces.
 */
export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  recommendation: "Safe to sign" | "Proceed with caution" | "Do not sign";
}

export function scoreFlags(flags: TxRiskFlag[]): ScoreResult {
  const raw = flags.reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.min(100, raw);

  let riskLevel: RiskLevel;
  if (score >= 60) riskLevel = "danger";
  else if (score >= 25) riskLevel = "caution";
  else riskLevel = "safe";

  const recommendation =
    riskLevel === "danger"
      ? "Do not sign"
      : riskLevel === "caution"
        ? "Proceed with caution"
        : "Safe to sign";

  return { score, riskLevel, recommendation };
}
