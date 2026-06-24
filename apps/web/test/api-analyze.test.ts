/**
 * Tests for the /api/analyze route handler (issue #19). The SDK engine and
 * the RPC are mocked — this covers the route's own responsibilities: rate
 * limiting, input validation, signature/base64 disambiguation, and that a
 * verdict is returned with no-store headers. Each test uses a distinct IP so
 * the module-level rate limiter doesn't bleed across cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const analyzeMock = vi.fn();

vi.mock("@txguardian/sdk", () => {
  class ParseError extends Error {}
  return {
    analyze: (...args: unknown[]) => analyzeMock(...args),
    ParseError,
  };
});

vi.mock("@/lib/rpc", () => ({
  getConnection: () => ({
    rpcEndpoint: "http://localhost:8899",
    getTransaction: vi.fn(async () => null),
  }),
}));

import { POST } from "@/app/api/analyze/route";

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

function post(body: unknown, ip = freshIp()): Request {
  return new Request("http://test/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => analyzeMock.mockReset());

describe("POST /api/analyze — validation", () => {
  it("400s on invalid JSON", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
  });

  it("400s when neither transaction nor signature is provided", async () => {
    const res = await POST(post({ mode: "fast" }));
    expect(res.status).toBe(400);
  });

  it("400s on oversized input (memory-bomb guard)", async () => {
    const res = await POST(post({ transaction: "A".repeat(9000) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/length/i);
  });

  it("does not call the engine for rejected input", async () => {
    await POST(post({}));
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze — happy path", () => {
  it("returns the verdict with no-store caching for a base64 tx", async () => {
    analyzeMock.mockResolvedValue({
      riskLevel: "safe",
      score: 0,
      flags: [],
      recommendation: "Safe to sign",
      decodedInstructions: [],
    });
    const res = await POST(post({ transaction: "AAAA", mode: "fast" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.riskLevel).toBe("safe");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(analyzeMock).toHaveBeenCalledOnce();
  });

  it("404s when a signature is not found on the cluster", async () => {
    // 88-char base58 → treated as a signature → connection.getTransaction
    // (mocked to return null) → signature_not_found.
    const sig = "5".repeat(88);
    const res = await POST(post({ signature: sig }));
    expect(res.status).toBe(404);
    expect((await res.json()).kind).toBe("signature_not_found");
  });
});

describe("POST /api/analyze — rate limiting", () => {
  it("429s after the per-IP budget is exhausted", async () => {
    const ip = "203.0.113.7";
    analyzeMock.mockResolvedValue({
      riskLevel: "safe",
      score: 0,
      flags: [],
      recommendation: "Safe to sign",
      decodedInstructions: [],
    });
    let last = 200;
    for (let i = 0; i < 40; i++) {
      const res = await POST(post({ transaction: "AAAA", mode: "fast" }, ip));
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
