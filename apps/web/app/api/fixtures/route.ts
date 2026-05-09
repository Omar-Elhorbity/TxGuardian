import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { FIXTURES, type FixtureId } from "@/lib/fixtures";
import { getConnection } from "@/lib/rpc";

export const runtime = "nodejs";

/**
 * GET /api/fixtures?type=safe|caution|danger&payer=<base58>?
 *
 * Builds and returns a sample transaction in base64.
 *
 * - Without `payer`: returns a deterministic analysis-only sample with a
 *   mock fee payer and a placeholder blockhash. Cannot be signed.
 * - With `payer`: rebuilds the sample using `payer` as the fee payer and
 *   fetches a fresh blockhash so the connected wallet can sign + submit.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const payerStr = url.searchParams.get("payer");

  if (!type || !(type in FIXTURES)) {
    return NextResponse.json(
      { error: "Unknown fixture type. Use one of: safe, caution, danger." },
      { status: 400 },
    );
  }

  let payer: PublicKey | undefined;
  let recentBlockhash: string | undefined;

  if (payerStr) {
    try {
      payer = new PublicKey(payerStr);
    } catch {
      return NextResponse.json(
        { error: "Invalid payer pubkey." },
        { status: 400 },
      );
    }

    try {
      const connection = getConnection();
      const latest = await connection.getLatestBlockhash("confirmed");
      recentBlockhash = latest.blockhash;
    } catch {
      return NextResponse.json(
        { error: "Could not fetch a recent blockhash from the RPC." },
        { status: 502 },
      );
    }
  }

  const fixture = FIXTURES[type as FixtureId];
  const transaction = fixture.build({
    ...(payer ? { payer } : {}),
    ...(recentBlockhash ? { recentBlockhash } : {}),
  });

  // Signable samples carry a fresh blockhash so they expire — don't cache.
  // Analysis-only samples are deterministic and safe to cache.
  const cacheControl = payerStr
    ? "no-store"
    : "public, max-age=3600";

  return NextResponse.json(
    {
      type,
      title: fixture.title,
      description: fixture.description,
      transaction,
      signable: payerStr !== null,
    },
    { headers: { "Cache-Control": cacheControl } },
  );
}
