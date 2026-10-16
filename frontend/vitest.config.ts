import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    // Per-test budgets: a genuinely hung test fails fast instead of stalling the
    // whole suite. NOTE: these do NOT bound the suite — a full run legitimately
    // takes ~145s on a slow (D:) filesystem due to transform + jsdom setup cost,
    // so any outer/CI budget must be >= 300s. A 120s outer budget reports this
    // healthy suite as a "timeout" (see docs/DAILY_BRIEFING_PROTOCOL.md).
    testTimeout: 300000,
    hookTimeout: 300000,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});