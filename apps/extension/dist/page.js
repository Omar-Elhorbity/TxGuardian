const w="TXG";function j(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}function z(e){return typeof e=="object"&&e!==null&&e.ns===w}console.log("[TxGuardian] page-context injection active");window.__TXG_LOADED__=!0;function k(e,n,i=1e4){const a=Date.now(),t=()=>{const s=e();if(s!==void 0){n(s);return}Date.now()-a>i||setTimeout(t,100)};t()}function u(){const e=new Error("User rejected the request via TxGuardian.");return e.code=4001,e}function T(e,n){if(!e.__txgPatched){if(e.__txgPatched=!0,console.log(`[TxGuardian] patching ${n}`),typeof e.signTransaction=="function"){const i=e.signTransaction.bind(e);e.signTransaction=async a=>{if(console.log("[TxGuardian] intercepted signTransaction"),await f([a])==="reject")throw u();return i(a)}}if(typeof e.signAllTransactions=="function"){const i=e.signAllTransactions.bind(e);e.signAllTransactions=async a=>{if(console.log("[TxGuardian] intercepted signAllTransactions"),await f(a)==="reject")throw u();return i(a)}}if(typeof e.signAndSendTransaction=="function"){const i=e.signAndSendTransaction.bind(e);e.signAndSendTransaction=async(a,t)=>{if(console.log("[TxGuardian] intercepted signAndSendTransaction"),await f([a])==="reject")throw u();return i(a,t)}}}}k(()=>window.phantom?.solana,e=>T(e,"window.phantom.solana"));k(()=>window.solana,e=>T(e,"window.solana"));function L(e){if(e.__txgPatched||!e.features)return;e.__txgPatched=!0,console.log("[TxGuardian] patching wallet (Wallet Standard):",Object.keys(e.features));const n=e.features["solana:signTransaction"];if(n?.signTransaction){const a=n.signTransaction.bind(n);n.signTransaction=async(...t)=>{const c=(t[0]??[]).map(l=>l.transaction).filter(l=>l instanceof Uint8Array);if(await f(c)==="reject")throw u();return a(...t)}}const i=e.features["solana:signAndSendTransaction"];if(i?.signAndSendTransaction){const a=i.signAndSendTransaction.bind(i);i.signAndSendTransaction=async(...t)=>{const c=(t[0]??[]).map(l=>l.transaction).filter(l=>l instanceof Uint8Array);if(await f(c)==="reject")throw u();return a(...t)}}}const $={register(e){return L(e),()=>{}}};window.addEventListener("wallet-standard:register-wallet",e=>{console.log("[TxGuardian] wallet-standard:register-wallet event");const{detail:n}=e;typeof n=="function"&&n($)},!1);window.dispatchEvent(new CustomEvent("wallet-standard:app-ready",{detail:$}));console.log("[TxGuardian] dispatched wallet-standard:app-ready");async function f(e){if(e.length===0)return"approve";for(const n of e){const i=await _(n);if(!i){console.warn("[TxGuardian] could not serialize a tx; allowing through");continue}const a=D({kind:"loading",origin:window.location.host}),t=await M(i);if(t?a.update({kind:"verdict",origin:window.location.host,verdict:t}):a.update({kind:"unavailable",origin:window.location.host}),await a.awaitDecision()==="reject")return"reject"}return"approve"}async function _(e){try{if(e instanceof Uint8Array)return v(e);const n=e;if(typeof n.serialize!="function")return null;let i;try{i=n.serialize()}catch{i=n.serialize({requireAllSignatures:!1,verifySignatures:!1})}return i instanceof Uint8Array||(i=new Uint8Array(i)),v(i)}catch(n){return console.warn("[TxGuardian] serialize failed",n),null}}function v(e){let n="";for(let i=0;i<e.length;i++)n+=String.fromCharCode(e[i]);return btoa(n)}function M(e){return new Promise(n=>{const i=j(),a=setTimeout(()=>{window.removeEventListener("message",t),n(null)},15e3);function t(c){if(c.source!==window||!z(c.data))return;const p=c.data;p.type!=="ANALYZE_RESPONSE"||p.id!==i||(clearTimeout(a),window.removeEventListener("message",t),n(p.ok&&p.result?p.result:null))}window.addEventListener("message",t);const s={type:"ANALYZE_REQUEST",ns:w,id:i,base64:e,origin:window.location.origin};window.postMessage(s,window.location.origin)})}const y="txguardian-modal-host";function D(e){document.getElementById(y)?.remove();const n=document.createElement("div");n.id=y,n.style.cssText="all: initial; position: fixed; inset: 0; z-index: 2147483647;",document.documentElement.appendChild(n);const i=n.attachShadow({mode:"open"}),a=document.createElement("style");a.textContent=Y,i.appendChild(a);const t=document.createElement("div");t.className="scrim",i.appendChild(t);const s=document.createElement("div");s.className="card-slot",t.appendChild(s);let c=null;const p=new Promise(r=>{c=r});function l(r){if(!c)return;const g=c;c=null,document.removeEventListener("keydown",b),t.classList.add("closing"),setTimeout(()=>{n.remove(),g(r)},140)}function b(r){if(r.key==="Escape"){r.preventDefault(),r.stopPropagation(),l("reject");return}if(r.key==="Enter"){const g=i.querySelector("[data-action='primary']");g&&!g.disabled&&(r.preventDefault(),r.stopPropagation(),g.click())}}document.addEventListener("keydown",b);function x(){i.querySelector("[data-action='approve']")?.addEventListener("click",()=>l("approve")),i.querySelector("[data-action='reject']")?.addEventListener("click",()=>l("reject")),i.querySelector("[data-action='close']")?.addEventListener("click",()=>l("reject")),(i.querySelector("[data-action='reject']")??i.querySelector("[data-action='close']"))?.focus()}function m(r){s.innerHTML=q(r),x()}return m(e),{update:m,awaitDecision:()=>p}}function o(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function I(e){return`sev sev-${e}`}function G(e){return e==="safe"?"Safe":e==="caution"?"Caution":"Danger"}const A='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',S='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',N='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m14.5 9.5-5 5"/><path d="m9.5 9.5 5 5"/></svg>',P='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',O='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';function H(e){return e==="safe"?A:e==="caution"?S:N}function q(e){switch(e.kind){case"loading":return R(e.origin);case"verdict":return B(e.origin,e.verdict);case"unavailable":return U(e.origin)}}function h(e){return`
    <header>
      <div class="brand">
        <span class="dot"></span>
        <span class="brand-name">TxGuardian</span>
      </div>
      <div class="origin-chip" title="${o(e)}">${o(e)}</div>
      <button class="close" data-action="close" aria-label="Close">×</button>
    </header>`}function R(e){return`
    <div class="card loading-card" role="dialog" aria-modal="true" aria-busy="true" aria-label="Analyzing transaction">
      ${h(e)}
      <div class="loading-body">
        <div class="loading-icon">${P}</div>
        <div class="loading-title">Analyzing transaction…</div>
        <div class="loading-subtitle">
          Running the rule engine, checking the on-chain registry, and translating to plain English.
        </div>
        <div class="progress">
          <div class="progress-bar"></div>
        </div>
      </div>
    </div>
  `}function U(e){return`
    <div class="card" role="dialog" aria-modal="true">
      ${h(e)}
      <div class="verdict level-caution">
        <div class="verdict-icon">${S}</div>
        <div class="verdict-text">
          <div class="verdict-label">Analyzer unavailable</div>
          <div class="verdict-meta">
            <span>Could not reach TxGuardian's analyzer.</span>
          </div>
        </div>
      </div>
      <div class="body">
        <p class="explanation">
          The wallet's own confirmation will still appear next. Proceed only if you trust this dApp and the transaction it's asking you to sign.
        </p>
      </div>
      <footer>
        <button class="btn primary" data-action="reject" data-action-also="primary">Reject</button>
        <button class="btn ghost" data-action="approve">Continue anyway</button>
      </footer>
    </div>
  `}function B(e,n){const i=n.riskLevel==="danger",a=n.riskLevel==="safe",t=i?"Sign anyway":"Approve & sign",s=i?"Reject":"Cancel",c=i?"btn ghost":"btn primary",p=i?"btn primary":"btn secondary",l=i?"":"data-action-also='primary'",b=i?"data-action-also='primary'":"",x=n.explanation?`<section class="block">
        <div class="block-label">Plain-English summary</div>
        <p class="explanation">${o(n.explanation)}</p>
      </section>`:"",m=n.whatThisDoes.length===0?"":`<section class="block">
          <div class="block-label">What this transaction does</div>
          <ul class="bullets">
            ${n.whatThisDoes.map(d=>`<li>${o(d)}</li>`).join("")}
          </ul>
        </section>`,r=n.flags.length===0?"":`<section class="block">
          <div class="block-label">Flags · ${n.flags.length}</div>
          <div class="flags">
            ${n.flags.map(d=>{const E=d.evidence?`<details class="evidence">
                      <summary>Show evidence</summary>
                      <pre>${o(JSON.stringify(d.evidence,null,2))}</pre>
                    </details>`:"";return`
                  <article class="flag flag-${o(d.severity)}">
                    <div class="flag-head">
                      <span class="${o(I(d.severity))}">${o(d.severity)}</span>
                      <strong>${o(d.label)}</strong>
                    </div>
                    <p>${o(d.description)}</p>
                    ${E}
                  </article>`}).join("")}
          </div>
        </section>`,g=n.decodedInstructions.length===0?"":`<details class="ix-panel">
          <summary>
            <span class="block-label">Decoded instructions · ${n.decodedInstructions.length}</span>
            <span class="ix-chevron">${O}</span>
          </summary>
          <ol class="ix-list">
            ${n.decodedInstructions.map(d=>`
                <li>
                  <div class="ix-summary">${o(d.summary)}</div>
                  <div class="ix-meta">${o(d.programName)} · ${o(F(d.programId))}</div>
                </li>`).join("")}
          </ol>
        </details>`,C=a&&n.flags.length===0?`<div class="affirmation">
        <span class="affirmation-icon">${A}</span>
        <span>No risks detected. The transaction matches routine patterns and the wallet's own confirmation will follow.</span>
      </div>`:"";return`
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-verdict-label">
      ${h(e)}

      <div class="verdict level-${o(n.riskLevel)}">
        <div class="verdict-icon">${H(n.riskLevel)}</div>
        <div class="verdict-text">
          <div id="txg-verdict-label" class="verdict-label">${o(G(n.riskLevel))}</div>
          <div class="verdict-meta">
            <span class="score">${n.score} <span class="score-dim">/ 100</span></span>
            <span class="dotsep">·</span>
            <span>${n.flags.length} flag${n.flags.length===1?"":"s"}</span>
          </div>
          <div class="recommendation">${o(n.recommendation)}</div>
        </div>
      </div>

      <div class="body">
        ${C}
        ${x}
        ${m}
        ${r}
        ${g}
      </div>

      <footer>
        <button class="${p}" data-action="reject" ${b}>${s}</button>
        <button class="${c}" data-action="approve" ${l}>${t}</button>
      </footer>
    </div>
  `}function F(e){return e.length<=12?e:`${e.slice(0,4)}…${e.slice(-4)}`}const Y=`
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
