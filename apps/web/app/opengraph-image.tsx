import { ImageResponse } from "next/og";

/**
 * Open Graph image — the preview that renders when the site URL is pasted
 * into LinkedIn, Twitter/X, Slack, iMessage, GitHub, etc. Generated at
 * request time by next/og (Edge runtime), then cached by the platform.
 *
 * Matches the editorial dark aesthetic of the site: near-black surface,
 * accent shield, Geist-equivalent system stack (next/og can't load the
 * Geist font from the page bundle, so we inherit the platform default —
 * close enough at OG size).
 */

export const runtime = "edge";
export const alt =
  "TxGuardian — See what you're signing. We don't. Solana browser extension that runs in your browser.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0f1213";
const ACCENT = "#3e8f96";
const TEXT_PRIMARY = "#e7e9ee";
const TEXT_SECONDARY = "#a8adb8";
const TEXT_MUTED = "#6e7380";
const BORDER = "#2a2d34";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top row: shield + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 128 128">
            <path
              d="M64 18 L98 30 V62 C98 86 84 102 64 110 C44 102 30 86 30 62 V30 Z"
              fill={ACCENT}
            />
            <path
              d="M48 64 L60 76 L82 52"
              fill="none"
              stroke={BG}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              letterSpacing: "-0.01em",
            }}
          >
            TxGuardian
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 1040,
            }}
          >
            See what you&apos;re signing.
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 600,
              color: TEXT_SECONDARY,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginTop: -16,
            }}
          >
            We don&apos;t.
          </div>
          <div
            style={{
              fontSize: 26,
              color: TEXT_SECONDARY,
              lineHeight: 1.4,
              maxWidth: 980,
              marginTop: 20,
            }}
          >
            Solana browser extension. Verdicts compute on your device, in
            milliseconds. No keys, no accounts, no telemetry.
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginTop: 56,
            paddingTop: 28,
            borderTop: `1px solid ${BORDER}`,
            fontSize: 22,
            color: TEXT_MUTED,
          }}
        >
          <span>Runs in your browser</span>
          <span>·</span>
          <span>Open source · MIT</span>
          <span>·</span>
          <span>No telemetry</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
