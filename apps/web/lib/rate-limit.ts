/**
 * Minimal per-IP rate limiter for API routes.
 *
 * In-memory only — state is per-process and resets on serverless cold
 * start. Adequate for v1 traffic; swap to Redis (Upstash) if abuse
 * patterns emerge. NOTE: each API route file imports its own
 * `createRateLimiter()` instance, so the buckets are PER ROUTE — an
 * attacker can spend each route's quota independently. Document this in
 * the security audit and tighten with shared persistence later if needed.
 *
 * IP detection trusts `x-forwarded-for` / `x-real-ip` headers. On Vercel
 * these are set by the edge and not spoofable; on a direct deployment
 * elsewhere they would need to be verified to come from a trusted proxy.
 */

export interface RateLimiter {
  /** Returns true if the request is allowed, false if rate-limited. */
  check(ip: string): boolean;
}

export interface RateLimiterOptions {
  /** Max requests per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    check(ip: string): boolean {
      const now = Date.now();
      const hit = hits.get(ip);
      if (!hit || hit.reset < now) {
        hits.set(ip, { count: 1, reset: now + opts.windowMs });
        return true;
      }
      if (hit.count >= opts.max) return false;
      hit.count++;
      return true;
    },
  };
}

/**
 * Extract the client IP from request headers. On Vercel, `x-forwarded-for`
 * is set by the edge and is trustworthy. On other hosts, `x-real-ip` is
 * the common alternative. Falls back to `"unknown"` (which buckets all
 * unidentified callers together — acceptable for a rate limit, not
 * acceptable for authorization).
 */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    // x-forwarded-for can be a comma-separated chain; the leftmost is
    // the original client.
    const first = fwd.split(",")[0];
    if (first) return first.trim();
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
