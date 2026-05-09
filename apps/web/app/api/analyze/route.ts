import { NextResponse } from "next/server";
import { analyze, ParseError } from "@txguardian/sdk";
import { getConnection } from "@/lib/rpc";
import { jsonSafe } from "@/lib/json-safe";

export const runtime = "nodejs";

/**
 * Conservative input cap. Real Solana transactions are at most 1232 bytes,
 * which base64-encodes to ~1644 chars. 8192 is a comfortable upper bound that
 * still rejects obvious memory bombs.
 */
const MAX_INPUT_CHARS = 8192;

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 30;
const ipHits = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || hit.reset < now) {
    ipHits.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (hit.count >= RATE_LIMIT_MAX) return false;
  hit.count++;
  return true;
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * POST /api/analyze
 * Body: { transaction: string (base64), mode?: "fast" | "full" }
 *
 * Runs the SDK on the input and returns the TxRiskResult as JSON. BigInt
 * fields in evidence are stringified safely. Errors return 4xx/5xx with a
 * short, non-leaky message.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Body must be a JSON object." },
      { status: 400 },
    );
  }

  const { transaction, mode } = body as {
    transaction?: unknown;
    mode?: unknown;
  };

  if (typeof transaction !== "string") {
    return NextResponse.json(
      { error: "Field 'transaction' must be a base64 string." },
      { status: 400 },
    );
  }
  if (transaction.length === 0 || transaction.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "Field 'transaction' has invalid length." },
      { status: 400 },
    );
  }

  const resolvedMode = mode === "full" ? "full" : "fast";
  const connection = getConnection();

  try {
    const result = await analyze({
      transaction,
      connection,
      mode: resolvedMode,
    });

    return NextResponse.json(jsonSafe(result), {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json(
        { error: err.message, kind: "parse_error" },
        { status: 400 },
      );
    }
    // Don't leak internals in the error message.
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
