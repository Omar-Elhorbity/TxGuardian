import { COMPUTE_BUDGET_PROGRAM_ID } from "../constants";
import type { Rule } from "./index";

const SET_COMPUTE_UNIT_PRICE = 3;
/**
 * Threshold above which a priority fee is "unusually high". Typical priority
 * fees are 1k–10k micro-lamports/CU; 1M+ is aggressive but legitimate during
 * congestion; 10M+ is suspicious. We pick 1M as the lower bound to keep this
 * a meaningful low-severity hint without becoming noise.
 */
const HIGH_PRIORITY_THRESHOLD = 1_000_000n;

function readU64LE(data: Uint8Array, offset: number): bigint | null {
  if (data.length < offset + 8) return null;
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

/**
 * Flag unusually high priority fees as a low-severity hint. Sometimes
 * indicates a drainer trying to outbid bots; often just congestion.
 */
export const detectUnusualFee: Rule = ({ parsed }) => {
  for (const ix of parsed.instructions) {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM_ID) continue;
    if (ix.data.length === 0) continue;
    if (ix.data[0] !== SET_COMPUTE_UNIT_PRICE) continue;

    const price = readU64LE(ix.data, 1);
    if (price === null) continue;
    if (price < HIGH_PRIORITY_THRESHOLD) continue;

    return {
      id: "UNUSUAL_FEE",
      severity: "low",
      label: "Unusually high priority fee",
      description: `Priority fee is ${price.toString()} micro-lamports/CU — well above typical levels. Often legitimate during congestion, occasionally a drainer trying to win the block.`,
      evidence: { microLamportsPerCu: price.toString() },
    };
  }
  return null;
};
