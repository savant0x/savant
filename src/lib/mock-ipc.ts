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
import type { AppConfig, ProfileSummary } from "./ipc";

// Tauri injects __TAURI_INTERNALS__ on the window object when running inside
// the webview. The @tauri-apps/api umbrella doesn't export this as a typed
// property, so we augment Window locally for this module.
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

let mockProfiles: ProfileSummary[] = [];
let mockConfig: AppConfig | null = null;

// Per-profile master key mirror — populated by `setup_master_key` so
// `provision_session_key` + `clear_session_key` can authorize their
// real `/v1/keys` HTTP calls. Master bytes never leave this module;
// chat outbound traffic only sees the derived (subkey) `key` field.
let mockMasters: Record<string, string> = {};

// Full wire-envelope responses keyed by `${profile}:${agentName}` for
// regression inspection. The renderer never sees these directly — they
// flow through `normalizeProvisionResponse` in `../lib/ipc.ts`.
const mockReports: Record<
  string,
  { data: Record<string, unknown>; key: string }
> = {};

const OPENROUTER_PROVISION_URL = "https://openrouter.ai/api/v1/keys";
const OPENROUTER_DELETE_KEY_URL_FMT = (hash: string): string =>
  `https://openrouter.ai/api/v1/keys/${hash}`;

export function setupMockIPC(): void {
  if (typeof window === "undefined") return; // server-side, no-op
  if (window.__TAURI_INTERNALS__) return; // real Tauri runtime, no mock needed

  // Reset on each setup so the browser preview is repeatable across HMR reloads
  mockProfiles = [];
  mockConfig = null;
  mockMasters = {};
  for (const k of Object.keys(mockReports)) delete mockReports[k];

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
        const apiKey = String(args.apiKey ?? "");
        // Capture master per profile so sibling commands can authorize
        // their real fetch. Module-scoped; master bytes never leave.
        mockMasters[provider] = apiKey;
        const profile: ProfileSummary = {
          name: `${provider}-default`,
          provider,
          method: "api_key",
          secret_ref_kind: "env",
          base_url:
            provider === "openrouter" ? "https://openrouter.ai/api/v1" : null,
          updated_at: Math.floor(Date.now() / 1000),
        };
        const idx = mockProfiles.findIndex((p) => p.name === profile.name);
        if (idx >= 0) mockProfiles[idx] = profile;
        else mockProfiles.push(profile);
        return null;
      }

      // Provision a scoped subkey from OpenRouter `/v1/keys`. Real
      // HTTP call (mock IPC's realness principle, FID Lessons Learned).
      // Output is the RAW wire envelope (data + top-level key); the
      // bridge's `normalizeProvisionResponse` flattens it to
      // `SessionKey` for the renderer.
      case "provision_session_key": {
        const profile = String(args.profile ?? "openrouter");
        const agentName = String(args.agentName ?? "");
        const master = mockMasters[profile];
        if (!master) {
          throw new Error(
            `Mock IPC: no master captured for profile '${profile}'. Call setup_master_key first.`,
          );
        }
        const body: Record<string, unknown> = { name: agentName };
        const scope = args.scope as
          | { limit?: number; limitReset?: string; expiresAt?: string }
          | undefined;
        if (scope?.limit !== undefined) body["limit"] = scope.limit;
        if (scope?.limitReset) body["limit_reset"] = scope.limitReset;
        if (scope?.expiresAt) body["expires_at"] = scope.expiresAt;

        // Fire-and-forget on a then-chain so we're synchronous-shaped
        // for the mock return — but the mockIPC callback returns the
        // Promise so awaiting is fine in practice.
        const wire$: Promise<{ data: Record<string, unknown>; key: string }> =
          (async () => {
            const response = await fetch(OPENROUTER_PROVISION_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${master}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
            if (!response.ok) {
              const text = await response.text();
              throw new Error(
                `Mock IPC: OpenRouter /v1/keys ${response.status}: ${text.slice(0, 200)}`,
              );
            }
            const parsed = (await response.json()) as {
              data: Record<string, unknown>;
              key: string;
            };
            mockReports[`${profile}:${agentName}`] = parsed;
            return parsed;
          })();
        // Resolve the async fetch via the return Promise; mockIPC
        // accepts async returns, so this propagates correctly to
        // `await invoke(...)` in the IPC bridge.
        return wire$;
      }

      // Delete a previously-provisioned subkey. Real DELETE call;
      // DELETE is by `hash`, not `name` (verified live 2026-07-12).
      // The signature still carries `name` for traceability on the
      // upstream call site (it's the human-readable label of the
      // subkey being deleted) but the mock doesn't need it for the
      // HTTP DELETE path-segment.
      case "clear_session_key": {
        const profile = String(args.profile ?? "openrouter");
        const hash = String(args.hash ?? "");
        const master = mockMasters[profile];
        if (!master || !hash) {
          // Silent { ok: false } on disconnect-without-master so the
          // renderer can keep the UX flat (failure surfaces in
          // already-rendered error banner, not as a new exception).
          return { ok: false };
        }
        const response$ = fetch(OPENROUTER_DELETE_KEY_URL_FMT(hash), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${master}` },
        }).then((response) => {
          // Cleanup the report entry on response (success or failure:
          // local cache invalidation is independent of upstream ack).
          for (const k of Object.keys(mockReports)) {
            const r = mockReports[k];
            if (
              k.startsWith(`${profile}:`) &&
              typeof r?.data?.["hash"] === "string" &&
              r.data["hash"] === hash
            ) {
              delete mockReports[k];
            }
          }
          return { ok: response.ok };
        });
        return response$;
      }

      case "infer_openrouter": {
        const prompt = String(args.prompt ?? "");
        const preview = prompt.slice(0, 80);
        return `[mock response — browser preview only] Received ${prompt.length} chars: "${preview}${prompt.length > 80 ? "..." : ""}"`;
      }

      case "save_config": {
        const provider = String(args.provider ?? "openrouter");
        const modelId = String(args.modelId ?? "");
        mockConfig = { provider, modelId };
        return null;
      }

      case "load_config": {
        return mockConfig;
      }

      default:
        throw new Error(`Mock IPC: unknown command "${cmd}"`);
    }
  });

  // eslint-disable-next-line no-console
  console.info(
    "[savant] Tauri mock IPC installed (browser preview mode). Run `cargo tauri dev` for real IPC.",
  );
}
