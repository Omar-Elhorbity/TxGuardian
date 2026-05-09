import type { TxRiskFlag } from "../types.js";
import type { Rule } from "./index.js";

/**
 * Threshold above which an Approve amount is treated as effectively unlimited.
 * Real apps almost never need approvals beyond a few orders of magnitude past
 * the user's balance; anything in the 10^18+ range is indistinguishable from
 * "all of it" and should be surfaced as such.
 */
const VERY_LARGE_APPROVAL = 1_000_000_000_000_000_000n; // 1e18

/**
 * Flag dangerous token approvals:
 *   - SPL Token / Token-2022 Approve or ApproveChecked with amount = u64::MAX
 *     or absurdly large (>= 1e18).
 *   - SetAuthority with AccountOwner type (transfers ownership of the token
 *     account itself — strictly worse than Approve).
 *
 * Includes the previously-separate "suspicious account delegation" pattern
 * as a sub-case: any AccountOwner SetAuthority is flagged here.
 */
export const detectFullApproval: Rule = ({ tokenOps }) => {
  const flags: TxRiskFlag[] = [];
  const seenSubcases = new Set<string>();

  for (const op of tokenOps) {
    if (op.type === "Approve" || op.type === "ApproveChecked") {
      const amount = op.amount ?? 0n;
      const unlimited = op.isMaxAmount === true || amount >= VERY_LARGE_APPROVAL;
      if (!unlimited) continue;

      const variant = op.isToken2022 ? "Token-2022" : "SPL Token";
      const evidenceKey = `approve:${op.delegate ?? "?"}`;
      if (seenSubcases.has(evidenceKey)) continue;
      seenSubcases.add(evidenceKey);

      flags.push({
        id: "FULL_TOKEN_APPROVAL",
        severity: "high",
        label: "Unlimited token approval",
        description: `This transaction grants UNLIMITED ${variant} approval to a delegate. The delegate can transfer your tokens at any time, without further confirmation.`,
        evidence: {
          subcase: "approve",
          variant,
          delegate: op.delegate,
          amount: op.amount?.toString(),
        },
      });
    } else if (
      op.type === "SetAuthority" &&
      op.authorityType === "AccountOwner"
    ) {
      const variant = op.isToken2022 ? "Token-2022" : "SPL Token";
      const removed = op.newAuthorityRemoved === true;
      const evidenceKey = `setauthority:${op.source ?? "?"}`;
      if (seenSubcases.has(evidenceKey)) continue;
      seenSubcases.add(evidenceKey);

      flags.push({
        id: "FULL_TOKEN_APPROVAL",
        severity: "high",
        label: removed
          ? "Token account owner removal"
          : "Token account ownership transfer",
        description: removed
          ? `This transaction REMOVES the owner of a ${variant} account. After this, no one can move funds out of the account.`
          : `This transaction TRANSFERS ownership of a ${variant} account to another address. The new owner controls all funds in that account.`,
        evidence: {
          subcase: "setauthority",
          variant,
          authorityType: op.authorityType,
          source: op.source,
          removed,
        },
      });
    }
  }

  return flags.length === 0 ? null : flags;
};
