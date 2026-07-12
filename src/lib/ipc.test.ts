import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Mock the @tauri-apps/api/core module so `invoke` is fully under our
// control. The FID's Test 1 sample (`vi.mocked(invoke).mockResolvedValueOnce(...)`)
// assumes this is set up at the test-file top level.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { provisionSessionKey, clearSessionKey, type SessionKey } from "./ipc";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.resetAllMocks();
});

// Helper: a fully-populated healthy wire envelope.
const healthyWire = (): { data: Record<string, unknown>; key: string } => ({
  data: {
    hash: "65b6c4087e821cf31c5f2496e97b4f1bbb22a6199d94ef70ae97460713b595f1",
    name: "savant-test-001",
    label: "sk-or-v1-1b4c23",
    disabled: false,
    limit: null,
    limit_remaining: null,
    limit_reset: null,
    include_byok_in_limit: false,
    usage: 0,
    usage_daily: 0,
    usage_weekly: 0,
    usage_monthly: 0,
    byok_usage: 0,
    byok_usage_daily: 0,
    byok_usage_weekly: 0,
    byok_usage_monthly: 0,
    created_at: "2026-07-12T00:54:56.505Z",
    updated_at: null,
    expires_at: null,
    creator_user_id: "user_test",
    workspace_id: "ws_test",
  },
  key: "sk-or-v1-TESTKEYVALUE",
});

describe("provisionSessionKey parser", () => {
  it("extracts the SessionKey shape from a healthy wire response", async () => {
    const wire = healthyWire();
    mockedInvoke.mockResolvedValueOnce(wire as never);
    const result: SessionKey = await provisionSessionKey({
      profile: "openrouter",
      agentName: "savant-test-001",
    });
    expect(result.key).toBe("sk-or-v1-TESTKEYVALUE");
    expect(result.name).toBe("savant-test-001");
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.label).toBe("sk-or-v1-1b4c23");
    expect(result.limit).toBeNull();
    expect(result.expires_at).toBeNull();
    expect(result.disabled).toBe(false);
    expect(result.include_byok_in_limit).toBe(false);
  });

  it("throws when OpenRouter returns disabled: true", async () => {
    const wire = healthyWire();
    (wire.data as Record<string, unknown>)["disabled"] = true;
    mockedInvoke.mockResolvedValueOnce(wire as never);
    await expect(
      provisionSessionKey({
        profile: "openrouter",
        agentName: "savant-test-002",
      }),
    ).rejects.toThrow(/disabled/i);
  });

  it("throws when the wire response is missing the data envelope", async () => {
    mockedInvoke.mockResolvedValueOnce({ key: "sk-or-v1-TEST" } as never);
    await expect(
      provisionSessionKey({
        profile: "openrouter",
        agentName: "savant-test-003",
      }),
    ).rejects.toThrow(/data.*envelope/i);
  });

  it("throws when the data envelope is malformed (missing hash/name/label/created_at)", async () => {
    mockedInvoke.mockResolvedValueOnce({
      data: {
        // Missing hash, name, label, created_at.
        disabled: false,
        limit: null,
      },
      key: "sk-or-v1-TEST",
    } as never);
    await expect(
      provisionSessionKey({
        profile: "openrouter",
        agentName: "savant-test-004",
      }),
    ).rejects.toThrow(/malformed/);
  });
});

describe("clearSessionKey", () => {
  it("forwards hash as the DELETE path-segment, not name (verified-live 2026-07-12 00:55)", async () => {
    mockedInvoke.mockResolvedValueOnce({ ok: true } as never);
    const result = await clearSessionKey({
      profile: "openrouter",
      name: "savant-old-agent-name",
      hash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    });
    expect(result.ok).toBe(true);
    expect(mockedInvoke).toHaveBeenCalledWith("clear_session_key", {
      profile: "openrouter",
      name: "savant-old-agent-name",
      hash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    });
  });
});
