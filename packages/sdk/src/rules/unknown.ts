import type { TxRiskFlag } from "../types";
import { isKnownProgram, KNOWN_DRAINER_MAP } from "../constants";
import type { OnChainAttestation } from "../registry";
import type { Rule } from "./index";

/**
 * Inverse-allowlist rule: any program not on the well-known list earns
 * an UNKNOWN_PROGRAM flag. Drainers get their own (more severe) flag and
 * are excluded here to avoid double-flagging. Programs that have a
 * CONFIRMED positive attestation in the on-chain verified registry are
 * also skipped — the community has reviewed them as safe.
 *
 * Severity: LOW. The Solana ecosystem grows daily; many legitimate new
 * programs won't be on a static allowlist or on the verified feed yet.
 * Treating "we don't recognize this" as a high-confidence warning leads
 * to alarm fatigue. Surface it as an informational signal that adds to
 * the score only when combined with other findings.
 */
export const detectUnknownPrograms: Rule = ({
  parsed,
  verifiedAttestations,
}) => {
  const verifiedSet = new Set<string>();
  if (verifiedAttestations) {
    for (const v of verifiedAttestations) {
      if (v.status === "confirmed") verifiedSet.add(v.targetProgram);
    }
  }

  const unknown = new Set<string>();
  for (const ix of parsed.instructions) {
    if (KNOWN_DRAINER_MAP.has(ix.programId)) continue;
    if (isKnownProgram(ix.programId)) continue;
    if (verifiedSet.has(ix.programId)) continue;
    unknown.add(ix.programId);
  }
  if (unknown.size === 0) return null;

  const list = Array.from(unknown);
  const description =
    list.length === 1
      ? "We don't recognize this program. New programs launch on Solana constantly, so this often just means it's unfamiliar — not necessarily malicious. Make sure you trust the dApp asking you to sign."
      : `We don't recognize ${list.length} of the programs in this transaction. New programs launch on Solana constantly, so they're often legitimate but unfamiliar — verify the dApp before signing.`;

  const flag: TxRiskFlag = {
    id: "UNKNOWN_PROGRAM",
    severity: "low",
    label: "Unverified program",
    description,
    evidence: { programs: list },
  };
  return flag;
};

// Re-export the type so the rule context typing in index.ts compiles when
// callers haven't yet plumbed verifiedAttestations through.
export type { OnChainAttestation };
