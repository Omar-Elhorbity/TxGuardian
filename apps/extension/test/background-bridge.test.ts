/**
 * Service-worker dispatch smoke test (issue #19). Imports background.ts with a
 * mocked `chrome` runtime + a mocked SDK, captures the registered
 * onMessage listener, and asserts the namespace/type guards gate dispatch:
 *   - foreign messages (wrong ns) are rejected (returns false, no analyze)
 *   - a valid ANALYZE_REQUEST keeps the channel open and yields a response
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

const analyzeMock = vi.fn();

vi.mock("@txguardian/sdk", () => {
  class ParseError extends Error {}
  return {
    analyze: (...args: unknown[]) => analyzeMock(...args),
    ParseError,
  };
});

// Mocked @solana/web3.js — background.ts imports Connection but only
// constructs it inside getConnection, which the mocked analyze never reaches.
vi.mock("@solana/web3.js", () => ({
  Connection: class {
    constructor(public url: string) {}
  },
}));

type OnMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (r: unknown) => void,
) => boolean | undefined;

let onMessage: OnMessageListener;

beforeAll(async () => {
  const chromeMock = {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((cb: OnMessageListener) => {
          onMessage = cb;
        }),
      },
    },
    tabs: { create: vi.fn() },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      session: { get: vi.fn(async () => ({})) },
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;
  // Dynamic import AFTER chrome is in place so import-time addListener works.
  await import("../src/background");
});

const VALID = {
  ns: "TXG",
  type: "ANALYZE_REQUEST",
  id: "req-1",
  base64: "AAAA",
  origin: "https://dapp.example",
};

describe("background onMessage guard", () => {
  it("registers a listener at import", () => {
    expect(typeof onMessage).toBe("function");
  });

  it("ignores a message without the TXG namespace", () => {
    expect(onMessage({ ns: "EVIL", type: "ANALYZE_REQUEST" }, {}, () => {})).toBe(
      false,
    );
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("ignores a TXG message of the wrong type", () => {
    expect(onMessage({ ns: "TXG", type: "SOMETHING" }, {}, () => {})).toBe(false);
  });

  it("dispatches a valid ANALYZE_REQUEST and responds", async () => {
    analyzeMock.mockResolvedValue({
      riskLevel: "safe",
      score: 0,
      flags: [],
      recommendation: "Safe to sign",
      explanation: "",
      whatThisDoes: [],
      decodedInstructions: [],
      mode: "full",
    });

    const response = await new Promise<Record<string, unknown>>((resolve) => {
      const kept = onMessage(VALID, {}, (r) => resolve(r as Record<string, unknown>));
      // Returning true keeps the channel open for the async sendResponse.
      expect(kept).toBe(true);
    });

    expect(response.ok).toBe(true);
    expect(response.type).toBe("ANALYZE_RESPONSE");
    expect(response.id).toBe("req-1");
    expect(analyzeMock).toHaveBeenCalledOnce();
  });
});
