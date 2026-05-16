import Link from "next/link";
import {
  ArrowRight,
  Download,
  ShieldCheck,
  Eye,
  ZapOff,
  ExternalLink,
} from "lucide-react";

export default function ExtensionPage() {
  return (
    <div className="mx-auto max-w-[960px] px-6 pb-24 pt-12 md:pt-16">
      {/* Lede */}
      <section className="max-w-[720px]">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-[12px] text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Browser extension · Chrome / Brave / Arc / Edge
        </p>
        <h1 className="text-[32px] font-semibold leading-[1.15] tracking-tight md:text-[40px]">
          TxGuardian, in your browser.
        </h1>
        <p className="mt-5 max-w-[600px] text-[15px] leading-[1.65] text-text-secondary">
          Sits between your wallet and any Solana dApp. Every signing request
          is intercepted, analyzed, and surfaced as a verdict overlay before
          your wallet's own prompt appears. You decide. The wallet still has
          the final say.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href="#install" className="btn btn-primary">
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
            Install
          </a>
          <Link href="/demo-sign" className="btn btn-secondary">
            Test the interception
          </Link>
        </div>
      </section>

      {/* What it does */}
      <section className="mt-16" aria-labelledby="how-heading">
        <h2
          id="how-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          What it does
        </h2>
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <FeatureCard
            icon={<Eye className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Intercept"
            body="Patches the signing API on every page at document_start, before any dApp script runs. Covers direct Phantom calls and the Wallet Standard protocol used by wallet-adapter."
          />
          <FeatureCard
            icon={
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            }
            title="Verify"
            body="Sends the transaction to TxGuardian for analysis — same engine as the scanner. Runs the rule engine, checks the on-chain registry, and translates to plain English."
          />
          <FeatureCard
            icon={<ZapOff className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Decide"
            body="Modal appears with the verdict. Approve passes through to your wallet's normal signing prompt. Reject throws code 4001 — the dApp sees a standard cancellation."
          />
        </div>
      </section>

      {/* Install */}
      <section id="install" className="mt-16 scroll-mt-24" aria-labelledby="install-heading">
        <h2
          id="install-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Install (unpacked)
        </h2>
        <p className="text-[14px] leading-[1.65] text-text-secondary">
          Not on the Chrome Web Store yet — load it unpacked from the
          monorepo. Takes about a minute.
        </p>

        <ol className="mt-5 space-y-5">
          <Step
            n={1}
            title="Build the extension"
            body={
              <>
                <CodeBlock>
{`git clone https://github.com/Omar-Elhorbity/TxGuardian
cd TxGuardian
pnpm install
pnpm --filter @txguardian/extension build
# → outputs apps/extension/dist/`}
                </CodeBlock>
                <p className="mt-3 text-[12px] text-text-muted">
                  The dist folder is tracked in git, so a fresh clone has it
                  already — but rebuilding ensures you're on the latest.
                </p>
              </>
            }
          />
          <Step
            n={2}
            title="Open the extensions page"
            body={
              <p className="text-[13px] leading-[1.65] text-text-secondary">
                Visit{" "}
                <code className="font-mono text-[12px] text-text-primary">
                  chrome://extensions
                </code>{" "}
                (or{" "}
                <code className="font-mono text-[12px] text-text-primary">
                  brave://extensions
                </code>
                ,{" "}
                <code className="font-mono text-[12px] text-text-primary">
                  arc://extensions
                </code>
                , etc.). Toggle{" "}
                <strong className="text-text-primary">Developer mode</strong>{" "}
                in the top-right.
              </p>
            }
          />
          <Step
            n={3}
            title="Load unpacked"
            body={
              <p className="text-[13px] leading-[1.65] text-text-secondary">
                Click{" "}
                <strong className="text-text-primary">Load unpacked</strong>{" "}
                and select{" "}
                <code className="font-mono text-[12px] text-text-primary">
                  apps/extension/dist
                </code>
                . TxGuardian appears in your extensions list, active on every
                page.
              </p>
            }
          />
          <Step
            n={4}
            title="Verify it's working"
            body={
              <>
                <p className="text-[13px] leading-[1.65] text-text-secondary">
                  Open any Solana dApp, then DevTools → Console. Filter for{" "}
                  <code className="font-mono text-[12px] text-text-primary">
                    TxGuardian
                  </code>
                  . You should see boot logs from both the page-context script
                  and the content-script bridge. Or use the dedicated test
                  surface:
                </p>
                <Link
                  href="/demo-sign"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
                >
                  Open /demo-sign — one-click signing test
                  <ArrowRight
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                </Link>
              </>
            }
          />
        </ol>
      </section>

      {/* Configuration */}
      <section className="mt-16" aria-labelledby="config-heading">
        <h2
          id="config-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Configure the analyzer endpoint
        </h2>
        <p className="text-[14px] leading-[1.65] text-text-secondary">
          The extension calls{" "}
          <code className="font-mono text-[12px] text-text-primary">
            http://localhost:3000/api/analyze
          </code>{" "}
          by default — change it to your deployed URL when you ship.
        </p>
        <CodeBlock>
{`// apps/extension/src/background.ts
const ANALYZE_ENDPOINT = "https://your-deployment.vercel.app/api/analyze";

// apps/extension/manifest.config.ts — add the host:
host_permissions: ["https://your-deployment.vercel.app/*", ...]`}
        </CodeBlock>
        <p className="mt-3 text-[12px] text-text-muted">
          Then rebuild and click reload on the extension card.
        </p>
      </section>

      {/* Coverage */}
      <section className="mt-16" aria-labelledby="coverage-heading">
        <h2
          id="coverage-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          What it covers (and doesn't)
        </h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.1em] text-text-muted">
                <th className="px-3 py-2 font-medium">Source of transaction</th>
                <th className="px-3 py-2 font-medium">Intercepted?</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <CoverRow label="Any dApp on a web page using Phantom" yes />
              <CoverRow label="Any dApp using a Wallet Standard wallet (Solflare, Backpack, Glow…)" yes />
              <CoverRow label="Iframes inside web dApps" yes />
              <CoverRow label="signAndSendTransaction (Phantom shorthand)" yes />
              <CoverRow label="Phantom's built-in Send / Swap / Stake" no />
              <CoverRow label="Mobile Phantom / in-app browsers" no />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-[1.65] text-text-muted">
          Phantom's internal flows can't be intercepted by any extension —
          architectural limit of the browser sandbox. Same constraint
          Wallet Guard, Pocket Universe, and Blowfish hit. Closing that gap
          requires Phantom's Blocks partner program.
        </p>
      </section>

      {/* Privacy */}
      <section className="mt-16" aria-labelledby="privacy-heading">
        <h2
          id="privacy-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          What we send (and don't)
        </h2>
        <div className="panel p-5 text-[13px] leading-[1.7] text-text-secondary">
          <p>
            On every signing request, the extension serializes the transaction
            to base64 and POSTs it to the analyzer endpoint. Nothing else
            leaves your browser. Specifically:
          </p>
          <ul className="mt-3 space-y-1.5 pl-5 list-disc">
            <li>
              <strong className="text-text-primary">Sent:</strong> the
              base64-encoded transaction bytes and the dApp's origin host.
            </li>
            <li>
              <strong className="text-text-primary">Never sent:</strong> your
              private keys, your seed phrase, your wallet's full pubkey list,
              your browsing history, or any cookies / localStorage from the
              dApp.
            </li>
            <li>
              <strong className="text-text-primary">Never stored:</strong> the
              analyzer doesn't persist transactions. Each request is processed
              and discarded.
            </li>
            <li>
              <strong className="text-text-primary">Never signs:</strong> the
              extension cannot sign transactions. It can only intercept and
              forward to your wallet (or throw a rejection). The wallet remains
              the sole keyholder.
            </li>
          </ul>
        </div>
      </section>

      {/* Architecture (compact) */}
      <section className="mt-16" aria-labelledby="arch-heading">
        <h2
          id="arch-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          How it works
        </h2>
        <div className="panel p-5">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.7] text-text-secondary">
{`dApp page
  ↓ calls window.phantom.solana.signTransaction(tx)
  ↓
[ src/page.ts ]      ← MAIN world, document_start
  ↓ patched method intercepts
  ↓ serializes tx → base64
  ↓ window.postMessage
  ↓
[ src/content.ts ]   ← ISOLATED world (bridge)
  ↓ chrome.runtime.sendMessage
  ↓
[ background.ts ]    ← service worker
  ↓ POST /api/analyze
  ↓
[ in-page modal ]    ← Shadow DOM overlay
  ↓ user decides
  ↓
  Approve → original signTransaction → wallet's prompt appears
  Reject  → throws code 4001 → dApp sees standard rejection`}
          </pre>
        </div>
        <p className="mt-3 text-[12px] text-text-muted">
          Source under{" "}
          <code className="font-mono text-[11px]">apps/extension</code>. ~30 KB
          minified, no React, no framework deps. Vanilla TypeScript +
          @crxjs/vite-plugin.
        </p>
      </section>

      <section className="mt-16 border-t border-border pt-8">
        <p className="text-[14px] leading-[1.65] text-text-secondary">
          Open source under the MIT license. Source, issues, and contributions
          welcome.
        </p>
        <a
          href="https://github.com/Omar-Elhorbity/TxGuardian"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
        >
          Read the source
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
        </a>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="panel p-5">
      <div className="inline-flex rounded-md bg-accent-soft p-2 text-accent">
        {icon}
      </div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.6] text-text-secondary">
        {body}
      </p>
    </article>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="grid gap-3 md:grid-cols-[40px_1fr] md:gap-5">
      <div className="text-[12px] font-mono text-text-muted md:pt-1">
        {String(n).padStart(2, "0")}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <div className="mt-2">{body}</div>
      </div>
    </li>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-[12.5px] leading-[1.6] text-text-primary">
      {children}
    </pre>
  );
}

function CoverRow({ label, yes, no }: { label: string; yes?: boolean; no?: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">{label}</td>
      <td className="px-3 py-2.5">
        {yes && <span className="text-risk-safe font-medium">Yes</span>}
        {no && <span className="text-risk-danger font-medium">No</span>}
      </td>
    </tr>
  );
}
