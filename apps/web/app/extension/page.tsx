import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  ShieldCheck,
  Eye,
  ZapOff,
  ExternalLink,
} from "lucide-react";
import pkg from "../../../extension/package.json";

const EXTENSION_VERSION = pkg.version;
const DOWNLOAD_HREF = "/txguardian-extension.zip";

/**
 * Read the build-time SHA256 of the downloadable extension zip so the
 * page can show it next to the download link. The prebuild hook
 * (apps/extension/scripts/zip-dist.mjs) writes
 * apps/web/public/txguardian-extension.sha256.txt — present in every
 * deploy that ran the prebuild. If the file is missing (dev server
 * without a prior build), we fall back to a dash so the page still
 * renders.
 */
function readExtensionSha256(): string | null {
  try {
    const path = join(
      process.cwd(),
      "public",
      "txguardian-extension.sha256.txt",
    );
    return readFileSync(path, "utf-8").trim() || null;
  } catch {
    return null;
  }
}
const EXTENSION_SHA256 = readExtensionSha256();

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
          See what you&apos;re signing.
          <br className="hidden md:block" />
          <span className="text-text-secondary">We don&apos;t.</span>
        </h1>
        <p className="mt-5 max-w-[600px] text-[15px] leading-[1.65] text-text-secondary">
          The whole verdict engine ships inside the extension. When a dApp
          asks your wallet to sign, the check happens in your browser —
          your transactions never reach our server. Verdicts in
          milliseconds. The wallet still has the final say.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href={DOWNLOAD_HREF}
            download
            className="btn btn-primary"
          >
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
            Download v{EXTENSION_VERSION}
          </a>
          <Link href="/demo-sign" className="btn btn-secondary">
            See it in action
          </Link>
        </div>
        <p className="mt-3 text-[12px] text-text-muted">
          ZIP, ~50 KB. Pre-built; works out of the box with a default
          Solana RPC. No accounts, no API keys, no setup.
        </p>
        {EXTENSION_SHA256 && (
          <p className="mt-2 text-[11px] text-text-muted">
            SHA256:{" "}
            <code className="break-all font-mono text-[11px] text-text-secondary">
              {EXTENSION_SHA256}
            </code>
            <br />
            Verify locally:{" "}
            <code className="font-mono text-[11px] text-text-secondary">
              shasum -a 256 txguardian-extension.zip
            </code>
          </p>
        )}
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
            body="Catches every signing request the moment a Solana dApp asks for one — before Phantom, Solflare, Backpack, or any other wallet shows you its prompt."
          />
          <FeatureCard
            icon={
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            }
            title="Check in your browser"
            body="The full engine ships in the extension. It inspects the transaction against six rules + a live on-chain blocklist, all on your device. Your transactions never reach our server — we can't see them."
          />
          <FeatureCard
            icon={<ZapOff className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Decide"
            body="Shows you the verdict in plain English. Approve and the request flows through to your wallet normally. Reject and the dApp sees a standard cancellation — same as if you'd hit cancel yourself."
          />
        </div>
      </section>

      {/* Install */}
      <section id="install" className="mt-16 scroll-mt-24" aria-labelledby="install-heading">
        <h2
          id="install-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Install in 3 steps
        </h2>
        <p className="text-[14px] leading-[1.65] text-text-secondary">
          Manifest V3 — works in Chrome, Brave, Arc, and Edge. Chrome Web
          Store listing in progress; load unpacked in the meantime.
        </p>

        <ol className="mt-5 space-y-5">
          <Step
            n={1}
            title="Download and extract"
            body={
              <>
                <p className="text-[13px] leading-[1.65] text-text-secondary">
                  Grab the zip and unzip it anywhere — the extracted folder
                  is what you&apos;ll point Chrome at in the next step.
                </p>
                <a
                  href={DOWNLOAD_HREF}
                  download
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
                >
                  <Download
                    className="h-3.5 w-3.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  txguardian-extension.zip · v{EXTENSION_VERSION}
                </a>
              </>
            }
          />
          <Step
            n={2}
            title="Open the extensions page and enable Developer mode"
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
                ,{" "}
                <code className="font-mono text-[12px] text-text-primary">
                  edge://extensions
                </code>
                ). Toggle{" "}
                <strong className="text-text-primary">Developer mode</strong>{" "}
                in the top-right.
              </p>
            }
          />
          <Step
            n={3}
            title="Load unpacked, then test it"
            body={
              <>
                <p className="text-[13px] leading-[1.65] text-text-secondary">
                  Click{" "}
                  <strong className="text-text-primary">Load unpacked</strong>{" "}
                  and select the folder you extracted in step 1. TxGuardian
                  appears in your extensions list, active on every page.
                </p>
                <Link
                  href="/demo-sign"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
                >
                  Run the signing test
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
        <p className="mt-6 text-[12px] leading-[1.65] text-text-muted">
          The extension defaults to the analyzer running on this site —
          zero configuration. Self-hosters can override the endpoint from
          the toolbar popup.
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
              <CoverRow label="One-click sign-and-send from a dApp (Phantom shorthand)" yes />
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

      {/* Build from source (developers) */}
      <section className="mt-16" aria-labelledby="dev-heading">
        <h2
          id="dev-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Build from source
        </h2>
        <p className="text-[13px] leading-[1.65] text-text-secondary">
          For development, custom analyzer endpoints, or auditing the build:
        </p>
        <CodeBlock>
{`git clone https://github.com/Omar-Elhorbity/TxGuardian
cd TxGuardian
pnpm install
pnpm --filter @txguardian/extension package
# → produces apps/extension/dist/ and apps/web/public/txguardian-extension.zip`}
        </CodeBlock>
        <p className="mt-3 text-[12px] text-text-muted">
          Then load{" "}
          <code className="font-mono text-[11px]">apps/extension/dist</code>{" "}
          unpacked. Endpoint can be overridden from the toolbar popup, or
          edit{" "}
          <code className="font-mono text-[11px]">
            apps/extension/src/config.ts
          </code>{" "}
          and rebuild.
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
