import Link from "next/link";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";

const SECTIONS = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#api-reference", label: "API reference" },
  { href: "#risk-flags", label: "Risk flags" },
  { href: "#on-chain-registry", label: "On-chain registry" },
  { href: "#integration", label: "Integration patterns" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14 md:grid md:grid-cols-[200px_1fr] md:gap-10">
      {/* Sidebar */}
      <aside
        className="mb-8 md:mb-0 md:sticky md:top-20 md:self-start"
        aria-label="Docs navigation"
      >
        {/* Mobile: collapsible "On this page". Closed by default so the page
            heading lands first; native <details> keeps it JS-free + accessible. */}
        <details className="group rounded-md border border-border bg-surface-1 md:hidden">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted [&::-webkit-details-marker]:hidden">
            <span>On this page</span>
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <ul className="space-y-1 border-t border-border px-4 py-3 text-[13px] text-text-secondary">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="block py-1 hover:text-text-primary"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>

        {/* Desktop: sticky sidebar */}
        <nav className="hidden text-[13px] md:block">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Docs
          </div>
          <ul className="space-y-1.5 text-text-secondary">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="hover:text-text-primary">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Content */}
      <article className="prose-like max-w-[760px]">
        <header>
          <h1 className="text-[32px] font-semibold tracking-tight">
            SDK documentation
          </h1>
          <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
            <code className="font-mono text-[12px] text-text-primary">
              @txguardian/sdk
            </code>{" "}
            is a TypeScript SDK that takes a Solana transaction and returns a
            structured risk verdict. Six active rules + a deployed Solana
            program backing the on-chain feed. One AI translator. No signing
            surface.
          </p>
        </header>

        {/* Quickstart */}
        <section id="quickstart" className="mt-12 scroll-mt-24">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Quickstart
          </h2>
          <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
            The SDK ships as the workspace package{" "}
            <code className="font-mono text-[12px] text-text-primary">
              @txguardian/sdk
            </code>{" "}
            in this monorepo. Clone and link to use it from any project in the
            workspace:
          </p>
          <CodeBlock>
{`git clone https://github.com/Omar-Elhorbity/TxGuardian
cd TxGuardian
pnpm install
# The SDK is now resolvable from any workspace package via "@txguardian/sdk"`}
          </CodeBlock>

          <p className="mt-4 text-[14px] leading-[1.65] text-text-secondary">
            Five-line integration in any TypeScript project:
          </p>
          <CodeBlock>
{`import { analyze } from "@txguardian/sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.RPC_URL!);

const result = await analyze({
  transaction: base64Tx,    // string from your wallet's signing prompt
  connection,
  mode: "full",             // "fast" = rules only; "full" = + simulation + AI + on-chain feed
});

if (result.riskLevel === "danger") {
  // Block the user from signing, surface result.flags + result.explanation
}`}
          </CodeBlock>
          <p className="mt-3 text-[13px] leading-[1.65] text-text-muted">
            For Full mode, set{" "}
            <code className="font-mono text-[11px]">
              GOOGLE_GENERATIVE_AI_API_KEY
            </code>{" "}
            server-side (free key at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-hover"
            >
              aistudio.google.com/apikey
            </a>
            ). Fast mode works without it.
          </p>
        </section>

        {/* API reference */}
        <section id="api-reference" className="mt-14 scroll-mt-24">
          <h2 className="text-[20px] font-semibold tracking-tight">
            API reference
          </h2>
          <h3 className="mt-6 text-[15px] font-semibold">analyze(options)</h3>
          <CodeBlock>
{`type AnalyzeOptions = {
  transaction: string | VersionedTransaction | Transaction;
  connection: Connection;
  publicKey?: PublicKey;
  mode?: "fast" | "full";
  model?: string; // override LLM model (default: gemini-2.5-flash)
};`}
          </CodeBlock>
          <h3 className="mt-6 text-[15px] font-semibold">TxRiskResult</h3>
          <CodeBlock>
{`type TxRiskResult = {
  riskLevel: "safe" | "caution" | "danger";
  score: number;                 // 0–100
  flags: TxRiskFlag[];
  explanation: string;           // Empty in fast mode
  recommendation: "Safe to sign" | "Proceed with caution" | "Do not sign";
  whatThisDoes: string[];        // Empty in fast mode
  decodedInstructions: DecodedInstruction[];
  simulation?: SimulationDelta;
  analyzedAt: string;            // ISO
  mode: "fast" | "full";
};`}
          </CodeBlock>
          <p className="mt-3 text-[13px] leading-[1.65] text-text-secondary">
            <strong className="text-text-primary">Invariant:</strong> the
            deterministic verdict (riskLevel, score, flags, recommendation) is
            always valid. AI failures and on-chain RPC failures degrade to
            empty fields, never to a wrong verdict.
          </p>

          <h3 className="mt-6 text-[15px] font-semibold">
            Registry helpers (on-chain feed)
          </h3>
          <CodeBlock>
{`// Read the live on-chain attestation feed.
import {
  fetchConfirmedAttestations,
  fetchAllAttestations,
  fetchRegistry,
  TXGUARDIAN_REGISTRY_PROGRAM_ID,
} from "@txguardian/sdk";

const attestations = await fetchConfirmedAttestations(connection);
const summary = await fetchRegistry(connection); // admin + counters`}
          </CodeBlock>
        </section>

        {/* Risk flags */}
        <section id="risk-flags" className="mt-14 scroll-mt-24">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Risk flags
          </h2>
          <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
            Every detected risk is reported as a{" "}
            <code className="font-mono text-[12px] text-text-primary">
              TxRiskFlag
            </code>{" "}
            with a stable id, severity, label, description, and structured
            evidence (including <code>evidence.source</code> for drainer
            matches: <code>"hardcoded"</code> or <code>"onchain"</code>).
          </p>
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Detects</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <FlagRow
                  id="KNOWN_DRAINER_PROGRAM"
                  sev="high"
                  detects="Program in the hardcoded blocklist OR a confirmed entry on the on-chain registry."
                />
                <FlagRow
                  id="FULL_TOKEN_APPROVAL"
                  sev="high"
                  detects="Unbounded SPL Token / Token-2022 Approve, or SetAuthority(AccountOwner)."
                />
                <FlagRow
                  id="SIMULATION_SPOOF"
                  sev="high"
                  detects="Token Transfer / TransferChecked to a non-signer destination — verify against wallet preview."
                />
                <FlagRow
                  id="UNKNOWN_PROGRAM"
                  sev="medium"
                  detects="Program not in the well-known allowlist."
                />
                <FlagRow
                  id="MULTI_INSTRUCTION_COMPLEXITY"
                  sev="medium"
                  detects="5+ non-ComputeBudget instructions — common obfuscation pattern."
                />
                <FlagRow
                  id="UNUSUAL_FEE"
                  sev="low"
                  detects="Priority fee ≥ 1M micro-lamports/CU."
                />
                <FlagRow
                  id="TOCTOU_PATTERN"
                  sev="medium"
                  detects="Schema reserved. Generic runtime detection requires per-program decoders and is not currently implemented."
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* On-chain registry */}
        <section id="on-chain-registry" className="mt-14 scroll-mt-24">
          <h2 className="text-[20px] font-semibold tracking-tight">
            On-chain registry
          </h2>
          <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
            The drainer blocklist isn't hardcoded — it lives on-chain as an{" "}
            <strong className="text-text-primary">Anchor program</strong>{" "}
            deployed on Solana devnet. Anyone can submit a flag; an admin
            keypair confirms or revokes; the SDK reads confirmed entries via{" "}
            <code className="font-mono text-[12px] text-text-primary">
              getProgramAccounts
            </code>{" "}
            with memcmp filters.
          </p>

          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-[13px]">
              <tbody className="text-text-secondary">
                <MetaRow label="Cluster" value="Devnet" />
                <MetaRow
                  label="Program ID"
                  value="Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7"
                  mono
                />
                <MetaRow label="Framework" value="Anchor 0.32.1, Rust" />
                <MetaRow
                  label="Source"
                  value="programs/txguardian-registry"
                  mono
                />
                <MetaRow
                  label="Explorer"
                  value="solana.com/explorer"
                  link="https://explorer.solana.com/address/Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7?cluster=devnet"
                />
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[14px] leading-[1.65] text-text-secondary">
            The SDK's drainer rule consults both the hardcoded list AND the
            on-chain feed. Each flag's{" "}
            <code className="font-mono text-[12px] text-text-primary">
              evidence.source
            </code>{" "}
            field tags the origin so the UI can show provenance.
          </p>

          <p className="mt-3 text-[14px] leading-[1.65] text-text-secondary">
            Visit the{" "}
            <Link
              href="/registry"
              className="text-accent hover:text-accent-hover"
            >
              live registry view
            </Link>{" "}
            to see current entries.
          </p>
        </section>

        {/* Integration */}
        <section id="integration" className="mt-14 scroll-mt-24">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Integration patterns
          </h2>

          <h3 className="mt-6 text-[15px] font-semibold">
            Wallet adapter (pre-sign hook)
          </h3>
          <CodeBlock>
{`// In your wallet's sign-transaction handler
async function onBeforeSign(tx: VersionedTransaction): Promise<boolean> {
  const result = await analyze({ transaction: tx, connection, mode: "full" });

  if (result.riskLevel === "danger") {
    // Show TxGuardian's verdict + flags in your wallet UI
    return await showWarningSheet(result); // returns user's decision
  }
  return true; // proceed to native signing
}`}
          </CodeBlock>

          <h3 className="mt-6 text-[15px] font-semibold">Next.js API route</h3>
          <CodeBlock>
{`// app/api/check/route.ts
import { analyze } from "@txguardian/sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.RPC_URL!);

export async function POST(req: Request) {
  const { transaction } = await req.json();
  const result = await analyze({ transaction, connection, mode: "full" });
  return Response.json(result);
}`}
          </CodeBlock>
        </section>

        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/scan"
            className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-hover"
          >
            Try it in the engine demo
            <ArrowRight
              className="h-3.5 w-3.5"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        </div>
      </article>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-[12.5px] leading-[1.6] text-text-primary">
      {children}
    </pre>
  );
}

const sevTone = {
  low: "bg-info-soft text-info",
  medium: "bg-risk-caution-soft text-risk-caution",
  high: "bg-risk-danger-soft text-risk-danger",
} as const;

function FlagRow({
  id,
  sev,
  detects,
}: {
  id: string;
  sev: keyof typeof sevTone;
  detects: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono text-[12px] text-text-primary">
        {id}
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevTone[sev]}`}
        >
          {sev}
        </span>
      </td>
      <td className="px-3 py-2">{detects}</td>
    </tr>
  );
}

function MetaRow({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <tr className="border-t border-border first:border-t-0">
      <td className="px-3 py-2 text-[12px] uppercase tracking-[0.08em] text-text-muted w-32">
        {label}
      </td>
      <td className="px-3 py-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 text-text-primary hover:text-accent ${mono ? "font-mono text-[12px]" : ""}`}
          >
            {value}
            <ExternalLink
              className="h-3 w-3 opacity-60"
              strokeWidth={2}
              aria-hidden
            />
          </a>
        ) : (
          <span
            className={mono ? "font-mono text-[12px] text-text-primary" : "text-text-primary"}
          >
            {value}
          </span>
        )}
      </td>
    </tr>
  );
}
