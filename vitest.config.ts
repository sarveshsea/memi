import { defineConfig } from "vitest/config";

export default defineConfig({
  css: { postcss: {} },
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "examples/**/__tests__/**/*.test.ts",
    ],
    css: false,
    // Some tests spawn real subprocesses (execute_code) and need more
    // headroom than vitest's 5s default. 30s covers cold tsx startup +
    // socket round-trips on slow CI runners.
    testTimeout: 30_000,
  },
});
