"use client";

import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";
import { Wallet as WalletIcon, ChevronDown, LogOut, Copy, Check } from "lucide-react";

/**
 * Custom wallet button — keeps our design system, no purple gradient.
 *
 * Disconnected: opens a small dropdown listing wallet-standard wallets
 * detected in the browser. One click selects + connects.
 *
 * Connected: shows truncated address; dropdown has Copy + Disconnect.
 */
export function WalletButton() {
  const { wallets, wallet, publicKey, connected, connecting, select, disconnect } =
    useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-away to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Wallet-standard installed wallets
  const installed = wallets.filter((w) => w.readyState === "Installed");
  const detectable = wallets.filter((w) => w.readyState === "Loadable");

  function shortAddr(addr: string): string {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }

  async function pickWallet(w: Wallet) {
    setOpen(false);
    select(w.adapter.name);
    // Connection is triggered by the WalletProvider once `wallet` is set;
    // a small await delay makes the UX feel snappier vs. waiting for the
    // useWallet effect.
    await new Promise((r) => setTimeout(r, 50));
  }

  async function copyAddress() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn btn-secondary text-[13px]"
      >
        {connected && publicKey ? (
          <>
            <span className="h-2 w-2 rounded-full bg-risk-safe" aria-hidden />
            <span className="font-mono">{shortAddr(publicKey.toBase58())}</span>
          </>
        ) : connecting ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <WalletIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span>Connect wallet</span>
          </>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[260px] overflow-hidden rounded-md border border-border-strong bg-surface-1 shadow-lg"
        >
          {connected && publicKey ? (
            <>
              <div className="border-b border-border px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  Connected
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-text-primary truncate">
                    {publicKey.toBase58()}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="btn btn-ghost p-1.5"
                    aria-label="Copy address"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-risk-safe" strokeWidth={2} aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
                {wallet && (
                  <div className="mt-2 text-[11px] text-text-muted">
                    via {wallet.adapter.name}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  void disconnect();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Disconnect
              </button>
            </>
          ) : (
            <>
              <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Pick a wallet
              </div>
              {installed.length === 0 && detectable.length === 0 ? (
                <div className="px-3 py-3 text-[12px] leading-[1.5] text-text-muted">
                  No Solana wallets detected. Install{" "}
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:text-accent-hover"
                  >
                    Phantom
                  </a>{" "}
                  or any wallet-standard wallet.
                </div>
              ) : (
                <ul>
                  {[...installed, ...detectable].map((w) => (
                    <li key={w.adapter.name}>
                      <button
                        onClick={() => void pickWallet(w)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-2"
                      >
                        <span className="flex items-center gap-2">
                          {w.adapter.icon && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={w.adapter.icon}
                              alt=""
                              className="h-4 w-4"
                              aria-hidden
                            />
                          )}
                          {w.adapter.name}
                        </span>
                        {w.readyState === "Installed" && (
                          <span className="text-[10px] text-text-muted">
                            Installed
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
