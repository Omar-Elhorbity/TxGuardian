import { defineConfig } from "vitest/config";

// Extension message-wiring smoke tests run in the node environment with a
// hand-rolled `chrome` mock (issue #19). No jsdom needed — the tests exercise
// the message guards + the service-worker dispatch, not the DOM modal.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
