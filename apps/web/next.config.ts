import type { NextConfig } from "next";

/**
 * Security headers applied to every page response.
 *
 * Rationale (from SECURITY_AUDIT_v1.md §5.4):
 *   - Content-Security-Policy: prevents XSS by restricting what scripts,
 *     styles, images, and connections the browser will load.
 *   - Strict-Transport-Security: forces HTTPS for 1y, including subdomains.
 *   - X-Content-Type-Options: nosniff — site-wide.
 *   - Referrer-Policy: strict-origin-when-cross-origin.
 *   - X-Frame-Options: DENY — clickjacking protection.
 *   - Permissions-Policy: locks down camera/mic/geo/payment (unused).
 *
 * CSP `script-src 'unsafe-inline'` is intentional for v1.0.0 — Next.js
 * App Router emits inline `__next_f.push(...)` chunks for streaming RSC
 * hydration. Without `'unsafe-inline'` the page renders, scripts get
 * blocked, React never mounts, you see a black screen. The proper fix
 * is nonce-based CSP via middleware (deferred to Phase 7+ as it
 * requires a per-request nonce computation that defeats Vercel's edge
 * caching for static pages). `frame-ancestors 'none'` + `base-uri` +
 * `form-action` + the explicit `connect-src` whitelist still provide
 * meaningful protection against the most common XSS impact.
 *
 * CSP `connect-src` includes `wss:` for Solana RPC subscriptions — the
 * web3.js Connection opens a WebSocket to the RPC's wss:// endpoint
 * for `subscribe*` methods used by the wallet adapter context.
 *
 * No `'unsafe-eval'` anywhere — all dependencies are eval-free.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Inline scripts allowed for Next App Router hydration (see comment).
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // WebSocket for Solana RPC subscriptions, plus the HTTPS whitelist
      // for fetch / XHR / EventSource (Solana RPC, Explorer, Gemini).
      "connect-src 'self' wss: https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://explorer.solana.com https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The SDK is consumed via workspace as raw TypeScript. Next's bundler
  // (webpack and Turbopack) needs to be told it's safe to transpile.
  transpilePackages: ["@txguardian/sdk"],
  async headers() {
    return [
      {
        // Apply to every route — pages and API routes alike.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
