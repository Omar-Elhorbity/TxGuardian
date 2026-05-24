#!/usr/bin/env node
/**
 * Zip the built extension dist into the web app's public/ directory so the
 * scanner site can offer it as a one-click download. Runs as part of
 * `pnpm --filter @txguardian/extension package` and from the web app's
 * `prebuild` hook so every Vercel deploy serves a fresh copy.
 *
 * Uses the system `zip` binary (available on Vercel's build images and
 * essentially every dev environment) rather than pulling in a JS zip
 * library — the dependency surface stays at zero for a 5-line script.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "..", "dist");
const outDir = resolve(here, "..", "..", "web", "public");
const outZip = resolve(outDir, "txguardian-extension.zip");
const outSha = resolve(outDir, "txguardian-extension.sha256.txt");

if (!existsSync(distDir) || readdirSync(distDir).length === 0) {
  console.error(
    "[zip-dist] dist/ is missing or empty — run `vite build` first.",
  );
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
if (existsSync(outZip)) rmSync(outZip);

try {
  // -r recursive, -q quiet. cwd=distDir so paths inside the zip are relative
  // (chrome://extensions Load unpacked points at the extracted folder root,
  // and we want the manifest at the top — not nested under "dist/").
  execFileSync("zip", ["-r", "-q", outZip, "."], {
    cwd: distDir,
    stdio: "inherit",
  });
} catch (err) {
  console.error(
    "[zip-dist] failed to invoke `zip`. Is it installed? On Debian/Ubuntu: `sudo apt install zip`.",
  );
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const sizeKB = (statSync(outZip).size / 1024).toFixed(1);
const rel = outZip.replace(resolve(here, "..", "..", ".."), "");
console.log(`[zip-dist] wrote ${rel} (${sizeKB} KB)`);

// Write SHA256 alongside so the /extension page can render it next to the
// download link. Lets users (and Chrome Web Store reviewers) verify that
// the published binary matches the source at the tagged commit.
const sha = createHash("sha256").update(readFileSync(outZip)).digest("hex");
writeFileSync(outSha, sha + "\n", "utf-8");
console.log(`[zip-dist] SHA256: ${sha}`);
