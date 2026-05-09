"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Severity, TxRiskFlag } from "@txguardian/sdk";

const sevTone: Record<Severity, string> = {
  low: "bg-info-soft text-info",
  medium: "bg-risk-caution-soft text-risk-caution",
  high: "bg-risk-danger-soft text-risk-danger",
};

const sevAriaLabel: Record<Severity, string> = {
  low: "Low severity",
  medium: "Medium severity",
  high: "High severity",
};

export function FlagCard({ flag }: { flag: TxRiskFlag }) {
  const [open, setOpen] = useState(false);
  const hasEvidence =
    flag.evidence !== undefined &&
    flag.evidence !== null &&
    Object.keys(flag.evidence).length > 0;

  const labelId = `flag-${flag.id.toLowerCase()}-${flag.label.length}`;

  return (
    <article className="panel p-4" aria-labelledby={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevTone[flag.severity]}`}
              aria-label={sevAriaLabel[flag.severity]}
            >
              {flag.severity}
            </span>
            <h3 id={labelId} className="text-[14px] font-semibold tracking-tight">
              {flag.label}
            </h3>
          </div>
          <p className="mt-2 text-[13px] leading-[1.6] text-text-secondary">
            {flag.description}
          </p>
        </div>
        {hasEvidence && (
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Hide evidence" : "Show evidence"}
            className="btn btn-ghost shrink-0 p-1.5"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        )}
      </div>
      {open && hasEvidence && (
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-text-secondary">
          {JSON.stringify(flag.evidence, null, 2)}
        </pre>
      )}
    </article>
  );
}
