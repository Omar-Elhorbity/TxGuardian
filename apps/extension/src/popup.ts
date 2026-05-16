/**
 * Popup script. Lets the user view + override the analyzer endpoint and
 * verify connectivity. The override is persisted to chrome.storage.local
 * under STORAGE_KEY_ENDPOINT; the service worker reads it on every request.
 *
 * "Test connection" issues an empty POST to the endpoint and treats any
 * response — including 4xx — as a positive signal that the route exists
 * and is reachable. A network error or 5xx counts as down.
 */

import {
  DEFAULT_ANALYZE_ENDPOINT,
  HOSTED_SITE_URL,
  STORAGE_KEY_ENDPOINT,
} from "./config";

const TEST_TIMEOUT_MS = 5000;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const dot = $<HTMLSpanElement>("status-dot");
const statusText = $<HTMLSpanElement>("status-text");
const versionEl = $<HTMLSpanElement>("version");
const input = $<HTMLInputElement>("endpoint");
const saveBtn = $<HTMLButtonElement>("save");
const resetBtn = $<HTMLButtonElement>("reset");
const testBtn = $<HTMLButtonElement>("test");
const testResult = $<HTMLDivElement>("test-result");
const linkExtension = $<HTMLAnchorElement>("link-extension");
const linkPrivacy = $<HTMLAnchorElement>("link-privacy");

linkExtension.href = `${HOSTED_SITE_URL}/extension`;
linkPrivacy.href = `${HOSTED_SITE_URL}/privacy`;

// Surface the installed version so users can compare against the site's
// current version and tell when their unpacked install has drifted.
versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

void init();

async function init(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_ENDPOINT);
  const value = stored[STORAGE_KEY_ENDPOINT];
  input.value =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : DEFAULT_ANALYZE_ENDPOINT;

  // Auto-run a connectivity check so the dot is meaningful on open.
  void runTest({ silent: true });
}

saveBtn.addEventListener("click", () => {
  void save();
});

resetBtn.addEventListener("click", () => {
  void reset();
});

testBtn.addEventListener("click", () => {
  void runTest({ silent: false });
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void save();
});

async function save(): Promise<void> {
  const raw = input.value.trim();
  if (raw.length === 0) {
    showTest("Endpoint can't be empty.", "err");
    return;
  }
  if (!isValidUrl(raw)) {
    showTest("Not a valid URL.", "err");
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY_ENDPOINT]: raw });
  showTest("Saved.", "ok");
  void runTest({ silent: true });
}

async function reset(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY_ENDPOINT);
  input.value = DEFAULT_ANALYZE_ENDPOINT;
  showTest("Reset to default.", "ok");
  void runTest({ silent: true });
}

interface TestOpts {
  silent: boolean;
}

async function runTest(opts: TestOpts): Promise<void> {
  const target = input.value.trim() || DEFAULT_ANALYZE_ENDPOINT;
  setStatus("checking", "checking…");
  if (!opts.silent) showTest(`Pinging ${target}…`, "neutral");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Empty body. The real /api/analyze returns JSON with an error field.
      // Non-JSON responses indicate the URL doesn't point at the analyzer
      // (typical case: Vercel's "DEPLOYMENT_NOT_FOUND" HTML on a missing
      // project, or a CDN/static page at the wrong path).
      body: "{}",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ctype = res.headers.get("content-type") ?? "";
    const isJson = ctype.includes("application/json");
    if (res.status >= 500) {
      setStatus("err", "server error");
      if (!opts.silent) showTest(`HTTP ${res.status} — server error.`, "err");
      return;
    }
    if (!isJson) {
      setStatus("err", "not the analyzer");
      if (!opts.silent) {
        showTest(
          `HTTP ${res.status}, non-JSON response — this URL doesn't look like the analyzer route.`,
          "err",
        );
      }
      return;
    }
    setStatus("ok", "reachable");
    if (!opts.silent) showTest(`HTTP ${res.status} — analyzer responding.`, "ok");
  } catch (err) {
    clearTimeout(timer);
    setStatus("err", "unreachable");
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Timed out after ${TEST_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    if (!opts.silent) showTest(msg, "err");
  }
}

function setStatus(state: "checking" | "ok" | "err", text: string): void {
  dot.classList.remove("ok", "err");
  if (state === "ok") dot.classList.add("ok");
  if (state === "err") dot.classList.add("err");
  statusText.textContent = text;
}

function showTest(text: string, kind: "ok" | "err" | "neutral"): void {
  testResult.hidden = false;
  testResult.classList.remove("ok", "err");
  if (kind === "ok") testResult.classList.add("ok");
  if (kind === "err") testResult.classList.add("err");
  testResult.textContent = text;
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
