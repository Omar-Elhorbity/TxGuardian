import type { ParsedInstruction, DecodedInstruction } from "./types";
import {
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  isComputeBudgetProgram,
  isTokenProgram,
  lookupProgramName,
} from "./constants";

const U64_MAX = (1n << 64n) - 1n;

const TOKEN_INSTRUCTION = {
  InitializeMint: 0,
  InitializeAccount: 1,
  InitializeMultisig: 2,
  Transfer: 3,
  Approve: 4,
  Revoke: 5,
  SetAuthority: 6,
  MintTo: 7,
  Burn: 8,
  CloseAccount: 9,
  FreezeAccount: 10,
  ThawAccount: 11,
  TransferChecked: 12,
  ApproveChecked: 13,
  MintToChecked: 14,
  BurnChecked: 15,
  SyncNative: 17,
} as const;

const AUTHORITY_TYPE_NAMES: Record<number, string> = {
  0: "MintTokens",
  1: "FreezeAccount",
  2: "AccountOwner",
  3: "CloseAccount",
};

const SYSTEM_INSTRUCTION_NAMES: Record<number, string> = {
  0: "CreateAccount",
  1: "Assign",
  2: "Transfer",
  3: "CreateAccountWithSeed",
  4: "AdvanceNonceAccount",
  5: "WithdrawNonceAccount",
  6: "InitializeNonceAccount",
  7: "AuthorizeNonceAccount",
  8: "Allocate",
  9: "AllocateWithSeed",
  10: "AssignWithSeed",
  11: "TransferWithSeed",
  12: "UpgradeNonceAccount",
};

const COMPUTE_BUDGET_NAMES: Record<number, string> = {
  0: "RequestUnitsDeprecated",
  1: "RequestHeapFrame",
  2: "SetComputeUnitLimit",
  3: "SetComputeUnitPrice",
};

const MEMO_PROGRAM_IDS = new Set([
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
]);

function readU64LE(data: Uint8Array, offset: number): bigint | null {
  if (data.length < offset + 8) return null;
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

function readU32LE(data: Uint8Array, offset: number): number | null {
  if (data.length < offset + 4) return null;
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  return view.getUint32(0, true);
}

function shortAddr(addr: string | undefined): string {
  if (!addr) return "?";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/**
 * Structured decode of an SPL Token / Token-2022 instruction.
 * All fields optional — caller must handle malformed instructions gracefully.
 */
export interface DecodedTokenOp {
  type:
    | "Approve"
    | "ApproveChecked"
    | "Transfer"
    | "TransferChecked"
    | "SetAuthority"
    | "Revoke"
    | "Burn"
    | "BurnChecked"
    | "CloseAccount"
    | "MintTo"
    | "MintToChecked"
    | "InitializeAccount"
    | "Other";
  programId: string;
  isToken2022: boolean;
  ixIndex: number;
  amount?: bigint;
  isMaxAmount?: boolean;
  authorityType?: string;
  /** null = removing authority; undefined = not applicable. */
  newAuthorityRemoved?: boolean;
  source?: string;
  destination?: string;
  delegate?: string;
  owner?: string;
  /** Token-2022 extension opcode if op >= 26. */
  extension?: number;
}

function decodeTokenInstruction(ix: ParsedInstruction): DecodedTokenOp | null {
  if (ix.data.length === 0) return null;
  const op = ix.data[0]!;
  const isToken2022 = ix.programId === TOKEN_2022_PROGRAM_ID;
  const base = {
    programId: ix.programId,
    isToken2022,
    ixIndex: ix.index,
  };

  switch (op) {
    case TOKEN_INSTRUCTION.Approve: {
      const amount = readU64LE(ix.data, 1);
      return {
        ...base,
        type: "Approve",
        amount: amount ?? undefined,
        isMaxAmount: amount === U64_MAX,
        source: ix.accounts[0],
        delegate: ix.accounts[1],
        owner: ix.accounts[2],
      };
    }
    case TOKEN_INSTRUCTION.ApproveChecked: {
      const amount = readU64LE(ix.data, 1);
      return {
        ...base,
        type: "ApproveChecked",
        amount: amount ?? undefined,
        isMaxAmount: amount === U64_MAX,
        source: ix.accounts[0],
        delegate: ix.accounts[2],
        owner: ix.accounts[3],
      };
    }
    case TOKEN_INSTRUCTION.SetAuthority: {
      const authorityTypeByte = ix.data[1] ?? -1;
      const optionFlag = ix.data[2] ?? 0;
      return {
        ...base,
        type: "SetAuthority",
        authorityType:
          AUTHORITY_TYPE_NAMES[authorityTypeByte] ??
          `Unknown(${authorityTypeByte})`,
        newAuthorityRemoved: optionFlag === 0,
        source: ix.accounts[0],
        owner: ix.accounts[1],
      };
    }
    case TOKEN_INSTRUCTION.Transfer: {
      return {
        ...base,
        type: "Transfer",
        amount: readU64LE(ix.data, 1) ?? undefined,
        source: ix.accounts[0],
        destination: ix.accounts[1],
        owner: ix.accounts[2],
      };
    }
    case TOKEN_INSTRUCTION.TransferChecked: {
      return {
        ...base,
        type: "TransferChecked",
        amount: readU64LE(ix.data, 1) ?? undefined,
        source: ix.accounts[0],
        destination: ix.accounts[2],
        owner: ix.accounts[3],
      };
    }
    case TOKEN_INSTRUCTION.Revoke:
      return {
        ...base,
        type: "Revoke",
        source: ix.accounts[0],
        owner: ix.accounts[1],
      };
    case TOKEN_INSTRUCTION.Burn:
      return {
        ...base,
        type: "Burn",
        amount: readU64LE(ix.data, 1) ?? undefined,
        source: ix.accounts[0],
      };
    case TOKEN_INSTRUCTION.BurnChecked:
      return {
        ...base,
        type: "BurnChecked",
        amount: readU64LE(ix.data, 1) ?? undefined,
        source: ix.accounts[0],
      };
    case TOKEN_INSTRUCTION.CloseAccount:
      return {
        ...base,
        type: "CloseAccount",
        source: ix.accounts[0],
        destination: ix.accounts[1],
        owner: ix.accounts[2],
      };
    case TOKEN_INSTRUCTION.MintTo:
      return {
        ...base,
        type: "MintTo",
        amount: readU64LE(ix.data, 1) ?? undefined,
        destination: ix.accounts[1],
      };
    case TOKEN_INSTRUCTION.MintToChecked:
      return {
        ...base,
        type: "MintToChecked",
        amount: readU64LE(ix.data, 1) ?? undefined,
        destination: ix.accounts[1],
      };
    case TOKEN_INSTRUCTION.InitializeAccount:
      return {
        ...base,
        type: "InitializeAccount",
        source: ix.accounts[0],
      };
    default:
      return {
        ...base,
        type: "Other",
        extension: isToken2022 && op >= 26 ? op : undefined,
      };
  }
}

function summarizeToken(op: DecodedTokenOp): string {
  const variant = op.isToken2022 ? "Token-2022" : "SPL Token";
  switch (op.type) {
    case "Approve":
    case "ApproveChecked": {
      if (op.isMaxAmount) {
        return `${variant} ${op.type}: UNLIMITED amount to delegate ${shortAddr(op.delegate)}`;
      }
      return `${variant} ${op.type}: ${op.amount?.toString() ?? "?"} units to delegate ${shortAddr(op.delegate)}`;
    }
    case "SetAuthority":
      return op.newAuthorityRemoved
        ? `${variant} SetAuthority: REMOVE ${op.authorityType} authority`
        : `${variant} SetAuthority: change ${op.authorityType} to a new account`;
    case "Transfer":
    case "TransferChecked":
      return `${variant} ${op.type}: ${op.amount?.toString() ?? "?"} units to ${shortAddr(op.destination)}`;
    case "Revoke":
      return `${variant} Revoke: clear delegate authority`;
    case "Burn":
    case "BurnChecked":
      return `${variant} ${op.type}: ${op.amount?.toString() ?? "?"} units`;
    case "CloseAccount":
      return `${variant} CloseAccount: close ${shortAddr(op.source)}, remainder to ${shortAddr(op.destination)}`;
    case "MintTo":
    case "MintToChecked":
      return `${variant} ${op.type}: ${op.amount?.toString() ?? "?"} units to ${shortAddr(op.destination)}`;
    case "InitializeAccount":
      return `${variant} InitializeAccount: ${shortAddr(op.source)}`;
    case "Other":
      if (op.extension != null) {
        return `${variant} extension instruction (op ${op.extension})`;
      }
      return `${variant} unknown instruction`;
  }
}

function formatSolFromLamports(lamports: bigint): string {
  const sol = Number(lamports) / 1_000_000_000;
  if (sol === 0) return "0 SOL";
  if (sol < 0.000001) return `${lamports} lamports`;
  return `${sol.toFixed(9).replace(/\.?0+$/, "")} SOL`;
}

/**
 * Decode a single instruction into a DecodedInstruction record.
 *
 * SECURITY (W011): When the instruction is a Memo, the on-chain text payload
 * is NEVER included verbatim in the summary — that text is attacker-controlled
 * and may contain prompt injection, misleading claims, or social-engineering
 * content. We only acknowledge memo presence and byte length.
 */
export function decodeInstruction(ix: ParsedInstruction): DecodedInstruction {
  const programName = lookupProgramName(ix.programId);

  if (isTokenProgram(ix.programId)) {
    const tok = decodeTokenInstruction(ix);
    if (tok) {
      return {
        index: ix.index,
        programId: ix.programId,
        programName,
        accounts: ix.accounts,
        type: `spl-token:${tok.type}`,
        summary: summarizeToken(tok),
      };
    }
  }

  if (isComputeBudgetProgram(ix.programId)) {
    const op = ix.data[0] ?? -1;
    const name = COMPUTE_BUDGET_NAMES[op] ?? `Op ${op}`;
    let summary = `Set compute budget (${name})`;
    if (op === 2) {
      const limit = readU32LE(ix.data, 1);
      if (limit != null) summary = `Set compute unit limit to ${limit.toLocaleString()}`;
    } else if (op === 3) {
      const price = readU64LE(ix.data, 1);
      if (price != null) summary = `Set priority fee at ${price.toString()} micro-lamports/CU`;
    }
    return {
      index: ix.index,
      programId: ix.programId,
      programName,
      accounts: ix.accounts,
      type: `compute-budget:${name}`,
      summary,
    };
  }

  if (ix.programId === SYSTEM_PROGRAM_ID) {
    const op = readU32LE(ix.data, 0);
    const name =
      op != null
        ? SYSTEM_INSTRUCTION_NAMES[op] ?? `Op ${op}`
        : "Unknown";
    let summary = `System Program: ${name}`;
    if (op === 2) {
      const lamports = readU64LE(ix.data, 4);
      const dest = ix.accounts[1];
      if (lamports != null && dest) {
        summary = `Transfer ${formatSolFromLamports(lamports)} to ${shortAddr(dest)}`;
      }
    } else if (op === 0) {
      const lamports = readU64LE(ix.data, 4);
      if (lamports != null) {
        summary = `Create account funded with ${formatSolFromLamports(lamports)}`;
      }
    }
    return {
      index: ix.index,
      programId: ix.programId,
      programName,
      accounts: ix.accounts,
      type: `system:${name}`,
      summary,
    };
  }

  if (MEMO_PROGRAM_IDS.has(ix.programId)) {
    return {
      index: ix.index,
      programId: ix.programId,
      programName,
      accounts: ix.accounts,
      type: "memo",
      summary: `Attaches a memo (untrusted text, ${ix.data.length} bytes — content not displayed)`,
    };
  }

  return {
    index: ix.index,
    programId: ix.programId,
    programName,
    accounts: ix.accounts,
    summary: `${programName} instruction (${ix.data.length} bytes data)`,
  };
}

/**
 * Decode all instructions in a parsed transaction. Returns both the
 * UI-facing DecodedInstruction[] and the structured token operations
 * for rule consumption.
 */
export function decodeAll(instructions: ParsedInstruction[]): {
  decoded: DecodedInstruction[];
  tokenOps: DecodedTokenOp[];
} {
  const decoded: DecodedInstruction[] = [];
  const tokenOps: DecodedTokenOp[] = [];
  for (const ix of instructions) {
    decoded.push(decodeInstruction(ix));
    if (isTokenProgram(ix.programId)) {
      const tok = decodeTokenInstruction(ix);
      if (tok) tokenOps.push(tok);
    }
  }
  return { decoded, tokenOps };
}

// Re-export constants used by rules.
export const _internal = {
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
};
