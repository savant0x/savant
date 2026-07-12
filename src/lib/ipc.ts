"use client";

// Phase 1 IPC wrappers — minimal type annotations that match the Rust types
// in src-tauri/src/security/master_key.rs (ProfileSummary) and the cmd return
// signatures in src-tauri/src/lib.rs. tauri-specta v2 in Phase 2 will replace
// these hand-written types with auto-generated bindings — see FID-001 "Q-Next"
// section for that work item.
//
// Browser-preview mode: `setupMockIPC()` installs @tauri-apps/api/mocks so the
// renderer works in any browser without a Tauri host. The mock is a no-op
// inside the Tauri webview (window.__TAURI_INTERNALS__ is set there).

import { invoke } from "@tauri-apps/api/core";
import { setupMockIPC } from "./mock-ipc";

setupMockIPC();

export type ProfileSummary = {
  name: string;
  provider: string;
  method: string;
  secret_ref_kind: string;
  base_url: string | null;
  updated_at: number;
};

/** Persist a provider profile (e.g. "openrouter") to the OS app-data vault. */
export async function saveMasterKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  return invoke("setup_master_key", { provider, apiKey });
}

/** Single-shot chat completion against OpenRouter's default profile. */
export async function inferOpenrouter(prompt: string): Promise<string> {
  return invoke("infer_openrouter", { prompt });
}

/** List all profiles currently in the vault (api keys not returned). */
export async function listProfiles(): Promise<ProfileSummary[]> {
  return invoke("vault_list_profiles");
}

export type AppConfig = {
  provider: string;
  modelId: string;
};

/** Persist the runtime config (provider + selected model) to the app vault. */
export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke("save_config", config);
}

/** Load the runtime config from the app vault. Returns null on a fresh install. */
export async function loadConfig(): Promise<AppConfig | null> {
  return invoke("load_config");
}

// ─────────────────────────────────────────────────────────────────
// FID-0003 — Session key derivation (auto-scoped subkey provisioning)
// ─────────────────────────────────────────────────────────────────

// Wire-envelope shape returned by OpenRouter `POST /v1/keys` (verified
// live 2026-07-12 00:55 in dev/fids/0003-auto-derived-session-key.md).
// 20 fields under `data` + 1 top-level sibling `key`.
type ProvisionWireResponse = {
  data?: Record<string, unknown>;
  key?: unknown;
};

/** Normalized SessionKey persisted in `LS_DERIVED` and consumed by chat. */
export type SessionKey = {
  /** 64-char hex; DELETE /v1/keys/<hash> path-segment (NOT `id`). */
  hash: string;
  /** User-supplied on creation; OpenRouter rejects duplicate names. */
  name: string;
  /** Bearer value for `Authorization: Bearer` on chat. Top-level sibling. */
  key: string;
  /** Server-controlled: <prefix>…<suffix>. UI-only — never logged. */
  label: string;
  /** ISO-8601; daily cron ≥24h check reads this. */
  created_at: string;
  /** null = no expiry (OQ-2 inheritance). */
  expires_at: string | null;
  disabled: boolean;
  /** USD cap; null = inherit (OQ-2 inheritance). */
  limit: number | null;
  include_byok_in_limit: boolean;
};

export type ProvisionKeyInput = {
  profile: string;
  agentName: string;
  scope?: {
    limit?: number;
    limitReset?: "daily" | "weekly" | "monthly";
    expiresAt?: string;
  };
};

export type ClearKeyInput = {
  profile: string;
  name: string;
  /** Required — DELETE /v1/keys/<hash>, not <name>. */
  hash: string;
};

/**
 * Flatten the wire envelope to a typed `SessionKey`. Surfaces
 * structured errors for invalid envelopes so the renderer can render
 * the OpenRouter error verbatim (Law 14 — every realistic failure
 * mode has visible feedback, no silent fallbacks).
 */
function normalizeProvisionResponse(wire: ProvisionWireResponse): SessionKey {
  if (!wire || typeof wire !== "object") {
    throw new Error("provision failed: invalid response envelope");
  }
  const data = wire.data;
  if (!data || typeof data !== "object") {
    throw new Error("provision failed: missing data envelope");
  }
  if (data["disabled"] === true) {
    throw new Error(
      "provision failed: OpenRouter returned `disabled: true` for subkey",
    );
  }
  const hash = data["hash"];
  const name = data["name"];
  const label = data["label"];
  const created = data["created_at"];
  if (
    typeof hash !== "string" ||
    typeof name !== "string" ||
    typeof label !== "string" ||
    typeof created !== "string"
  ) {
    throw new Error(
      "provision failed: malformed data envelope — missing hash/name/label/created_at",
    );
  }
  const topKey = wire.key;
  if (typeof topKey !== "string" || !topKey.startsWith("sk-or-v1-")) {
    throw new Error(
      "provision failed: malformed response — missing or invalid top-level `key`",
    );
  }
  const expRaw = data["expires_at"];
  const expires_at = typeof expRaw === "string" ? expRaw : null;
  const limitRaw = data["limit"];
  const limit = typeof limitRaw === "number" ? limitRaw : null;
  return {
    hash,
    name,
    key: topKey,
    label,
    created_at: created,
    expires_at,
    disabled: false,
    limit,
    include_byok_in_limit: Boolean(data["include_byok_in_limit"] ?? false),
  };
}

/**
 * Provision a scoped subkey from the IPC vault. Calls the
 * `provision_session_key` Tauri command (browser-preview: mocked in
 * `mock-ipc.ts` to actually hit OpenRouter `/v1/keys`).
 */
export async function provisionSessionKey(
  input: ProvisionKeyInput,
): Promise<SessionKey> {
  const wire = await invoke<ProvisionWireResponse>(
    "provision_session_key",
    input,
  );
  try {
    return normalizeProvisionResponse(wire);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "[savant] provision normalize failed",
      JSON.stringify({
        input_profile: input.profile,
        input_agent: input.agentName,
        code: "openrouter_provision_status_parser",
        agent_name: input.agentName.slice(-4),
      }),
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

/**
 * Delete a previously-provisioned subkey from OpenRouter. DELETE is
 * by `hash`, not `name` (verified live 2026-07-12 00:55). Returns
 * `{ ok: boolean }` — failure surfaces to the renderer, never silently.
 */
export async function clearSessionKey(
  input: ClearKeyInput,
): Promise<{ ok: boolean }> {
  return invoke<{ ok: boolean }>("clear_session_key", input);
}
