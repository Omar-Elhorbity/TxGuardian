import type { TxRiskFlag } from "../types";
import { isKnownProgram, KNOWN_DRAINER_MAP } from "../constants";
import type { Rule } from "./index";

/**
 * Inverse-allowlist rule: any program not on the well-known list earns
 * an UNKNOWN_PROGRAM flag. Drainers get their own (more severe) flag and
 * are excluded here to avoid double-flagging.
 *
 * False positives are intentional. A "we don't recognize this program"
 * surface is far less harmful than missing a malicious one — and gives
 * users a real reason to slow down before signing.
 */
export const detectUnknownPrograms: Rule = ({ parsed }) => {
  const unknown = new Set<string>();
  for (const ix of parsed.instructions) {
    if (KNOWN_DRAINER_MAP.has(ix.programId)) continue;
    if (!isKnownProgram(ix.programId)) {
      unknown.add(ix.programId);
    }
  }
  if (unknown.size === 0) return null;

  const list = Array.from(unknown);
  const description =
    list.length === 1
      ? `One program is not in our well-known allowlist: ${list[0]}.`
      : `${list.length} programs are not in our well-known allowlist.`;

  const flag: TxRiskFlag = {
    id: "UNKNOWN_PROGRAM",
    severity: "medium",
    label: "Unverified program",
    description,
    evidence: { programs: list },
  };
  return flag;
};
