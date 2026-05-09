"use client";

import type { TxRiskResult } from "@txguardian/sdk";
import { RiskBadge } from "./RiskBadge";
import { FlagCard } from "./FlagCard";
import { ExplanationBox } from "./ExplanationBox";
import { useState } from "react";
import { ChevronDown, FileCode } from "lucide-react";

export function ResultView({ result }: { result: TxRiskResult }) {
  return (
    <div className="space-y-5">
      {/* 1. Verdict */}
      <RiskBadge
        level={result.riskLevel}
        score={result.score}
        flagCount={result.flags.length}
      />

      {/* 2. Explanation (full mode only) */}
      {result.mode === "full" && (
        <ExplanationBox
          text={result.explanation}
          whatThisDoes={result.whatThisDoes}
        />
      )}

      {/* 3. Flag evidence */}
      {result.flags.length > 0 && (
        <section aria-labelledby="flags-heading">
          <h2
            id="flags-heading"
            className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
          >
            Flags
          </h2>
          <div className="space-y-2.5">
            {result.flags.map((flag, i) => (
              <FlagCard key={`${flag.id}-${i}`} flag={flag} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Decoded instructions */}
      {result.decodedInstructions.length > 0 && (
        <DecodedInstructionsPanel
          instructions={result.decodedInstructions}
        />
      )}

      {/* 5. Raw data toggle */}
      <RawDataPanel result={result} />
    </div>
  );
}

function DecodedInstructionsPanel({
  instructions,
}: {
  instructions: TxRiskResult["decodedInstructions"];
}) {
  return (
    <section aria-labelledby="ix-heading" className="panel p-5">
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-text-muted" strokeWidth={1.75} aria-hidden />
        <h2
          id="ix-heading"
          className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted"
        >
          Decoded instructions
        </h2>
      </div>
      <ol className="mt-3 space-y-2 text-[13px]">
        {instructions.map((ix) => (
          <li key={ix.index} className="flex gap-3">
            <span className="shrink-0 font-mono text-[11px] text-text-muted">
              {String(ix.index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-text-primary">{ix.summary}</div>
              <div className="mt-0.5 font-mono text-[10px] text-text-muted">
                {ix.programName} · {short(ix.programId)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RawDataPanel({ result }: { result: TxRiskResult }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel-strong p-4">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Raw analysis JSON
        </span>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {open && (
        <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.5] text-text-secondary">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}

function short(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
