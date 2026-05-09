import {
  type Connection,
  type AddressLookupTableAccount,
  Message,
  MessageV0,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import type { ParsedTransaction, ParsedInstruction } from "./types";

/**
 * Hard cap on input size. A real Solana transaction is at most 1232 bytes
 * (the network packet limit), so 4096 leaves comfortable headroom while
 * preventing memory bombs from adversarial input.
 */
const MAX_TX_BYTES = 4096;

export class ParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Decode a base64 string into bytes, tolerating URL-safe variants.
 * Throws ParseError for empty, oversized, or undecodable input.
 *
 * SECURITY: input is treated as fully untrusted. We validate size before and
 * after decoding; we do not interpret any bytes until VersionedTransaction.
 */
function decodeBase64(input: string): Uint8Array {
  if (typeof input !== "string" || input.length === 0) {
    throw new ParseError("Transaction input is empty.");
  }
  if (input.length > MAX_TX_BYTES * 2) {
    throw new ParseError("Transaction input exceeds maximum size.");
  }
  const normalized = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  let bytes: Buffer;
  try {
    bytes = Buffer.from(normalized, "base64");
  } catch (err) {
    throw new ParseError("Could not decode base64 transaction.", err);
  }
  if (bytes.length === 0 || bytes.length > MAX_TX_BYTES) {
    throw new ParseError(
      `Decoded transaction has invalid size: ${bytes.length} bytes.`,
    );
  }
  return new Uint8Array(bytes);
}

/**
 * Normalize any accepted input shape into a VersionedTransaction.
 * Legacy Transactions are compiled into a v0-compatible message wrapper.
 */
function normalizeToVersioned(
  input: string | Transaction | VersionedTransaction,
): VersionedTransaction {
  if (typeof input === "string") {
    const bytes = decodeBase64(input);
    try {
      return VersionedTransaction.deserialize(bytes);
    } catch (err) {
      throw new ParseError(
        "Failed to deserialize transaction. Input may be malformed or not a Solana transaction.",
        err,
      );
    }
  }
  if (input instanceof VersionedTransaction) {
    return input;
  }
  if (input instanceof Transaction) {
    // Legacy Transactions need recentBlockhash + feePayer to compile.
    // We only use the compiled message for analysis — never to send.
    if (!input.recentBlockhash) {
      input.recentBlockhash = "11111111111111111111111111111111";
    }
    if (!input.feePayer) {
      const firstSigner = input.signatures[0]?.publicKey;
      if (firstSigner) {
        input.feePayer = firstSigner;
      } else {
        throw new ParseError(
          "Legacy Transaction has no fee payer or signers; cannot compile for analysis.",
        );
      }
    }
    const message = input.compileMessage();
    return new VersionedTransaction(message);
  }
  throw new ParseError("Unsupported transaction input type.");
}

/**
 * Resolve all ALTs referenced by a v0 transaction. Best-effort: if any
 * lookup fails (RPC error or table not found), we proceed with the tables
 * we have and set altResolved=false. Rules can degrade accordingly.
 */
async function resolveAlts(
  message: MessageV0,
  connection: Connection,
): Promise<{ accounts: AddressLookupTableAccount[]; resolved: boolean }> {
  const lookups = message.addressTableLookups;
  if (lookups.length === 0) {
    return { accounts: [], resolved: true };
  }

  const results = await Promise.all(
    lookups.map(async (lookup) => {
      try {
        const res = await connection.getAddressLookupTable(lookup.accountKey);
        return res.value;
      } catch {
        return null;
      }
    }),
  );

  const accounts = results.filter(
    (a): a is AddressLookupTableAccount => a !== null,
  );
  const resolved = accounts.length === lookups.length;
  return { accounts, resolved };
}

/**
 * Decode legacy instruction data which is stored as a base58 string.
 * v0 compiled instructions already carry data as Uint8Array.
 */
function decodeLegacyData(data: string): Uint8Array {
  if (!data) return new Uint8Array();
  try {
    return bs58.decode(data);
  } catch {
    // Malformed data — return empty. Rules that inspect data will skip.
    return new Uint8Array();
  }
}

/**
 * Public parser: takes any accepted transaction input and returns a
 * normalized ParsedTransaction with all account keys resolved (including
 * v0 ALT entries) and all instructions converted to a uniform shape.
 *
 * Always async because v0 ALT resolution may require RPC calls.
 */
export async function parseTransaction(
  input: string | Transaction | VersionedTransaction,
  connection: Connection,
): Promise<ParsedTransaction> {
  const vtx = normalizeToVersioned(input);
  const message = vtx.message;
  const isV0 = message.version === 0;

  let altAccounts: AddressLookupTableAccount[] = [];
  let altResolved = true;
  if (isV0) {
    const result = await resolveAlts(message as MessageV0, connection);
    altAccounts = result.accounts;
    altResolved = result.resolved;
  }

  const accountKeysObject = message.getAccountKeys({
    addressLookupTableAccounts: altAccounts.length > 0 ? altAccounts : undefined,
  });

  // keySegments() returns [staticKeys, writableALTKeys, readonlyALTKeys] in canonical order.
  const segments = accountKeysObject.keySegments();
  const accountKeys = segments.flat().map((k: PublicKey) => k.toBase58());

  // Build normalized instructions.
  const instructions: ParsedInstruction[] = [];
  if (isV0) {
    const compiled = (message as MessageV0).compiledInstructions;
    compiled.forEach((ix, idx) => {
      const programId = accountKeys[ix.programIdIndex];
      if (!programId) return;
      const accounts: string[] = [];
      for (const i of ix.accountKeyIndexes) {
        const k = accountKeys[i];
        if (typeof k === "string") accounts.push(k);
      }
      instructions.push({
        index: idx,
        programId,
        accounts,
        data: new Uint8Array(ix.data),
      });
    });
  } else {
    const legacyMsg = message as Message;
    legacyMsg.instructions.forEach((ix, idx) => {
      const programId = accountKeys[ix.programIdIndex];
      if (!programId) return;
      const accounts: string[] = [];
      for (const i of ix.accounts) {
        const k = accountKeys[i];
        if (typeof k === "string") accounts.push(k);
      }
      instructions.push({
        index: idx,
        programId,
        accounts,
        data: decodeLegacyData(ix.data),
      });
    });
  }

  const numSigners = message.header.numRequiredSignatures;
  const signers = accountKeys.slice(0, numSigners);
  const feePayer = signers[0] ?? "";

  return {
    version: isV0 ? 0 : "legacy",
    accountKeys,
    instructions,
    signers,
    feePayer,
    altResolved,
    recentBlockhash: message.recentBlockhash,
  };
}

/**
 * Re-serialize a parsed input back to a VersionedTransaction. Used by the
 * simulation step which needs the raw v0 transaction object. We keep this
 * in the parser module so the SDK has a single source of truth on
 * normalization.
 */
export function toVersionedTransaction(
  input: string | Transaction | VersionedTransaction,
): VersionedTransaction {
  return normalizeToVersioned(input);
}
