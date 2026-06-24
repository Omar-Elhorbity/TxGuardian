import base from "../../eslint.config.base.mjs";

// @txguardian/extension — MV3 service worker + content/page scripts (TS).
export default [{ ignores: ["dist/**"] }, ...base];
