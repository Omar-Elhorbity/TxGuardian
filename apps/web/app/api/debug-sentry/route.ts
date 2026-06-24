import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Verification endpoint for the Sentry wiring (issue #21).
 *
 * Throws an intentional, content-free error so an operator can confirm that
 * errors reach their Sentry dashboard. Gated behind `?trigger=1` so it can't
 * become a permanent 500 in production, and the error carries no transaction
 * data. See docs/observability.md for the verification procedure.
 *
 *   GET /api/debug-sentry?trigger=1  → throws (captured by onRequestError)
 *   GET /api/debug-sentry            → 404
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("trigger") !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  throw new Error("TxGuardian Sentry verification error (intentional, no data).");
}
