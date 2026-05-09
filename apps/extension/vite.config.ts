import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      // Add page.ts as a separate input. crxjs handles content_scripts +
      // background; this slot is for the MAIN-world script injected by
      // content.ts via <script> tag.
      input: {
        page: resolve(__dirname, "src/page.ts"),
      },
      output: {
        // page.ts is referenced by name from content.ts, so its output
        // path must be predictable: dist/page.js (no hash).
        // crxjs's outputs keep their hashed names.
        entryFileNames: (chunk) => {
          if (chunk.name === "page") return "page.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/chunk-[hash].js",
      },
    },
  },
});
