/**
 * Message-guard smoke tests (issue #19). `isExtensionMessage` is the gate
 * every cross-context message passes through in both content.ts and
 * background.ts — it's the defence against a random page postMessage being
 * mistaken for a TxGuardian message (threat model §4.2). These tests pin that
 * behaviour.
 */

import { describe, it, expect } from "vitest";
import { isExtensionMessage, newId, MSG_NAMESPACE } from "../src/types";

describe("isExtensionMessage", () => {
  it("accepts a well-formed TXG message", () => {
    expect(
      isExtensionMessage({ ns: MSG_NAMESPACE, type: "ANALYZE_REQUEST", id: "1" }),
    ).toBe(true);
  });

  it("rejects foreign / forged postMessage payloads", () => {
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage(undefined)).toBe(false);
    expect(isExtensionMessage("TXG")).toBe(false);
    expect(isExtensionMessage(42)).toBe(false);
    expect(isExtensionMessage({})).toBe(false);
    expect(isExtensionMessage({ ns: "SOMETHING_ELSE" })).toBe(false);
    expect(isExtensionMessage({ type: "ANALYZE_REQUEST" })).toBe(false);
  });
});

describe("newId", () => {
  it("produces non-empty, unique ids", () => {
    const a = newId();
    const b = newId();
    expect(a).toMatch(/-/);
    expect(a.length).toBeGreaterThan(3);
    expect(a).not.toBe(b);
  });
});
