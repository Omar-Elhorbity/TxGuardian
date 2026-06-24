import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Web API-route tests run in the node environment (the routes are server
// handlers). The `@/` alias mirrors tsconfig's path mapping for imports
// like `@/app/api/analyze/route` and `@/lib/rpc`. See issue #19.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
