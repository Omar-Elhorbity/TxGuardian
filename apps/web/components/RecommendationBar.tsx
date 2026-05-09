"use client";

import type { RiskLevel } from "@txguardian/sdk";
import { Loader2, Send, ShieldX, ExternalLink } from "lucide-react";

const tone: Record<RiskLevel, string> = {
  safe: "text-risk-safe",
  caution: "text-risk-caution",
  danger: "text-risk-danger",
};

export interface RecommendationBarProps {
  level: RiskLevel;
  recommendation: string;
  onScanAnother: () => void;
  /** Called when the user proceeds to sign + send. Resolves with the tx signature, or rejects. */
  onSignAndSend?: () => Promise<void>;
  /** True while the wallet is signing / the network is confirming. */
  sending?: boolean;
  /** Tx signature when signing succeeds. Triggers the success state. */
  signature?: string | null;
  /** True iff a wallet is currently connected. */
  walletConnected: boolean;
  /** Reason the proceed action is unavailable, if any (shown as a hint). */
  proceedDisabledReason?: string | null;
}

const EXPLORER_BASE = "https://explorer.solana.com/tx/";

export function RecommendationBar({
  level,
  recommendation,
  onScanAnother,
  onSignAndSend,
  sending = false,
  signature = null,
  walletConnected,
  proceedDisabledReason = null,
}: RecommendationBarProps) {
  // Success view — replaces the action buttons with the explorer link.
  if (signature) {
    return (
      <div
        className="sticky bottom-0 z-20 border-t border-border bg-base/95 backdrop-blur-md"
        role="region"
        aria-label="Send result"
      >
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Sent
            </div>
            <div className="mt-1 text-[14px] font-medium text-risk-safe">
              Transaction submitted
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${EXPLORER_BASE}${signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary text-[13px]"
            >
              View on Explorer
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </a>
            <button
              onClick={onScanAnother}
              className="btn btn-primary text-[13px]"
            >
              Scan another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default view — Reject + (optional) Sign & Send. Layout depends on level.
  const proceedAvailable = onSignAndSend && walletConnected && !proceedDisabledReason;
  const isDanger = level === "danger";

  return (
    <div
      className="sticky bottom-0 z-20 border-t border-border bg-base/95 backdrop-blur-md"
      role="region"
      aria-label="Recommendation"
    >
      <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Recommendation
          </div>
          <div className={`mt-1 text-[15px] font-semibold ${tone[level]}`}>
            {recommendation}
          </div>
          {!walletConnected && onSignAndSend && (
            <div className="mt-1 text-[11px] text-text-muted">
              Connect a wallet to sign this transaction.
            </div>
          )}
          {proceedDisabledReason && walletConnected && (
            <div className="mt-1 text-[11px] text-text-muted">
              {proceedDisabledReason}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onScanAnother}
            disabled={sending}
            className={`btn ${isDanger ? "btn-primary" : "btn-secondary"} text-[13px]`}
          >
            {isDanger && <ShieldX className="h-4 w-4" strokeWidth={2} aria-hidden />}
            {isDanger ? "Reject" : "Cancel"}
          </button>
          {onSignAndSend && (
            <button
              onClick={() => void onSignAndSend()}
              disabled={!proceedAvailable || sending}
              className={`btn ${isDanger ? "btn-ghost" : "btn-primary"} text-[13px]`}
              title={
                proceedDisabledReason ??
                (walletConnected ? "Sign and submit to the network" : "Connect a wallet first")
              }
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {isDanger ? "Sign anyway" : "Sign & send"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
