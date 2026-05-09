import type { TxRiskFlag } from "../types.js";
import { KNOWN_DRAINER_MAP } from "../constants.js";
import type { Rule } from "./index.js";

/**
 * Flag any program in the transaction that matches the curated drainer
 * blocklist. High-severity, deterministic, no false positives by design.
 *
 * The blocklist is intentionally short — every entry must have a verifiable
 * public source (see constants.ts).
 */
export const detectKnownDrainer: Rule = ({ parsed }) => {
  const matches = new Set<string>();
  for (const ix of parsed.instructions) {
    if (KNOWN_DRAINER_MAP.has(ix.programId)) {
      matches.add(ix.programId);
    }
  }
  if (matches.size === 0) return null;

  const addresses = Array.from(matches);
  const names = addresses
    .map((a) => KNOWN_DRAINER_MAP.get(a)?.name ?? a)
    .join(", ");

  const flag: TxRiskFlag = {
    id: "KNOWN_DRAINER_PROGRAM",
    severity: "high",
    label: "Known wallet drainer detected",
    description: `This transaction calls a program previously linked to wallet draining: ${names}.`,
    evidence: { addresses },
  };
  return flag;
};
