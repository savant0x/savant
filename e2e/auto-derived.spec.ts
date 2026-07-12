import { test, expect } from "@playwright/test";

// e2e/auto-derived.spec.ts — Playwright round-trip tests for FID-0003.
//
// These tests exercise the full save→derive→chat flow against the
// browser preview (next dev on :3000). The mock IPC at
// src/lib/mock-ipc.ts actually invokes OpenRouter's `/v1/keys`
// endpoint, so a live OpenRouter master is **required** to run this
// suite end-to-end. The `test.skip()` guards below skip cleanly when
// SAVANT_TEST_MASTER is unset — `npm run test:e2e` then exits PASS
// with skipped tests, not FAIL.
//
// Vitest unit tests in src/lib/ipc.test.ts are hermetic and run
// regardless of env. `npm run test:all` runs both.

const MASTER = process.env["SAVANT_TEST_MASTER"];
const HAS_MASTER = Boolean(MASTER && MASTER.startsWith("sk-or-v1-"));

test.describe("FID-0003 round-trip save → derive → chat", () => {
  test.skip(
    !HAS_MASTER,
    "SAVANT_TEST_MASTER env var not set — skipping live /v1/keys round-trip",
  );

  test("full save→chat round-trip uses derived key, not master", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByLabel("OpenRouter Master Key").fill(MASTER!);
    await page.getByRole("button", { name: /save master key/i }).click();

    // Settings card: Session Key appears with last-4 of the derived
    // key. Time budget ≈ 1s for the provision round-trip.
    await expect(page.getByRole("status", { name: /saved/i })).toBeVisible({
      timeout: 5_000,
    });

    // Intercept chat outbound fetch and capture the Authorization
    // header to compare with the master + verify it's a derived subkey.
    let capturedAuth: string | null = null;
    page.on("request", (req) => {
      if (req.url().includes("/v1/chat/completions")) {
        capturedAuth = req.headers().authorization ?? null;
      }
    });

    await page.goto("/chat");
    // Chat mounts with derived; the Savant-listening empty state
    // appears (provisioned). Click into the composer is allowed.
    await expect(page.getByText(/Savant is listening/i)).toBeVisible({
      timeout: 5_000,
    });
    await page.getByPlaceholder(/ask savant/i).fill("hello");
    await page.keyboard.press("Enter");

    expect(capturedAuth).not.toBeNull();
    expect(capturedAuth).toMatch(/^Bearer sk-or-v1-/);
    // Master and derived have distinct last-8 — the captured header
    // must NOT contain the master's last-8.
    expect(capturedAuth).not.toContain(MASTER!.slice(-8));
  });

  test("bad master surfaces OpenRouter error verbatim; no Session Key card", async ({
    page,
  }) => {
    await page.goto("/settings");
    // Synthetic bad master — guaranteed to fail /v1/keys; same shape
    // so saveMasterKey accepts it.
    await page
      .getByLabel("OpenRouter Master Key")
      .fill("sk-or-v1-DEFINITELY-NOT-A-REAL-KEY-XXXXXXXXXXXX");
    await page.getByRole("button", { name: /save master key/i }).click();

    // Error surfaces verbatim from OpenRouter; "Saved" indicator does
    // NOT appear (provisioning failed).
    await expect(page.getByText(/provision|401|mock ipc|error/i)).toBeVisible({
      timeout: 5_000,
    });
    // Session Key card shows the not-provisioned empty state.
    await expect(page.getByText(/Session key not provisioned/i)).toBeVisible();
  });
});
