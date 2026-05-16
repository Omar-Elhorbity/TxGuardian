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

/**
 * Solana signature: 64-byte base58 string, 87–88 chars long (varies with
 * leading-zero handling). Used here only for the inline input hint badge —
 * the server does the authoritative check.
 */
const SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

function detectInputKind(value: string): "signature" | "base64" | "empty" {
  const v = value.trim();
  if (v.length === 0) return "empty";
  if (SIGNATURE_REGEX.test(v)) return "signature";
  return "base64";
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
  const kind = detectInputKind(value);

  return (
    <div className="panel p-5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium text-text-primary"
      >
        Paste a transaction signature or base64 transaction
      </label>
      <p
        id={helpId}
        className="mt-1 text-[12px] leading-[1.5] text-text-muted"
      >
        Drop any signature copied from{" "}
        <span className="text-text-secondary">Solana Explorer</span> (88-char
        base58), or paste a base64-serialized transaction. The engine handles
        both.
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
        rows={5}
        placeholder="5VERv8N…  ·or·  AQABA…"
        className="mt-3 block w-full resize-y rounded-md border border-border bg-surface-2 p-3 font-mono text-[12px] leading-[1.55] text-text-primary placeholder:text-text-muted disabled:opacity-50"
      />

      {kind !== "empty" && (
        <p className="mt-2 text-[11px] text-text-muted">
          Detected:{" "}
          <span className="font-mono text-text-secondary">
            {kind === "signature"
              ? "transaction signature — will fetch from RPC"
              : "base64 transaction — will analyze directly"}
          </span>
        </p>
      )}

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
