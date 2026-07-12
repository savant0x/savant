"use client";

// Chat with Savant — utility-first, two-tier credential architecture.
//
// FID-0003 fix-phase implementation (Level 3 autonomy): chat outbound
// traffic uses `derived.key` from `LS_DERIVED`, NOT the master. The
// master is vault-only and never reaches HTTP traffic directly. If
// LS_DERIVED is empty or invalid (per OQ-3 — strict blocking UI), the
// chat surface is replaced with a blocking <dialog> modal + a Retry
// button. The modal won't auto-dismiss; user must explicitly retry
// after the master is provisioned.
//
// v1 constraints:
//   - No streaming. POST /v1/chat/completions non-stream.
//   - No persistence yet. Messages live in React state.
//   - No multi-turn trimming. Full history each call.
//   - One persona ("Savant") hard-coded system prompt.
//
// Multi-tab: cross-tab LS_DERIVED sync via `storage` event — tab A's
// provision/rotation writes LS_DERIVED, tab B's chat picks it up on
// its next render or via the hook below.

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Card } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  useLoadedConfig,
  LS_DERIVED,
  parseDerivedSession,
} from "@/lib/hooks/use-loaded-config";
import { useDerivedRotation } from "@/lib/hooks/use-derived-rotation";
import { provisionSessionKey, type SessionKey } from "@/lib/ipc";
import { randomHex } from "@/lib/ids";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PROVIDER = "openrouter";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  ts: number;
};

const SAVANT_SOUL =
  "You are Savant, a proactive AI agent built by Spencer. Be concise, " +
  "curious, and act rather than explain. Ask only when clarification is " +
  "essential. Tone is calm, technical, and direct. Avoid fluff, hedging, " +
  "and marketing language. Prefer code or commands over prose when both work.";

// Provisioning state for the blocking <dialog>.
type ProvisioningState = {
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
};

// Parse LS_DERIVED into a typed SessionKey; null on empty/malformed.
// Shared helper `parseDerivedSession` lives in
// `@/lib/hooks/use-loaded-config`.

export default function ChatPage() {
  const [derived, setDerived] = useState<SessionKey | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisional, setProvisional] = useState<ProvisioningState>({
    attempts: 0,
    lastStatus: null,
    lastError: null,
  });
  const listRef = useRef<HTMLDivElement>(null);

  // Mount the daily rotation hook (FID Step 17 — OQ-4 cron). Fires on
  // mount and every minute; rotates LS_DERIVED when ≥24h old. The
  // Settings page also mounts it (no double-fire; React effects are
  // per-component).
  useDerivedRotation();

  // Hydrate derived key on mount + cross-tab sync via `storage` event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDerived(parseDerivedSession(window.localStorage.getItem(LS_DERIVED)));
    const onStorage = (e: StorageEvent): void => {
      if (e.key === LS_DERIVED) {
        setDerived(parseDerivedSession(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const loaded = useLoadedConfig();
  useEffect(() => {
    if (loaded.modelId) setModel(loaded.modelId);
  }, [loaded.modelId]);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, sending]);

  /**
   * OQ-3: retry the provision from chat. Calls provisionSessionKey
   * (the mock IPC holds the master from a prior `setup_master_key`),
   * persists the new SessionKey to LS_DERIVED, and re-hydrates
   * `derived`. Increments `provisional.attempts` per attempt so the
   * modal can show the latest attempt count.
   */
  const retryProvisioning = useCallback(async (): Promise<void> => {
    setProvisional((p) => ({ ...p, attempts: p.attempts + 1 }));
    try {
      const fresh = await provisionSessionKey({
        profile: PROVIDER,
        agentName: `savant-${randomHex(8)}`,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_DERIVED, JSON.stringify(fresh));
      }
      setDerived(fresh);
      setProvisional({ attempts: 0, lastStatus: 201, lastError: null });
    } catch (e) {
      const statusMatch = /\b(\d{3})\b/.exec(
        e instanceof Error ? e.message : String(e),
      );
      setProvisional({
        attempts: 0,
        lastStatus: statusMatch ? Number(statusMatch[1]) : null,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const send = async (): Promise<void> => {
    const text = composer.trim();
    if (!text || !derived || sending) return;

    setError(null);
    setSending(true);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          // OAuth-style header uses the DERIVED subkey, not the
          // master. DevTools Network verification step in FID §
          // Verification confirms this. The master never reaches
          // outbound HTTP traffic.
          Authorization: `Bearer ${derived.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            typeof window !== "undefined"
              ? window.location.origin
              : "https://savant.local",
          "X-Title": "Savant",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SAVANT_SOUL },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 160)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data?.choices?.[0]?.message?.content ?? "(empty reply)";

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        ts: Date.now(),
      };
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        ts: Date.now(),
      };
      setMessages([...messages, userMsg, assistantMsg]);
      setComposer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // OQ-3 strict blocking UI: if LS_DERIVED is missing or invalid, no
  // outbound fetch ever fires. The chat surface is replaced with a
  // blocking <dialog> modal + a Retry button (no auto-retry, per
  // FID §Loop 1 GREEN step 16 — prevents thundering herd against
  // /v1/keys rate limit; user can manually click Retry).
  if (!derived) {
    return (
      <DashboardShell>
        <div className="flex h-full items-center justify-center">
          <Card
            className="max-w-md p-8"
            role="dialog"
            aria-labelledby="provision-modal-title"
            aria-describedby="provision-modal-body"
            aria-live="polite"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Provisioning
            </p>
            <h2
              id="provision-modal-title"
              className="mt-2 font-mono text-base font-semibold uppercase tracking-[0.18em] text-foreground"
            >
              Provisioning Session Credentials
            </h2>
            <p id="provision-modal-body" className="mt-3 text-sm text-muted">
              Waiting on{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent">
                POST /v1/keys
              </code>{" "}
              to return 201. Last attempt status:{" "}
              <span className="font-mono">{provisional.lastStatus ?? "—"}</span>
              .
            </p>
            {provisional.lastError && (
              <p
                className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-danger"
                role="status"
              >
                {provisional.lastError.slice(0, 160)}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => void retryProvisioning()}
                className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/25"
              >
                <i className="fas fa-arrows-rotate" aria-hidden />
                Retry
              </button>
              <a
                href="/settings"
                className="inline-flex items-center gap-2 rounded-md border border-default/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted no-underline transition-colors hover:border-accent hover:text-accent"
              >
                <i className="fas fa-gear" aria-hidden />
                Open Settings
              </a>
            </div>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex h-full flex-col gap-4">
        <div ref={listRef} className="flex-1 overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Savant is listening · session {derived.name} · sk-or-v1-…
                {derived.key.slice(-4)}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[80%] rounded-md border border-default/40 bg-surface/40 px-4 py-3"
                      : "mr-auto max-w-[80%] rounded-md border border-accent/40 bg-accent/5 px-4 py-3"
                  }
                >
                  <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.25em] text-muted">
                    {m.role === "user" ? "You" : "Savant"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {m.content}
                  </p>
                </li>
              ))}
              {sending && (
                <li className="mr-auto max-w-[80%] rounded-md border border-accent/40 bg-accent/5 px-4 py-3">
                  <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.25em] text-muted">
                    Savant
                  </p>
                  <p className="font-mono text-sm text-muted">
                    <span className="animate-pulse">▍</span>
                  </p>
                </li>
              )}
            </ul>
          )}
          {error && (
            <div className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
              <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.25em] text-danger">
                Error
              </p>
              <p className="font-mono text-xs text-foreground">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-end gap-3 border-t border-default/40 pt-4">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Ask Savant… (Enter to send, Shift+Enter for newline)"
            disabled={sending}
            rows={2}
            className="flex-1 resize-none rounded-md border border-default/40 bg-surface/30 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!composer.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent bg-accent/10 text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
            title="Send"
          >
            <i className="fas fa-paper-plane" aria-hidden />
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
