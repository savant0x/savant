/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    // HeroUI v3 alpha — keep it out of Vite's optimizer (alpha
    // versions often break when bundled aggressively).
    exclude: ["@heroui/react", "@heroui/styles"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
