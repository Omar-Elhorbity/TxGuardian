import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// @txguardian/web — Next.js app. Migrated off the deprecated `next lint` to
// the ESLint flat config (issue #20). FlatCompat loads the eslintrc-style
// `eslint-config-next` shareable configs into flat config.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Tooling config files (anonymous default export is idiomatic there) and
  // Next's build output are not app code — leave them out of the baseline.
  { ignores: [".next/**", "next-env.d.ts", "**/*.config.{js,mjs,ts}"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Apostrophes/quotes in JSX prose render correctly in React; requiring
      // &apos;/&quot; escapes hurts copy readability for no real bug-class.
      // Baselined off intentionally (issue #20).
      "react/no-unescaped-entities": "off",
    },
  },
];
