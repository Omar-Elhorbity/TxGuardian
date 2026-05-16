"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TxRiskResult } from "@txguardian/sdk";
import Link from "next/link";
import { SampleTxPicker } from "@/components/SampleTxPicker";
import { RiskBadge } from "@/components/RiskBadge";
import { ExplanationBox } from "@/components/ExplanationBox";
import { Code2, Loader2 } from "lucide-react";

type SampleType = "safe" | "caution" | "danger";

export default function PlaygroundPage() {
  const [mode, setMode] = useState<"fast" | "full">("full");
  const [result, setResult] = useState<TxRiskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<SampleType | null>(null);

  // Re-run when the user toggles mode while a sample is loaded — otherwise
  // the displayed result is stale (built with the old mode) and Full looks
  // broken because the previous Fast result has no explanation.
  const initialRender = useRef(true);

  const runSample = useCallback(
    async (type: SampleType, modeArg: "fast" | "full") => {
      setActiveSample(type);
      setError(null);
      setBusy(true);
      setResult(null);
      try {
        const fixtureRes = await fetch(`/api/fixtures?type=${type}`);
        const fixtureJson = await fixtureRes.json();
        if (!fixtureRes.ok) {
          throw new Error(fixtureJson?.error ?? "Fixture failed");
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: fixtureJson.transaction,
            mode: modeArg,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Analysis failed");
        setResult(json as TxRiskResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (activeSample && !busy) {
      void runSample(activeSample, mode);
    }
    // Intentionally only re-runs on mode change with an active sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onPick = useCallback(
    (type: SampleType) => {
      void runSample(type, mode);
    },
    [mode, runSample],
  );

  const showExplanationPanel =
    result?.mode === "full" &&
    (result.explanation.length > 0 || result.whatThisDoes.length > 0);

  const showFullModeWaitingNote =
    result?.mode === "full" &&
    result.explanation.length === 0 &&
    result.whatThisDoes.length === 0;

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
      <header className="max-w-[680px]">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-[12px] text-text-secondary">
          <Code2
            className="h-3 w-3 text-accent"
            strokeWidth={2}
            aria-hidden
          />
          For developers integrating the SDK
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          SDK playground
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">
          Live <code className="font-mono text-[12px] text-text-primary">analyze()</code>{" "}
          calls against each sample, with the raw{" "}
          <code className="font-mono text-[12px] text-text-primary">
            TxRiskResult
          </code>{" "}
          shown on the right. Use this to size fields, check which keys are
          populated in each mode, and preview the shape before you write
          parser code in your own integration.
        </p>
        <p className="mt-2 text-[12px] text-text-muted">
          Want the rendered UI view instead?{" "}
          <Link
            href="/scan"
            className="text-accent hover:text-accent-hover"
          >
            Open the engine demo
          </Link>
          . Want the type definitions?{" "}
          <Link href="/docs" className="text-accent hover:text-accent-hover">
            Read the SDK docs
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          <SampleTxPicker onPick={onPick} disabled={busy} />

          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                Mode
              </div>
              {activeSample && (
                <div className="text-[10px] text-text-muted">
                  Toggling re-runs against the current sample
                </div>
              )}
            </div>
            <div className="inline-flex items-center gap-1 rounded-sm bg-surface-2 p-1">
              <ModeButton
                active={mode === "fast"}
                onClick={() => setMode("fast")}
                label="Fast"
                sub="Rules only"
              />
              <ModeButton
                active={mode === "full"}
                onClick={() => setMode("full")}
                label="Full"
                sub="+ Simulation + AI"
              />
            </div>
          </div>

          {result && (
            <>
              <RiskBadge
                level={result.riskLevel}
                score={result.score}
                flagCount={result.flags.length}
              />
              <ResultMetaBadge result={result} />
            </>
          )}

          {showExplanationPanel && (
            <ExplanationBox
              text={result.explanation}
              whatThisDoes={result.whatThisDoes}
            />
          )}

          {showFullModeWaitingNote && (
            <div className="panel p-3 text-[12px] leading-[1.6] text-text-muted">
              <span className="font-medium text-text-secondary">
                No explanation returned.
              </span>{" "}
              Full mode is selected but the AI step produced empty output.
              Most likely cause: missing or invalid{" "}
              <code className="font-mono text-[11px] text-text-primary">
                GOOGLE_GENERATIVE_AI_API_KEY
              </code>
              . Deterministic verdict above is still valid.
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="panel-strong min-w-0 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              TxRiskResult JSON
            </div>
            {busy && (
              <Loader2
                className="h-4 w-4 animate-spin text-accent"
                aria-hidden
              />
            )}
          </div>
          {error && (
            <div className="mb-3 rounded-sm border border-risk-danger/30 bg-risk-danger-soft p-3 text-[12px] text-risk-danger">
              {error}
            </div>
          )}
          <pre className="max-h-[600px] max-w-full overflow-auto whitespace-pre rounded-md border border-border bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.55] text-text-secondary">
            {result
              ? JSON.stringify(result, null, 2)
              : activeSample
                ? "// Loading…"
                : "// Pick a sample to run analyze() and see the result."}
          </pre>
          <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-text-muted">
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

function ResultMetaBadge({ result }: { result: TxRiskResult }) {
  const flagCount = result.flags.length;
  const aiOn =
    result.mode === "full" &&
    (result.explanation.length > 0 || result.whatThisDoes.length > 0);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
      <Pill>mode: {result.mode}</Pill>
      <Pill>{flagCount} flag{flagCount === 1 ? "" : "s"}</Pill>
      {result.mode === "full" && (
        <Pill tone={aiOn ? "ok" : "warn"}>
          AI: {aiOn ? "responded" : "empty"}
        </Pill>
      )}
      {result.simulation && (
        <Pill tone={result.simulation.ok ? "ok" : "warn"}>
          sim: {result.simulation.ok ? "ok" : "failed"}
        </Pill>
      )}
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-risk-safe-soft text-risk-safe"
      : tone === "warn"
        ? "bg-risk-caution-soft text-risk-caution"
        : "bg-surface-2 text-text-secondary";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start rounded-sm px-3 py-1.5 text-left transition-colors ${
        active
          ? "bg-surface-3 text-text-primary"
          : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className="text-[12px] font-medium leading-none">{label}</span>
      <span className="mt-1 text-[10px] leading-none text-text-muted">
        {sub}
      </span>
    </button>
  );
}
