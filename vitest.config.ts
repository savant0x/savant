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
  // FID-009 perfection loop — vitest's default esbuild config uses
  // the classic JSX transform (`React.createElement(...)`) which
  // requires `import React from "react"` in EVERY .tsx file that
  // contains JSX. The production Next.js build uses the automatic
  // transform (`_jsx-runtime`), so the source files don't import
  // React. Configure esbuild to match the production transform so
  // the test runner can execute the source's JSX without needing
  // an explicit React import.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "e2e"],
    testTimeout: 10_000,
    // FID-009 perfection loop — polyfill crypto.subtle from Node's
    // webcrypto (happy-dom's implementation is incomplete).
    setupFiles: ["./vitest.setup.ts"],
  },
});
