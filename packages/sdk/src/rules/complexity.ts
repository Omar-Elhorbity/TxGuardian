import type { TxRiskFlag } from "../types.js";
import { isComputeBudgetProgram } from "../constants.js";
import type { Rule } from "./index.js";

const COMPLEX_THRESHOLD = 5;

/**
 * Flag transactions with many instructions — a common obfuscation pattern.
 * ComputeBudget instructions are filtered out; they are routine and would
 * make every modern transaction look complex.
 */
export const detectComplexity: Rule = ({ parsed }) => {
  const meaningful = parsed.instructions.filter(
    (ix) => !isComputeBudgetProgram(ix.programId),
  );
  if (meaningful.length < COMPLEX_THRESHOLD) return null;

  const flag: TxRiskFlag = {
    id: "MULTI_INSTRUCTION_COMPLEXITY",
    severity: "medium",
    label: "Complex multi-instruction transaction",
    description: `This transaction bundles ${meaningful.length} instructions. Bundling is a common tactic to hide a malicious instruction inside a busy transaction.`,
    evidence: { count: meaningful.length, threshold: COMPLEX_THRESHOLD },
  };
  return flag;
};
