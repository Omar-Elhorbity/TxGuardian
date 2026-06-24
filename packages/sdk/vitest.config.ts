import { defineConfig } from "vitest/config";

/**
 * SDK test + coverage config (issue #19).
 *
 * The coverage gate protects the deterministic *engine* — the code that
 * produces the verdict (parser, decode, rules, scorer, registry deserialize,
 * constants). The I/O boundaries are excluded because they're exercised by
 * integration (the live /api/analyze round-trip), not by unit tests, and
 * unit-mocking them inflates coverage without testing real behaviour:
 *   - index.ts        orchestration over the network
 *   - simulate.ts     RPC simulation
 *   - translator/**   LLM (Gemini) calls
 *   - types.ts        type declarations, no runtime code
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/types.ts",
        "src/simulate.ts",
        "src/translator/**",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
