import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Stable file names so manifest references resolve cleanly.
        chunkFileNames: "assets/chunk-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
