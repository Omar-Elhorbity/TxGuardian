import { NextResponse } from "next/server";
import { analyze, ParseError } from "@txguardian/sdk";
import { VersionedTransaction } from "@solana/web3.js";
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
 * Tx signatures are 64 bytes base58 — exactly 87 or 88 characters (varies by
 * leading-zero handling). Base58 excludes 0/O/I/l. We use this to disambiguate
 * a signature from a base64 transaction, which is much longer.
 */
const SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

function looksLikeSignature(s: string): boolean {
  return SIGNATURE_REGEX.test(s);
}

/**
 * POST /api/analyze
 * Body: {
 *   transaction?: string (base64 of an unsigned/partially-signed tx),
 *   signature?:   string (base58 sig of a mined transaction),
 *   mode?: "fast" | "full"
 * }
 *
 * Exactly one of `transaction` or `signature` must be provided. For backwards
 * compat, `transaction` is also accepted as a signature if it looks like one
 * — this means the scanner UI can have a single input box.
 *
 * Returns: { ...TxRiskResult, signature?, slot?, blockTime? } with provenance
 * fields when the input was a signature.
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

  const { transaction, signature, mode } = body as {
    transaction?: unknown;
    signature?: unknown;
    mode?: unknown;
  };

  // Pick the raw input. Allow `transaction` to carry a signature too so the
  // scanner can have a single unified text box.
  const rawInput =
    typeof signature === "string"
      ? signature.trim()
      : typeof transaction === "string"
        ? transaction.trim()
        : null;

  if (rawInput === null) {
    return NextResponse.json(
      { error: "Provide a 'transaction' (base64) or 'signature' (base58)." },
      { status: 400 },
    );
  }
  if (rawInput.length === 0 || rawInput.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "Input has invalid length." },
      { status: 400 },
    );
  }

  const resolvedMode = mode === "full" ? "full" : "fast";
  const connection = getConnection();

  // Branch 1: signature → fetch from RPC, serialize message back to base64.
  if (looksLikeSignature(rawInput)) {
    let base64: string;
    let provenance: {
      signature: string;
      slot: number;
      blockTime: number | null;
    };
    try {
      const fetched = await connection.getTransaction(rawInput, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (!fetched) {
        return NextResponse.json(
          {
            error:
              "Signature not found on this cluster. Make sure the RPC_URL matches the cluster the transaction was confirmed on.",
            kind: "signature_not_found",
          },
          { status: 404 },
        );
      }
      const message = fetched.transaction.message;
      // Reconstruct a VersionedTransaction with placeholder signatures so we
      // can serialize it back to base64. The analyzer ignores signatures.
      const sigCount = message.header.numRequiredSignatures;
      const placeholderSigs = Array.from(
        { length: sigCount },
        () => new Uint8Array(64),
      );
      const vt = new VersionedTransaction(message, placeholderSigs);
      base64 = Buffer.from(vt.serialize()).toString("base64");
      provenance = {
        signature: rawInput,
        slot: fetched.slot,
        blockTime: fetched.blockTime ?? null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: `Could not fetch transaction from RPC: ${msg}`,
          kind: "rpc_error",
        },
        { status: 502 },
      );
    }

    try {
      const result = await analyze({
        transaction: base64,
        connection,
        mode: resolvedMode,
      });
      return NextResponse.json(
        jsonSafe({ ...result, provenance }),
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch (err) {
      if (err instanceof ParseError) {
        return NextResponse.json(
          { error: err.message, kind: "parse_error" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 500 },
      );
    }
  }

  // Branch 2: base64 transaction → analyze directly.
  try {
    const result = await analyze({
      transaction: rawInput,
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
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
