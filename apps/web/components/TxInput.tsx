"use client";

import { useId } from "react";
import { Search } from "lucide-react";

export interface TxInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  mode: "fast" | "full";
  onModeChange: (m: "fast" | "full") => void;
  disabled?: boolean;
}

export function TxInput({
  value,
  onChange,
  onSubmit,
  mode,
  onModeChange,
  disabled,
}: TxInputProps) {
  const inputId = useId();
  const helpId = useId();

  return (
    <div className="panel p-5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium text-text-primary"
      >
        Paste a base64-serialized Solana transaction
      </label>
      <p
        id={helpId}
        className="mt-1 text-[12px] leading-[1.5] text-text-muted"
      >
        Anything copied from a wallet's signing prompt, or built with{" "}
        <code className="font-mono text-[11px] text-text-secondary">
          tx.serialize().toString(&quot;base64&quot;)
        </code>
        .
      </p>
      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={helpId}
        disabled={disabled}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        rows={6}
        placeholder="AQABA..."
        className="mt-3 block w-full resize-y rounded-md border border-border bg-surface-2 p-3 font-mono text-[12px] leading-[1.55] text-text-primary placeholder:text-text-muted disabled:opacity-50"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <fieldset className="inline-flex items-center gap-1 rounded-sm bg-surface-2 p-1">
          <legend className="sr-only">Analysis mode</legend>
          <ModeButton
            active={mode === "fast"}
            onClick={() => onModeChange("fast")}
            label="Fast"
            sub="Rules only"
          />
          <ModeButton
            active={mode === "full"}
            onClick={() => onModeChange("full")}
            label="Full"
            sub="Rules + AI"
          />
        </fieldset>
        <button
          onClick={onSubmit}
          disabled={disabled || value.trim().length === 0}
          className="btn btn-primary"
        >
          <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
          Analyze
        </button>
      </div>
    </div>
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
        active ? "bg-surface-3 text-text-primary" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      <span className="text-[12px] font-medium leading-none">{label}</span>
      <span className="mt-1 text-[10px] leading-none text-text-muted">
        {sub}
      </span>
    </button>
  );
}
