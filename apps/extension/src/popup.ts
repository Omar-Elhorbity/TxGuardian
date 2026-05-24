/**
 * Popup script. Manages four user-facing settings:
 *   1. Engine mode — local (default) or hosted fallback
 *   2. RPC URL — Solana RPC for local-mode simulation + registry lookups
 *   3. Hosted analyzer endpoint — for hosted-mode users
 *   4. AI translator — opt-in BYO Gemini key (session-only storage)
 *
 * Storage policy:
 *   - mode, rpcUrl, analyzerEndpoint, llmEnabled, llmModel → chrome.storage.local (persistent)
 *   - llmKey                                                → chrome.storage.session (cleared on browser close, NEVER on disk)
 *
 * The popup never sees the LLM key in cleartext after save — once saved
 * to session storage, the input field is replaced with a placeholder
 * indicator. "Forget key" wipes it. This matches the password-field
 * convention so users with shoulder-surfing concerns have a clean UX.
 */

import {
  DEFAULT_ANALYZE_ENDPOINT,
  DEFAULT_ENGINE_MODE,
  DEFAULT_LLM_MODEL,
  DEFAULT_RPC_URL,
  HOSTED_SITE_URL,
  STORAGE_KEY_ENDPOINT,
  STORAGE_KEY_LLM_ENABLED,
  STORAGE_KEY_LLM_KEY,
  STORAGE_KEY_LLM_MODEL,
  STORAGE_KEY_MODE,
  STORAGE_KEY_RPC,
  STORAGE_KEY_SHOW_WELCOME,
} from "./config";

const RPC_TEST_TIMEOUT_MS = 5000;
const ENDPOINT_TEST_TIMEOUT_MS = 5000;
const LLM_TEST_TIMEOUT_MS = 8000;

// ─── DOM helpers ────────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const dot = $<HTMLSpanElement>("status-dot");
const statusText = $<HTMLSpanElement>("status-text");
const versionEl = $<HTMLSpanElement>("version");

const modeLocal = $<HTMLInputElement>("mode-local");
const modeHosted = $<HTMLInputElement>("mode-hosted");
const modeLocalCard = $<HTMLLabelElement>("mode-local-card");
const modeHostedCard = $<HTMLLabelElement>("mode-hosted-card");

const sectionRpc = $<HTMLDivElement>("section-rpc");
const sectionEndpoint = $<HTMLDivElement>("section-endpoint");

const rpcInput = $<HTMLInputElement>("rpc-url");
const rpcSave = $<HTMLButtonElement>("rpc-save");
const rpcReset = $<HTMLButtonElement>("rpc-reset");
const rpcTest = $<HTMLButtonElement>("rpc-test");
const rpcResult = $<HTMLDivElement>("rpc-test-result");

const endpointInput = $<HTMLInputElement>("endpoint");
const endpointSave = $<HTMLButtonElement>("endpoint-save");
const endpointReset = $<HTMLButtonElement>("endpoint-reset");
const endpointTest = $<HTMLButtonElement>("endpoint-test");
const endpointResult = $<HTMLDivElement>("endpoint-test-result");

const llmEnabled = $<HTMLInputElement>("llm-enabled");
const llmConfig = $<HTMLDivElement>("llm-config");
const llmKey = $<HTMLInputElement>("llm-key");
const llmSave = $<HTMLButtonElement>("llm-save");
const llmForget = $<HTMLButtonElement>("llm-forget");
const llmTest = $<HTMLButtonElement>("llm-test");
const llmResult = $<HTMLDivElement>("llm-test-result");

const linkExtension = $<HTMLAnchorElement>("link-extension");
const linkPrivacy = $<HTMLAnchorElement>("link-privacy");

const welcomePanel = $<HTMLDivElement>("welcome");
const welcomeDismiss = $<HTMLButtonElement>("welcome-dismiss");
const aiDetails = $<HTMLDetailsElement>("ai-details");
const aiState = $<HTMLSpanElement>("ai-state");
const privacyReadout = $<HTMLDivElement>("privacy-readout");

// ─── Init ───────────────────────────────────────────────────────────────

linkExtension.href = `${HOSTED_SITE_URL}/extension`;
linkPrivacy.href = `${HOSTED_SITE_URL}/privacy`;
versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

void init();

async function init(): Promise<void> {
  const cfg = await loadConfig();

  // Welcome panel: show if the SW set the flag on install/update.
  if (cfg.showWelcome) {
    welcomePanel.hidden = false;
    // Auto-expand the AI details so users see all the options the first
    // time. Closed by default on subsequent opens.
    aiDetails.open = true;
  }

  // Mode
  if (cfg.mode === "hosted") {
    modeHosted.checked = true;
  } else {
    modeLocal.checked = true;
  }
  updateModeUi();

  // RPC
  rpcInput.value = cfg.rpcUrl;

  // Endpoint
  endpointInput.value = cfg.endpoint;

  // LLM
  llmEnabled.checked = cfg.llmEnabled;
  updateLlmConfigVisibility();
  if (cfg.llmKeyPresent) {
    llmKey.placeholder = "•••••••• (key saved to session)";
  }
  updateAiStateBadge(cfg.llmEnabled, cfg.llmKeyPresent);

  setStatusReady(cfg.mode);
  updatePrivacyReadout();
}

welcomeDismiss.addEventListener("click", () => {
  welcomePanel.hidden = true;
  void chrome.storage.local.remove(STORAGE_KEY_SHOW_WELCOME);
});

// ─── Load + save ────────────────────────────────────────────────────────

interface PopupConfig {
  mode: "local" | "hosted";
  rpcUrl: string;
  endpoint: string;
  llmEnabled: boolean;
  llmKeyPresent: boolean;
  showWelcome: boolean;
}

async function loadConfig(): Promise<PopupConfig> {
  const local = await chrome.storage.local.get([
    STORAGE_KEY_MODE,
    STORAGE_KEY_RPC,
    STORAGE_KEY_ENDPOINT,
    STORAGE_KEY_LLM_ENABLED,
    STORAGE_KEY_SHOW_WELCOME,
  ]);
  let llmKeyPresent = false;
  try {
    if (typeof chrome.storage.session !== "undefined") {
      const session = await chrome.storage.session.get([STORAGE_KEY_LLM_KEY]);
      const k = session[STORAGE_KEY_LLM_KEY];
      llmKeyPresent = typeof k === "string" && k.trim().length > 0;
    }
  } catch {
    llmKeyPresent = false;
  }
  return {
    mode: local[STORAGE_KEY_MODE] === "hosted" ? "hosted" : DEFAULT_ENGINE_MODE,
    rpcUrl: trimOrDefault(local[STORAGE_KEY_RPC], DEFAULT_RPC_URL),
    endpoint: trimOrDefault(
      local[STORAGE_KEY_ENDPOINT],
      DEFAULT_ANALYZE_ENDPOINT,
    ),
    llmEnabled: local[STORAGE_KEY_LLM_ENABLED] === true,
    llmKeyPresent,
    showWelcome: local[STORAGE_KEY_SHOW_WELCOME] === true,
  };
}

function trimOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

// ─── Mode (radio toggle) ────────────────────────────────────────────────

function updateModeUi(): void {
  const isLocal = modeLocal.checked;
  modeLocalCard.classList.toggle("selected", isLocal);
  modeHostedCard.classList.toggle("selected", !isLocal);
  sectionRpc.hidden = !isLocal;
  sectionEndpoint.hidden = isLocal;
  setStatusReady(isLocal ? "local" : "hosted");
}

async function onModeChange(): Promise<void> {
  const mode = modeLocal.checked ? "local" : "hosted";
  await chrome.storage.local.set({ [STORAGE_KEY_MODE]: mode });
  updateModeUi();
  void updatePrivacyReadout();
}

modeLocal.addEventListener("change", () => void onModeChange());
modeHosted.addEventListener("change", () => void onModeChange());

// ─── RPC ────────────────────────────────────────────────────────────────

rpcSave.addEventListener("click", () => void saveRpc());
rpcReset.addEventListener("click", () => void resetRpc());
rpcTest.addEventListener("click", () => void testRpc());
rpcInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void saveRpc();
});

async function saveRpc(): Promise<void> {
  const raw = rpcInput.value.trim();
  if (raw.length === 0) {
    showResult(rpcResult, "RPC URL can't be empty.", "err");
    return;
  }
  if (!isValidHttpUrl(raw)) {
    showResult(rpcResult, "Not a valid URL.", "err");
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY_RPC]: raw });
  showResult(rpcResult, "Saved.", "ok");
  void updatePrivacyReadout();
}

async function resetRpc(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_RPC);
  rpcInput.value = DEFAULT_RPC_URL;
  showResult(rpcResult, "Reset to default.", "ok");
  void updatePrivacyReadout();
}

async function testRpc(): Promise<void> {
  const url = rpcInput.value.trim() || DEFAULT_RPC_URL;
  showResult(rpcResult, `Pinging ${url}…`, "neutral");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TEST_TIMEOUT_MS);
  try {
    // Minimal JSON-RPC ping. getHealth is universally cheap on Solana RPCs.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("application/json")) {
      showResult(rpcResult, `HTTP ${res.status}, non-JSON — not a Solana RPC.`, "err");
      return;
    }
    const json = (await res.json()) as { result?: unknown; error?: unknown };
    if (json.error) {
      showResult(rpcResult, `RPC returned an error.`, "err");
      return;
    }
    showResult(rpcResult, `RPC reachable. ✓`, "ok");
  } catch (err) {
    clearTimeout(timer);
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Timed out after ${RPC_TEST_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    showResult(rpcResult, msg, "err");
  }
}

// ─── Hosted endpoint ────────────────────────────────────────────────────

endpointSave.addEventListener("click", () => void saveEndpoint());
endpointReset.addEventListener("click", () => void resetEndpoint());
endpointTest.addEventListener("click", () => void testEndpoint());
endpointInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void saveEndpoint();
});

async function saveEndpoint(): Promise<void> {
  const raw = endpointInput.value.trim();
  if (raw.length === 0 || !isValidHttpUrl(raw)) {
    showResult(endpointResult, "Not a valid URL.", "err");
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY_ENDPOINT]: raw });
  showResult(endpointResult, "Saved.", "ok");
}

async function resetEndpoint(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_ENDPOINT);
  endpointInput.value = DEFAULT_ANALYZE_ENDPOINT;
  showResult(endpointResult, "Reset to default.", "ok");
}

async function testEndpoint(): Promise<void> {
  const target = endpointInput.value.trim() || DEFAULT_ANALYZE_ENDPOINT;
  showResult(endpointResult, `Pinging ${target}…`, "neutral");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENDPOINT_TEST_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("application/json")) {
      showResult(
        endpointResult,
        `HTTP ${res.status}, non-JSON — this URL doesn't look like the analyzer.`,
        "err",
      );
      return;
    }
    if (res.status >= 500) {
      showResult(endpointResult, `HTTP ${res.status} — server error.`, "err");
      return;
    }
    showResult(endpointResult, `HTTP ${res.status} — analyzer responding.`, "ok");
  } catch (err) {
    clearTimeout(timer);
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Timed out after ${ENDPOINT_TEST_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    showResult(endpointResult, msg, "err");
  }
}

// ─── AI translator ──────────────────────────────────────────────────────

llmEnabled.addEventListener("change", () => {
  void chrome.storage.local.set({
    [STORAGE_KEY_LLM_ENABLED]: llmEnabled.checked,
  });
  // Set the model too (locked to default for v1; future-proof).
  void chrome.storage.local.set({
    [STORAGE_KEY_LLM_MODEL]: DEFAULT_LLM_MODEL,
  });
  updateLlmConfigVisibility();
  void refreshAiState();
});

async function refreshAiState(): Promise<void> {
  const cfg = await loadConfig();
  updateAiStateBadge(cfg.llmEnabled, cfg.llmKeyPresent);
  await updatePrivacyReadout();
}

llmSave.addEventListener("click", () => void saveLlmKey());
llmForget.addEventListener("click", () => void forgetLlmKey());
llmTest.addEventListener("click", () => void testLlmKey());
llmKey.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void saveLlmKey();
});

function updateLlmConfigVisibility(): void {
  llmConfig.hidden = !llmEnabled.checked;
}

async function saveLlmKey(): Promise<void> {
  const raw = llmKey.value.trim();
  if (raw.length === 0) {
    showResult(llmResult, "Key can't be empty.", "err");
    return;
  }
  if (typeof chrome.storage.session === "undefined") {
    showResult(
      llmResult,
      "chrome.storage.session isn't available in this browser. Upgrade Chrome to use session-only key storage.",
      "err",
    );
    return;
  }
  await chrome.storage.session.set({ [STORAGE_KEY_LLM_KEY]: raw });
  llmKey.value = "";
  llmKey.placeholder = "•••••••• (key saved to session)";
  showResult(
    llmResult,
    "Key saved to this browser session. Will be cleared when the browser closes.",
    "ok",
  );
  await refreshAiState();
}

async function forgetLlmKey(): Promise<void> {
  try {
    if (typeof chrome.storage.session !== "undefined") {
      await chrome.storage.session.remove(STORAGE_KEY_LLM_KEY);
    }
  } catch {
    // ignore — best effort
  }
  llmKey.value = "";
  llmKey.placeholder = "Google Gemini API key";
  showResult(llmResult, "Key forgotten.", "ok");
  await refreshAiState();
}

async function testLlmKey(): Promise<void> {
  // Resolve the key — prefer the field value if user just typed it,
  // otherwise read from session storage.
  let key = llmKey.value.trim();
  if (key.length === 0) {
    try {
      if (typeof chrome.storage.session !== "undefined") {
        const session = await chrome.storage.session.get([STORAGE_KEY_LLM_KEY]);
        const stored = session[STORAGE_KEY_LLM_KEY];
        if (typeof stored === "string" && stored.trim().length > 0) {
          key = stored.trim();
        }
      }
    } catch {
      // fall through
    }
  }
  if (key.length === 0) {
    showResult(llmResult, "Enter a key first, then test.", "err");
    return;
  }
  showResult(llmResult, "Testing key…", "neutral");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TEST_TIMEOUT_MS);
  try {
    // Minimal Gemini API call. The key auth happens via query param.
    // We use the listModels endpoint — cheapest possible request, returns
    // the model catalog if the key is valid, 400 if not.
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 200) {
      showResult(llmResult, "Key valid. ✓", "ok");
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
      showResult(llmResult, `Key rejected (HTTP ${res.status}).`, "err");
    } else {
      showResult(llmResult, `Unexpected HTTP ${res.status}.`, "err");
    }
  } catch (err) {
    clearTimeout(timer);
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Timed out after ${LLM_TEST_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    showResult(llmResult, msg, "err");
  }
}

// ─── Status header ──────────────────────────────────────────────────────

function setStatusReady(mode: "local" | "hosted"): void {
  dot.classList.remove("err");
  statusText.textContent = mode === "local" ? "local" : "hosted";
}

// ─── AI state badge (inside the <details> summary) ─────────────────────

function updateAiStateBadge(enabled: boolean, keyPresent: boolean): void {
  if (enabled && keyPresent) {
    aiState.textContent = "on · your key";
    aiState.classList.add("on");
  } else if (enabled) {
    aiState.textContent = "on · no key";
    aiState.classList.remove("on");
  } else {
    aiState.textContent = "off";
    aiState.classList.remove("on");
  }
}

// ─── Privacy readout (pinned footer, live updates as settings change) ──

async function updatePrivacyReadout(): Promise<void> {
  const cfg = await loadConfig();
  const parts: string[] = [];

  // Engine
  parts.push(
    cfg.mode === "local"
      ? `<span class="field">Local engine</span>`
      : `<span class="field warn">Hosted analyzer</span>`,
  );

  // RPC
  const isDefaultRpc = cfg.rpcUrl === DEFAULT_RPC_URL;
  parts.push(
    isDefaultRpc
      ? `<span>default RPC</span>`
      : `<span>custom RPC</span>`,
  );

  // AI
  if (cfg.llmEnabled && cfg.llmKeyPresent) {
    parts.push(
      `<span class="field">AI on (Gemini, your key)</span>`,
    );
  } else if (cfg.llmEnabled) {
    parts.push(`<span>AI enabled, no key</span>`);
  } else {
    parts.push(`<span>no AI</span>`);
  }

  // Server contact statement
  parts.push(
    cfg.mode === "hosted"
      ? `<span class="field warn">TxGuardian server: contacted</span>`
      : `<span class="field">TxGuardian server: not contacted</span>`,
  );

  privacyReadout.innerHTML = parts.join(" · ");
}

// ─── Shared result helper ───────────────────────────────────────────────

function showResult(
  el: HTMLDivElement,
  text: string,
  kind: "ok" | "err" | "neutral",
): void {
  el.hidden = false;
  el.classList.remove("ok", "err");
  if (kind === "ok") el.classList.add("ok");
  if (kind === "err") el.classList.add("err");
  el.textContent = text;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
