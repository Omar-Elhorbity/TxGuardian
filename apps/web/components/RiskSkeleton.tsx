"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Parsing transaction…",
  "Resolving address lookup tables…",
  "Running risk checks…",
  "Generating explanation…",
];

export function RiskSkeleton({ mode }: { mode: "fast" | "full" }) {
  const visibleSteps = mode === "full" ? STEPS : STEPS.slice(0, 3);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
    }, 500);
    return () => clearInterval(interval);
  }, [visibleSteps.length]);

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="h-7 w-32 animate-pulse rounded-sm bg-surface-2" />
        <div className="mt-2.5 h-3 w-48 animate-pulse rounded-sm bg-surface-2" />
      </div>

      <div
        className="panel p-5"
        aria-live="polite"
        aria-label="Analysis progress"
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Analyzing
        </div>
        <ul className="mt-3 space-y-2 text-[13px] text-text-secondary">
          {visibleSteps.map((label, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    done
                      ? "bg-risk-safe"
                      : active
                        ? "animate-pulse bg-accent"
                        : "bg-surface-3"
                  }`}
                />
                <span className={done ? "text-text-muted" : ""}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {[1, 2].map((n) => (
        <div key={n} className="panel p-4">
          <div className="h-3 w-20 animate-pulse rounded-sm bg-surface-2" />
          <div className="mt-3 h-3 w-full animate-pulse rounded-sm bg-surface-2" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded-sm bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
