import type { Severity, TxRiskFlag } from "../types";
import { KNOWN_DRAINER_MAP } from "../constants";
import type { OnChainAttestation } from "../registry";
import type { Rule } from "./index";

/**
 * Flag any program in the transaction that matches either:
 *   - the curated hardcoded `KNOWN_DRAINERS` blocklist (constants.ts), OR
 *   - a CONFIRMED attestation on the on-chain TxGuardian registry.
 *
 * Both produce a `KNOWN_DRAINER_PROGRAM` flag; the `evidence.source` field
 * distinguishes them so the UI can show provenance and the LLM can see
 * the right description without ever reading attacker-controlled `reason`
 * text from on-chain attestations (W011).
 *
 * On-chain attestations inherit severity from the on-chain `severity` byte
 * (1=low, 2=medium, 3=high). Hardcoded entries are always high — they are
 * the most-curated tier.
 */
export const detectKnownDrainer: Rule = ({ parsed, onChainAttestations }) => {
  const flags: TxRiskFlag[] = [];

  // 1. Hardcoded fallback list (currently empty by design — see constants.ts)
  const hardcodedHits = new Set<string>();
  for (const ix of parsed.instructions) {
    if (KNOWN_DRAINER_MAP.has(ix.programId)) {
      hardcodedHits.add(ix.programId);
    }
  }

  if (hardcodedHits.size > 0) {
    const addresses = Array.from(hardcodedHits);
    const names = addresses
      .map((a) => KNOWN_DRAINER_MAP.get(a)?.name ?? a)
      .join(", ");
    flags.push({
      id: "KNOWN_DRAINER_PROGRAM",
      severity: "high",
      label: "Known wallet drainer detected",
      description: `This transaction calls a program previously linked to wallet draining: ${names}.`,
      evidence: { source: "hardcoded", addresses },
    });
  }

  // 2. On-chain confirmed registry feed
  if (onChainAttestations && onChainAttestations.length > 0) {
    const onchainMap = new Map<string, OnChainAttestation>();
    for (const a of onChainAttestations) {
      if (a.status === "confirmed") onchainMap.set(a.targetProgram, a);
    }

    for (const ix of parsed.instructions) {
      const att = onchainMap.get(ix.programId);
      if (!att) continue;

      const severity: Severity =
        att.severity === 3 ? "high" : att.severity === 2 ? "medium" : "low";

      flags.push({
        id: "KNOWN_DRAINER_PROGRAM",
        severity,
        label: "Flagged on the on-chain registry",
        // NOTE: `att.reason` is attacker-controlled (anyone can submit). It's
        // intentionally NOT in the description (which the LLM sees). The UI
        // surfaces it from `evidence` with an "untrusted text" label.
        description: `Program ${shortAddr(ix.programId)} is flagged ${severityLabel(att.severity)} on the TxGuardian on-chain registry.`,
        evidence: {
          source: "onchain",
          address: ix.programId,
          severity: att.severity,
          attestedBy: att.attestedBy,
          submitter: att.submitter,
          submittedAt: att.submittedAt,
          // Reason is rendered in the UI as untrusted user text.
          reason: att.reason,
        },
      });
    }
  }

  return flags.length === 0 ? null : flags;
};

function severityLabel(s: 1 | 2 | 3): string {
  return s === 3 ? "high-risk" : s === 2 ? "medium-risk" : "low-risk";
}

function shortAddr(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}
