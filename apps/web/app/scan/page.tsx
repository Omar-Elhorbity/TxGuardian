"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { TxRiskResult } from "@txguardian/sdk";
import { TxInput } from "@/components/TxInput";
import { SampleTxPicker } from "@/components/SampleTxPicker";
import { RiskSkeleton } from "@/components/RiskSkeleton";
import { ResultView } from "@/components/ResultView";
import { RecommendationBar } from "@/components/RecommendationBar";
import { AlertCircle } from "lucide-react";
import { signAndSend, checkSignability } from "@/lib/sign-and-send";

type State =
  | { kind: "idle" }
  | { kind: "loading"; mode: "fast" | "full" }
  | { kind: "error"; message: string }
  | {
      kind: "result";
      data: TxRiskResult;
      /** The base64 transaction that was analyzed. Needed for sign+send. */
      transaction: string;
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
    async (transaction: string, m: "fast" | "full") => {
      const trimmed = transaction.trim();
      if (!trimmed) return;
      setSignature(null);
      setSendError(null);
      setState({ kind: "loading", mode: m });
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        setState({
          kind: "result",
          data: json as TxRiskResult,
          transaction: trimmed,
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
        // If wallet is connected, request a signable variant: server rebuilds
        // the sample with the connected pubkey as payer + fresh blockhash so
        // the user can actually sign and submit.
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

  // The transaction we'd sign — only valid in result state.
  const resultTx =
    state.kind === "result" ? state.transaction : null;

  // Pre-flight: is this transaction signable by the connected wallet?
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
      <header className="mb-8 max-w-[640px]">
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          Inspect a transaction
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-text-secondary">
          Paste a base64 Solana transaction below. The deterministic rule
          engine and (in Full mode) AI translator run on the server. If you
          want to sign and submit, connect a wallet — TxGuardian never holds
          your keys.
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
        {state.kind === "result" && <ResultView result={state.data} />}
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

      {state.kind === "result" && (
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
    </div>
  );
}
