import { ShieldCheck, AlertTriangle, ShieldX } from "lucide-react";
import type { RiskLevel } from "@txguardian/sdk";

const config: Record<
  RiskLevel,
  { label: string; Icon: typeof ShieldCheck; surface: string; text: string }
> = {
  safe: {
    label: "Safe",
    Icon: ShieldCheck,
    surface: "bg-risk-safe-soft",
    text: "text-risk-safe",
  },
  caution: {
    label: "Caution",
    Icon: AlertTriangle,
    surface: "bg-risk-caution-soft",
    text: "text-risk-caution",
  },
  danger: {
    label: "Danger",
    Icon: ShieldX,
    surface: "bg-risk-danger-soft",
    text: "text-risk-danger",
  },
};

export function RiskBadge({
  level,
  score,
  flagCount,
}: {
  level: RiskLevel;
  score: number;
  flagCount: number;
}) {
  const c = config[level];
  const Icon = c.Icon;
  const flagText =
    flagCount === 0
      ? "No flags detected"
      : flagCount === 1
        ? "1 flag detected"
        : `${flagCount} flags detected`;
  return (
    <div
      role="status"
      aria-label={`${c.label}. Score ${score} of 100. ${flagText}.`}
      className={`inline-flex items-center gap-4 rounded-lg border border-border-strong px-5 py-4 ${c.surface}`}
    >
      <Icon className={`h-7 w-7 ${c.text}`} strokeWidth={1.5} aria-hidden />
      <div>
        <div className={`text-[20px] font-semibold leading-none ${c.text}`}>
          {c.label}
        </div>
        <div className="mt-1.5 text-[12px] text-text-secondary">
          <span className="font-mono">{score} / 100</span>
          <span className="mx-1.5 text-text-muted">·</span>
          <span>{flagText}</span>
        </div>
      </div>
    </div>
  );
}
