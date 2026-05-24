import type { NextConfig } from "next";

/**
 * Security headers applied to every page response.
 *
 * Rationale (from SECURITY_AUDIT_v1.md):
 *   - Content-Security-Policy: prevents XSS by restricting what scripts,
 *     styles, images, and connections the browser will load. The 'self'
 *     baseline is augmented to allow:
 *       - inline styles (Tailwind injects a few)
 *       - images from anywhere (OG card crawlers, user avatars in future)
 *       - api.devnet.solana.com + the explorer (the /registry page links there)
 *       - generativelanguage.googleapis.com (the extension calls it, but
 *         the site itself doesn't — included only as a safety net)
 *   - Strict-Transport-Security: forces HTTPS for one year, including
 *     subdomains. Vercel serves the site over HTTPS already; HSTS makes
 *     it sticky.
 *   - X-Content-Type-Options: nosniff — already applied per-route on the
 *     API; this makes it site-wide.
 *   - Referrer-Policy: strict-origin-when-cross-origin — sends the full
 *     URL to same-origin requests, only the origin to cross-origin
 *     requests, nothing to HTTP downgrades.
 *   - X-Frame-Options: DENY — prevents the site from being framed by
 *     malicious sites (clickjacking protection). The site has nothing
 *     that needs to be embedded.
 *   - Permissions-Policy: locks down powerful APIs we don't use.
 *
 * The CSP intentionally allows 'unsafe-inline' for styles (Next.js + the
 * Tailwind runtime inject a few inline style tags) but NOT for scripts.
 * No 'unsafe-eval' anywhere.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com https://explorer.solana.com https://generativelanguage.googleapis.com",
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
