"use client";

import { ShieldCheck, AlertTriangle, ShieldX } from "lucide-react";

export interface SampleTxPickerProps {
  onPick: (type: "safe" | "caution" | "danger") => void;
  disabled?: boolean;
}

const samples = [
  {
    id: "safe" as const,
    label: "Safe sample",
    sub: "Routine SOL transfer",
    Icon: ShieldCheck,
    tone: "text-risk-safe",
  },
  {
    id: "caution" as const,
    label: "Caution sample",
    sub: "Unverified program call",
    Icon: AlertTriangle,
    tone: "text-risk-caution",
  },
  {
    id: "danger" as const,
    label: "Danger sample",
    sub: "Unlimited token approval",
    Icon: ShieldX,
    tone: "text-risk-danger",
  },
];

export function SampleTxPicker({ onPick, disabled }: SampleTxPickerProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
        Try a sample
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {samples.map((s) => {
          const Icon = s.Icon;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              disabled={disabled}
              className="panel flex items-center gap-3 p-3 text-left transition-colors hover:border-border-strong disabled:opacity-50"
            >
              <Icon className={`h-4 w-4 shrink-0 ${s.tone}`} strokeWidth={1.75} aria-hidden />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text-primary">
                  {s.label}
                </div>
                <div className="text-[11px] text-text-muted">{s.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
