/**
 * Scorer tests. The scorer maps flags → score → riskLevel → recommendation.
 * Recommendation is enum-locked to riskLevel; LLM cannot mutate it.
 */

import { describe, expect, it } from "vitest";
import { scoreFlags } from "../src/scorer";
import type { TxRiskFlag } from "../src/types";

function flag(severity: TxRiskFlag["severity"]): TxRiskFlag {
  return {
    id: "UNKNOWN_PROGRAM",
    severity,
    label: "test",
    description: "test flag",
  };
}

describe("scoreFlags", () => {
  it("empty flags → safe (score 0)", () => {
    const r = scoreFlags([]);
    expect(r.score).toBe(0);
    expect(r.riskLevel).toBe("safe");
    expect(r.recommendation).toBe("Safe to sign");
  });

  it("one low flag → safe (under caution threshold)", () => {
    // low = 10 points, caution threshold = 25
    const r = scoreFlags([flag("low")]);
    expect(r.score).toBe(10);
    expect(r.riskLevel).toBe("safe");
    expect(r.recommendation).toBe("Safe to sign");
  });

  it("one medium flag → caution (at threshold)", () => {
    // medium = 25 points, caution threshold = 25
    const r = scoreFlags([flag("medium")]);
    expect(r.score).toBe(25);
    expect(r.riskLevel).toBe("caution");
    expect(r.recommendation).toBe("Proceed with caution");
  });

  it("one high flag → caution (45 points, below danger threshold of 60)", () => {
    const r = scoreFlags([flag("high")]);
    expect(r.score).toBe(45);
    expect(r.riskLevel).toBe("caution");
  });

  it("two medium flags → caution (50 points)", () => {
    const r = scoreFlags([flag("medium"), flag("medium")]);
    expect(r.score).toBe(50);
    expect(r.riskLevel).toBe("caution");
  });

  it("two high flags → danger (90 points, above 60 threshold)", () => {
    const r = scoreFlags([flag("high"), flag("high")]);
    expect(r.score).toBe(90);
    expect(r.riskLevel).toBe("danger");
    expect(r.recommendation).toBe("Do not sign");
  });

  it("score clamps at 100 — many flags don't overflow", () => {
    const flags = Array.from({ length: 10 }, () => flag("high")); // 450 raw
    const r = scoreFlags(flags);
    expect(r.score).toBe(100);
    expect(r.riskLevel).toBe("danger");
  });
});
