"use client";

// useLoadedConfig — hydrate the runtime AppConfig (provider + modelId)
// from the IPC vault first, then the browser-local cache.
//
// The IPC vault is the durable source of truth. localStorage is the
// fallback for when the vault is empty (fresh install) or the IPC is
// unavailable. Cancels the in-flight load on unmount so setState never
// fires after the component is gone.

import { useEffect, useState } from "react";
import type { SessionKey } from "@/lib/ipc";
import { loadConfig } from "@/lib/ipc";

// localStorage keys for the AppConfig cache. Co-located with the
// hook so the save path (handleSaveModel in settings) and any future
// readers share the exact same strings. Keep them sorted to match
// the order the hook returns fields in.
export const LS_PROVIDER = "savant.provider";
export const LS_MODEL = "savant.openrouter.model";

// localStorage key for the derived (scoped subkey) SessionKey cache
// (FID-0003). The master is vault-only; the renderer reads/writes
// this key for chat outbound auth + cross-tab sync via `storage`
// events. Shape: JSON-encoded SessionKey (see ipc.ts).
export const LS_DERIVED = "savant.session.derived";

export type LoadedConfig = {
  provider: string | null;
  modelId: string | null;
};

/**
 * Parse the raw `LS_DERIVED` value into a typed `SessionKey`,
 * returning `null` on missing or malformed JSON. Shared parser used
 * by both settings + chat pages (Law 13 — utility-first, no
 * duplicate logic across consumers). The cast is a structural
 * assertion — callers should re-validate via the bridge's
 * normalizeProvisionResponse on happy-path writes; this parser is
 * the best-effort read-side.
 */
export function parseDerivedSession(raw: string | null): SessionKey | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionKey;
  } catch {
    return null;
  }
}

export function useLoadedConfig(): LoadedConfig {
  const [config, setConfig] = useState<LoadedConfig>({
    provider: null,
    modelId: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Vault first. If it returns a config, that's authoritative.
      let resolved: LoadedConfig | null = null;
      try {
        const cfg = await loadConfig();
        if (cancelled) return;
        if (cfg) {
          resolved = { provider: cfg.provider, modelId: cfg.modelId };
        }
      } catch {
        // vault unavailable, fall through to localStorage
      }
      if (cancelled) return;

      // 2. localStorage fallback. Only adopted if the vault returned
      //    null. A stale localStorage value never wins over a fresh
      //    vault read.
      if (!resolved && typeof window !== "undefined") {
        const lsProvider = window.localStorage.getItem(LS_PROVIDER);
        const lsModel = window.localStorage.getItem(LS_MODEL);
        if (lsProvider || lsModel) {
          resolved = { provider: lsProvider, modelId: lsModel };
        }
      }
      if (cancelled) return;

      if (resolved) setConfig(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
