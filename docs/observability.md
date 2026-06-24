# Observability (web app)

Error tracking for `apps/web` (the `/scan` demo + extension download page).
Decision rationale: [`docs/agdr/AgDR-0002-web-observability.md`](agdr/AgDR-0002-web-observability.md).

## What's wired

- **Server-side Sentry only**, initialized in `apps/web/instrumentation.ts`.
- **Off by default.** With no `SENTRY_DSN`, `Sentry.init` is never called and
  nothing is sent. It activates only when an operator sets the DSN.
- **No browser SDK**, so the audited CSP (`next.config.ts`) is untouched and no
  client-side data is captured.
- Errors thrown in route handlers / SSR are captured via the Next.js
  `onRequestError` hook.

## Privacy guarantees

The product promise is that we don't see your transactions, so the error
pipeline is built not to capture them:

| Control | Where |
|---|---|
| Nothing sent unless `SENTRY_DSN` is set | `instrumentation.ts` (early return) |
| `sendDefaultPii: false` — no IP / cookies / user id | `Sentry.init` |
| Request body / cookies / query-string deleted before send | `beforeSend` |
| `authorization` / `cookie` headers deleted | `beforeSend` |
| Any base64/base58 transaction- or signature-shaped blob redacted to `[redacted-tx]` | `beforeSend` |
| No client/browser capture, no session replay | server-only design |

## Enable it

1. Create a project in Sentry (or your self-hosted instance) and copy its DSN.
2. Set the env var on the deployment (Vercel → Project → Settings → Environment
   Variables, or your host's equivalent):
   ```
   SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
   SENTRY_ENVIRONMENT=production   # optional; defaults to VERCEL_ENV / NODE_ENV
   ```
3. Redeploy. `register()` runs at server startup and initializes Sentry.

## Verify capture

With a DSN set (locally: put it in `.env.local` and run `pnpm --filter @txguardian/web dev`):

```
curl -i 'http://localhost:3000/api/debug-sentry?trigger=1'
```

- The endpoint throws an intentional, content-free error → HTTP 500.
- Within ~30s the event "TxGuardian Sentry verification error (intentional, no
  data)" appears in the Sentry **Issues** dashboard.
- Without `?trigger=1` the endpoint returns 404 (so it can't become a permanent
  500 in production).

With no DSN set, the same request still 500s but nothing is sent — confirming the
inert-by-default behaviour.

## Dashboard & alerting access

- **Dashboard:** Sentry → your org → the TxGuardian project → **Issues**.
- **Alerting:** Sentry → **Alerts** → create an issue alert (e.g. "notify on a
  new issue" or "error count > N in 1h") routed to email / Slack. Recommended
  starting alert: any new unresolved issue in `production`.
- **Access:** managed via Sentry org membership — add maintainers to the project
  team. Self-hosted instances follow the same Issues/Alerts model.

## Known gap (v1)

Browser-side React errors are **not** captured — that would require a client SDK
and relaxing the CSP `connect-src` to allow Sentry's ingest domain. Deferred (see
AgDR-0002); the server path, which is where the actual invisible failures were,
is covered.
