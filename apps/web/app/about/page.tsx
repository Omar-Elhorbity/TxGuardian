import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[820px] px-6 py-10 md:py-14">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight">About TxGuardian</h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-text-secondary">
          A pre-sign safety layer for Solana — built as an open SDK any wallet, dApp, or signing service can embed. Deterministic rules decide what's risky; an AI translator makes the decision legible to a non-developer in seconds.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          The problem
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-text-primary">
          Solana wallet drainers steal funds even when the wallet preview looks safe. The signing UI shows "no balance change" while the underlying instruction stream authorizes a token approval, an account ownership transfer, or a transfer to an attacker-controlled address. Users can't tell the difference at a glance — and they shouldn't have to.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Persona — Omar the DeFi grinder
        </h2>
        <div className="panel mt-3 p-5 text-[14px] leading-[1.7] text-text-secondary">
          Uses Phantom on desktop. Chases yields, airdrops, and new mints on X and Discord. Fast-moving and FOMO-prone — signs transactions quickly without reading raw instruction data. Relies on wallet simulation previews, which makes him vulnerable to spoofing where the preview hides the true intent. TxGuardian gives Omar a second opinion before he signs.
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Architecture
        </h2>
        <div className="panel mt-3 p-5">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.7] text-text-secondary">
{`User → /scan (Next.js) → /api/analyze → @txguardian/sdk
                                          ├─ Parser  (legacy + v0 + ALT + Token-2022)
                                          ├─ Decoder (instruction summaries; memo content stripped)
                                          ├─ Rules   (5 deterministic, source of truth on risk)
                                          ├─ Scorer  (severity → 0–100 → riskLevel + recommendation)
                                          └─ AI Translator (Claude Haiku 4.5; never decides risk)`}
          </pre>
        </div>
        <p className="mt-3 text-[13px] leading-[1.65] text-text-muted">
          The deterministic engine is the source of truth on risk. The LLM only renders the verdict into prose — it cannot raise, lower, or invent flags, and the recommendation is enum-locked to the deterministic level.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Roadmap
        </h2>
        <ol className="mt-3 space-y-3">
          <RoadmapRow
            phase="Now"
            title="Web scanner + open SDK"
            body="Public Vercel scanner anyone can use. Five active risk flags, AI translator. SDK consumable in 5 lines."
          />
          <RoadmapRow
            phase="Next"
            title="Browser extension"
            body="A Phantom-compatible extension that intercepts the signing prompt and shows TxGuardian's verdict inline. Activates runtime TOCTOU detection."
          />
          <RoadmapRow
            phase="v2"
            title="<TxGuardianWidget />"
            body="A drop-in React component for dApps to show pre-sign risk checks before they ever route to the wallet."
          />
          <RoadmapRow
            phase="v3"
            title="Enterprise API"
            body="Authenticated, rate-limited REST API for wallets, custodians, and exchanges. Continuously updated drainer feeds. SLA."
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
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
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
        <p className="mt-1 text-[13px] leading-[1.65] text-text-secondary">{body}</p>
      </div>
    </li>
  );
}
