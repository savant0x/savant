import { defineConfig } from "vitest/config";
import path from "path";

// vitest.config.ts — renderer unit tests
//
// Scope: src/**\/*.test.{ts,tsx} co-located with source files. Single
// happy-dom environment (AionUi uses multi-project node+dom; we have
// no Node-runtime tests yet, so a single env is correct). The e2e/
// directory is excluded here — those run via @playwright/test, not vitest.
//
// The `@/*` alias mirrors tsconfig.json's paths so test imports resolve
// against the same roots as production code.

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "e2e"],
    testTimeout: 10_000,
  },
});
