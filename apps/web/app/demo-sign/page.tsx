"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import Link from "next/link";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from "lucide-react";

/**
 * Minimal extension-test page.
 *
 * Builds a real Solana transaction (zero-lamport self-transfer) and calls
 * wallet.signTransaction. That call goes through wallet-standard's
 * solana:signTransaction feature — exactly the path the TxGuardian browser
 * extension patches. If the extension is loaded on this page, the verdict
 * modal should appear before Phantom's signing prompt.
 *
 * The transaction is never broadcast. We just exercise the signing flow.
 */
export default function DemoSignPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected, connecting } = useWallet();

  type State =
    | { kind: "idle" }
    | { kind: "building" }
    | { kind: "signing" }
    | { kind: "signed"; signatureCount: number; firstSig: string }
    | { kind: "rejected" }
    | { kind: "error"; message: string };

  const [state, setState] = useState<State>({ kind: "idle" });

  const onSign = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      setState({ kind: "error", message: "Wallet is not connected." });
      return;
    }
    setState({ kind: "building" });
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: publicKey,
            lamports: 0,
          }),
        ],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);

      setState({ kind: "signing" });
      const signed = await signTransaction(tx);

      const sigs = signed.signatures.filter(
        (s) => !s.every((b) => b === 0),
      );
      const firstSig = sigs[0]
        ? Buffer.from(sigs[0]).toString("hex").slice(0, 16) + "…"
        : "(none)";
      setState({
        kind: "signed",
        signatureCount: sigs.length,
        firstSig,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /reject|cancel|denied/i.test(msg) ||
        (err as { code?: number })?.code === 4001
      ) {
        setState({ kind: "rejected" });
      } else {
        setState({ kind: "error", message: msg });
      }
    }
  }, [publicKey, signTransaction, connection]);

  const buttonDisabled =
    !connected || connecting || state.kind === "building" || state.kind === "signing";

  return (
    <div className="mx-auto max-w-[640px] px-6 py-16">
      <header>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-[12px] text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Extension test surface
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight md:text-[32px]">
          Sign a test transaction
        </h1>
        <p className="mt-3 text-[14px] leading-[1.65] text-text-secondary">
          Verifies the{" "}
          <Link
            href="/extension"
            className="text-accent hover:text-accent-hover"
          >
            installed extension
          </Link>{" "}
          is intercepting signing requests on this page. Builds a real Solana
          zero-lamport self-transfer and calls{" "}
          <code className="font-mono text-[12px] text-text-primary">
            wallet.signTransaction
          </code>{" "}
          — the same path the extension patches. The transaction is signed
          locally and{" "}
          <strong className="text-text-primary">never broadcast</strong>.
        </p>
        <p className="mt-3 rounded-md border border-border bg-surface-1 px-3 py-2 text-[12px] leading-[1.55] text-text-muted">
          <strong className="text-text-secondary">Not what you want?</strong>{" "}
          To try the engine on any transaction (no install needed), use the{" "}
          <Link
            href="/scan"
            className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
          >
            <FlaskConical
              className="h-3 w-3"
              strokeWidth={2}
              aria-hidden
            />
            engine demo
          </Link>
          .
        </p>
      </header>

      <section className="mt-8 panel-strong p-6">
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
          Wallet
        </div>
        <div className="mt-1 font-mono text-[12px] text-text-primary">
          {publicKey ? publicKey.toBase58() : "Not connected"}
        </div>

        <button
          onClick={onSign}
          disabled={buttonDisabled}
          className="btn btn-primary mt-5 w-full justify-center text-[14px]"
        >
          {state.kind === "building" || state.kind === "signing" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {state.kind === "building"
                ? "Building transaction…"
                : "Awaiting signature…"}
            </>
          ) : (
            <>
              Sign test transaction
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </>
          )}
        </button>

        {!connected && (
          <p className="mt-3 text-center text-[12px] text-text-muted">
            Connect your wallet via the button in the top nav.
          </p>
        )}

        {/* Result states */}
        {state.kind === "signed" && (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-risk-safe/30 bg-risk-safe-soft p-4 text-[13px] text-risk-safe">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <div className="font-medium">Signed successfully</div>
              <p className="mt-1 leading-[1.55] opacity-90">
                {state.signatureCount} signature(s) attached. First (truncated):{" "}
                <code className="font-mono text-[11px]">{state.firstSig}</code>.
                Not broadcast — this was a signing-flow test only.
              </p>
            </div>
          </div>
        )}

        {state.kind === "rejected" && (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-risk-caution/30 bg-risk-caution-soft p-4 text-[13px] text-risk-caution">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <div className="font-medium">Rejected</div>
              <p className="mt-1 leading-[1.55] opacity-90">
                Signing was cancelled — either by you in Phantom or by
                TxGuardian's modal. Both paths produce the same{" "}
                <code className="font-mono text-[11px]">code: 4001</code>{" "}
                error to the dApp.
              </p>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="mt-5 flex items-start gap-3 rounded-md border border-risk-danger/30 bg-risk-danger-soft p-4 text-[13px] text-risk-danger">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <div className="font-medium">Failed</div>
              <p className="mt-1 leading-[1.55] opacity-90">{state.message}</p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 panel p-5 text-[13px] leading-[1.65] text-text-secondary">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          What to expect
        </div>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>
            Click <strong className="text-text-primary">Sign test transaction</strong>
          </li>
          <li>
            Page builds a real, zero-lamport self-transfer with a fresh
            blockhash
          </li>
          <li>
            <code className="font-mono text-[11px]">wallet.signTransaction</code> is
            called via wallet-adapter
          </li>
          <li>
            <strong className="text-text-primary">If TxGuardian extension is loaded:</strong>{" "}
            modal appears with the verdict (Safe — clean self-transfer, no
            flags)
          </li>
          <li>
            After approve, Phantom's signing prompt opens for final
            confirmation
          </li>
          <li>
            Result panel above shows signature count, then you're done. Nothing
            was sent on-chain.
          </li>
        </ol>
        <p className="mt-3 text-[12px] text-text-muted">
          If the modal doesn't appear and Phantom prompts you directly, the
          extension isn't intercepting on this page. Check the DevTools console
          for{" "}
          <code className="font-mono text-[11px]">[TxGuardian]</code> logs and
          <code className="font-mono text-[11px]">window.__TXG_LOADED__</code>.
        </p>
      </section>
    </div>
  );
}
