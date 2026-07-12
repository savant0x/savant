import { defineConfig, devices } from "@playwright/test";

// playwright.config.ts — round-trip e2e tests.
//
// The e2e tests in `e2e/auto-derived.spec.ts` exercise the full
// save→derive→chat flow, which (per FID-0003 §Quality Setup Test 2) calls
// OpenRouter's real `/v1/keys` endpoint from the browser-preview mock
// IPC. Because that requires a live OpenRouter master, the tests are
// **gated on the SAVANT_TEST_MASTER env var** at run time — absent that,
// the e2e tests skip cleanly. The vitest unit tests (Test 1) are
// hermetic and run regardless of env.
//
// `npm run test:all` runs both; CI can set SAVANT_TEST_MASTER to opt
// the e2e suite in. The webServer block boots `next dev` on :3000
// automatically.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
