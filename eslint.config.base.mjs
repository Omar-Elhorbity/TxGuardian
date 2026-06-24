import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint base for the TypeScript workspaces (packages/sdk,
 * apps/extension). Each workspace extends this with its own ignores; see
 * issue #20. apps/web has its own Next.js-flavoured config.
 *
 * Rule set is the *recommended* (syntactic) tier, not the type-checked tier —
 * fast, no per-file type info needed, and clean against the current code.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // TypeScript already reports undefined identifiers, and the core rule
      // false-flags ambient DOM / Web-extension / Node globals. Disabling it
      // for .ts is the typescript-eslint-recommended posture.
      "no-undef": "off",
      // Allow intentionally-unused args/vars when prefixed with `_`, and don't
      // flag unused error bindings in catch clauses.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },
);
