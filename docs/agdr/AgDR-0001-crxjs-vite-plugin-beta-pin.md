# Keep `@crxjs/vite-plugin` on the 2.0 beta pin

> In the context of the extension's MV3 build pipeline, facing a `2.0.0-beta`
> dependency on a critical build path flagged by the #18 dependency audit, I
> decided to keep the beta pin and track its stable release via the weekly scan,
> to achieve a working MV3 HMR + manifest build with the least risk, accepting
> that we depend on a pre-1.0-style beta for build tooling.

## Context

`apps/extension` builds a Manifest V3 Chrome extension with Vite. The build is
driven by `@crxjs/vite-plugin@^2.0.0-beta.32` (a **devDependency** — it runs only
at build time and ships no code into the ~134 KB extension bundle).

The #18 dependency-audit baseline flagged the beta pin as "beta tooling on a
critical path warrants watching." Findings relevant to the decision:

- The plugin carries **no security advisory** in the baseline.
- It is the de-facto standard for Vite + MV3: it generates the manifest from
  `manifest.config.ts`, wires content-script/service-worker entry points, and
  provides HMR during `vite dev`.
- The `2.0` line has lived in `beta` for an extended period; the `1.x` stable line
  predates much of the current MV3 tooling and lacks features the build relies on.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Keep `^2.0.0-beta.32`, track stable** | Build works today; no migration; no advisory; matches the ecosystem norm for Vite MV3 | Depends on a `beta` tag for a build-critical tool; semver `^` on a beta only ranges within `2.0.0-beta.*` |
| Downgrade to `@crxjs/vite-plugin@1.x` (stable) | "Stable" tag | Older MV3 support; likely build rework; regressions in manifest generation |
| Switch to `@samrum/vite-plugin-web-extension` | Actively maintained alternative | Migration cost (different manifest model); re-test every entry point |
| Drop the plugin, hand-roll Vite + manifest | Zero plugin dependency | Lose HMR + automatic manifest wiring; more bespoke build code to maintain |

## Decision

Chosen: **keep `@crxjs/vite-plugin@^2.0.0-beta.32`**, because it is the
lowest-risk option that keeps the MV3 build working, it ships nothing to users
(build-time only), and it has no known vulnerability. The "beta" label reflects
the plugin's own release cadence more than instability for our use — the build is
reproducible and covered by CI (`pnpm --filter @txguardian/extension package`).

To address the "warrants watching" concern without taking on migration risk now:

- The weekly `dependency-audit` workflow surfaces any new advisory against the
  plugin or its deps.
- When `@crxjs/vite-plugin@2.0.0` (non-beta) ships, bump to it in a dedicated PR
  and re-run the extension build + load-unpacked smoke test.

## Consequences

- No build change in this PR; the extension build path is unchanged.
- A documented trigger ("2.0.0 stable ships" / "new advisory appears") for
  revisiting, rather than an open-ended "it's beta" worry.
- If the plugin is ever abandoned, the migration options above are pre-identified.

## Artifacts

- Baseline: `docs/security/dependency-audit-baseline.md` §5
- Workflow: `.github/workflows/dependency-audit.yml`
- Issue: #18
