"use client";

import { useState } from "react";
import type { TxRiskResult } from "@txguardian/sdk";
import { SampleTxPicker } from "@/components/SampleTxPicker";
import { RiskBadge } from "@/components/RiskBadge";
import { Loader2 } from "lucide-react";

export default function PlaygroundPage() {
  const [mode, setMode] = useState<"fast" | "full">("full");
  const [result, setResult] = useState<TxRiskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<
    "safe" | "caution" | "danger" | null
  >(null);

  async function runSample(type: "safe" | "caution" | "danger") {
    setActiveSample(type);
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const fixtureRes = await fetch(`/api/fixtures?type=${type}`);
      const fixtureJson = await fixtureRes.json();
      if (!fixtureRes.ok) throw new Error(fixtureJson?.error ?? "Fixture failed");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: fixtureJson.transaction, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Analysis failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
      <header className="max-w-[640px]">
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          Playground
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
          Pick a sample, see the structured <code className="font-mono text-[12px] text-text-primary">TxRiskResult</code> the SDK would return your dApp.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <SampleTxPicker onPick={runSample} disabled={busy} />

          <div className="panel p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Mode
            </div>
            <div className="inline-flex items-center gap-1 rounded-sm bg-surface-2 p-1">
              <ModeButton
                active={mode === "fast"}
                onClick={() => setMode("fast")}
                label="Fast"
              />
              <ModeButton
                active={mode === "full"}
                onClick={() => setMode("full")}
                label="Full"
              />
            </div>
          </div>

          {result && (
            <RiskBadge
              level={result.riskLevel}
              score={result.score}
              flagCount={result.flags.length}
            />
          )}
        </div>

        <div className="panel-strong p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              TxRiskResult JSON
            </div>
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
            )}
          </div>
          {error && (
            <div className="mb-3 rounded-sm border border-risk-danger/30 bg-risk-danger-soft p-3 text-[12px] text-risk-danger">
              {error}
            </div>
          )}
          <pre className="max-h-[600px] overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.55] text-text-secondary">
            {result
              ? JSON.stringify(result, null, 2)
              : activeSample
                ? "// Loading…"
                : "// Pick a sample to run analyze() and see the result."}
          </pre>
          <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-text-muted">
{`await analyze({
  transaction: <base64>,
  connection,
  mode: "${mode}",
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-sm px-3 py-1.5 text-[12px] transition-colors ${
        active ? "bg-surface-3 text-text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
