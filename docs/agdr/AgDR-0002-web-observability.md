# Web observability: server-side Sentry, DSN-gated, privacy-scrubbed

> In the context of the public `apps/web` (the `/scan` demo + extension download
> page) having no error tracking, facing the constraint that TxGuardian's whole
> value proposition is "we don't see your transactions", I decided to wire
> **server-side-only Sentry, inert unless a DSN is set, with transaction-data
> scrubbing**, to achieve visibility into production errors, accepting that
> browser-side (client) errors are not captured in v1.

## Context

`apps/web` currently has zero error tracking — a production failure in
`/api/analyze` or an SSR crash is invisible (issue #21). The driver is real:
the route already swallows errors into generic 500s, so nothing surfaces.

Two hard constraints shape the choice:

1. **Privacy posture.** The product promise is that the transaction isn't seen
   by us. Any observability that could capture a user's transaction bytes
   violates the core value prop. `/api/analyze` receives full transactions, so
   its error context is exactly where a tx could leak.
2. **The security-audited CSP.** `next.config.ts` ships a `connect-src`
   whitelist (Solana RPC + Explorer + Gemini only). A **client-side** error
   tracker would be CSP-blocked and would force relaxing that whitelist to allow
   `*.sentry.io` — a privacy- and security-relevant change to an audited header.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Server-side Sentry, DSN-gated, scrubbed** | Captures the API/SSR errors that are the actual gap; no CSP change; no browser data; nothing sent unless an operator opts in with their own DSN | No client-side error capture; needs careful `beforeSend` scrubbing |
| Full Sentry (client + server) | Captures browser errors too | Requires relaxing the audited CSP to allow sentry.io; risk of capturing browser-side PII/session data; heavier |
| Vercel Web Analytics only | Privacy-friendly, trivial | It's *analytics*, not error tracking — doesn't address "production errors are invisible" |
| Both (Sentry + Vercel Analytics) | Errors + usage | Same CSP/privacy cost as full Sentry if client-side; more surface |
| Nothing / rely on Vercel function logs | No deps | Logs are ephemeral, no alerting, no grouping — the gap stays open |

## Decision

Chosen: **server-side-only Sentry, initialized in `instrumentation.ts` only when
`SENTRY_DSN` is set**, because it closes the actual gap (server/API errors)
without touching the audited CSP, without sending any browser data, and without
sending anything at all until an operator deliberately provides a DSN.

Privacy hardening baked into the wiring:

- **Inert by default** — no DSN ⇒ `Sentry.init` is never called; zero data leaves.
- **Server-only** — no client SDK, so no `connect-src` change and no
  browser-side capture (no session replay, no PII).
- **`sendDefaultPii: false`** and a `beforeSend` that deletes request
  bodies/cookies/query-strings and redacts any long base64/base58
  (transaction- or signature-shaped) blob from messages and exception values.

Client-side error capture and Vercel Web Analytics are **deferred** (not
rejected). They can be added later behind the same opt-in if the CSP trade-off
is consciously accepted; Vercel Analytics in particular is privacy-friendly and
a reasonable future addition.

## Consequences

- Operators get production error visibility by setting `SENTRY_DSN` (+ optional
  `SENTRY_ENVIRONMENT`); the default deploy is unchanged and silent.
- The CSP and the v1 security audit are untouched.
- A documented residual gap: browser-side React errors aren't captured in v1.
- A verification endpoint (`/api/debug-sentry?trigger=1`) and runbook
  (`docs/observability.md`) let an operator confirm capture + find the dashboard.

## Artifacts

- `apps/web/instrumentation.ts` (init + scrub + `onRequestError`)
- `apps/web/app/api/debug-sentry/route.ts` (verification trigger)
- `docs/observability.md` (setup, dashboard/alerting, verification, privacy)
- `.env.example` (`SENTRY_DSN`)
- Issue #21
