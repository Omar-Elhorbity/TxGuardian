const w="TXG";function j(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}function M(e){return typeof e=="object"&&e!==null&&e.ns===w}console.log("[TxGuardian] page-context injection active");window.__TXG_LOADED__=!0;function k(e,n,i=1e4){const t=Date.now(),a=()=>{const s=e();if(s!==void 0){n(s);return}Date.now()-t>i||setTimeout(a,100)};a()}function u(){const e=new Error("User rejected the request via TxGuardian.");return e.code=4001,e}function T(e,n){if(!e.__txgPatched){if(e.__txgPatched=!0,console.log(`[TxGuardian] patching ${n}`),typeof e.signTransaction=="function"){const i=e.signTransaction.bind(e);e.signTransaction=async t=>{if(console.log("[TxGuardian] intercepted signTransaction"),await f([t])==="reject")throw u();return i(t)}}if(typeof e.signAllTransactions=="function"){const i=e.signAllTransactions.bind(e);e.signAllTransactions=async t=>{if(console.log("[TxGuardian] intercepted signAllTransactions"),await f(t)==="reject")throw u();return i(t)}}if(typeof e.signAndSendTransaction=="function"){const i=e.signAndSendTransaction.bind(e);e.signAndSendTransaction=async(t,a)=>{if(console.log("[TxGuardian] intercepted signAndSendTransaction"),await f([t])==="reject")throw u();return i(t,a)}}}}k(()=>window.phantom?.solana,e=>T(e,"window.phantom.solana"));k(()=>window.solana,e=>T(e,"window.solana"));function _(e){if(e.__txgPatched||!e.features)return;e.__txgPatched=!0,console.log("[TxGuardian] patching wallet (Wallet Standard):",Object.keys(e.features));const n=e.features["solana:signTransaction"];if(n?.signTransaction){const t=n.signTransaction.bind(n);n.signTransaction=async(...a)=>{const l=(a[0]??[]).map(c=>c.transaction).filter(c=>c instanceof Uint8Array);if(await f(l)==="reject")throw u();return t(...a)}}const i=e.features["solana:signAndSendTransaction"];if(i?.signAndSendTransaction){const t=i.signAndSendTransaction.bind(i);i.signAndSendTransaction=async(...a)=>{const l=(a[0]??[]).map(c=>c.transaction).filter(c=>c instanceof Uint8Array);if(await f(l)==="reject")throw u();return t(...a)}}}const $={register(e){return _(e),()=>{}}};window.addEventListener("wallet-standard:register-wallet",e=>{console.log("[TxGuardian] wallet-standard:register-wallet event");const{detail:n}=e;typeof n=="function"&&n($)},!1);window.dispatchEvent(new CustomEvent("wallet-standard:app-ready",{detail:$}));console.log("[TxGuardian] dispatched wallet-standard:app-ready");async function f(e){if(e.length===0)return"approve";for(const n of e){const i=await I(n);if(!i){console.warn("[TxGuardian] could not serialize a tx; allowing through");continue}const t=G({kind:"loading",origin:window.location.host}),a=await D(i);if(a.ok?t.update({kind:"verdict",origin:window.location.host,verdict:a.result}):t.update({kind:"unavailable",origin:window.location.host,reason:a.error}),await t.awaitDecision()==="reject")return"reject"}return"approve"}async function I(e){try{if(e instanceof Uint8Array)return v(e);const n=e;if(typeof n.serialize!="function")return null;let i;try{i=n.serialize()}catch{i=n.serialize({requireAllSignatures:!1,verifySignatures:!1})}return i instanceof Uint8Array||(i=new Uint8Array(i)),v(i)}catch(n){return console.warn("[TxGuardian] serialize failed",n),null}}function v(e){let n="";for(let i=0;i<e.length;i++)n+=String.fromCharCode(e[i]);return btoa(n)}function D(e){return new Promise(n=>{const i=j(),t=setTimeout(()=>{window.removeEventListener("message",a),n({ok:!1,error:"Engine timed out after 15s"})},15e3);function a(l){if(l.source!==window||!M(l.data))return;const p=l.data;p.type!=="ANALYZE_RESPONSE"||p.id!==i||(clearTimeout(t),window.removeEventListener("message",a),p.ok&&p.result?n({ok:!0,result:p.result}):n({ok:!1,error:p.error??"Unknown engine error"}))}window.addEventListener("message",a);const s={type:"ANALYZE_REQUEST",ns:w,id:i,base64:e,origin:window.location.origin};window.postMessage(s,window.location.origin)})}const y="txguardian-modal-host";function G(e){document.getElementById(y)?.remove();const n=document.createElement("div");n.id=y,n.style.cssText="all: initial; position: fixed; inset: 0; z-index: 2147483647;",document.documentElement.appendChild(n);const i=n.attachShadow({mode:"open"}),t=document.createElement("style");t.textContent=K,i.appendChild(t);const a=document.createElement("div");a.className="scrim",i.appendChild(a);const s=document.createElement("div");s.className="card-slot",a.appendChild(s);let l=null;const p=new Promise(r=>{l=r});function c(r){if(!l)return;const g=l;l=null,document.removeEventListener("keydown",b),a.classList.add("closing"),setTimeout(()=>{n.remove(),g(r)},140)}function b(r){if(r.key==="Escape"){r.preventDefault(),r.stopPropagation(),c("reject");return}if(r.key==="Enter"){const g=i.querySelector("[data-action='primary']");g&&!g.disabled&&(r.preventDefault(),r.stopPropagation(),g.click())}}document.addEventListener("keydown",b);function m(){i.querySelector("[data-action='approve']")?.addEventListener("click",()=>c("approve")),i.querySelector("[data-action='reject']")?.addEventListener("click",()=>c("reject")),i.querySelector("[data-action='close']")?.addEventListener("click",()=>c("reject")),(i.querySelector("[data-action='reject']")??i.querySelector("[data-action='close']"))?.focus()}function x(r){s.innerHTML=F(r),m()}return x(e),{update:x,awaitDecision:()=>p}}function o(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function P(e){return`sev sev-${e}`}function N(e){return e==="safe"?"Safe":e==="caution"?"Caution":"Danger"}const A='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',S='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',H='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/></svg>',O='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',R='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',B='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',q='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>';function U(e){return e==="safe"?A:e==="caution"?S:H}function F(e){switch(e.kind){case"loading":return Y(e.origin);case"verdict":return X(e.origin,e.verdict);case"unavailable":return V(e.origin,e.reason)}}function C(){return`<div class="engine-badge engine-badge-local" title="This transaction was analyzed by the extension's bundled engine in your browser. TxGuardian's server was not contacted.">
    <span class="engine-badge-icon">${q}</span>
    <span>We didn&apos;t see this transaction</span>
  </div>`}function h(e){return`
    <header>
      <div class="brand">
        <span class="dot"></span>
        <span class="brand-name">TxGuardian</span>
      </div>
      <div class="origin-chip" title="${o(e)}">${o(e)}</div>
      <button class="close" data-action="close" aria-label="Close">×</button>
    </header>`}function Y(e){return`
    <div class="card loading-card" role="dialog" aria-modal="true" aria-busy="true" aria-label="Analyzing transaction">
      ${h(e)}
      <div class="loading-body">
        <div class="loading-icon">${O}</div>
        <div class="loading-title">Analyzing transaction…</div>
        <div class="loading-subtitle">
          Running the rule engine, checking the on-chain registry, and translating to plain English.
        </div>
        <div class="progress">
          <div class="progress-bar"></div>
        </div>
      </div>
    </div>
  `}function V(e,n){const i=n?`<p class="explanation" style="margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; opacity: 0.7;">
         ${o(n)}
       </p>`:"";return`
    <div class="card" role="dialog" aria-modal="true">
      ${h(e)}
      ${C()}
      <div class="verdict level-caution">
        <div class="verdict-icon">${S}</div>
        <div class="verdict-text">
          <div class="verdict-label">Engine couldn't complete the check</div>
          <div class="verdict-meta">
            <span>The rules ran but the on-chain registry lookup or the simulation failed — usually a Solana RPC problem (timeout, rate limit, or wrong cluster).</span>
          </div>
        </div>
      </div>
      <div class="body">
        <p class="explanation">
          The wallet's own confirmation will still appear next. Proceed only if you trust this dApp and the transaction it's asking you to sign.
        </p>
        ${i}
        <p class="explanation" style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
          Tip: open the TxGuardian icon in your toolbar and check the RPC. The default devnet RPC is rate-limited; for heavy use, point at Helius / QuickNode / Triton / Alchemy.
        </p>
      </div>
      <footer>
        <button class="btn primary" data-action="reject" data-action-also="primary">Reject</button>
        <button class="btn ghost" data-action="approve">Continue anyway</button>
      </footer>
    </div>
  `}function X(e,n){const i=n.riskLevel==="danger",t=n.riskLevel==="safe",a=i?"Sign anyway":"Approve & sign",s=i?"Reject":"Cancel",l=i?"btn ghost":"btn primary",p=i?"btn primary":"btn secondary",c=i?"":"data-action-also='primary'",b=i?"data-action-also='primary'":"",m=n.explanation?`<div class="ai-badge" title="The explanation above was generated by Google Gemini using the API key you supplied in the extension popup. The verdict itself is computed deterministically and is independent of this prose.">
        <span class="ai-badge-icon">${B}</span>
        AI explanation · Google Gemini · your key
      </div>`:"",x=n.explanation?`<section class="block">
        <div class="block-label">Plain-English summary</div>
        <p class="explanation">${o(n.explanation)}</p>
        ${m}
      </section>`:"",r=n.whatThisDoes.length===0?"":`<section class="block">
          <div class="block-label">What this transaction does</div>
          <ul class="bullets">
            ${n.whatThisDoes.map(d=>`<li>${o(d)}</li>`).join("")}
          </ul>
        </section>`,g=n.flags.length===0?"":`<section class="block">
          <div class="block-label">Flags · ${n.flags.length}</div>
          <div class="flags">
            ${n.flags.map(d=>{const z=d.evidence?`<details class="evidence">
                      <summary>Show evidence</summary>
                      <pre>${o(JSON.stringify(d.evidence,null,2))}</pre>
                    </details>`:"";return`
                  <article class="flag flag-${o(d.severity)}">
                    <div class="flag-head">
                      <span class="${o(P(d.severity))}">${o(d.severity)}</span>
                      <strong>${o(d.label)}</strong>
                    </div>
                    <p>${o(d.description)}</p>
                    ${z}
                  </article>`}).join("")}
          </div>
        </section>`,E=n.decodedInstructions.length===0?"":`<details class="ix-panel">
          <summary>
            <span class="block-label">Decoded instructions · ${n.decodedInstructions.length}</span>
            <span class="ix-chevron">${R}</span>
          </summary>
          <ol class="ix-list">
            ${n.decodedInstructions.map(d=>`
                <li>
                  <div class="ix-summary">${o(d.summary)}</div>
                  <div class="ix-meta">${o(d.programName)} · ${o(W(d.programId))}</div>
                </li>`).join("")}
          </ol>
        </details>`,L=t&&n.flags.length===0?`<div class="affirmation">
        <span class="affirmation-icon">${A}</span>
        <span>No risks detected. The transaction matches routine patterns and the wallet's own confirmation will follow.</span>
      </div>`:"";return`
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-verdict-label">
      ${h(e)}
      ${C()}

      <div class="verdict level-${o(n.riskLevel)}">
        <div class="verdict-icon">${U(n.riskLevel)}</div>
        <div class="verdict-text">
          <div id="txg-verdict-label" class="verdict-label">${o(N(n.riskLevel))}</div>
          <div class="verdict-meta">
            <span class="score">${n.score} <span class="score-dim">/ 100</span></span>
            <span class="dotsep">·</span>
            <span>${n.flags.length} flag${n.flags.length===1?"":"s"}</span>
          </div>
          <div class="recommendation">${o(n.recommendation)}</div>
        </div>
      </div>

      <div class="body">
        ${L}
        ${x}
        ${r}
        ${g}
        ${E}
      </div>

      <footer>
        <button class="${p}" data-action="reject" ${b}>${s}</button>
        <button class="${l}" data-action="approve" ${c}>${a}</button>
      </footer>
    </div>
  `}function W(e){return e.length<=12?e:`${e.slice(0,4)}…${e.slice(-4)}`}const K=`
:host { all: initial; }
* { box-sizing: border-box; }

.scrim {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 19, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: scrim-in 160ms ease-out;
}

.scrim.closing {
  animation: scrim-out 140ms ease-in forwards;
}

@keyframes scrim-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scrim-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

.card-slot {
  width: 100%;
  max-width: 520px;
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #171c1f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #eef2f3;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.02);
  animation: card-in 220ms cubic-bezier(0.2, 0, 0, 1);
}

.scrim.closing .card {
  animation: card-out 140ms ease-in forwards;
}

@keyframes card-in {
  from { transform: translateY(16px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}
@keyframes card-out {
  from { transform: translateY(0)    scale(1);    opacity: 1; }
  to   { transform: translateY(8px)  scale(0.98); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .scrim, .scrim.closing, .card, .scrim.closing .card { animation: none; }
}

/* ----- Header -------------------------------------------------------------- */
header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
.brand .dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #3e8f96;
  box-shadow: 0 0 0 3px rgba(62, 143, 150, 0.18);
}
.brand-name {
  color: #eef2f3;
}

.origin-chip {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #a7b0b5;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.close {
  background: transparent;
  border: 0;
  color: #a7b0b5;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}
.close:hover { color: #eef2f3; background: rgba(255, 255, 255, 0.06); }

/* ----- Verdict block ------------------------------------------------------- */
.verdict {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.verdict-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.verdict-icon svg {
  width: 22px;
  height: 22px;
}

.verdict-text { min-width: 0; flex: 1; }

.verdict-label {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.verdict-meta {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #a7b0b5;
}
.verdict-meta .dotsep { color: #7f8a90; }
.verdict-meta .score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #eef2f3;
}
.verdict-meta .score-dim {
  font-weight: 400;
  color: #7f8a90;
  margin-left: 1px;
}

.recommendation {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 500;
}

.level-safe    .verdict-label,
.level-safe    .recommendation,
.level-safe    .verdict-icon { color: #4d8f66; }
.level-safe    .verdict-icon { background: rgba(77, 143, 102, 0.16); }
.level-safe                  { background: linear-gradient(180deg, rgba(77,143,102,0.10), rgba(77,143,102,0.02)); }

.level-caution .verdict-label,
.level-caution .recommendation,
.level-caution .verdict-icon { color: #d0a34b; }
.level-caution .verdict-icon { background: rgba(208, 163, 75, 0.18); }
.level-caution               { background: linear-gradient(180deg, rgba(208,163,75,0.10), rgba(208,163,75,0.02)); }

.level-danger  .verdict-label,
.level-danger  .recommendation,
.level-danger  .verdict-icon { color: #c35b63; }
.level-danger  .verdict-icon { background: rgba(195, 91, 99, 0.18); }
.level-danger                { background: linear-gradient(180deg, rgba(195,91,99,0.12), rgba(195,91,99,0.02)); }

/* ----- Body --------------------------------------------------------------- */
.body { padding: 16px 20px; }
.body > * + * { margin-top: 18px; }

.affirmation {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(77, 143, 102, 0.10);
  border: 1px solid rgba(77, 143, 102, 0.22);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: #c8d8cf;
}
.affirmation-icon {
  flex-shrink: 0;
  color: #4d8f66;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
}
.affirmation-icon svg { width: 18px; height: 18px; }

/* ─── Engine provenance badge (rendered above the verdict block) ─── */
.engine-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  /* Symmetric vertical margin so the badge breathes between the header
     and the verdict block — was missing a bottom margin in v1. */
  margin: 12px 20px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1px solid;
  width: fit-content;
}
.engine-badge-icon {
  width: 12px;
  height: 12px;
  display: grid;
  place-items: center;
}
.engine-badge-icon svg { width: 12px; height: 12px; }
.engine-badge-local {
  color: #d6c79b;
  background: rgba(214, 199, 155, 0.08);
  border-color: rgba(214, 199, 155, 0.25);
}

/* ─── AI provenance badge (under the LLM-generated explanation) ─── */
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #a8adb8;
  background: rgba(168, 173, 184, 0.06);
  border: 1px solid rgba(168, 173, 184, 0.16);
  width: fit-content;
}
.ai-badge-icon {
  width: 11px;
  height: 11px;
  display: grid;
  place-items: center;
  color: #d6c79b;
}
.ai-badge-icon svg { width: 11px; height: 11px; }

.block-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #7f8a90;
  margin-bottom: 8px;
  font-weight: 500;
}

.explanation {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
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
.bullets li + li { margin-top: 4px; }
.bullets li::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #4a5358;
}

/* ----- Flags -------------------------------------------------------------- */
.flags { display: flex; flex-direction: column; gap: 8px; }
.flag {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1d2327;
  border-radius: 10px;
  padding: 11px 12px;
  position: relative;
  transition: border-color 120ms;
}
.flag:hover { border-color: rgba(255, 255, 255, 0.14); }

.flag-high   { border-left: 3px solid #c35b63; padding-left: 13px; }
.flag-medium { border-left: 3px solid #d0a34b; padding-left: 13px; }
.flag-low    { border-left: 3px solid #5a8fcb; padding-left: 13px; }

.flag-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}
.flag p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: #a7b0b5;
}

.sev {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 7px;
  line-height: 1;
}
.sev-low    { background: rgba(90, 143, 203, 0.16); color: #6ea0d6; }
.sev-medium { background: rgba(208, 163, 75, 0.18); color: #dfb55c; }
.sev-high   { background: rgba(195, 91, 99, 0.18); color: #d97580; }

.evidence {
  margin-top: 8px;
  font-size: 11.5px;
}
.evidence summary {
  cursor: pointer;
  color: #7f8a90;
  user-select: none;
  padding: 2px 0;
}
.evidence summary:hover { color: #a7b0b5; }
.evidence pre {
  margin: 6px 0 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: #a7b0b5;
  overflow-x: auto;
  white-space: pre;
}

/* ----- Decoded instructions panel ----------------------------------------- */
.ix-panel {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
}
.ix-panel summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.ix-panel summary::-webkit-details-marker { display: none; }
.ix-panel summary .block-label { margin: 0; }
.ix-chevron {
  width: 14px;
  height: 14px;
  color: #7f8a90;
  transition: transform 160ms ease;
  display: grid;
  place-items: center;
}
.ix-chevron svg { width: 14px; height: 14px; }
.ix-panel[open] .ix-chevron { transform: rotate(180deg); }

.ix-list {
  list-style: none;
  margin: 0;
  padding: 0 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ix-list li {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
  font-size: 13px;
}
.ix-list li:first-child { border-top: 0; padding-top: 4px; }
.ix-summary { color: #eef2f3; line-height: 1.45; }
.ix-meta {
  margin-top: 2px;
  font-size: 11px;
  color: #7f8a90;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* ----- Footer + buttons --------------------------------------------------- */
footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.15);
  position: sticky;
  bottom: 0;
}

.btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 16px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 120ms, color 120ms, border-color 120ms, transform 120ms;
}
.btn:active { transform: translateY(1px); }
.btn.primary { background: #3e8f96; color: #0a1416; font-weight: 600; }
.btn.primary:hover { background: #4fa3aa; }
.btn.secondary { background: #1d2327; color: #eef2f3; border-color: rgba(255, 255, 255, 0.08); }
.btn.secondary:hover { background: #232a2f; }
.btn.ghost { background: transparent; color: #7f8a90; }
.btn.ghost:hover { background: #1d2327; color: #a7b0b5; }

button:focus-visible {
  outline: 2px solid #3e8f96;
  outline-offset: 2px;
}

/* ----- Loading state ------------------------------------------------------ */
.loading-card { min-height: 200px; }
.loading-body {
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}
.loading-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  color: #3e8f96;
  background: rgba(62, 143, 150, 0.14);
  border-radius: 10px;
  margin-bottom: 6px;
  animation: pulse 1.4s ease-in-out infinite;
}
.loading-icon svg { width: 22px; height: 22px; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.loading-title {
  font-size: 15px;
  font-weight: 600;
  color: #eef2f3;
}
.loading-subtitle {
  font-size: 12.5px;
  color: #a7b0b5;
  line-height: 1.55;
  max-width: 360px;
}
.progress {
  margin-top: 14px;
  width: 200px;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
}
.progress-bar {
  position: absolute;
  inset: 0;
  width: 40%;
  background: #3e8f96;
  border-radius: 999px;
  animation: indeterminate 1.4s ease-in-out infinite;
}
@keyframes indeterminate {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* ----- Card scrollbar (subtle) ------------------------------------------- */
.card::-webkit-scrollbar { width: 8px; }
.card::-webkit-scrollbar-track { background: transparent; }
.card::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}
.card::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.14); }
`;
//# sourceMappingURL=page.js.map
