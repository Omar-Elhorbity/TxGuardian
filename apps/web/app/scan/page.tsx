"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { TxRiskResult } from "@txguardian/sdk";
import { TxInput } from "@/components/TxInput";
import { SampleTxPicker } from "@/components/SampleTxPicker";
import { RiskSkeleton } from "@/components/RiskSkeleton";
import { ResultView } from "@/components/ResultView";
import { RecommendationBar } from "@/components/RecommendationBar";
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  FlaskConical,
  History,
  Puzzle,
  MousePointerClick,
} from "lucide-react";
import { signAndSend, checkSignability } from "@/lib/sign-and-send";

interface Provenance {
  signature: string;
  slot: number;
  blockTime: number | null;
}

type ResultWithProvenance = TxRiskResult & { provenance?: Provenance };

type State =
  | { kind: "idle" }
  | { kind: "loading"; mode: "fast" | "full" }
  | { kind: "error"; message: string }
  | {
      kind: "result";
      data: ResultWithProvenance;
      /** The base64 transaction that was analyzed. Null when the input was a
       *  signature (mined tx — nothing to sign-and-send). */
      transaction: string | null;
    };

export default function ScanPage() {
  const [tx, setTx] = useState("");
  const [mode, setMode] = useState<"fast" | "full">("full");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const { connection } = useConnection();
  const wallet = useWallet();

  const submit = useCallback(
    async (input: string, m: "fast" | "full") => {
      const trimmed = input.trim();
      if (!trimmed) return;
      setSignature(null);
      setSendError(null);
      setState({ kind: "loading", mode: m });
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Server detects signature vs base64; keep one input field.
          body: JSON.stringify({ transaction: trimmed, mode: m }),
        });
        const json = await res.json();
        if (!res.ok) {
          setState({
            kind: "error",
            message:
              typeof json?.error === "string"
                ? json.error
                : "Analysis failed.",
          });
          return;
        }
        const data = json as ResultWithProvenance;
        setState({
          kind: "result",
          data,
          // If the server reported provenance, this was a mined-signature
          // lookup — there's no signable base64 we can send.
          transaction: data.provenance ? null : trimmed,
        });
      } catch {
        setState({
          kind: "error",
          message: "Network error. Check your connection and try again.",
        });
      }
    },
    [],
  );

  const onAnalyze = useCallback(() => {
    void submit(tx, mode);
  }, [tx, mode, submit]);

  const onPickSample = useCallback(
    async (type: "safe" | "caution" | "danger") => {
      try {
        const params = new URLSearchParams({ type });
        if (wallet.publicKey) {
          params.set("payer", wallet.publicKey.toBase58());
        }
        const res = await fetch(`/api/fixtures?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || typeof json?.transaction !== "string") {
          setState({
            kind: "error",
            message:
              typeof json?.error === "string"
                ? json.error
                : "Failed to load sample.",
          });
          return;
        }
        setTx(json.transaction);
        await submit(json.transaction, mode);
      } catch {
        setState({ kind: "error", message: "Failed to load sample." });
      }
    },
    [mode, submit, wallet.publicKey],
  );

  const onReset = useCallback(() => {
    setTx("");
    setState({ kind: "idle" });
    setSignature(null);
    setSendError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const resultTx =
    state.kind === "result" ? state.transaction : null;
  const provenance =
    state.kind === "result" ? state.data.provenance : undefined;

  // Pre-flight: is this transaction signable by the connected wallet?
  // Disabled entirely when there's no base64 (signature-based analysis).
  const proceedDisabledReason = useMemo(() => {
    if (!resultTx) return "No transaction to sign.";
    return checkSignability(resultTx, wallet.publicKey ?? null);
  }, [resultTx, wallet.publicKey]);

  const onSignAndSend = useCallback(async () => {
    if (!resultTx) return;
    setSendError(null);
    setSending(true);
    try {
      const outcome = await signAndSend(resultTx, wallet, connection);
      if (outcome.ok) {
        setSignature(outcome.signature);
      } else {
        setSendError(outcome.error);
      }
    } finally {
      setSending(false);
    }
  }, [resultTx, wallet, connection]);

  return (
    <div className="mx-auto max-w-[960px] px-6 pb-8 pt-10 md:pt-14">
      <header className="mb-8 max-w-[680px]">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-[12px] text-text-secondary">
          <FlaskConical
            className="h-3 w-3 text-accent"
            strokeWidth={2}
            aria-hidden
          />
          Engine demo
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          Try the analyzer on any Solana transaction
        </h1>
        <p className="mt-3 text-[14px] leading-[1.65] text-text-secondary">
          The same deterministic engine the{" "}
          <Link
            href="/extension"
            className="text-accent hover:text-accent-hover"
          >
            browser extension
          </Link>{" "}
          uses behind every signing prompt. Pick a sample, drop in a signature
          from Solana Explorer, or paste a base64 transaction — get the
          verdict, flags, and plain-English explanation. Optionally connect a
          wallet to sign-and-send a sample on devnet.
        </p>
        <p className="mt-2 text-[12px] leading-[1.6] text-text-muted">
          Integrating the SDK and want to see raw{" "}
          <code className="font-mono text-[11px] text-text-secondary">
            TxRiskResult
          </code>{" "}
          JSON instead?{" "}
          <Link
            href="/playground"
            className="text-accent hover:text-accent-hover"
          >
            Open the SDK playground
          </Link>
          .
        </p>
      </header>

      <div className="space-y-5">
        <TxInput
          value={tx}
          onChange={setTx}
          onSubmit={onAnalyze}
          mode={mode}
          onModeChange={setMode}
          disabled={state.kind === "loading"}
        />
        <SampleTxPicker
          onPick={onPickSample}
          disabled={state.kind === "loading"}
        />
      </div>

      <section className="mt-10" aria-live="polite">
        {state.kind === "loading" && <RiskSkeleton mode={state.mode} />}
        {state.kind === "error" && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-risk-danger/30 bg-risk-danger-soft p-4 text-[13px] text-risk-danger"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <div className="font-medium">Analysis failed</div>
              <p className="mt-1 leading-[1.55] opacity-90">{state.message}</p>
            </div>
          </div>
        )}
        {state.kind === "result" && (
          <>
            {provenance && <ProvenanceBanner p={provenance} />}
            <ResultView result={state.data} />
          </>
        )}
      </section>

      {sendError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-md border border-risk-danger/30 bg-risk-danger-soft p-4 text-[13px] text-risk-danger"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden
          />
          <div>
            <div className="font-medium">Sign &amp; send failed</div>
            <p className="mt-1 leading-[1.55] opacity-90">{sendError}</p>
          </div>
        </div>
      )}

      {state.kind === "result" && resultTx && (
        <RecommendationBar
          level={state.data.riskLevel}
          recommendation={state.data.recommendation}
          onScanAnother={onReset}
          onSignAndSend={onSignAndSend}
          sending={sending}
          signature={signature}
          walletConnected={wallet.connected}
          proceedDisabledReason={proceedDisabledReason}
        />
      )}

      {/* Two-card "what's this vs that" — disambiguates /scan (engine demo)
          from /demo-sign (extension verification). Each card explicitly names
          what it's for so users land on the right surface. */}
      <section
        className="mt-16 grid gap-3 md:grid-cols-2 md:gap-4"
        aria-label="Other surfaces"
      >
        <div className="panel-strong p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-accent-soft p-2 text-accent">
              <Puzzle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight">
                For real use, install the extension
              </h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-text-secondary">
                You don&apos;t have base64 transactions sitting around — your
                wallet does. The extension intercepts every signing request
                on every dApp and runs this same engine before your
                wallet&apos;s prompt.
              </p>
              <Link
                href="/extension"
                className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent hover:text-accent-hover"
              >
                Install the extension
                <ArrowRight
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-surface-2 p-2 text-text-secondary">
              <MousePointerClick
                className="h-4 w-4"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight">
                Already installed it? Test the interception
              </h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-text-secondary">
                Confirm the extension is patching your wallet correctly.
                One-click signing flow on devnet — the verdict modal should
                appear before your wallet&apos;s prompt.
              </p>
              <Link
                href="/demo-sign"
                className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent hover:text-accent-hover"
              >
                Run the signing test
                <ArrowRight
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProvenanceBanner({ p }: { p: Provenance }) {
  const explorer = `https://explorer.solana.com/tx/${p.signature}?cluster=devnet`;
  const when = p.blockTime ? formatRelativeTime(p.blockTime) : null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-md border border-info/30 bg-info-soft p-4 text-[13px] text-info">
      <History
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">This transaction is already on Solana</div>
        <p className="mt-1 leading-[1.55] opacity-90">
          {when
            ? `Signed and confirmed ${when}.`
            : "It's already been signed and confirmed."}{" "}
          TxGuardian can&apos;t block what&apos;s already on chain — this
          shows what the verdict would have looked like before you signed.
        </p>
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[12px] underline underline-offset-2"
        >
          See it on Solana Explorer
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </div>
  );
}

/**
 * Plain-English relative time. Tuned for the engine demo where users care
 * about "is this recent or ancient?" not millisecond precision.
 */
function formatRelativeTime(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return "moments ago";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400 * 30) {
    const d = Math.floor(diff / 86400);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400 * 365) {
    const mo = Math.floor(diff / 86400 / 30);
    return `${mo} month${mo === 1 ? "" : "s"} ago`;
  }
  const y = Math.floor(diff / 86400 / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}
