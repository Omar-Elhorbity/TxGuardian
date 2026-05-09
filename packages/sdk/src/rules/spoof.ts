import type { TxRiskFlag } from "../types.js";
import type { Rule } from "./index.js";

/**
 * SIMULATION_SPOOF — intent–outcome mismatch detector.
 *
 * Honest scope: we cannot definitively detect "spoofing" by re-simulating —
 * we'd just reproduce the same simulation result a buggy wallet shows. What
 * we CAN do is statically detect token movement intent in the instruction
 * stream and surface it for the user to verify against what their wallet
 * displays.
 *
 * Rule:
 *   - At least one SPL Token / Token-2022 Transfer or TransferChecked, AND
 *   - The destination is NOT one of the transaction's signer keys, AND
 *   - The transferred amount is non-zero (defensive — zero-value transfers
 *     are sometimes used as no-ops, no need to alarm)
 *   → flag SIMULATION_SPOOF.
 *
 * If simulation was attempted (full mode) and failed for non-routine reasons,
 * we annotate that in evidence so the developer can see it; we don't change
 * the verdict on simulation alone.
 *
 * Severity: high — token outflow that doesn't match the wallet preview is
 * the canonical drainer pattern.
 */
export const detectSpoofRisk: Rule = ({ tokenOps, parsed, simulation }) => {
  const signerSet = new Set(parsed.signers);
  const suspicious: Array<{
    type: string;
    destination: string;
    amount?: string;
  }> = [];

  for (const op of tokenOps) {
    if (op.type !== "Transfer" && op.type !== "TransferChecked") continue;
    const dest = op.destination;
    if (!dest) continue;
    if (signerSet.has(dest)) continue; // self-transfer is fine
    const amount = op.amount;
    if (amount !== undefined && amount === 0n) continue;

    suspicious.push({
      type: op.type,
      destination: dest,
      amount: amount?.toString(),
    });
  }

  if (suspicious.length === 0) return null;

  const description =
    suspicious.length === 1
      ? `This transaction will move tokens out of your wallet. Verify the destination matches what your wallet preview shows — drainers exploit this gap.`
      : `This transaction will move tokens out of your wallet via ${suspicious.length} transfers. Verify every destination — drainers often hide one inside a busy transaction.`;

  const evidence: Record<string, unknown> = { transfers: suspicious };
  if (simulation) {
    evidence.simulationOk = simulation.ok;
    if (simulation.error) evidence.simulationError = simulation.error;
  }

  const flag: TxRiskFlag = {
    id: "SIMULATION_SPOOF",
    severity: "high",
    label: "Outbound token movement",
    description,
    evidence,
  };
  return flag;
};
