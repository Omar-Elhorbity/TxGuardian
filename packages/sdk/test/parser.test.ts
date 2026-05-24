/**
 * Parser input-validation tests. Focused on the security-relevant edge
 * cases: oversized input (memory bomb), empty input, malformed base64.
 * Successful-parse paths are covered indirectly by end-to-end testing
 * (the live /api/analyze round-trip in earlier sessions).
 */

import { describe, expect, it } from "vitest";
import { parseTransaction, ParseError } from "../src/parser";

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
