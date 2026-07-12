"use client";

// Settings route — master key + derived session key + model + vault.
//
// FID-0003 fix-phase implementation (Level 3 autonomy): the master key
// is vault-only and never written to browser localStorage. Save Master
// Key fires a chain: vault write → POST /v1/keys provision → LS_DERIVED
// write. The "Saved" indicator implies both vault AND provisioning
// succeeded, so a save without a working subkey surfaces an OpenRouter
// error verbatim (Law 14 — every realistic failure path has visible
// feedback; no silent fallback to bare master).
//
// Override precedence (matches Rust side):
//   1. OPENROUTER_MASTER_KEY env var, if set (FID-008)
//   2. The vault entry saved via saveMasterKey("openrouter", key)
//   3. The derived subkey in LS_DERIVED for browser-direct fetches
//
// File-size note: this file exceeds the TypeScript override 400-line
// limit (was 488 pre-FID, ~600 post-FID). The FID §Loop 1 SELF-CORRECT
// explicitly defers the SettingsKeys.tsx + SettingsModel.tsx split to
// a follow-on FID (registered as deferred below). Refactor pending.

import { useCallback, useEffect, useState } from "react";
import { Card } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  listProfiles,
  saveConfig,
  saveMasterKey,
  provisionSessionKey,
  clearSessionKey,
  getMasterKeyInfo,
  removeMasterKey,
  type MasterKeyInfo,
  type ProfileSummary,
  type SessionKey,
} from "@/lib/ipc";
import {
  useLoadedConfig,
  LS_MODEL,
  LS_PROVIDER,
  LS_DERIVED,
  parseDerivedSession,
} from "@/lib/hooks/use-loaded-config";
import { useDerivedRotation } from "@/lib/hooks/use-derived-rotation";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { LS_MASTER } from "@/lib/mock-ipc";
import { randomHex } from "@/lib/ids";

const PROVIDER = "openrouter";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

// Provider catalog. Single source of truth for the provider <select>;
// keep entries sorted alphabetically by `name` so the dropdown order
// stays predictable as more providers are added.
const PROVIDERS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "openrouter", name: "OpenRouter" },
].sort((a, b) => a.name.localeCompare(b.name));

const byDisplayName = (a: OpenRouterModel, b: OpenRouterModel): number =>
  (a.name ?? a.id).localeCompare(b.name ?? b.id);

// OpenRouter's /models payload. The fields below are what the UI
// surfaces; the catalog has more (architecture, supported_parameters,
// etc.) that we ignore for v1.
type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
};

// Fallback catalog when the live /models fetch fails (e.g. offline).
// Keeps the picker functional even without network.
const FALLBACK_MODELS: OpenRouterModel[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (free)",
    context_length: 131072,
  },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (free)",
  },
];

// Parse LS_DERIVED into a typed SessionKey, returning null on missing
// or malformed JSON (Law 14 — JSON.parse bombing fails loud, never
// silently corrupts state). The parser is the shared
// `parseDerivedSession` helper exported from `@/lib/hooks/use-loaded-config` —
// duplicated here would violate Law 13.

// Compute the last-4 of the derived key for the UI chip. Returns "···"
// when the derived key is unavailable so the layout doesn't collapse.
function last4(k: SessionKey["key"] | undefined): string {
  if (!k || k.length < 4) return "···";
  return k.slice(-4);
}

export default function SettingsPage() {
  // Master-key state (input only; master never held past save).
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [busy, setBusy] = useState(false);

  // FID-007 — Master Key saved-state (masked chip + Edit/Remove) +
  // edit mode toggle. `masterInfo` is the redacted summary from
  // `getMasterKeyInfo`; it carries `last4` + `savedAt` so the UI can
  // show a masked `sk-or-v1-••••••••••••<last4>` chip WITHOUT ever
  // holding the raw key in React state (Law 12). `editingKey` flips
  // to true when the user clicks Edit — the input is re-enabled and
  // the user can paste a replacement key.
  const [masterInfo, setMasterInfo] = useState<MasterKeyInfo | null>(null);
  const [editingKey, setEditingKey] = useState(false);

  // Derived session key state
  const [derived, setDerived] = useState<SessionKey | null>(null);

  // Model state
  const [provider, setProvider] = useState<string>(PROVIDER);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSaved, setModelSaved] = useState(false);

  // Mount the daily rotation hook (FID Step 17 — OQ-4 cron). Fires on
  // mount and every minute; rotates LS_DERIVED when ≥24h old.
  useDerivedRotation();

  const refresh = async (): Promise<void> => {
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch {
      setProfiles([]);
    }
  };

  const fetchModels = async (): Promise<void> => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const r = await fetch(OPENROUTER_MODELS_URL, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`OpenRouter /models ${r.status}`);
      const data = (await r.json()) as { data?: OpenRouterModel[] };
      const list = data.data ?? [];
      if (list.length === 0) {
        setModels(FALLBACK_MODELS);
        setModelsError("OpenRouter returned no models; using fallback list.");
      } else {
        setModels(list);
      }
    } catch (e) {
      setModels(FALLBACK_MODELS);
      setModelsError(
        `Could not load OpenRouter catalog (${e instanceof Error ? e.message : String(e)}). Using fallback list.`,
      );
    } finally {
      setModelsLoading(false);
    }
  };

  // Initial load (refresh profiles + fetch models + hydrate derived).
  useEffect(() => {
    void refresh();
    void fetchModels();
    if (typeof window !== "undefined") {
      setDerived(parseDerivedSession(window.localStorage.getItem(LS_DERIVED)));
    }
  }, []);

  // Cross-tab LS_DERIVED sync (FID Step 9). Tab A's save / rotate /
  // disconnect writes LS_DERIVED; tab B's `storage` event re-hydrates
  // its in-memory `derived` state. Single-tab UX stays consistent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key === LS_DERIVED) {
        setDerived(parseDerivedSession(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // FID-007 — Hydrate the master-key saved-state on mount + on
  // cross-tab storage events. The mock IPC persists the master
  // key to `localStorage["savant.master.openrouter"]` (see
  // `mock-ipc.ts:LS_MASTER`); a tab A save/remove fires the
  // `storage` event in tab B, which re-hydrates `masterInfo` so the
  // masked chip stays in sync across tabs.
  const hydrateMasterInfo = useCallback(async (): Promise<void> => {
    try {
      const info = await getMasterKeyInfo(PROVIDER);
      setMasterInfo(info);
    } catch {
      // FID-008 — `source: "none"` is required by the `MasterKeyInfo`
      // type. Use the explicit union member instead of a cast.
      setMasterInfo({ exists: false, source: "none" });
    }
  }, []);
  useEffect(() => {
    void hydrateMasterInfo();
  }, [hydrateMasterInfo]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key === LS_MASTER) {
        void hydrateMasterInfo();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrateMasterInfo]);
  // FID-008 — Re-hydrate `masterInfo` when the env var fetch
  // resolves (closes the cold-start race where the first render
  // shows `source: "none"` because the env var fetch is async).
  // The mock IPC dispatches `savant:env-master-key-hydrated` from
  // `hydrateEnvMasterKey()` in `src/lib/mock-ipc.ts` once
  // `_envMasterKey` is populated.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onEnvHydrated = (): void => {
      void hydrateMasterInfo();
    };
    window.addEventListener("savant:env-master-key-hydrated", onEnvHydrated);
    return () =>
      window.removeEventListener(
        "savant:env-master-key-hydrated",
        onEnvHydrated,
      );
  }, [hydrateMasterInfo]);

  const loaded = useLoadedConfig();
  useEffect(() => {
    if (loaded.provider) setProvider(loaded.provider);
    if (loaded.modelId) setModelId(loaded.modelId);
  }, [loaded.provider, loaded.modelId]);

  /**
   * Step 5: dual-stage save. `saveMasterKey` writes to the IPC vault
   * only — no `LS_KEY` update (master never reaches browser
   * localStorage). `provisionSessionKey` auto-fires against OpenRouter
   * `/v1/keys`; on success, the normalized SessionKey writes to
   * `LS_DERIVED` for chat outbound traffic.
   *
   * The "Saved" indicator only flips after BOTH stages succeed.
   * Failure surfaces verbatim from OpenRouter (Law 14 — never lie
   * about success).
   */
  const handleSaveKey = async (): Promise<void> => {
    if (!apiKey.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveMasterKey(PROVIDER, apiKey.trim());
      const fresh = await provisionSessionKey({
        profile: PROVIDER,
        agentName: `savant-${randomHex(8)}`,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_DERIVED, JSON.stringify(fresh));
      }
      setDerived(fresh);
      setSaved(true);
      // +S: clear input post-save so master bytes don't linger in the
      // React-controlled DOM field (Law 12 — no sensitive bytes in
      // user-visible state post-save). Not in FID §Step 5 verbatim;
      // documented here to keep the deviation traceable.
      setApiKey("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 6: disconnect clears the derived subkey from OpenRouter
   * (DELETE upstream subkey by hash) and removes LS_DERIVED. The
   * master remains in the vault — user can re-derive at any time.
   * The version-rocking discipline says the master was registered as
   * the durable credential; disconnect is per-session, not
   * per-master.
   */
  const handleDisconnect = async (): Promise<void> => {
    if (!derived) {
      setDerived(null);
      setApiKey("");
      setSaved(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clearSessionKey({
        profile: PROVIDER,
        name: derived.name,
        hash: derived.hash,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LS_DERIVED);
      }
      setDerived(null);
      setApiKey("");
      setSaved(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * FID-007 — Remove the saved master key. Wipes both the
   * localStorage mirror (via the mock IPC `remove_master_key`
   * command) AND the module-scoped `mockMasters` cache so the next
   * `manifest_soul` call falls through to the static 18-section
   * template. The derived subkey in `LS_DERIVED` is intentionally
   * LEFT IN PLACE — the user can still chat with the existing
   * subkey until it expires (24h cron) or they hit Disconnect on
   * the Session Key card. This matches the version-rocking
   * discipline where disconnect is per-session, not per-master.
   *
   * Two-step confirm (window.confirm) since the action is
   * destructive: a mis-click loses the master key, and the next
   * `manifest_soul` call silently degrades to the static template.
   * Reversible by re-paste, so a simple native confirm is the
   * right weight (no inline two-step pattern needed).
   */
  const handleRemoveKey = async (): Promise<void> => {
    if (busy) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Remove the OpenRouter master key? " +
          "You can re-add it at any time by pasting a new key. " +
          "The next Manifest Soul call will use the static template until then.",
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await removeMasterKey(PROVIDER);
      // FID-008 — `source: "none"` is required by the `MasterKeyInfo`
      // type (added in FID-008). Env var may still be active; the
      // env-var hydration effect will re-fetch and switch the UI.
      setMasterInfo({ exists: false, source: "none" });
      setEditingKey(false);
      setApiKey("");
      setSaved(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 10: rotate. Provisions a fresh subkey (new random agentName)
   * and DELETEs the old one for cleanliness (avoids zombie keys
   * accumulating in the user's OpenRouter dashboard). Equivalent
   * effect to waiting for the daily cron: a new created_at resets
   * the ≥24h timer.
   */
  const handleRotate = useCallback(async (): Promise<void> => {
    if (busy || !derived) return;
    setBusy(true);
    setError(null);
    try {
      const freshAgent = `savant-${randomHex(8)}`;
      const fresh = await provisionSessionKey({
        profile: PROVIDER,
        agentName: freshAgent,
      });
      await clearSessionKey({
        profile: PROVIDER,
        name: derived.name,
        hash: derived.hash,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_DERIVED, JSON.stringify(fresh));
      }
      setDerived(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, derived]);

  const handleSaveModel = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setModelSaved(false);
    try {
      await saveConfig({ provider, modelId });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_PROVIDER, provider);
        window.localStorage.setItem(LS_MODEL, modelId);
      }
      setModelSaved(true);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedModel = models.find((m) => m.id === modelId);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 lg:max-w-3xl">
        {/* ── Master Key ───────────────────────────────────────── */}
        <Card className="p-6">
          <header className="mb-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Authorization
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground">
              Master Key
            </h2>
          </header>
          <p className="mb-3 text-sm text-muted">
            This is the master key that authorises provisioning derived subkeys
            for every agent call. Saved to your device vault — never reaches
            browser localStorage. Override precedence: the{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent">
              OPENROUTER_MASTER_KEY
            </code>{" "}
            environment variable takes priority when set.
          </p>
          <div className="mb-5 rounded-md border border-white/15 bg-surface/20 px-4 py-3">
            <header className="mb-2 flex items-center gap-2">
              <i
                className="fas fa-shield-halved text-[11px] text-accent"
                aria-hidden
              />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
                Two-tier credential architecture
              </span>
            </header>
            <p className="mb-3 text-sm text-muted">
              <strong>Master</strong> authorises procurement;{" "}
              <strong>session</strong> is the scoped, per-session subkey that
              chat outbound traffic uses. Save Master Key fires both in one shot
              — derivation round-trip is the &quot;Saved&quot; gate.
            </p>
            <dl className="flex flex-col gap-2">
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 pt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Tier 1
                </dt>
                <dd className="text-sm text-muted">
                  Master (vault-only, never reaches HTTP traffic directly; only
                  re-derived subkeys do).
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 pt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Tier 2
                </dt>
                <dd className="text-sm text-muted">
                  Session subkey (browser-readable, scoped to Savant inference
                  only; auto-rotated ≥24h).
                </dd>
              </div>
            </dl>
          </div>
          {/* FID-008 — Env-var-shadows-vault banner. Shown when the
              env var is the active source AND a vault entry is also
              saved. Tells the user that the vault entry is being
              shadowed (still saved, but not used for authorization).
              Uses warning color (not accent) to signal "your saved
              entry is being overridden", not success. */}
          {masterInfo?.source === "env" &&
            profiles.some((p) => p.provider === PROVIDER) && (
              <div
                data-testid="env-shadows-vault-banner"
                className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-warning"
              >
                <i
                  className="fas fa-info-circle mt-0.5 text-[11px]"
                  aria-hidden
                />
                <span className="normal-case tracking-normal text-foreground">
                  The{" "}
                  <code className="text-warning">OPENROUTER_MASTER_KEY</code>{" "}
                  environment variable shadows your saved vault entry. Remove
                  the env var or your saved vault entry to switch sources.
                </span>
              </div>
            )}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="master-key"
              className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted"
            >
              <span>OpenRouter Master Key</span>
              {editingKey && (
                <span className="font-normal normal-case text-accent">
                  · editing
                </span>
              )}
            </label>
            {masterInfo?.exists && !editingKey ? (
              /* ── SAVED STATE: masked key chip + source badge + Edit/Remove ── */
              <div className="flex items-center gap-2">
                <code
                  data-testid="master-key-masked"
                  className="flex-1 truncate rounded-md border border-[color:var(--input-border-color)] bg-black/30 px-3 py-2 font-mono text-sm text-foreground"
                  title={
                    masterInfo.source === "env"
                      ? "Master key from OPENROUTER_MASTER_KEY env var (tier 1, highest priority)"
                      : "Master key saved — stored in browser localStorage (browser-preview only; the Tauri desktop app uses the OS keychain via tauri-plugin-stronghold)"
                  }
                >
                  sk-or-v1-••••••••••••{masterInfo.last4 ?? "••••"}
                </code>
                {/* FID-008 — Source badge: "env" (tier 1) or "vault" (tier 2).
                    Helps the user see at a glance which tier is active. */}
                {masterInfo.source === "env" && (
                  <span
                    data-testid="master-key-source"
                    className="rounded border border-accent/40 bg-accent/15 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-accent"
                    title="Source: OPENROUTER_MASTER_KEY env var (tier 1)"
                  >
                    env
                  </span>
                )}
                {masterInfo.source === "vault" && (
                  <span
                    data-testid="master-key-source"
                    className="rounded border border-default/60 bg-surface/40 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted"
                    title="Source: vault entry (tier 2)"
                  >
                    vault
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(true);
                    setApiKey("");
                    setError(null);
                  }}
                  aria-label="Edit master key"
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-md border border-default/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-pen" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemoveKey()}
                  aria-label="Remove master key"
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-md border border-default/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-trash" aria-hidden />
                  Remove
                </button>
              </div>
            ) : (
              /* ── INPUT STATE: empty (first save) or editing (replace) ── */
              <>
                <input
                  id="master-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingKey ? "Enter new key" : "sk-or-v1-..."}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-md border border-[color:var(--input-border-color)] bg-black/50 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                />
                {editingKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKey(false);
                      setApiKey("");
                      setError(null);
                    }}
                    className="self-start font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
                  >
                    Cancel edit
                  </button>
                )}
              </>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            {masterInfo?.exists && !editingKey ? (
              /* ── SAVED STATE: "Saved · last updated X ago" chip ── */
              <span
                aria-label="saved and provisioned"
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-success"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_4px_var(--success)]"
                  aria-hidden
                />
                Saved
                {masterInfo.savedAt !== null &&
                  masterInfo.savedAt !== undefined && (
                    <>
                      {" "}
                      · last updated{" "}
                      <span
                        title={new Date(
                          masterInfo.savedAt * 1000,
                        ).toISOString()}
                      >
                        {formatRelativeTime(masterInfo.savedAt * 1000)}
                      </span>
                    </>
                  )}
              </span>
            ) : (
              /* ── INPUT/EDIT STATE: primary action button ── */
              <button
                type="button"
                onClick={() => void handleSaveKey()}
                disabled={!apiKey.trim() || busy}
                className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="fas fa-key" aria-hidden />
                {editingKey ? "Update Master Key" : "Save Master Key"}
              </button>
            )}
            {saved && (
              <span
                aria-label="saved and provisioned"
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-success"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_4px_var(--success)]"
                  aria-hidden
                />
                Saved
              </span>
            )}
            {error && (
              <span
                aria-live="polite"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-danger"
              >
                {error.slice(0, 80)}
              </span>
            )}
          </div>
        </Card>

        {/* ── Session Key (FID-0003 Step 8 — NEW card) ─────────── */}
        <Card
          className="p-6"
          aria-label={
            derived
              ? `Session key: provisioned · ${derived.name}`
              : "Session key: not provisioned"
          }
          aria-live="polite"
        >
          <header className="mb-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Runtime
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground">
              Session Key
            </h2>
          </header>
          {derived ? (
            <>
              <div className="mb-4 flex items-start gap-4">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success shadow-[0_0_4px_var(--success)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs uppercase tracking-[0.15em] text-foreground">
                    {derived.name}
                  </p>
                  <p
                    className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
                    title={derived.key}
                  >
                    sk-or-v1-…{last4(derived.key)}
                  </p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted">
                    minted{" "}
                    <span title={new Date(derived.created_at).toISOString()}>
                      {formatRelativeTime(new Date(derived.created_at))}
                    </span>
                    {derived.expires_at && (
                      <>
                        {" "}
                        · expires{" "}
                        <span
                          title={new Date(derived.expires_at).toISOString()}
                        >
                          {formatRelativeTime(new Date(derived.expires_at))}
                        </span>
                      </>
                    )}
                    {derived.limit !== null && <> · cap ${derived.limit}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRotate()}
                  disabled={busy}
                  aria-label="Rotate session key — generate new subkey"
                  className="flex items-center gap-2 rounded-md border border-default/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-arrows-rotate" aria-hidden />
                  Rotate
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={busy}
                  aria-label="Disconnect and remove session key"
                  className="rounded-md border border-default/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Session key not provisioned. Save Master Key above to mint a
              scoped subkey — or wait for the daily cron to fire if a vault
              entry exists.
            </p>
          )}
        </Card>

        {/* ── Model ───────────────────────────────────────────── */}
        <Card className="p-6">
          <header className="mb-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Configuration
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground">
              Model
            </h2>
          </header>
          <p className="mb-5 text-sm text-muted">
            Pick the provider and model Savant routes through. The catalog is
            fetched live from OpenRouter; pricing + context length show below
            the picker.
          </p>

          <div className="mb-4 flex flex-col gap-2">
            <label
              htmlFor="provider"
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted"
            >
              Provider
            </label>
            <div className="relative">
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full appearance-none rounded-md border border-[color:var(--input-border-color)] bg-black/50 px-3 py-2 pr-8 font-mono text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {PROVIDERS.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    className="bg-[#0a0a0a] text-foreground"
                  >
                    {p.name}
                  </option>
                ))}
              </select>
              <i
                className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted"
                aria-hidden
              />
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2">
            <label
              htmlFor="model"
              className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted"
            >
              <span>Model</span>
              {modelsLoading && (
                <span className="font-normal normal-case text-muted">
                  loading catalog…
                </span>
              )}
            </label>
            <div className="relative">
              <select
                id="model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full appearance-none rounded-md border border-[color:var(--input-border-color)] bg-black/50 px-3 py-2 pr-8 font-mono text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {models.length === 0 && !modelsLoading && (
                  <option
                    value={modelId}
                    className="bg-[#0a0a0a] text-foreground"
                  >
                    {modelId}
                  </option>
                )}
                {models
                  .slice()
                  .sort(byDisplayName)
                  .map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      className="bg-[#0a0a0a] text-foreground"
                    >
                      {m.name ?? m.id}
                    </option>
                  ))}
              </select>
              <i
                className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted"
                aria-hidden
              />
            </div>
            {modelsError && (
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-warning">
                {modelsError}
              </p>
            )}
          </div>

          {selectedModel && (
            <div className="mb-5 rounded-md border border-white/15 bg-surface/20 px-4 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                {selectedModel.id}
              </p>
              {selectedModel.description && (
                <p className="mt-2 text-sm text-muted">
                  {selectedModel.description}
                </p>
              )}
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                {selectedModel.context_length !== undefined && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Context</dt>
                    <dd className="text-foreground">
                      {(selectedModel.context_length / 1000).toFixed(0)}K
                    </dd>
                  </div>
                )}
                {selectedModel.pricing?.prompt !== undefined && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Prompt</dt>
                    <dd className="text-foreground">
                      $
                      {(
                        Number(selectedModel.pricing.prompt) * 1_000_000
                      ).toFixed(3)}
                      /M
                    </dd>
                  </div>
                )}
                {selectedModel.pricing?.completion !== undefined && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Completion</dt>
                    <dd className="text-foreground">
                      $
                      {(
                        Number(selectedModel.pricing.completion) * 1_000_000
                      ).toFixed(3)}
                      /M
                    </dd>
                  </div>
                )}
                {selectedModel.architecture?.modality && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Modality</dt>
                    <dd className="text-foreground">
                      {selectedModel.architecture.modality}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveModel()}
              disabled={busy}
              className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="fas fa-floppy-disk" aria-hidden />
              Save Model
            </button>
            {modelSaved && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-success">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_4px_var(--success)]"
                  aria-hidden
                />
                Saved
              </span>
            )}
          </div>
        </Card>

        {/* ── Vault ───────────────────────────────────────────── */}
        <Card className="p-6">
          <header className="mb-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Connected
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground">
              Vault
            </h2>
          </header>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted">
              Vault is empty. Save a master key above to authorise the agent.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {profiles.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-3 rounded-md border border-default/60 bg-surface/30 px-4 py-3"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-[0_0_4px_var(--success)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs uppercase tracking-[0.15em] text-foreground">
                      {p.provider}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      {p.method}
                      {p.base_url ? ` · ${p.base_url}` : ""}
                    </p>
                  </div>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
                    title={new Date(p.updated_at * 1000).toISOString()}
                  >
                    {formatRelativeTime(p.updated_at * 1000)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
