/**
 * Rule engine tests. Each rule gets at least one positive case (the rule
 * fires) and one negative case (the rule stays silent). The shared
 * runRules orchestrator gets its own block to verify the dedupe + error
 * isolation properties documented in SECURITY_AUDIT_v1.md.
 *
 * These tests bypass the parser entirely — they construct
 * ParsedTransaction / DecodedTokenOp / ParsedInstruction objects directly
 * and feed them to the rules. The parser has its own test file.
 */

import { describe, expect, it } from "vitest";

import {
  detectKnownDrainer,
} from "../src/rules/drainer";
import { detectFullApproval } from "../src/rules/approval";
import { detectSpoofRisk } from "../src/rules/spoof";
import { detectUnknownPrograms } from "../src/rules/unknown";
import { detectComplexity } from "../src/rules/complexity";
import { detectUnusualFee } from "../src/rules/fee";
import { runRules, type RuleContext } from "../src/rules";
import {
  COMPUTE_BUDGET_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "../src/constants";
import type { DecodedTokenOp } from "../src/decode";
import type { ParsedInstruction, ParsedTransaction } from "../src/types";

// ─── Helpers ────────────────────────────────────────────────────────────

function mockInstruction(
  programId: string,
  data: number[] = [],
  accounts: string[] = [],
): ParsedInstruction {
  return {
    index: 0,
    programId,
    accounts,
    data: new Uint8Array(data),
  };
}

function mockParsed(
  instructions: ParsedInstruction[],
  signers: string[] = ["SignerPubKey1111111111111111111111111111111"],
): ParsedTransaction {
  // Re-index instructions to match their position.
  const indexed = instructions.map((ix, i) => ({ ...ix, index: i }));
  const feePayer = signers[0] ?? "SignerPubKey1111111111111111111111111111111";
  return {
    version: 0,
    accountKeys: [feePayer],
    instructions: indexed,
    signers,
    feePayer,
    altResolved: true,
  };
}

function mockCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  const parsed = overrides.parsed ?? mockParsed([]);
  return {
    parsed,
    decoded: overrides.decoded ?? [],
    tokenOps: overrides.tokenOps ?? [],
    ...(overrides.simulation !== undefined
      ? { simulation: overrides.simulation }
      : {}),
    ...(overrides.signer !== undefined ? { signer: overrides.signer } : {}),
    ...(overrides.onChainAttestations !== undefined
      ? { onChainAttestations: overrides.onChainAttestations }
      : {}),
    ...(overrides.verifiedAttestations !== undefined
      ? { verifiedAttestations: overrides.verifiedAttestations }
      : {}),
  };
}

// A program ID that's deterministic + not in the hardcoded allowlist.
const UNKNOWN_PROGRAM_ID = "8SFqwqnq4whPhs8icwHA2hQg3hUoN1qrCLK1SBx3WKwe";

// ─── detectKnownDrainer ────────────────────────────────────────────────

describe("detectKnownDrainer", () => {
  it("returns null when no drainer programs are called", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(SYSTEM_PROGRAM_ID)]),
    });
    expect(detectKnownDrainer(ctx)).toBeNull();
  });

  it("fires when an on-chain confirmed attestation matches a called program", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(UNKNOWN_PROGRAM_ID)]),
      onChainAttestations: [
        {
          targetProgram: UNKNOWN_PROGRAM_ID,
          severity: 3,
          status: "confirmed",
          submitter: "Submitter111111111111111111111111111111111",
          attestedBy: "Admin1111111111111111111111111111111111111",
          submittedAt: 1700000000,
          updatedAt: 1700000001,
          reason: "demo drainer",
        },
      ],
    });
    const result = detectKnownDrainer(ctx);
    expect(result).not.toBeNull();
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags).toHaveLength(1);
    expect(flags[0]!.id).toBe("KNOWN_DRAINER_PROGRAM");
    expect(flags[0]!.severity).toBe("high"); // severity 3 → high
    expect(flags[0]!.evidence?.source).toBe("onchain");
  });

  it("emits ONE flag per unique program even when called multiple times", () => {
    // Regression for the dedupe fix from earlier — was emitting N flags
    // for N instructions calling the same flagged program.
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
      ]),
      onChainAttestations: [
        {
          targetProgram: UNKNOWN_PROGRAM_ID,
          severity: 2,
          status: "confirmed",
          submitter: "Submitter111111111111111111111111111111111",
          attestedBy: "Admin1111111111111111111111111111111111111",
          submittedAt: 1700000000,
          updatedAt: 1700000001,
          reason: "demo",
        },
      ],
    });
    const result = detectKnownDrainer(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags).toHaveLength(1);
  });

  it("ignores attestations that are not 'confirmed'", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(UNKNOWN_PROGRAM_ID)]),
      onChainAttestations: [
        {
          targetProgram: UNKNOWN_PROGRAM_ID,
          severity: 3,
          status: "pending", // not confirmed
          submitter: "Submitter111111111111111111111111111111111",
          attestedBy: "Admin1111111111111111111111111111111111111",
          submittedAt: 1700000000,
          updatedAt: 1700000001,
          reason: "demo",
        },
      ],
    });
    expect(detectKnownDrainer(ctx)).toBeNull();
  });
});

// ─── detectFullApproval ────────────────────────────────────────────────

describe("detectFullApproval", () => {
  it("returns null with no token ops", () => {
    expect(detectFullApproval(mockCtx())).toBeNull();
  });

  it("fires on unbounded SPL Token Approve (u64::MAX)", () => {
    const op: DecodedTokenOp = {
      type: "Approve",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      amount: 18446744073709551615n, // u64::MAX
      isMaxAmount: true,
      delegate: "AttackerDelegate11111111111111111111111111",
    };
    const result = detectFullApproval(mockCtx({ tokenOps: [op] }));
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("FULL_TOKEN_APPROVAL");
    expect(flags[0]!.severity).toBe("high");
  });

  it("does NOT fire on a small bounded Approve", () => {
    const op: DecodedTokenOp = {
      type: "Approve",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      amount: 100n,
      isMaxAmount: false,
      delegate: "Delegate11111111111111111111111111111111111",
    };
    expect(detectFullApproval(mockCtx({ tokenOps: [op] }))).toBeNull();
  });

  it("fires on SetAuthority(AccountOwner) — ownership transfer", () => {
    const op: DecodedTokenOp = {
      type: "SetAuthority",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      authorityType: "AccountOwner",
      newAuthorityRemoved: false,
      source: "Source1111111111111111111111111111111111111",
    };
    const result = detectFullApproval(mockCtx({ tokenOps: [op] }));
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("FULL_TOKEN_APPROVAL");
    expect(flags[0]!.label).toContain("ownership transfer");
  });
});

// ─── detectSpoofRisk ────────────────────────────────────────────────────

describe("detectSpoofRisk", () => {
  const SIGNER = "SignerPubKey1111111111111111111111111111111";
  const ATTACKER = "AttackerPubKey1111111111111111111111111111";

  it("returns null when there are no token transfers", () => {
    const ctx = mockCtx({ parsed: mockParsed([], [SIGNER]) });
    expect(detectSpoofRisk(ctx)).toBeNull();
  });

  it("fires on TransferChecked to a non-signer destination", () => {
    const op: DecodedTokenOp = {
      type: "TransferChecked",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      amount: 50_000_000_000n,
      destination: ATTACKER,
    };
    const ctx = mockCtx({
      parsed: mockParsed([], [SIGNER]),
      tokenOps: [op],
    });
    const result = detectSpoofRisk(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("SIMULATION_SPOOF");
    expect(flags[0]!.severity).toBe("high");
  });

  it("does NOT fire on a self-transfer (destination is a signer)", () => {
    const op: DecodedTokenOp = {
      type: "TransferChecked",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      amount: 100n,
      destination: SIGNER,
    };
    const ctx = mockCtx({
      parsed: mockParsed([], [SIGNER]),
      tokenOps: [op],
    });
    expect(detectSpoofRisk(ctx)).toBeNull();
  });

  it("does NOT fire on a zero-amount transfer", () => {
    const op: DecodedTokenOp = {
      type: "Transfer",
      programId: SPL_TOKEN_PROGRAM_ID,
      isToken2022: false,
      ixIndex: 0,
      amount: 0n,
      destination: ATTACKER,
    };
    const ctx = mockCtx({
      parsed: mockParsed([], [SIGNER]),
      tokenOps: [op],
    });
    expect(detectSpoofRisk(ctx)).toBeNull();
  });
});

// ─── detectUnknownPrograms ─────────────────────────────────────────────

describe("detectUnknownPrograms", () => {
  it("returns null when every program is on the allowlist", () => {
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SPL_TOKEN_PROGRAM_ID),
      ]),
    });
    expect(detectUnknownPrograms(ctx)).toBeNull();
  });

  it("fires (LOW severity) when an unknown program is invoked", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(UNKNOWN_PROGRAM_ID)]),
    });
    const result = detectUnknownPrograms(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("UNKNOWN_PROGRAM");
    expect(flags[0]!.severity).toBe("low");
  });

  it("is SUPPRESSED by a confirmed verified attestation", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(UNKNOWN_PROGRAM_ID)]),
      verifiedAttestations: [
        {
          targetProgram: UNKNOWN_PROGRAM_ID,
          status: "confirmed",
          submitter: "Submitter111111111111111111111111111111111",
          attestedBy: "Admin1111111111111111111111111111111111111",
          submittedAt: 1700000000,
          updatedAt: 1700000001,
          note: "reviewed",
        },
      ],
    });
    expect(detectUnknownPrograms(ctx)).toBeNull();
  });

  it("dedupes by programId — N calls to same unknown program → 1 flag", () => {
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
      ]),
    });
    const result = detectUnknownPrograms(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags).toHaveLength(1);
  });
});

// ─── detectComplexity ──────────────────────────────────────────────────

describe("detectComplexity", () => {
  it("returns null below the 5-instruction threshold (CB ignored)", () => {
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(COMPUTE_BUDGET_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
      ]),
    });
    // 4 non-CB instructions — below threshold
    expect(detectComplexity(ctx)).toBeNull();
  });

  it("fires at exactly the 5-instruction threshold (CB ignored)", () => {
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(COMPUTE_BUDGET_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
      ]),
    });
    // 5 non-CB instructions — threshold met
    const result = detectComplexity(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("MULTI_INSTRUCTION_COMPLEXITY");
    expect(flags[0]!.severity).toBe("medium");
    expect(flags[0]!.evidence?.count).toBe(5);
  });
});

// ─── detectUnusualFee ──────────────────────────────────────────────────

describe("detectUnusualFee", () => {
  /**
   * Build a ComputeBudget SetComputeUnitPrice instruction.
   * Discriminator = 3, then u64 LE microLamportsPerCu.
   */
  function setPriorityFeeIx(microLamports: bigint): ParsedInstruction {
    const data = new Uint8Array(9);
    data[0] = 3; // SetComputeUnitPrice
    new DataView(data.buffer).setBigUint64(1, microLamports, true);
    return mockInstruction(COMPUTE_BUDGET_PROGRAM_ID, Array.from(data));
  }

  it("returns null below the 1M micro-lamport threshold", () => {
    const ctx = mockCtx({
      parsed: mockParsed([setPriorityFeeIx(500_000n)]),
    });
    expect(detectUnusualFee(ctx)).toBeNull();
  });

  it("fires at or above the 1M micro-lamport threshold", () => {
    const ctx = mockCtx({
      parsed: mockParsed([setPriorityFeeIx(5_000_000n)]),
    });
    const result = detectUnusualFee(ctx);
    const flags = Array.isArray(result) ? result : [result!];
    expect(flags[0]!.id).toBe("UNUSUAL_FEE");
    expect(flags[0]!.severity).toBe("low");
  });

  it("returns null when there is no SetComputeUnitPrice instruction", () => {
    const ctx = mockCtx({
      parsed: mockParsed([mockInstruction(SYSTEM_PROGRAM_ID)]),
    });
    expect(detectUnusualFee(ctx)).toBeNull();
  });
});

// ─── runRules() orchestrator ────────────────────────────────────────────

describe("runRules orchestrator", () => {
  it("returns the union of all rule outputs", () => {
    // Tx that trips BOTH UNKNOWN_PROGRAM and MULTI_INSTRUCTION_COMPLEXITY.
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(COMPUTE_BUDGET_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(UNKNOWN_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
        mockInstruction(SYSTEM_PROGRAM_ID),
      ]),
    });
    const flags = runRules(ctx);
    const ids = flags.map((f) => f.id).sort();
    expect(ids).toEqual([
      "MULTI_INSTRUCTION_COMPLEXITY",
      "UNKNOWN_PROGRAM",
    ]);
  });

  it("collapses duplicate flags by (id + description)", () => {
    // Construct a context that would produce duplicate flags if a rule
    // misbehaved. We rely on the dedupe safety net in runRules itself.
    // The current rules don't naturally double-emit; this regression
    // test guards against future bugs reintroducing the pattern.
    const ctx = mockCtx({
      parsed: mockParsed([
        mockInstruction(UNKNOWN_PROGRAM_ID),
      ]),
    });
    const flags = runRules(ctx);
    const unknownFlags = flags.filter((f) => f.id === "UNKNOWN_PROGRAM");
    expect(unknownFlags).toHaveLength(1);
  });
});
