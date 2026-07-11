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
  apiKey: string
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
