import base from "../../eslint.config.base.mjs";

// @txguardian/sdk — runtime-agnostic TS library. Lints src + test.
export default [{ ignores: ["dist/**"] }, ...base];
