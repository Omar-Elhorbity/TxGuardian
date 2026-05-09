/**
 * In-page verdict modal. Rendered in a Shadow DOM root so the dApp's
 * styles can't bleed in (and vice versa). No React — keeps the bundle
 * small and avoids clashing with the dApp's React.
 *
 * Returns a Promise that resolves to "approve" | "reject" when the user
 * clicks. The patched signing function awaits this Promise — the dApp's
 * await on signTransaction is held by the JS event loop until then.
 */

import type { TxRiskResultLike } from "./types";

export type Decision = "approve" | "reject";

export type ModalInput =
  | { kind: "verdict"; origin: string; verdict: TxRiskResultLike }
  | { kind: "unavailable"; origin: string };

const HOST_ID = "txguardian-modal-host";

export function showVerdictModal(input: ModalInput): Promise<Decision> {
  return new Promise((resolve) => {
    // Remove any existing modal (paranoid — shouldn't happen since we await
    // sequentially, but safe against re-entrancy)
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    // Position at the top of the document so it's above everything.
    host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647;";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = MODAL_CSS;
    shadow.appendChild(style);

    const root = document.createElement("div");
    root.className = "scrim";
    root.innerHTML =
      input.kind === "verdict"
        ? renderVerdict(input.origin, input.verdict)
        : renderUnavailable(input.origin);
    shadow.appendChild(root);

    function close(decision: Decision): void {
      host.remove();
      resolve(decision);
    }

    shadow.querySelector<HTMLButtonElement>("[data-action='approve']")
      ?.addEventListener("click", () => close("approve"));
    shadow.querySelector<HTMLButtonElement>("[data-action='reject']")
      ?.addEventListener("click", () => close("reject"));
    shadow.querySelector<HTMLButtonElement>("[data-action='close']")
      ?.addEventListener("click", () => close("reject"));

    // Esc to reject
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        close("reject");
      }
    }
    document.addEventListener("keydown", onKey);
  });
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function severityClass(s: "low" | "medium" | "high"): string {
  return `sev sev-${s}`;
}

function levelClass(l: "safe" | "caution" | "danger"): string {
  return `level level-${l}`;
}

function levelLabel(l: "safe" | "caution" | "danger"): string {
  return l === "safe" ? "Safe" : l === "caution" ? "Caution" : "Danger";
}

function renderVerdict(origin: string, v: TxRiskResultLike): string {
  const flagsHTML = v.flags.length === 0
    ? `<div class="empty">No flags raised.</div>`
    : v.flags
        .map(
          (f) => `
          <article class="flag">
            <div class="flag-head">
              <span class="${escapeHTML(severityClass(f.severity))}">${escapeHTML(f.severity)}</span>
              <strong>${escapeHTML(f.label)}</strong>
            </div>
            <p>${escapeHTML(f.description)}</p>
          </article>`,
        )
        .join("");

  const whatHTML = v.whatThisDoes.length === 0
    ? ""
    : `<section class="block">
        <div class="block-label">What this transaction does</div>
        <ul class="bullets">
          ${v.whatThisDoes.map((s) => `<li>${escapeHTML(s)}</li>`).join("")}
        </ul>
      </section>`;

  const explanationHTML = v.explanation
    ? `<section class="block"><p class="explanation">${escapeHTML(v.explanation)}</p></section>`
    : "";

  const isDanger = v.riskLevel === "danger";
  const approveLabel = isDanger ? "Sign anyway" : "Approve & sign";
  const rejectLabel = isDanger ? "Reject" : "Cancel";
  const approveClass = isDanger ? "btn ghost" : "btn primary";
  const rejectClass = isDanger ? "btn primary" : "btn secondary";

  return `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-title">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${escapeHTML(origin)}</span>
        </div>
        <button class="close" data-action="close" aria-label="Close">×</button>
      </header>

      <div class="verdict ${escapeHTML(levelClass(v.riskLevel))}">
        <div class="verdict-label">${escapeHTML(levelLabel(v.riskLevel))}</div>
        <div class="verdict-meta">
          <span>${v.score} / 100</span>
          <span class="dotsep">·</span>
          <span>${v.flags.length} flag${v.flags.length === 1 ? "" : "s"}</span>
          <span class="dotsep">·</span>
          <span>${escapeHTML(v.recommendation)}</span>
        </div>
      </div>

      <div class="body">
        ${explanationHTML}
        ${whatHTML}
        ${
          v.flags.length > 0
            ? `<section class="block">
                <div class="block-label">Flags</div>
                <div class="flags">${flagsHTML}</div>
              </section>`
            : ""
        }
      </div>

      <footer>
        <button class="${rejectClass}" data-action="reject">${rejectLabel}</button>
        <button class="${approveClass}" data-action="approve">${approveLabel}</button>
      </footer>
    </div>
  `;
}

function renderUnavailable(origin: string): string {
  return `
    <div class="card" role="dialog" aria-modal="true">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${escapeHTML(origin)}</span>
        </div>
        <button class="close" data-action="close" aria-label="Close">×</button>
      </header>
      <div class="body">
        <div class="block-label">Analyzer unavailable</div>
        <p class="explanation">
          TxGuardian could not reach the analyzer service. The wallet's own
          confirmation will still appear next. Proceed only if you trust this
          dApp.
        </p>
      </div>
      <footer>
        <button class="btn primary" data-action="reject">Reject</button>
        <button class="btn ghost" data-action="approve">Continue anyway</button>
      </footer>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Styles — matches our /scan design system, kept inline so the modal works
// without any external assets. Tokens copied from apps/web/app/globals.css.
// ----------------------------------------------------------------------------

const MODAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.scrim {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 19, 0.78);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fade 120ms ease-out;
}

@keyframes fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.card {
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #171c1f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #eef2f3;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.brand .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #3e8f96;
}
.brand .origin {
  font-weight: 400;
  color: #7f8a90;
  font-size: 12px;
  margin-left: 4px;
}

.close {
  background: transparent;
  border: 0;
  color: #a7b0b5;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.close:hover { color: #eef2f3; background: rgba(255, 255, 255, 0.06); }

.verdict {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.verdict-label {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.verdict-meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #a7b0b5;
}
.verdict-meta .dotsep { color: #7f8a90; }

.level-safe    .verdict-label { color: #4d8f66; }
.level-safe                   { background: rgba(77, 143, 102, 0.10); }
.level-caution .verdict-label { color: #d0a34b; }
.level-caution                { background: rgba(208, 163, 75, 0.10); }
.level-danger  .verdict-label { color: #c35b63; }
.level-danger                 { background: rgba(195, 91, 99, 0.10); }

.body { padding: 16px 20px; }

.block + .block { margin-top: 18px; }
.block-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #7f8a90;
  margin-bottom: 8px;
}

.explanation {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: #eef2f3;
}

.bullets {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.55;
  color: #a7b0b5;
}
.bullets li {
  padding-left: 14px;
  position: relative;
}
.bullets li::before {
  content: "·";
  position: absolute;
  left: 4px;
  color: #7f8a90;
}

.flags { display: flex; flex-direction: column; gap: 8px; }
.flag {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1d2327;
  border-radius: 10px;
  padding: 10px 12px;
}
.flag-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.flag p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: #a7b0b5;
}

.sev {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 8px;
}
.sev-low    { background: rgba(90, 143, 203, 0.15); color: #5a8fcb; }
.sev-medium { background: rgba(208, 163, 75, 0.16); color: #d0a34b; }
.sev-high   { background: rgba(195, 91, 99, 0.16); color: #c35b63; }

.empty {
  font-size: 13px;
  color: #7f8a90;
  font-style: italic;
}

footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 120ms, color 120ms, border-color 120ms;
}
.btn.primary { background: #3e8f96; color: #0a1416; font-weight: 600; }
.btn.primary:hover { background: #4fa3aa; }
.btn.secondary { background: #1d2327; color: #eef2f3; border-color: rgba(255, 255, 255, 0.08); }
.btn.secondary:hover { background: #232a2f; }
.btn.ghost { background: transparent; color: #a7b0b5; }
.btn.ghost:hover { background: #1d2327; color: #eef2f3; }

button:focus-visible {
  outline: 2px solid #3e8f96;
  outline-offset: 2px;
}
`;
