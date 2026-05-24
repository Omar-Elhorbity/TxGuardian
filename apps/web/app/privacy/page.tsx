import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — TxGuardian",
  description:
    "What the TxGuardian browser extension and engine demo send, store, and don't.",
};

const LAST_UPDATED = "May 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[780px] px-6 py-10 md:py-14">
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight">Privacy</h1>
        <p className="mt-2 text-[12px] uppercase tracking-[0.12em] text-text-muted">
          Last updated {LAST_UPDATED}
        </p>
        <p className="mt-4 text-[15px] leading-[1.65] text-text-secondary">
          TxGuardian is a transaction-safety tool. It analyzes Solana
          transactions before you sign them. The most important sentence
          on this page is the next one.
        </p>
        <p className="mt-4 text-[15px] leading-[1.65] text-text-primary font-medium">
          By default, your transactions never leave your browser.
        </p>
        <p className="mt-3 text-[14px] leading-[1.65] text-text-secondary">
          The verdict engine ships inside the extension. When a dApp asks
          you to sign, the analysis runs in your service worker — not on
          our server. There are two optional opt-ins (hosted analyzer for
          users without a Solana RPC; AI prose explanation via your own
          Gemini key) that broaden the trust circle in different ways.
          Both are off by default. This page describes exactly what flows
          where in each configuration.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          What flows where, by mode
        </h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-[0.1em] text-text-muted">
                <th className="px-3 py-2 font-medium">Configuration</th>
                <th className="px-3 py-2 font-medium">TxGuardian server</th>
                <th className="px-3 py-2 font-medium">Your RPC provider</th>
                <th className="px-3 py-2 font-medium">Google (Gemini)</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <ModeRow
                config="Extension default (local engine, no AI)"
                txg="Never contacted"
                rpc="Sees the tx for simulation + registry lookup"
                google="Never contacted"
                primary
              />
              <ModeRow
                config="Extension + AI translator enabled (your key)"
                txg="Never contacted"
                rpc="Sees the tx (as above)"
                google="Sees decoded summaries + flags (your key used)"
              />
              <ModeRow
                config="Extension hosted fallback (opt-in)"
                txg="Sees the full transaction bytes"
                rpc="(via our server, not yours)"
                google="(via our server, our key)"
                warn
              />
              <ModeRow
                config="Web demo at /scan or /playground"
                txg="Sees the full transaction bytes"
                rpc="(via our server, not yours)"
                google="(via our server, our key)"
                warn
              />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] leading-[1.65] text-text-muted">
          Your wallet&apos;s public key (the fee payer) is part of the
          transaction payload in every mode because it has to be — it
          identifies you on-chain. We never collect it separately.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          What does NOT get sent
        </h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-[1.7] text-text-secondary">
          <li>
            <strong className="text-text-primary">No private keys.</strong>{" "}
            TxGuardian has no signing surface and no access to wallet
            internals. Signing always happens inside your wallet.
          </li>
          <li>
            <strong className="text-text-primary">No browsing history.</strong>{" "}
            The extension only activates on a signing request — it does not
            read page content, log URLs, or track navigation.
          </li>
          <li>
            <strong className="text-text-primary">
              No personally-identifying data.
            </strong>{" "}
            No name, email, or account ID is sent. Your wallet&apos;s public
            key is part of the transaction payload because it has to be — it
            identifies the fee payer on-chain — but it is not separately
            collected, stored, or correlated.
          </li>
          <li>
            <strong className="text-text-primary">No analytics or telemetry.</strong>{" "}
            No third-party trackers, no analytics SDK, no session
            replays. The analyzer endpoint logs only operational metrics
            (HTTP status, latency) on the hosting provider.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Storage
        </h2>
        <div className="mt-3 space-y-3 text-[14px] leading-[1.7] text-text-secondary">
          <p>
            The browser extension uses{" "}
            <code className="font-mono text-[12px] text-text-primary">
              chrome.storage.local
            </code>{" "}
            to remember one thing: the analyzer endpoint URL, if you have
            overridden it from the popup. Nothing else is persisted on your
            device.
          </p>
          <p>
            The analyzer endpoint applies a short-lived in-memory cache on
            verdicts (keyed by the deterministic transaction hash) to avoid
            re-running identical analyses. Cache entries are not shared,
            aggregated, or sold.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Third parties
        </h2>
        <div className="mt-3 space-y-3 text-[14px] leading-[1.7] text-text-secondary">
          <p>
            The analyzer makes outbound calls to:
          </p>
          <ul className="space-y-2">
            <li>
              A <strong className="text-text-primary">Solana RPC provider</strong>{" "}
              (Helius / QuickNode / official endpoints) to fetch account
              metadata and simulate the transaction. The transaction payload
              is sent to the RPC.
            </li>
            <li>
              <strong className="text-text-primary">Google Generative Language API</strong>{" "}
              (Gemini 2.5 Flash) for the plain-English explanation. Only
              pre-decoded instruction summaries are sent — never raw
              transaction bytes, never account labels controlled by an
              attacker. Memo content is stripped before this step.
            </li>
          </ul>
          <p>
            If you self-host the analyzer (you can — the source is public),
            you control which RPC and which LLM provider receive the
            payload. The extension popup lets you point at your own
            instance.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Permissions used by the extension
        </h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-[1.7] text-text-secondary">
          <li>
            <code className="font-mono text-[12px] text-text-primary">
              host_permissions: &lt;all_urls&gt;
            </code>{" "}
            — required because the extension must inject into every site that
            could host a Solana dApp to intercept the wallet&apos;s signing
            request. The injected script only activates when a wallet asks
            to sign; it does not read or modify page content otherwise.
          </li>
          <li>
            <code className="font-mono text-[12px] text-text-primary">
              storage
            </code>{" "}
            — used to persist the user-configured analyzer endpoint. No
            other data is stored.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Open source
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-text-secondary">
          Every line of TxGuardian — extension, web demo, SDK, on-chain
          program — is open source under the MIT license. The privacy claims
          on this page are auditable. Source at{" "}
          <a
            href="https://github.com/Omar-Elhorbity/TxGuardian"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-accent-hover"
          >
            github.com/Omar-Elhorbity/TxGuardian
          </a>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-text-muted">
          Contact
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-text-secondary">
          Privacy questions or security reports: open a private security
          advisory on the GitHub repo, or email{" "}
          <a
            href="mailto:omarhusseinelhorbity@gmail.com"
            className="text-accent hover:text-accent-hover"
          >
            omarhusseinelhorbity@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="mt-12 border-t border-border pt-6">
        <Link
          href="/extension"
          className="text-[13px] text-accent hover:text-accent-hover"
        >
          ← Back to extension install guide
        </Link>
      </section>
    </div>
  );
}

function ModeRow({
  config,
  txg,
  rpc,
  google,
  primary,
  warn,
}: {
  config: string;
  txg: string;
  rpc: string;
  google: string;
  primary?: boolean;
  warn?: boolean;
}) {
  const tone = primary
    ? "text-risk-safe"
    : warn
      ? "text-risk-caution"
      : "text-text-secondary";
  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2.5 text-text-primary">{config}</td>
      <td className={`px-3 py-2.5 ${tone}`}>{txg}</td>
      <td className="px-3 py-2.5">{rpc}</td>
      <td className="px-3 py-2.5">{google}</td>
    </tr>
  );
}
