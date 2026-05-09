import { NextResponse } from "next/server";
import { FIXTURES, type FixtureId } from "@/lib/fixtures";

export const runtime = "nodejs";

/**
 * GET /api/fixtures?type=safe|caution|danger
 *
 * Builds and returns a deterministic sample transaction in base64. Used by
 * the /scan page's "Try a sample" buttons. The transactions are NOT signed
 * and are NEVER intended to be sent on-chain — they exist purely to exercise
 * the analyzer.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (!type || !(type in FIXTURES)) {
    return NextResponse.json(
      {
        error:
          "Unknown fixture type. Use one of: safe, caution, danger.",
      },
      { status: 400 },
    );
  }

  const fixture = FIXTURES[type as FixtureId];
  const transaction = fixture.build();

  return NextResponse.json(
    {
      type,
      title: fixture.title,
      description: fixture.description,
      transaction,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
