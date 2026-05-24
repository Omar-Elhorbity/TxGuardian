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
          A Solana browser extension that checks every signing request{" "}
          <strong className="text-text-primary">in your browser</strong>{" "}
          before your wallet&apos;s prompt appears. The verdict engine
          ships in the extension itself — your transactions never reach
          our server. Deterministic rules decide what&apos;s risky; an
          optional AI translator (your Gemini key) makes the verdict
          legible in seconds.
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
          Who it&apos;s for
        </h2>
        <div className="panel mt-3 p-5 text-[14px] leading-[1.7] text-text-secondary">
          Active Solana DeFi users — anyone signing transactions on Phantom or
          another Wallet Standard wallet. Particularly relevant if you chase
          yields, airdrops, and new mints, where signing happens fast and
          drainers count on you not reading the raw instruction data. The
          wallet preview only shows simulation; TxGuardian shows intent.
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Architecture
        </h2>
        <div className="panel mt-3 p-5">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.7] text-text-secondary">
{`EXTENSION  (the product — bundles the entire engine)
┌────────────────────────────────────────────────────────────────┐
│  page.ts (MAIN world)                                          │
│    intercepts signTransaction → serializes → postMessage       │
│           ↓                                                    │
│  service worker                                                │
│    runs @txguardian/sdk locally:                              │
│      Parser   (legacy + v0 + ALT + Token-2022)                 │
│      Decoder  (instruction summaries; memo stripped)           │
│      Simulator (your RPC — sigVerify=false)                    │
│      Registry  (your RPC — drainer + verified feeds)           │
│      Rules     (deterministic — source of truth)               │
│      Scorer    (severity → 0–100 → recommendation)             │
│    ┌─ optional: Translator (Google Gemini · YOUR key) ────┐    │
│    │  TxGuardian server NEVER involved in the LLM call    │    │
│    └─────────────────────────────────────────────────────────┘    │
│           ↓                                                    │
│  Shadow-DOM modal · user decides · wallet has the final say   │
└────────────────────────────────────────────────────────────────┘

WEB SITE  (demo + docs — optional)
┌────────────────────────────────────────────────────────────────┐
│  /scan, /playground  ──→  POST /api/analyze  (same engine,     │
│  hosted convenience for users without a personal RPC + key)    │
└────────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>
        <p className="mt-3 text-[13px] leading-[1.65] text-text-muted">
          The deterministic engine decides risk. The LLM only writes the
          prose explanation — it can&apos;t raise, lower, or invent flags,
          and the recommendation is enum-locked to the engine&apos;s
          verdict. The extension bundle is reproducible against the source
          (SHA256 published next to the download). The AI step uses your
          own Gemini key and goes directly to Google.
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
          Scope
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-text-primary">
          The browser extension is the product. Everything else is how
          you reach the same engine without installing it: a public web
          demo at /scan for one-off analysis (the only place our server
          runs the engine), a TypeScript SDK for integrators that want
          pre-sign checks embedded in their own wallet or dApp code, and
          the Anchor program on devnet that supplies the on-chain
          drainer + verified-program feeds.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Known limitations
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.7] text-text-secondary">
          <li>
            <strong className="text-text-primary">Devnet only.</strong> The
            on-chain registry runs on devnet. Mainnet deployment requires
            multisig governance and a curated initial entry set.
          </li>
          <li>
            <strong className="text-text-primary">Single-keypair admin.</strong>{" "}
            The registry is currently controlled by one keypair. The{" "}
            <code className="font-mono text-[12px] text-text-primary">
              update_admin
            </code>{" "}
            instruction supports rotation to a multisig.
          </li>
          <li>
            <strong className="text-text-primary">
              No coverage of in-wallet flows.
            </strong>{" "}
            Phantom's built-in Send / Swap / Stake happen inside Phantom's
            sandbox and cannot be intercepted by any browser extension. Same
            constraint every wallet-safety extension hits.
          </li>
          <li>
            <strong className="text-text-primary">Mobile not yet covered.</strong>{" "}
            Browser extensions do not run in mobile in-app browsers. A
            Solana Mobile app would close this gap.
          </li>
          <li>
            <strong className="text-text-primary">TOCTOU detection schema-only.</strong>{" "}
            The{" "}
            <code className="font-mono text-[12px] text-text-primary">
              TOCTOU_PATTERN
            </code>{" "}
            flag is part of the result schema but generic runtime detection
            requires per-program decoders that don&apos;t exist yet.
          </li>
        </ul>
      </section>

      <section className="mt-12 border-t border-border pt-6">
        <Link
          href="/extension"
          className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
        >
          Install the extension
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
