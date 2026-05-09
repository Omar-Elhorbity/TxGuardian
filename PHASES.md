# Build Phase Log

A running journal of how TxGuardian was built. Each phase ends with a commit and a short note.

## Phase 0 — Repo init & monorepo workspace

**Goal:** Get the bones in place so subsequent phases can land independently.

**Done:**
- `git init` (main branch)
- `.gitignore` (Node + Next.js + editor + Vercel)
- `pnpm-workspace.yaml` declaring `packages/*` and `apps/*`
- Root `package.json` with pnpm 9.12 pinned via `packageManager`
- `.env.example` documenting `RPC_URL` and `ANTHROPIC_API_KEY`
- `README.md` (project overview, architecture diagram, dev quickstart)
- `DESIGN.md` and `IA.md` already in place from the planning phase
- This file (`PHASES.md`)

**Not done by design:**
- No `pnpm install` — dependencies are listed but install/build happens on the user's other machine.
- No tooling configs yet (tsconfig, eslint) — added in later phases per workspace.

**Next:** Phase 1 — SDK foundation (types, constants, parser).
