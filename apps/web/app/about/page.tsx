import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

const PROGRAM_ID = "Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7";
const EXPLORER_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[820px] px-6 py-10 md:py-14">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight">
          About TxGuardian
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-text-secondary">
          A pre-sign safety layer for Solana — built as an open SDK any wallet,
          dApp, or signing service can embed, backed by an on-chain attestation
          registry deployed to devnet. Deterministic rules decide what's risky;
          an AI translator makes the decision legible to a non-developer in
          seconds.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          The problem
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-text-primary">
          Solana wallet drainers steal funds even when the wallet preview looks
          safe. The signing UI shows "no balance change" while the underlying
          instruction stream authorizes a token approval, an account ownership
          transfer, or a transfer to an attacker-controlled address. Users
          can't tell the difference at a glance — and they shouldn't have to.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Persona — Omar the DeFi grinder
        </h2>
        <div className="panel mt-3 p-5 text-[14px] leading-[1.7] text-text-secondary">
          Uses Phantom on desktop. Chases yields, airdrops, and new mints on X
          and Discord. Fast-moving and FOMO-prone — signs transactions quickly
          without reading raw instruction data. Relies on wallet simulation
          previews, which makes him vulnerable to spoofing where the preview
          hides the true intent. TxGuardian gives Omar a second opinion before
          he signs.
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Architecture
        </h2>
        <div className="panel mt-3 p-5">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.7] text-text-secondary">
{`User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├─ Parser     (legacy + v0 + ALT + Token-2022)
                                          ├─ Decoder    (instruction summaries; memo stripped)
                                          ├─ Simulator  (replaceRecentBlockhash, sigVerify=false)
                                          ├─ Registry   (on-chain getProgramAccounts) ─────┐
                                          ├─ Rules      (deterministic — source of truth) ←┘
                                          ├─ Scorer     (severity → 0–100 → recommendation)
                                          └─ Translator (Gemini 2.5 Flash — never decides risk)`}
          </pre>
        </div>
        <p className="mt-3 text-[13px] leading-[1.65] text-text-muted">
          The deterministic engine is the source of truth on risk. The LLM only
          renders the verdict into prose — it cannot raise, lower, or invent
          flags, and the recommendation is enum-locked to the deterministic
          level. The on-chain registry feeds confirmed attestations into the
          drainer rule alongside a hardcoded fallback list.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          On-chain program (devnet)
        </h2>
        <div className="panel mt-3 p-4 font-mono text-[12px]">
          <div className="text-text-muted">Program ID</div>
          <div className="mt-1 text-text-primary break-all">{PROGRAM_ID}</div>
          <a
            href={EXPLORER_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-hover"
          >
            View on Solana Explorer
            <ExternalLink
              className="h-3 w-3"
              strokeWidth={2}
              aria-hidden
            />
          </a>
        </div>
        <p className="mt-3 text-[13px] leading-[1.65] text-text-secondary">
          Source under{" "}
          <code className="font-mono text-[12px] text-text-primary">
            programs/txguardian-registry
          </code>
          . Anchor 0.32, Rust. Five instructions:{" "}
          <code className="font-mono text-[11px]">initialize</code>,{" "}
          <code className="font-mono text-[11px]">submit</code> (permissionless),{" "}
          <code className="font-mono text-[11px]">attest</code> (admin),{" "}
          <code className="font-mono text-[11px]">revoke</code> (admin),{" "}
          <code className="font-mono text-[11px]">update_admin</code>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Roadmap
        </h2>
        <ol className="mt-3 space-y-3">
          <RoadmapRow
            phase="Now"
            title="Web scanner + open SDK + on-chain registry"
            body="Public Vercel scanner, framework-agnostic TypeScript SDK, Anchor program live on devnet feeding the drainer rule. Five active risk flags, AI translator (Gemini 2.5 Flash)."
          />
          <RoadmapRow
            phase="Next"
            title="Browser extension"
            body="A Phantom-compatible extension that intercepts the signing prompt and shows TxGuardian's verdict inline. Activates runtime TOCTOU detection."
          />
          <RoadmapRow
            phase="v2"
            title="<TxGuardianWidget /> + npm publish"
            body="A drop-in React component for dApps to show pre-sign risk checks before they ever route to the wallet. SDK published to npm with semantic versioning."
          />
          <RoadmapRow
            phase="v3"
            title="Multisig curator + enterprise API"
            body="Registry admin moves to a multisig. Authenticated rate-limited REST API for wallets, custodians, exchanges. Continuously updated drainer feeds. SLA."
          />
        </ol>
      </section>

      <section className="mt-12 border-t border-border pt-6">
        <p className="text-[13px] text-text-muted">
          Built for the Dev3pack Global Hackathon (Cairo Hub), May 2026.
        </p>
        <Link
          href="/scan"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
        >
          Try the scanner
          <ArrowRight
            className="h-3.5 w-3.5"
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      </section>
    </div>
  );
}

function RoadmapRow({
  phase,
  title,
  body,
}: {
  phase: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid gap-3 md:grid-cols-[80px_1fr] md:gap-5">
      <div className="text-[12px] font-mono uppercase text-text-muted md:pt-0.5">
        {phase}
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-[13px] leading-[1.65] text-text-secondary">
          {body}
        </p>
      </div>
    </li>
  );
}
