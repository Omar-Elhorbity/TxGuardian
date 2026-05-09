"use client";

import type { RiskLevel } from "@txguardian/sdk";

const tone: Record<RiskLevel, string> = {
  safe: "text-risk-safe",
  caution: "text-risk-caution",
  danger: "text-risk-danger",
};

export function RecommendationBar({
  level,
  recommendation,
  onScanAnother,
}: {
  level: RiskLevel;
  recommendation: string;
  onScanAnother: () => void;
}) {
  return (
    <div
      className="sticky bottom-0 z-20 border-t border-border bg-base/95 backdrop-blur-md"
      role="region"
      aria-label="Recommendation"
    >
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Recommendation
          </div>
          <div className={`mt-1 text-[15px] font-semibold ${tone[level]}`}>
            {recommendation}
          </div>
        </div>
        <button
          onClick={onScanAnother}
          className="btn btn-secondary text-[13px]"
        >
          Scan another
        </button>
      </div>
    </div>
  );
}
