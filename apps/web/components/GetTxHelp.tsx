"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Check, ExternalLink } from "lucide-react";

/**
 * Expandable "Where do I get a transaction?" helper that lives below the
 * scan input. Documents the four practical paths a user has today plus
 * generates the bookmarklet bound to the current origin.
 */
export function GetTxHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bind the bookmarklet to whatever origin the page is served from. That way
  // the same bookmarklet works on dev (localhost), preview deploys, and prod.
  const bookmarklet = useMemo(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    // Single-line javascript: URI. Keep escaped quotes for safe drag-to-bar.
    return `javascript:(function(){const TXG=${JSON.stringify(origin)};if(!window.phantom||!window.phantom.solana){alert('Phantom not detected on this page.');return;}const sol=window.phantom.solana;if(sol.__txgPatched){alert('TxGuardian interceptor already active. Trigger the dApp transaction now.');return;}sol.__txgPatched=true;function b64(b){let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}function ser(t){let bytes;try{bytes=t.serialize();}catch(e){bytes=t.serialize({requireAllSignatures:false,verifySignatures:false});}if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);return b64(bytes);}function patch(orig){return async function(arg){const arr=Array.isArray(arg)?arg:[arg];for(const tx of arr){try{const e=ser(tx);window.open(TXG+'/scan?tx='+encodeURIComponent(e),'_blank');}catch(e){console.error('TxGuardian:',e);}}throw new Error('TxGuardian: review on the new tab. Reload this page to disable the interceptor and sign normally.');};}sol.signTransaction=patch(sol.signTransaction.bind(sol));sol.signAllTransactions=patch(sol.signAllTransactions.bind(sol));alert('TxGuardian interceptor active on '+location.host+'. Trigger the dApp transaction now.');})();`;
  }, []);

  async function copyBookmarklet() {
    if (!bookmarklet) return;
    await navigator.clipboard.writeText(bookmarklet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // React 19 blocks `javascript:` URLs in `href` attributes at render time
  // as an XSS guard. Our bookmarklet is a controlled string we generate
  // ourselves (no user input), so we set the href via direct DOM after
  // mount — bypasses React's filter without disabling it globally.
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (linkRef.current && bookmarklet) {
      linkRef.current.setAttribute("href", bookmarklet);
    }
  }, [bookmarklet]);

  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-medium text-text-primary">
          Where do I get a base64 transaction to scan?
        </span>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 text-[13px] leading-[1.65] text-text-secondary">
          <p>
            Phantom doesn&apos;t expose the raw base64 of a pending signing
            request, and the Solana CLI doesn&apos;t print it for in-flight
            transactions. Four practical paths today:
          </p>

          <ol className="mt-4 space-y-5">
            <li>
              <div className="font-medium text-text-primary">
                1. Bookmarklet (recommended for any dApp)
              </div>
              <p className="mt-1">
                Drag this link to your bookmarks bar. On any dApp page with
                Phantom connected, click it before triggering a transaction.
                The next signing request will open here automatically with the
                base64 pre-loaded — Phantom&apos;s prompt is intercepted, no
                signing happens.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* Drag-to-bookmarks anchor — href set via ref after mount
                    to bypass React 19's javascript: URL filter. */}
                <a
                  ref={linkRef}
                  className="btn btn-secondary text-[12px] cursor-grab active:cursor-grabbing"
                  onClick={(e) => {
                    // Don't try to navigate if the user clicks instead of
                    // dragging — the click would fire a no-op since the
                    // bookmarklet's IIFE expects to run in a dApp page.
                    e.preventDefault();
                    alert(
                      "Drag this button to your bookmarks bar — don't click it. Or use the 'Copy source' button and paste it as a bookmark URL.",
                    );
                  }}
                  draggable
                >
                  Scan on TxGuardian
                </a>
                <button
                  type="button"
                  onClick={copyBookmarklet}
                  className="btn btn-ghost text-[12px]"
                >
                  {copied ? (
                    <>
                      <Check
                        className="h-3.5 w-3.5 text-risk-safe"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy
                        className="h-3.5 w-3.5"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      Copy source
                    </>
                  )}
                </button>
                <span className="text-[11px] text-text-muted">
                  Bound to{" "}
                  <code className="font-mono text-[11px]">
                    {typeof window !== "undefined" ? window.location.host : ""}
                  </code>
                </span>
              </div>
              <details className="mt-3 rounded-md border border-border bg-surface-2/60 p-3 text-[12px]">
                <summary className="cursor-pointer text-text-secondary">
                  Drag-to-bar not working? Add it manually.
                </summary>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-text-secondary">
                  <li>Right-click your bookmarks bar → <em>Add page…</em></li>
                  <li>
                    Name: <code className="font-mono text-[11px]">Scan on TxGuardian</code>
                  </li>
                  <li>
                    URL: click <strong>Copy source</strong> above and paste
                    here. The string starts with{" "}
                    <code className="font-mono text-[11px]">javascript:</code>.
                  </li>
                  <li>Save. Use it on any dApp page with Phantom connected.</li>
                </ol>
                <p className="mt-2 text-[11px] text-text-muted">
                  Some browsers (Brave, hardened Chrome profiles) strip the{" "}
                  <code className="font-mono text-[11px]">javascript:</code>{" "}
                  prefix when pasting into the URL field — re-type it after
                  paste if so.
                </p>
              </details>
              <p className="mt-2 text-[11px] text-text-muted">
                After reviewing, reload the dApp page to remove the
                interceptor and sign normally.
              </p>
            </li>

            <li>
              <div className="font-medium text-text-primary">
                2. Pull a confirmed transaction from RPC
              </div>
              <p className="mt-1">
                Get any signature from{" "}
                <a
                  href="https://explorer.solana.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1"
                >
                  Solana Explorer
                  <ExternalLink
                    className="h-3 w-3"
                    strokeWidth={2}
                    aria-hidden
                  />
                </a>
                , then:
              </p>
              <CodeBlock>
{`SIG="<paste signature here>"
curl -s -X POST -H 'Content-Type: application/json' \\
  -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"getTransaction\\",\\"params\\":[\\"$SIG\\",{\\"encoding\\":\\"base64\\",\\"maxSupportedTransactionVersion\\":0}]}" \\
  https://api.devnet.solana.com | jq -r '.result.transaction[0]'`}
              </CodeBlock>
            </li>

            <li>
              <div className="font-medium text-text-primary">
                3. Build one with the SDK locally
              </div>
              <p className="mt-1">
                If you&apos;ve cloned the repo, the helper script outputs
                pre-shaped samples (drainer-style, real SPL approve, complex,
                routine):
              </p>
              <CodeBlock>
{`pnpm exec tsx scripts/build-test-tx.ts approve
# Output is the base64 string — paste above`}
              </CodeBlock>
            </li>

            <li>
              <div className="font-medium text-text-primary">
                4. Connect a wallet and try a sample
              </div>
              <p className="mt-1">
                Use the wallet button in the top nav. Once connected, the
                three sample buttons below build sign-able transactions with
                your wallet as the fee payer + a fresh blockhash. End-to-end
                demo without leaving this page.
              </p>
            </li>
          </ol>

          <p className="mt-5 text-[12px] text-text-muted">
            The proper fix to all of this — the upcoming{" "}
            <strong className="text-text-secondary">browser extension</strong>{" "}
            — sits between Phantom and the dApp permanently and shows
            TxGuardian&apos;s verdict inline before each signing prompt. No
            bookmarklet, no copy-paste.
          </p>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11.5px] leading-[1.55] text-text-primary">
      {children}
    </pre>
  );
}
