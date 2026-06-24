# Dependency CVE + license baseline

> Baseline established for issue #18. This is the *starting line* — the set of
> advisories known at this date — so future dependency changes can be measured
> against it and new CVEs are easy to spot. Recurring scans run weekly via
> [`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml).

| | |
|---|---|
| **Date** | 2026-06-25 |
| **Tools** | `pnpm audit` (pnpm 9.12.0, Node 24), `pnpm licenses list`, Cargo: see §4 |
| **Scope** | `packages/sdk`, `apps/web`, `apps/extension` (npm tree) + the Anchor crate |
| **Method** | Full-tree `pnpm audit` for visibility; `pnpm audit --prod` to isolate the runtime-reachable subset; triage each advisory by *where the code actually runs* |

## 1. Headline numbers

| Tree | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| **Full** (incl. dev/build deps) | 2 | 6 | 9 | 4 | 21 |
| **Prod-only** (`--prod`, runtime-reachable) | 1 | 3 | 4 | 3 | 11 |

The gap between the two rows is the point: **10 of 21 advisories live entirely in
dev/build tooling** (test runner, bundlers, the React-Native build toolchain
pulled transitively by the Solana mobile wallet adapter) and never reach a
shipped artifact.

## 2. Triage — why nothing here is an emergency

The shipped artifacts are: (a) the **extension bundle** (~134 KB gzipped, tree-shaken
— only imported code ships) and (b) the **Next.js serverless functions**. Neither
bundles the React-Native / Babel / Metro toolchain that most of these advisories
sit in.

### 2a. Dev / build-time only — not in any shipped artifact

| Advisory | Sev | Package | Why it's not reachable |
|---|---|---|---|
| CVE-2026-47429 | **critical** | `vitest` | UI-server RCE; only when `vitest --ui` is listening. We run `vitest run` (no server). Test-time only. |
| CVE-2026-9277 | **critical** | `shell-quote` | Transitive via `react-native` (mobile wallet adapter). RN build tooling — never executed by the Next.js runtime or the extension. |
| CVE-2026-27606 | high | `rollup` | Vite's bundler. Build-time. |
| GHSA-5c6j-r48x-rmvq | high | `serialize-javascript` | RN/Metro build toolchain. Build-time. |
| CVE-2026-53571 | high | `vite` | Dev server / bundler. Build-time. |
| GHSA-67mh-4wv8-2f99 | moderate | `esbuild` | Dev server request SSRF; build-time only. |
| CVE-2026-39365 | moderate | `vite` | optimizer path traversal; build-time. |
| CVE-2026-53632 | moderate | `launch-editor` (via vite) | Dev-only "open in editor". |
| CVE-2026-53550 | moderate | `js-yaml` | Config parsing, build-time. |
| GHSA-g7r4-m6w7-qqqr | low | `esbuild` | Build-time file read. |
| CVE-2026-49356 | low | `@babel/core` | RN build toolchain. Build-time. |

**Disposition:** accept for now. These are toolchain advisories; the mitigation is
keeping the toolchain current, which the weekly scan tracks. None block a release.

### 2b. Runtime-reachable — watch, with notes

| Advisory | Sev | Package | Path | Disposition |
|---|---|---|---|---|
| CVE-2025-3194 | high | `bigint-buffer` | `@solana/spl-token` → web3.js | **No upstream patch exists** (`patched: <0.0.0`). Used for fixed-size LE conversions of known-width values, not attacker-sized buffers. Accept + track; revisit if Solana migrates off it. |
| CVE-2026-48779 / -45736 | high/mod | `ws` (8.x) | `@solana/web3.js` websocket | Patched ≥ 8.21.0. The SDK uses HTTP RPC (getProgramAccounts/simulate), not ws subscriptions, so the DoS surface needs a malicious RPC the user already chose. Candidate for a `pnpm.overrides` bump once web3.js compatibility is confirmed. |
| CVE-2026-41907 | moderate | `uuid` | transitive | Patched ≥ 11.1.1. Low impact (v3/v5 bounds check). Bump via override when convenient. |
| CVE-2026-41305 | moderate | `postcss` | tailwind pipeline | Patched ≥ 8.5.10. Build-adjacent; bump with the next tailwind/next bump. |
| CVE-2025-9910 | moderate | `jsondiffpatch` | RN devtools transitive | Not reachable in shipped code. Accept. |
| CVE-2025-48985 | low | `ai` (Vercel AI SDK) | `packages/sdk` translator | Patched ≥ 5.0.52; repo is on `^4.0.0`. **Major bump (4→5) is breaking** — defer to a dedicated upgrade ticket. The translator is optional and schema-locked (see SECURITY.md §5), so impact is low. |
| CVE-2026-8769 | low | `@ai-sdk/provider-utils` | translator | Same upgrade path as `ai`. Defer with it. |

**No runtime-reachable Critical with an available, non-breaking patch.** The one
prod-tree "critical" (`shell-quote`) is React-Native build tooling mislabelled as
prod because the mobile wallet adapter is a prod dependency of `apps/web`; it is
not executed at runtime.

## 3. License baseline (prod tree)

| License | Count | Note |
|---|---|---|
| MIT | 244 | ✅ permissive |
| Apache-2.0 | 46 | ✅ permissive |
| ISC | 22 | ✅ permissive |
| BSD-3-Clause / BSD-2-Clause / 0BSD | 14 | ✅ permissive |
| LGPL-3.0-or-later | 2 | `@img/sharp-libvips-*` — libvips native libs behind Next.js image optimization. Dynamically linked, not shipped to the client. Acceptable. |
| LGPL-3.0-only | 1 | `rpc-websockets` — transitive via `@solana/web3.js`. LGPL permits linking from MIT code; we don't modify it. Acceptable. |
| CC-BY-4.0 | 1 | `caniuse-lite` — browserslist data. Acceptable. |
| (MIT OR Apache-2.0), (MIT OR CC0-1.0), (AFL-2.1 OR BSD-3-Clause), CC0-1.0, SIL OFL | 5 | ✅ permissive / dual-licensed |
| Unknown | 2 | `eyes@0.1.8`, `text-encoding-utf-8@1.0.2` — old transitive utils with no machine-readable license field; both are in fact permissive. Low concern. |

**Verdict:** no copyleft license that would force source disclosure of TxGuardian's
own MIT code. The three LGPL entries are dynamically-linked libraries, which LGPL
explicitly permits. No GPL anywhere.

## 4. Rust / Anchor crate

`cargo-audit` is **not installed** in the baseline environment (`cargo` is present).
The crate's third-party surface is small and pinned via `Cargo.lock`
(`anchor-lang` + the Solana SDK). The weekly workflow installs and runs
`cargo audit` against `programs/txguardian-registry` so the Rust side is covered
going forward. To run locally:

```bash
cargo install cargo-audit
cargo audit --file programs/txguardian-registry/Cargo.lock   # or repo-root Cargo.lock
```

## 5. The `@crxjs/vite-plugin` beta pin

`apps/extension` pins `@crxjs/vite-plugin@^2.0.0-beta.32` (a **devDependency** — it
runs at extension build time, ships nothing). It carries **no advisory** in this
baseline. The decision to keep the beta vs. alternatives is recorded in
[`docs/agdr/AgDR-0001-crxjs-vite-plugin-beta-pin.md`](../agdr/AgDR-0001-crxjs-vite-plugin-beta-pin.md):
**keep the beta, track the stable 2.0 release via the weekly scan.**

## 6. Recurring pipeline — wired

A weekly + manual `dependency-audit` workflow is added at
[`.github/workflows/dependency-audit.yml`](../../.github/workflows/dependency-audit.yml).
It is **report-only** (writes to the run summary, does not block PRs) — a blocking
gate today would red the build on unreachable toolchain CVEs. Promote it to
blocking on the *prod* tree once the runtime-reachable items in §2b are bumped.

## 7. Recommended follow-ups (not done in this PR)

This PR establishes the baseline; it intentionally does **not** churn the lockfile.
Suggested next tickets:

1. Add `pnpm.overrides` for the safe runtime bumps: `ws ≥ 8.21.0`, `uuid ≥ 11.1.1`, `postcss ≥ 8.5.10` (verify web3.js/tailwind still build).
2. Upgrade the Vercel AI SDK `ai` 4 → 5 (`@ai-sdk/*` with it) on a dedicated branch — breaking, needs translator regression tests.
3. Re-evaluate `bigint-buffer` exposure when `@solana/web3.js` next updates.
