import Link from "next/link";
import { ArrowRight, ShieldCheck, ShieldX, KeyRound } from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1120px] px-6 pb-24 pt-12 md:pt-16">
      {/* Lede */}
      <section className="max-w-[720px]">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-[12px] text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Pre-sign safety layer for Solana
        </p>
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-tight md:text-[40px]">
          Know what you're signing,
          <br className="hidden md:block" />
          <span className="text-text-secondary">before you sign it.</span>
        </h1>
        <p className="mt-5 max-w-[600px] text-[15px] leading-[1.65] text-text-secondary">
          TxGuardian inspects a Solana transaction against deterministic risk
          rules — drainer programs, unlimited token approvals, simulation
          mismatches — then translates the verdict into plain English. No
          signing surface, no key access. Just clarity.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/scan" className="btn btn-primary">
            Check a transaction
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
          <Link href="/docs" className="btn btn-secondary">
            View the SDK
          </Link>
        </div>
      </section>

      {/* Side-by-side comparison hero */}
      <section
        className="mt-16 md:mt-20"
        aria-labelledby="side-by-side-heading"
      >
        <h2
          id="side-by-side-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          The problem, in one screen
        </h2>
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <ComparisonCard
            tag="What you'd see"
            label="Phantom preview"
            verdict={{
              tone: "neutral",
              icon: <ShieldCheck className="h-4 w-4" />,
              text: "No balance change",
            }}
            lines={[
              "Estimated fee: 0.00001 SOL",
              "No SOL movement",
              "No token movement",
            ]}
          />
          <ComparisonCard
            tag="What's actually happening"
            label="TxGuardian analysis"
            verdict={{
              tone: "danger",
              icon: <ShieldX className="h-4 w-4" />,
              text: "Danger · Score 87 / 100",
            }}
            lines={[
              "Unlimited token approval to an unknown account",
              "Calls a program not in the well-known allowlist",
              "Bundles 6 instructions — common obfuscation tactic",
            ]}
          />
        </div>
        <p className="mt-4 text-center text-[12px] text-text-muted">
          Same transaction. Two different stories.
        </p>
      </section>

      {/* How it works */}
      <section className="mt-20" aria-labelledby="how-heading">
        <h2
          id="how-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          How it works
        </h2>
        <ol className="grid gap-3 md:grid-cols-3 md:gap-4">
          <Step
            n={1}
            title="Paste a transaction"
            body="Paste any base64 Solana transaction into the scanner — or connect Phantom on devnet."
          />
          <Step
            n={2}
            title="Deterministic rule engine"
            body="Five rules check for known drainers, unlimited approvals, complexity, and intent–simulation mismatches."
          />
          <Step
            n={3}
            title="Plain-English translation"
            body="Claude Haiku 4.5 turns the deterministic verdict into a 5-second read. Translator only — never decides risk."
          />
        </ol>
      </section>

      {/* SDK callout */}
      <section className="mt-20" aria-labelledby="sdk-heading">
        <div className="panel-strong p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-md bg-accent-soft p-2 text-accent">
              <KeyRound className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="flex-1">
              <h2
                id="sdk-heading"
                className="text-[18px] font-semibold tracking-tight"
              >
                Building on Solana? Embed TxGuardian.
              </h2>
              <p className="mt-2 max-w-[620px] text-[14px] leading-[1.6] text-text-secondary">
                One install, one function call. Wallets, dApps, and signing
                services can drop in pre-sign risk checks in under 10 minutes.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-[13px] text-text-primary">
                {`pnpm add @txguardian/sdk

import { analyze } from "@txguardian/sdk";

const result = await analyze({
  transaction: base64Tx,
  connection,
  mode: "full",
});`}
              </pre>
              <Link
                href="/docs"
                className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent hover:text-accent-hover"
              >
                Read the integration guide
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="panel p-5">
      <div className="text-[12px] font-mono text-text-muted">
        {String(n).padStart(2, "0")}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.6] text-text-secondary">
        {body}
      </p>
    </li>
  );
}

function ComparisonCard({
  tag,
  label,
  verdict,
  lines,
}: {
  tag: string;
  label: string;
  verdict: {
    tone: "neutral" | "danger";
    icon: React.ReactNode;
    text: string;
  };
  lines: string[];
}) {
  const verdictTone =
    verdict.tone === "danger"
      ? "bg-risk-danger-soft text-risk-danger"
      : "bg-surface-2 text-text-secondary";
  return (
    <article className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {tag}
        </span>
        <span className="text-[11px] text-text-muted">{label}</span>
      </div>
      <div
        className={`inline-flex w-fit items-center gap-2 rounded-sm px-3 py-1.5 text-[13px] font-medium ${verdictTone}`}
      >
        {verdict.icon}
        <span>{verdict.text}</span>
      </div>
      <ul className="space-y-1.5 text-[13px] leading-[1.55] text-text-secondary">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-text-muted">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
