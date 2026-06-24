/**
 * Parser input-validation tests. Focused on the security-relevant edge
 * cases: oversized input (memory bomb), empty input, malformed base64.
 * Successful-parse paths are covered indirectly by end-to-end testing
 * (the live /api/analyze round-trip in earlier sessions).
 */

import { describe, expect, it } from "vitest";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  parseTransaction,
  ParseError,
  toVersionedTransaction,
} from "../src/parser";

// No ALTs in these fixtures, so no RPC is hit — a bare stub suffices.
const STUB_CONN = {} as unknown as Connection;
const ZERO_BLOCKHASH = "11111111111111111111111111111111";

function v0Transfer(): { vtx: VersionedTransaction; payer: Keypair } {
  const payer = Keypair.generate();
  const dest = Keypair.generate();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: ZERO_BLOCKHASH,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: dest.publicKey,
        lamports: 1000,
      }),
    ],
  }).compileToV0Message();
  return { vtx: new VersionedTransaction(msg), payer };
}

// We don't need a real Connection for these tests — every failure case
// rejects before any RPC call. Cast a stub through unknown to satisfy
// the type checker.
const STUB_CONNECTION = {} as never;

describe("parseTransaction — input validation", () => {
  it("rejects empty input", async () => {
    await expect(parseTransaction("", STUB_CONNECTION)).rejects.toBeInstanceOf(
      ParseError,
    );
  });

  it("rejects oversized input before decoding (memory-bomb guard)", async () => {
    // Build a string longer than 2 * MAX_TX_BYTES = 8192 chars. Should
    // reject at the size-check, never reach atob().
    const oversized = "A".repeat(10_000);
    await expect(
      parseTransaction(oversized, STUB_CONNECTION),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("rejects malformed base64", async () => {
    // Characters outside base64 alphabet that also aren't URL-safe variants.
    await expect(
      parseTransaction("!!!@@@###", STUB_CONNECTION),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("rejects valid base64 that decodes to invalid Solana bytes", async () => {
    // Valid base64 ("AAAA" = 3 zero bytes) but not a valid Solana
    // transaction structure.
    await expect(
      parseTransaction("AAAA", STUB_CONNECTION),
    ).rejects.toBeInstanceOf(ParseError);
  });
});

describe("parseTransaction — success paths", () => {
  it("parses a base64 v0 transaction (instructions, fee payer, signers)", async () => {
    const { vtx, payer } = v0Transfer();
    const base64 = Buffer.from(vtx.serialize()).toString("base64");
    const parsed = await parseTransaction(base64, STUB_CONN);

    expect(parsed.version).toBe(0);
    expect(parsed.feePayer).toBe(payer.publicKey.toBase58());
    expect(parsed.signers[0]).toBe(payer.publicKey.toBase58());
    expect(parsed.instructions).toHaveLength(1);
    expect(parsed.instructions[0]!.programId).toBe(
      SystemProgram.programId.toBase58(),
    );
    expect(parsed.altResolved).toBe(true);
  });

  it("accepts a VersionedTransaction object directly", async () => {
    const { vtx, payer } = v0Transfer();
    const parsed = await parseTransaction(vtx, STUB_CONN);
    expect(parsed.feePayer).toBe(payer.publicKey.toBase58());
  });

  it("compiles + parses a legacy Transaction", async () => {
    const payer = Keypair.generate();
    const dest = Keypair.generate();
    const tx = new Transaction();
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: dest.publicKey,
        lamports: 5,
      }),
    );
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = ZERO_BLOCKHASH;

    const parsed = await parseTransaction(tx, STUB_CONN);
    expect(parsed.version).toBe("legacy");
    expect(parsed.instructions).toHaveLength(1);
    expect(parsed.feePayer).toBe(payer.publicKey.toBase58());
  });

  it("toVersionedTransaction round-trips a base64 input", () => {
    const { vtx } = v0Transfer();
    const base64 = Buffer.from(vtx.serialize()).toString("base64");
    const out = toVersionedTransaction(base64);
    expect(out).toBeInstanceOf(VersionedTransaction);
  });
});
