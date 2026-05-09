import Link from "next/link";
import { ExternalLink, ShieldX, AlertTriangle, ShieldCheck, Database } from "lucide-react";
import {
  fetchAllAttestations,
  fetchRegistry,
  TXGUARDIAN_REGISTRY_PROGRAM_ID,
  type AttestationSeverity,
  type AttestationStatus,
  type OnChainAttestation,
} from "@txguardian/sdk";
import { getConnection } from "@/lib/rpc";

// Server component — refetches every 30s. Cheap, plays well with our 60s
// in-process cache in the SDK.
export const revalidate = 30;

const EXPLORER_BASE =
  "https://explorer.solana.com/address/";

export default async function RegistryPage() {
  const connection = getConnection();
  const [registry, attestations] = await Promise.all([
    fetchRegistry(connection),
    fetchAllAttestations(connection),
  ]);

  // Sort: confirmed first (high → low severity), then pending, then revoked.
  const sorted = [...attestations].sort((a, b) => {
    const statusRank = (s: AttestationStatus) =>
      s === "confirmed" ? 0 : s === "pending" ? 1 : 2;
    const sa = statusRank(a.status);
    const sb = statusRank(b.status);
    if (sa !== sb) return sa - sb;
    if (a.severity !== b.severity) return b.severity - a.severity;
    return b.submittedAt - a.submittedAt;
  });

  const programExplorer = `${EXPLORER_BASE}${TXGUARDIAN_REGISTRY_PROGRAM_ID}?cluster=devnet`;

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-10 md:py-14">
      <header className="max-w-[760px]">
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          On-chain risk registry
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
          The TxGuardian SDK reads confirmed entries from this on-chain feed at
          scan time and folds them into the deterministic rule engine. Anyone
          can submit a flag; an admin keypair confirms or revokes. Multisig is
          v1 work.
        </p>
      </header>

      {/* Program metadata */}
      <section className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Registry metadata">
        <Stat
          label="Program ID"
          value={shortAddr(TXGUARDIAN_REGISTRY_PROGRAM_ID)}
          mono
          link={programExplorer}
        />
        <Stat
          label="Confirmed entries"
          value={
            registry ? registry.confirmedCount.toString() : "—"
          }
        />
        <Stat
          label="Total submissions"
          value={
            registry ? registry.submissionCount.toString() : "—"
          }
        />
      </section>

      {/* Table */}
      <section className="mt-8" aria-labelledby="entries-heading">
        <h2
          id="entries-heading"
          className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Entries
        </h2>

        {sorted.length === 0 ? (
          <EmptyState registryInitialized={registry !== null} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  <th className="px-3 py-2 font-medium">Target program</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Reason (untrusted)</th>
                  <th className="px-3 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {sorted.map((a) => (
                  <Row key={a.targetProgram} attestation={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* How to submit */}
      <section className="mt-12 panel-strong p-5" aria-labelledby="submit-heading">
        <h2
          id="submit-heading"
          className="text-[15px] font-semibold tracking-tight"
        >
          How to flag a program
        </h2>
        <p className="mt-2 max-w-[700px] text-[13px] leading-[1.65] text-text-secondary">
          The submit instruction is permissionless — anyone can flag a program
          for review by paying rent for the attestation account (~0.002 SOL on
          devnet). The admin keypair confirms or revokes; only confirmed entries
          show up in scanner output.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[12px] leading-[1.55] text-text-primary">
{`// Server-side, with @coral-xyz/anchor and the program IDL
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { deriveRegistryPda, deriveAttestationPda, TXGUARDIAN_REGISTRY_PROGRAM_ID } from "@txguardian/sdk";

const [registry] = deriveRegistryPda();
const [attestation] = deriveAttestationPda(targetProgramPubkey);

const reason = Buffer.alloc(64);
reason.write("Drainer reported on 2026-04-15", "utf8");

await program.methods
  .submit(targetProgramPubkey, 3, Array.from(reason))
  .accounts({ registry, attestation, submitter, systemProgram })
  .rpc();`}
        </pre>
        <p className="mt-3 text-[12px] text-text-muted">
          See <Link href="/docs" className="text-accent hover:text-accent-hover">/docs</Link> for the full instruction reference, or the{" "}
          <a href={programExplorer} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover inline-flex items-center gap-1">
            program on Solana Explorer
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
          </a>.
        </p>
      </section>

      {/* Security note */}
      <section className="mt-8 panel p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-risk-caution"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="text-[12px] leading-[1.65] text-text-secondary">
            <span className="font-medium text-text-primary">Reason text is untrusted.</span>{" "}
            Anyone can submit any string up to 64 bytes. The scanner never quotes
            reason text into LLM prompts, and treats it as display-only here. Do
            not act on a reason field as if it's authoritative — verify the
            target program independently.
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
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
    <div className="panel p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className={`mt-2 text-[15px] ${mono ? "font-mono text-[14px]" : "font-semibold"} text-text-primary`}>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            {value}
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function EmptyState({ registryInitialized }: { registryInitialized: boolean }) {
  return (
    <div className="panel flex items-start gap-3 p-5">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
      <div className="text-[13px] leading-[1.65] text-text-secondary">
        {registryInitialized ? (
          <>
            <span className="font-medium text-text-primary">No entries yet.</span>{" "}
            The registry is initialized but no programs have been flagged.
            Submit one with the snippet below — the scanner will pick it up
            within 60 seconds (cache TTL).
          </>
        ) : (
          <>
            <span className="font-medium text-text-primary">Registry not initialized.</span>{" "}
            Run{" "}
            <code className="font-mono text-[12px] text-text-primary">
              pnpm tsx scripts/seed-registry.ts
            </code>{" "}
            to bootstrap the singleton account and seed the demo entries.
          </>
        )}
      </div>
    </div>
  );
}

function Row({ attestation }: { attestation: OnChainAttestation }) {
  const { Icon, tone } = severityVisual(attestation.severity);
  const explorer = `${EXPLORER_BASE}${attestation.targetProgram}?cluster=devnet`;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-3">
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12px] text-text-primary hover:text-accent inline-flex items-center gap-1"
        >
          {shortAddr(attestation.targetProgram)}
          <ExternalLink className="h-3 w-3 opacity-60" strokeWidth={2} aria-hidden />
        </a>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
          <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
          {severityLabel(attestation.severity)}
        </span>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={attestation.status} />
      </td>
      <td className="px-3 py-3 max-w-[280px]">
        <span className="line-clamp-2 text-text-secondary" title={attestation.reason || "(none)"}>
          {attestation.reason || <span className="italic text-text-muted">(none)</span>}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-[12px] text-text-muted">
        {formatRelative(attestation.submittedAt)}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: AttestationStatus }) {
  const map: Record<AttestationStatus, { tone: string; label: string }> = {
    confirmed: { tone: "bg-risk-safe-soft text-risk-safe", label: "Confirmed" },
    pending: { tone: "bg-info-soft text-info", label: "Pending" },
    revoked: { tone: "bg-surface-3 text-text-muted", label: "Revoked" },
  };
  const c = map[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${c.tone}`}>
      {c.label}
    </span>
  );
}

function severityVisual(s: AttestationSeverity) {
  if (s === 3)
    return { Icon: ShieldX, tone: "bg-risk-danger-soft text-risk-danger" };
  if (s === 2)
    return {
      Icon: AlertTriangle,
      tone: "bg-risk-caution-soft text-risk-caution",
    };
  return { Icon: ShieldCheck, tone: "bg-info-soft text-info" };
}

function severityLabel(s: AttestationSeverity): string {
  return s === 3 ? "high" : s === 2 ? "medium" : "low";
}

function shortAddr(a: string): string {
  if (a.length <= 16) return a;
  return `${a.slice(0, 8)}…${a.slice(-8)}`;
}

function formatRelative(unixSeconds: number): string {
  if (!unixSeconds || unixSeconds <= 0) return "—";
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
