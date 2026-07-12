"use client";

// useDerivedRotation — daily cron for the derived subkey.
//
// Fires on mount + every minute thereafter. If the `LS_DERIVED`
// SessionKey's `created_at` is ≥24h old, provisions a fresh subkey
// (new agent_name) and DELETEs the prior subkey via `clearSessionKey`.
// Per FID-0003 OQ-4 implementation, the strict spec is "≥24h from
// last created_at" — a 24h-old key replaces itself on the next tick.
// Manual Rotate button on the Settings card calls the same provision
// path immediately (sets a fresh `created_at` equivalent to the cron
// firing).
//
// Mount-time scan runs once on mount regardless of interval — catches
// user re-visits after long absences.
//
// Multi-tab note: every mounted instance of this hook will fire on
// the same minute-tick boundary; there's no cross-tab lock. Document
// in an FID's "Out of scope (deferred FIDs)" follow-on if the
// thundering-herd becomes a real OpenRouter rate-limit concern (not
// observed in v1 browser-preview usage).

import { useEffect } from "react";
import { LS_DERIVED } from "@/lib/hooks/use-loaded-config";
import { randomHex } from "@/lib/ids";
import {
  provisionSessionKey,
  clearSessionKey,
  type SessionKey,
} from "@/lib/ipc";
import { logger } from "@/lib/logger";

const PROVIDER = "openrouter";
const ROTATION_INTERVAL_MS = 60_000;
const ROTATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function useDerivedRotation(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = async (): Promise<void> => {
      const raw = window.localStorage.getItem(LS_DERIVED);
      if (!raw) return;

      let parsed: SessionKey;
      try {
        parsed = JSON.parse(raw) as SessionKey;
      } catch {
        // Bad JSON — leave alone; chat's blocking modal surfaces the
        // parse error to the user on next render.
        return;
      }

      const createdMs = Date.parse(parsed.created_at);
      if (Number.isNaN(createdMs)) return;
      const ageMs = Date.now() - createdMs;
      if (ageMs < ROTATION_THRESHOLD_MS) return;

      const freshAgent = `savant-${randomHex(8)}`;
      try {
        const fresh = await provisionSessionKey({
          profile: PROVIDER,
          agentName: freshAgent,
        });
        await clearSessionKey({
          profile: PROVIDER,
          name: parsed.name,
          hash: parsed.hash,
        });
        window.localStorage.setItem(LS_DERIVED, JSON.stringify(fresh));
        // ECHO Law 12 — the `redact()` helper strips hash + key
        // fields from the context before logging, so this line is
        // safe to leave in production builds.
        logger.info("session key rotated (24h cron)", {
          old_hash_suffix: parsed.hash.slice(-4),
          new_agent_suffix: freshAgent.slice(-4),
        });
      } catch (e) {
        logger.warn(
          "rotation failed",
          {
            code: "rotation_error",
            old_hash_suffix: parsed.hash.slice(-4),
            new_agent_suffix: freshAgent.slice(-4),
          },
          e,
        );
        // Leave old LS_DERIVED in place; chat still works with
        // existing key; user can retry via the Rotate button.
      }
    };

    void tick();
    const id = window.setInterval(tick, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);
}
