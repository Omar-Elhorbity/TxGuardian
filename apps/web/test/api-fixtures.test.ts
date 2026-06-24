/**
 * Tests for the /api/fixtures route handler (issue #19). The no-payer path
 * builds a deterministic sample with the real fixture builder (no RPC), so
 * most of this needs no mocks — it covers type validation, the analysis-only
 * happy path, and payer-pubkey validation.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/fixtures/route";

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.1.0.${ipCounter}`;
}

function get(query: string, ip = freshIp()): Request {
  return new Request(`http://test/api/fixtures${query}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("GET /api/fixtures", () => {
  it("400s on a missing/unknown fixture type", async () => {
    expect((await GET(get(""))).status).toBe(400);
    expect((await GET(get("?type=bogus"))).status).toBe(400);
  });

  it("returns a deterministic, non-signable sample for a known type", async () => {
    const res = await GET(get("?type=safe"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("safe");
    expect(typeof body.transaction).toBe("string");
    expect(body.transaction.length).toBeGreaterThan(0);
    expect(body.signable).toBe(false);
    // Deterministic analysis-only sample → cacheable.
    expect(res.headers.get("Cache-Control")).toContain("max-age");
  });

  it("400s on an invalid payer pubkey", async () => {
    const res = await GET(get("?type=danger&payer=not-a-real-pubkey"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/payer/i);
  });
});
