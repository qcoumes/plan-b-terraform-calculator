import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// Saved settings live in localStorage for this origin, so keep it.
const LOCAL_SERVER = { host: "127.0.0.1", port: 8765, strictPort: true };

// For Docker setups where file events don't reach the container (docker/dev.env).
const USE_POLLING = process.env.VITE_USE_POLLING === "true";

export default defineConfig({
  // Relative URLs, so the build works from any folder (e.g. GitHub Pages).
  base: "./",
  plugins: [vue()],
  server: { ...LOCAL_SERVER, ...(USE_POLLING ? { watch: { usePolling: true } } : {}) },
  preview: LOCAL_SERVER,
  test: {
    include: ["tests/**/*_test.ts"],
  },
});
