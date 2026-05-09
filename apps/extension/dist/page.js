const x="TXG";function y(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}function T(e){return typeof e=="object"&&e!==null&&e.ns===x}console.log("[TxGuardian] page-context injection active");window.__TXG_LOADED__=!0;function h(e,n,t=1e4){const a=Date.now(),o=()=>{const i=e();if(i!==void 0){n(i);return}Date.now()-a>t||setTimeout(o,100)};o()}function p(){const e=new Error("User rejected the request via TxGuardian.");return e.code=4001,e}function m(e,n){if(!e.__txgPatched){if(e.__txgPatched=!0,console.log(`[TxGuardian] patching ${n}`),typeof e.signTransaction=="function"){const t=e.signTransaction.bind(e);e.signTransaction=async a=>{if(console.log("[TxGuardian] intercepted signTransaction"),await u([a])==="reject")throw p();return t(a)}}if(typeof e.signAllTransactions=="function"){const t=e.signAllTransactions.bind(e);e.signAllTransactions=async a=>{if(console.log("[TxGuardian] intercepted signAllTransactions"),await u(a)==="reject")throw p();return t(a)}}if(typeof e.signAndSendTransaction=="function"){const t=e.signAndSendTransaction.bind(e);e.signAndSendTransaction=async(a,o)=>{if(console.log("[TxGuardian] intercepted signAndSendTransaction"),await u([a])==="reject")throw p();return t(a,o)}}}}h(()=>window.phantom?.solana,e=>m(e,"window.phantom.solana"));h(()=>window.solana,e=>m(e,"window.solana"));function k(e){if(e.__txgPatched||!e.features)return;e.__txgPatched=!0,console.log("[TxGuardian] patching wallet (Wallet Standard):",Object.keys(e.features));const n=e.features["solana:signTransaction"];if(n?.signTransaction){const a=n.signTransaction.bind(n);n.signTransaction=async(...o)=>{const s=(o[0]??[]).map(r=>r.transaction).filter(r=>r instanceof Uint8Array);if(await u(s)==="reject")throw p();return a(...o)}}const t=e.features["solana:signAndSendTransaction"];if(t?.signAndSendTransaction){const a=t.signAndSendTransaction.bind(t);t.signAndSendTransaction=async(...o)=>{const s=(o[0]??[]).map(r=>r.transaction).filter(r=>r instanceof Uint8Array);if(await u(s)==="reject")throw p();return a(...o)}}}const w={register(e){return k(e),()=>{}}};window.addEventListener("wallet-standard:register-wallet",e=>{console.log("[TxGuardian] wallet-standard:register-wallet event");const{detail:n}=e;typeof n=="function"&&n(w)},!1);window.dispatchEvent(new CustomEvent("wallet-standard:app-ready",{detail:w}));console.log("[TxGuardian] dispatched wallet-standard:app-ready");async function u(e){if(e.length===0)return"approve";for(const n of e){const t=await A(n);if(!t){console.warn("[TxGuardian] could not serialize a tx; allowing through");continue}const a=await S(t);if(!a){if(await b({kind:"unavailable",origin:window.location.host})==="reject")return"reject";continue}if(await b({kind:"verdict",origin:window.location.host,verdict:a})==="reject")return"reject"}return"approve"}async function A(e){try{if(e instanceof Uint8Array)return g(e);const n=e;if(typeof n.serialize!="function")return null;let t;try{t=n.serialize()}catch{t=n.serialize({requireAllSignatures:!1,verifySignatures:!1})}return t instanceof Uint8Array||(t=new Uint8Array(t)),g(t)}catch(n){return console.warn("[TxGuardian] serialize failed",n),null}}function g(e){let n="";for(let t=0;t<e.length;t++)n+=String.fromCharCode(e[t]);return btoa(n)}function S(e){return new Promise(n=>{const t=y(),a=setTimeout(()=>{window.removeEventListener("message",o),n(null)},15e3);function o(s){if(s.source!==window||!T(s.data))return;const c=s.data;c.type!=="ANALYZE_RESPONSE"||c.id!==t||(clearTimeout(a),window.removeEventListener("message",o),n(c.ok&&c.result?c.result:null))}window.addEventListener("message",o);const i={type:"ANALYZE_REQUEST",ns:x,id:t,base64:e,origin:window.location.origin};window.postMessage(i,window.location.origin)})}const f="txguardian-modal-host";function b(e){return new Promise(n=>{document.getElementById(f)?.remove();const t=document.createElement("div");t.id=f,t.style.cssText="all: initial; position: fixed; inset: 0; z-index: 2147483647;",document.documentElement.appendChild(t);const a=t.attachShadow({mode:"open"}),o=document.createElement("style");o.textContent=_,a.appendChild(o);const i=document.createElement("div");i.className="scrim",i.innerHTML=e.kind==="verdict"?L(e.origin,e.verdict):z(e.origin),a.appendChild(i);function s(r){t.remove(),n(r)}a.querySelector("[data-action='approve']")?.addEventListener("click",()=>s("approve")),a.querySelector("[data-action='reject']")?.addEventListener("click",()=>s("reject")),a.querySelector("[data-action='close']")?.addEventListener("click",()=>s("reject"));function c(r){r.key==="Escape"&&(document.removeEventListener("keydown",c),s("reject"))}document.addEventListener("keydown",c)})}function l(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function j(e){return`sev sev-${e}`}function E(e){return`level level-${e}`}function $(e){return e==="safe"?"Safe":e==="caution"?"Caution":"Danger"}function L(e,n){const t=n.flags.length===0?'<div class="empty">No flags raised.</div>':n.flags.map(d=>`
          <article class="flag">
            <div class="flag-head">
              <span class="${l(j(d.severity))}">${l(d.severity)}</span>
              <strong>${l(d.label)}</strong>
            </div>
            <p>${l(d.description)}</p>
          </article>`).join(""),a=n.whatThisDoes.length===0?"":`<section class="block">
        <div class="block-label">What this transaction does</div>
        <ul class="bullets">
          ${n.whatThisDoes.map(d=>`<li>${l(d)}</li>`).join("")}
        </ul>
      </section>`,o=n.explanation?`<section class="block"><p class="explanation">${l(n.explanation)}</p></section>`:"",i=n.riskLevel==="danger",s=i?"Sign anyway":"Approve & sign",c=i?"Reject":"Cancel",r=i?"btn ghost":"btn primary",v=i?"btn primary":"btn secondary";return`
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="txg-title">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${l(e)}</span>
        </div>
        <button class="close" data-action="close" aria-label="Close">×</button>
      </header>

      <div class="verdict ${l(E(n.riskLevel))}">
        <div class="verdict-label">${l($(n.riskLevel))}</div>
        <div class="verdict-meta">
          <span>${n.score} / 100</span>
          <span class="dotsep">·</span>
          <span>${n.flags.length} flag${n.flags.length===1?"":"s"}</span>
          <span class="dotsep">·</span>
          <span>${l(n.recommendation)}</span>
        </div>
      </div>

      <div class="body">
        ${o}
        ${a}
        ${n.flags.length>0?`<section class="block">
                <div class="block-label">Flags</div>
                <div class="flags">${t}</div>
              </section>`:""}
      </div>

      <footer>
        <button class="${v}" data-action="reject">${c}</button>
        <button class="${r}" data-action="approve">${s}</button>
      </footer>
    </div>
  `}function z(e){return`
    <div class="card" role="dialog" aria-modal="true">
      <header>
        <div class="brand">
          <span class="dot"></span>
          <span>TxGuardian</span>
          <span class="origin">on ${l(e)}</span>
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
  `}const _=`
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
//# sourceMappingURL=page.js.map
