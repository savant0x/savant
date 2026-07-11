"use client";

// Browser preview mock for Tauri IPC.
//
// In a normal browser, @tauri-apps/api/core's `invoke()` fails because there's
// no Tauri runtime. We install @tauri-apps/api/mocks' `mockIPC()` to intercept
// the invoke calls and return realistic data. The renderer code in src/lib/ipc.ts
// doesn't change — it just calls `invoke('setup_master_key', ...)` and the mock
// answers.
//
// Branching is automatic:
//   - Tauri desktop: window.__TAURI_INTERNALS__ is set → no mock, real IPC
//   - Browser preview: window.__TAURI_INTERNALS__ undefined → mock installed

import { mockIPC } from "@tauri-apps/api/mocks";
import type { InvokeArgs } from "@tauri-apps/api/core";
import type { ProfileSummary } from "./ipc";

// Tauri injects __TAURI_INTERNALS__ on the window object when running inside
// the webview. The @tauri-apps/api umbrella doesn't export this as a typed
// property, so we augment Window locally for this module.
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

let mockProfiles: ProfileSummary[] = [];

export function setupMockIPC(): void {
  if (typeof window === "undefined") return; // server-side, no-op
  if (window.__TAURI_INTERNALS__) return; // real Tauri runtime, no mock needed

  // Reset on each setup so the browser preview is repeatable across HMR reloads
  mockProfiles = [];

  // InvokeArgs is a union (Record<string, unknown> | number[] | ...), so
  // we cast to Record<string, unknown> for ergonomic property access on
  // the key/value variant. The mock commands we handle always pass
  // key/value args, so this narrowing is safe.
  mockIPC((cmd: string, payload?: InvokeArgs) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    switch (cmd) {
      case "vault_list_profiles":
        return [...mockProfiles];

      case "setup_master_key": {
        const provider = String(args.provider ?? "openrouter");
        const profile: ProfileSummary = {
          name: `${provider}-default`,
          provider,
          method: "api_key",
          secret_ref_kind: "env",
          base_url:
            provider === "openrouter"
              ? "https://openrouter.ai/api/v1"
              : null,
          updated_at: Math.floor(Date.now() / 1000),
        };
        const idx = mockProfiles.findIndex(
          (p) => p.name === profile.name
        );
        if (idx >= 0) mockProfiles[idx] = profile;
        else mockProfiles.push(profile);
        return null;
      }

      case "infer_openrouter": {
        const prompt = String(args.prompt ?? "");
        const preview = prompt.slice(0, 80);
        return `[mock response — browser preview only] Received ${prompt.length} chars: "${preview}${prompt.length > 80 ? "..." : ""}"`;
      }

      default:
        throw new Error(`Mock IPC: unknown command "${cmd}"`);
    }
  });

  // eslint-disable-next-line no-console
  console.info(
    "[savant] Tauri mock IPC installed (browser preview mode). Run `cargo tauri dev` for real IPC."
  );
}
