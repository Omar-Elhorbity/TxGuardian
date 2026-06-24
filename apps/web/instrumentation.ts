import * as Sentry from "@sentry/nextjs";

/**
 * Server-side-only error tracking (issue #21 / AgDR-0002).
 *
 *   - Inert unless SENTRY_DSN is set — the default deploy sends nothing.
 *   - Server-only: no browser SDK, so the audited CSP is untouched and no
 *     client/browser data is captured.
 *   - beforeSend strips request bodies/cookies/query and redacts any
 *     transaction- or signature-shaped blob, so an error from /api/analyze can
 *     never carry a user's transaction. Preserves the privacy posture
 *     (see SECURITY.md): we don't see your transactions.
 *
 * Next.js calls register() once per server runtime at startup.
 */

// Long base64 / base58 blobs — serialized transactions (~1.6k chars) and
// signatures (87–88 chars). Redacted anywhere they might surface in an error.
const TX_LIKE = /[A-Za-z0-9+/_-]{80,}={0,2}/g;

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // observability off by default — opt in with a DSN.

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    tracesSampleRate: 0.1,
    // Never attach IP / cookies / user identifiers.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
      }
      if (event.message) {
        event.message = event.message.replace(TX_LIKE, "[redacted-tx]");
      }
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = ex.value.replace(TX_LIKE, "[redacted-tx]");
      }
      return event;
    },
  });
}

/**
 * Next.js `onRequestError` hook — captures errors thrown during route handling
 * / rendering. No-op unless a DSN configured Sentry above.
 */
export async function onRequestError(
  error: unknown,
  ...rest: unknown[]
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  // captureRequestError attaches Next's request context when available; fall
  // back to a plain capture if the signature differs across SDK versions.
  const capture = (
    Sentry as unknown as {
      captureRequestError?: (e: unknown, ...a: unknown[]) => void;
    }
  ).captureRequestError;
  if (typeof capture === "function") capture(error, ...rest);
  else Sentry.captureException(error);
}
