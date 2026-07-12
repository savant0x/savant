"use client";

// /manifest — FID-006 v3 Soul Builder.
//
// 3 sections in vertical order (v2 reopen 2026-07-13, after Spencer's
// 8-point feedback on the v1 implementation):
//   1. Soul Manifestation Engine — builder form (name + die icon +
//      prompt + tier + submit). Dispatches `manifest_soul` IPC;
//      Pending→Ready status; persists to localStorage["LS_SOUL_BUILT"].
//   2. Draft Buffer — enterprise-grade metadata + rating grid +
//      character counter + soul body + Copy/Revert. Replaces the
//      v1 "terrible" single-card view.
//   3. Swarm Deployment — collapsible (was wasting space when not
//      generating multiple souls).
//
// v2 changes (2026-07-13 hotfix, FID-006 v3 v2 reopen):
//   - System prompt rewritten (src/lib/soul-generation-system-prompt.ts)
//     to add "CRITICAL DIRECTIVE: PROMPT-DRIVEN IDENTITY" + domain-
//     specific qualifiers. The v1 prompt produced 90% filler content
//     that ignored the user's prompt (e.g., "hustler" → generic
//     INTJ/architect template).
//   - Section 2 redesigned with metadata grid (4 cards: NAME, TIER,
//     STATUS, GENERATED) + rating grid (5 cards: LINES, SECTIONS,
//     DEPTH, HASH, INFRA) + character counter (moved from Section 1).
//   - Die icon (`fa-dice`) next to the name input generates a random
//     name from a curated list (Prometheus, Athena, Nova, etc.).
//   - Tier `<select>` given `colorScheme: "dark"` + `bg-[color:var(--surface)]`
//     to fix the white dropdown background in dark mode.
//   - Section 3 wrapped in `<details>` (closed by default).
//   - Section 4 REMOVED — was showing the chat's canonical persona
//     ("Savant") instead of the just-built soul, which Spencer called
//     "CLEARLY not wired". The canonical persona is shown in the chat
//     page header; the manifest page is the BUILDER, not a viewer.
//   - `RatingBox` extracted to `src/components/rating-box.tsx` (per
//     ECHO Law 13 utility-first; reusable for any future metric display).
//
// Source-of-truth (pasteback-grounded, see FID-006 v3 §Evidence):
//   - ControlFrame::SoulManifest:  crates/core/src/types/mod.rs:75-79
//   - ControlFrame::BulkManifest:  crates/core/src/types/mod.rs:84-86
//   - BootstrapTier:               crates/core/src/types/mod.rs:1153-1164
//   - BootstrapStatus:             crates/core/src/types/mod.rs:1174-1183
//   - AgentManifestPlan:           crates/core/src/types/mod.rs:189-194
//   - generate_template_soul:      crates/gateway/src/handlers/mod.rs:2031
//   - BulkManifest dispatch + SEC #8: crates/gateway/src/handlers/mod.rs:645-665
//   - execute_manifestation:       crates/gateway/src/handlers/mod.rs:1718-1982
//
// Phase 1: mock IPC (src/lib/mock-ipc.ts `manifest_soul` + `bulk_manifest`).
// Phase 2 (Tauri integration): real writes to workspace-savant/SOUL.md.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { RatingBox } from "@/components/rating-box";
import { SectionRatingCard } from "@/components/section-rating-card";
import { SoulBodyViewer } from "@/components/soul-body-viewer";
import { BulkDiffViewer } from "@/components/bulk-diff-viewer";
import {
  bulkManifest,
  manifestSoulStream,
  createManifestStreamChannel,
  getSwarmBaseline,
  type ManifestStreamHandle,
} from "@/lib/ipc";
import { useLoadedConfig } from "@/lib/hooks/use-loaded-config";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  getRandomName,
  TOTAL_NAME_COUNT,
  TOTAL_THEME_COUNT,
} from "@/lib/name-generator";
import { getRandomPrompt, CURATED_PROMPTS } from "@/lib/prompt-generator";
import { computeSectionMetrics, type SectionMetric } from "@/lib/manifest-mock";
import { previewSwarmDiff, type SwarmDiff } from "@/lib/swarm-diff";
import type {
  AgentManifestPlan,
  BootstrapStatus,
  BootstrapTier,
  BulkManifestResult,
} from "@/types/control-frames";

const LS_SOUL_BUILT = "LS_SOUL_BUILT";

type BuiltSoulEntry = {
  ts: number;
  prompt: string;
  name: string | null;
  tier: string | null;
  status: "complete" | "template" | "error";
  metrics: { lines: number; sections: number; depth_score: number };
  content: string;
  /** SHA-256 hex digest in browser (BLAKE3 in savant-orig; field
   *  name kept for IPC contract parity). Optional — the template
   *  fallback doesn't compute a hash. */
  soul_blake3?: string;
  /** True if the LLM declared capabilities via
   *  `## INFRASTRUCTURE_REQUIREMENTS` block. */
  has_infra_block?: boolean;
  note?: string;
  error?: string;
};

const STATUS_LABEL: Record<BootstrapStatus, string> = {
  ready: "Ready",
  pending: "Pending",
  degraded: "Degraded",
};

const STATUS_COLOR: Record<BootstrapStatus, string> = {
  ready: "text-success",
  pending: "text-warning",
  degraded: "text-danger",
};

const TIER_LABEL: Record<BootstrapTier, string> = {
  pure_generation: "Pure Generation",
  grounded: "Grounded",
  scaffolded: "Scaffolded",
  aspirational: "Aspirational",
};

const TIER_DESCRIPTION: Record<BootstrapTier, string> = {
  pure_generation:
    "No grounding. LLM hallucinates freely. No manifest.json. (types/mod.rs:1156)",
  grounded:
    "Injected system context. LLM must match reality exactly. (types/mod.rs:1158)",
  scaffolded:
    "Context + LLM can request scaffolding via structured infra block. (types/mod.rs:1160)",
  aspirational:
    "All Tier 3 + unfulfillable claims classified as backlog. (types/mod.rs:1162)",
};

const DEFAULT_TIER: BootstrapTier = "grounded";

// FID-009 — Random name/prompt generators moved to dedicated utility
// modules (see `src/lib/name-generator.ts` + `src/lib/prompt-generator.ts`)
// for 100+ themed names + 20 curated example prompts. The die icons
// on the name input + prompt textarea call `getRandomName()` +
// `getRandomPrompt()` respectively.

export default function ManifestPage() {
  // Loaded chat model (FID-006 v3 reopen: passed to the
  // `manifest_soul` payload so the mock LLM call uses the
  // user's chosen model; empty string falls back to DEFAULT_MODEL).
  const { modelId } = useLoadedConfig();

  // Section 1 — builder form state
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState<BootstrapTier>(DEFAULT_TIER);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BootstrapStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  // FID-014 — Regenerate counter. Incremented each time the user
  // clicks "Regenerate" (re-runs the LLM with the persisted prompt
  // but a new [variant #N] suffix). Resets to 0 on a fresh main
  // submit. The suffix forces OpenRouter's free models to produce
  // different output across regenerations (no native seed support).
  const [regenCount, setRegenCount] = useState(0);
  // FID-014 — `regenPending` flag. Set to `true` by `onRegenerate`
  // and consumed by a useEffect that fires the submit. Gates
  // both MANIFEST SOUL + Regenerate buttons (`submitDisabled` +
  // `onRegenerate`'s guard) to close the double-click race during
  // the regenPending window. Declared here (top of component) so
  // it's in scope for the callbacks + `submitDisabled` + the
  // Regenerate button's `disabled` prop declared below.
  const [regenPending, setRegenPending] = useState(false);

  // FID-010 — streaming state. `streamBuffer` is the live preview
  // text (preamble + accumulated chunks); `streamStartTs` powers
  // the elapsed-time ticker. `streamBufferRef` is the write-through
  // mirror that rAF batches into `streamBuffer` state (avoids
  // triggering a React re-render on every SSE token).
  const [streamBuffer, setStreamBuffer] = useState("");
  const [streamStartTs, setStreamStartTs] = useState<number | null>(null);
  const [streamElapsedSec, setStreamElapsedSec] = useState(0);
  const streamBufferRef = useRef<string>("");
  const streamHandleRef = useRef<ManifestStreamHandle | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const unsubChannelRef = useRef<(() => void) | null>(null);
  const streamStartTsRef = useRef<number | null>(null);

  // Section 2 — draft buffer state
  const [builtSoul, setBuiltSoul] = useState<BuiltSoulEntry | null>(null);
  const [copied, setCopied] = useState(false);

  // Section 3 — swarm deployment state
  const [bulkJson, setBulkJson] = useState("[]");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkManifestResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // FID-013 — Swarm diff preview state. `bulkBaseline` is the
  // currently-deployed swarm (persisted to localStorage by the
  // mock IPC on successful bulk_manifest). `bulkDiff` is the
  // computed 3-way diff shown in the BulkDiffViewer before the
  // user confirms the deploy. `bulkShowDiff` toggles the diff
  // panel (false = hide, true = show + wait for confirm).
  const [bulkBaseline, setBulkBaseline] = useState<AgentManifestPlan[]>([]);
  const [bulkDiff, setBulkDiff] = useState<SwarmDiff | null>(null);
  const [bulkShowDiff, setBulkShowDiff] = useState(false);

  // FID-012 — Per-section metrics. Memoized on `builtSoul.content`
  // (NOT the full `builtSoul` object) so we only recompute when
  // the soul body string actually changes — not when ancillary
  // fields like `ts` or `note` change. Empty array if no built soul.
  const sectionMetrics = useMemo<SectionMetric[]>(
    () => (builtSoul ? computeSectionMetrics(builtSoul.content) : []),
    [builtSoul?.content],
  );

  // FID-013 — Load the swarm baseline on mount so the diff preview
  // is ready when the user clicks "Deploy Swarm" (no flicker).
  // Silent fail → empty baseline (first deploy — all agents will
  // be ADDED in the diff, which is correct).
  useEffect(() => {
    void getSwarmBaseline()
      .then(setBulkBaseline)
      .catch(() => setBulkBaseline([]));
  }, []);

  // Hydrate Draft Buffer from localStorage (with migration for stale
  // entries from before the v3 reopen — those lack `status` + `metrics`).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = (): void => {
      const raw = window.localStorage.getItem(LS_SOUL_BUILT);
      if (!raw) {
        setBuiltSoul(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<BuiltSoulEntry> | null;
        if (!parsed || typeof parsed !== "object") {
          setBuiltSoul(null);
          return;
        }
        setBuiltSoul({
          ts: parsed.ts ?? 0,
          prompt: parsed.prompt ?? "",
          name: parsed.name ?? null,
          tier: parsed.tier ?? null,
          status: parsed.status ?? "template",
          metrics: {
            lines: parsed.metrics?.lines ?? 0,
            sections: parsed.metrics?.sections ?? 0,
            depth_score: parsed.metrics?.depth_score ?? 0.5,
          },
          content: parsed.content ?? "",
          note: parsed.note,
          error: parsed.error,
        });
      } catch {
        setBuiltSoul(null);
      }
    };
    read();
    const onStorage = (e: StorageEvent): void => {
      if (e.key === LS_SOUL_BUILT) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // FID-010 — Elapsed-time ticker for the streaming preview. Reads
  // the start timestamp from a ref (set when the stream begins) so
  // the interval doesn't re-create on every state change. Stops
  // automatically when the stream ends (startTs is set to null).
  useEffect(() => {
    if (streamStartTs === null) return;
    const id = window.setInterval(() => {
      if (streamStartTsRef.current === null) return;
      setStreamElapsedSec(
        Math.floor((Date.now() - streamStartTsRef.current) / 1000),
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [streamStartTs]);

  // FID-010 — Cleanup on unmount: cancel any in-flight stream +
  // cancel any pending rAF tick. Without this, an unmount during
  // streaming would leak the fetch (and the channel listeners).
  useEffect(() => {
    return () => {
      streamHandleRef.current?.cancel();
      streamHandleRef.current = null;
      unsubChannelRef.current?.();
      unsubChannelRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // FID-009 — Generate a random name (die icon INSIDE the name input,
  // overlaid on the right edge). The selector pulls from 100+ themed
  // names (mythological + sci-fi + tech + nature + abstract).
  const onGenerateName = useCallback((): void => {
    setName(getRandomName());
  }, []);

  // FID-009 — Generate a random prompt (die icon inside the prompt
  // textarea, overlaid on the bottom-right). The selector pulls from
  // 20 curated example prompts across different domains (hustler,
  // security, poet, strategist, zen, ceo, negotiator, quantum, chef,
  // crisis, philosopher, ai-safety, marine-bio, lawyer, chess,
  // er-doctor, jazz, vc, astrophysicist, product-designer).
  const onGeneratePrompt = useCallback((): void => {
    setPrompt(getRandomPrompt().text);
  }, []);

  // FID-010 — Stream the soul generation via SSE. The channel
  // handler is the central dispatch point: each event from the
  // mock IPC is routed to a side effect (buffer append, persist,
  // error display). The rAF batching in `scheduleStreamFlush` is
  // critical for performance — OpenRouter can emit 50-200 chunks
  // per second, and we can't re-render on every one.
  const scheduleStreamFlush = useCallback((): void => {
    if (rafIdRef.current !== null) return; // already scheduled
    rafIdRef.current = requestAnimationFrame(() => {
      setStreamBuffer(streamBufferRef.current);
      rafIdRef.current = null;
    });
  }, []);

  // Cancel an in-flight stream. Fire-and-forget: triggers the
  // AbortController (which aborts fetch + the SSE parser), then
  // resets the streaming state so the user can immediately submit
  // a new prompt. The handle's `done` promise will resolve when
  // the background loop unwinds (typically < 100ms after cancel).
  // Cancellation is a USER action, not an error — we don't set
  // `error` (the user knows they cancelled; surfacing a red
  // "Stream cancelled" error would be misleading).
  const onCancelStream = useCallback((): void => {
    streamHandleRef.current?.cancel();
    streamHandleRef.current = null;
    unsubChannelRef.current?.();
    unsubChannelRef.current = null;
    streamBufferRef.current = "";
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setStreamBuffer("");
    setStreamStartTs(null);
    streamStartTsRef.current = null;
    setStreamElapsedSec(0);
    setSubmitting(false);
    setStatus("ready");
    setError(null);
  }, []);

  // Manifest soul via streaming IPC (real OpenRouter SSE call
  // when a master key is captured; static 18-section template
  // fallback otherwise). Mirrors savant-orig
  // `execute_manifestation` at [`mod.rs:1718-1982`].
  //
  // Auto-cancels any previous in-flight stream before starting a
  // new one (FID-010 — concurrent streams would interleave chunks
  // and corrupt the buffer).
  //
  // FID-014 — CAPTURE-THEN-RESET PATTERN for `regenCount`. The
  // counter is read into a local variable at the top of the
  // function, then immediately reset to 0 in React state. The
  // suffix is applied using the captured value. This guarantees
  // that the variant suffix is used for EXACTLY the submit
  // triggered by `onRegenerate` — the next time the user clicks
  // MANIFEST SOUL (with the same or different prompt), the
  // counter is back at 0 and no suffix is appended. Without this
  // pattern, the suffix would persist across submissions
  // (because React state is async; the next closure would still
  // see the old `regenCount`).
  //
  // NOTE: the variant suffix is a BEST-EFFORT attempt to force
  // OpenRouter's free models to produce different output across
  // regenerations (those models don't accept a `seed` parameter).
  // Aggressive prompt caching on free tier may still produce
  // identical output for near-identical prompts. A more reliable
  // approach would be to vary the temperature (e.g., 0.78 + 0.05
  // * regenCount, capped at 1.0) — deferred to a follow-up FID
  // since the current approach is "good enough" for Phase 1.
  const onManifestSubmit = useCallback(async (): Promise<void> => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || submitting) return;
    // CAPTURE-THEN-RESET (see comment above). Local variable
    // captures the value for the suffix; the state update below
    // resets the counter so the next submit (main button click
    // or future regenerate) starts fresh.
    const submitRegenCount = regenCount;
    if (submitRegenCount > 0) setRegenCount(0);
    // Auto-cancel any previous stream (see comment above).
    if (streamHandleRef.current) {
      streamHandleRef.current.cancel();
      streamHandleRef.current = null;
      unsubChannelRef.current?.();
      unsubChannelRef.current = null;
    }
    setSubmitting(true);
    setStatus("pending");
    setError(null);
    setStreamBuffer("");
    setStreamStartTs(Date.now());
    streamStartTsRef.current = Date.now();
    setStreamElapsedSec(0);
    streamBufferRef.current = "";
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Variant suffix (FID-014). Only applied if the CAPTURED
    // `submitRegenCount > 0` — a fresh main submit uses the user
    // prompt as-is. The suffix is appended with a space separator
    // so the LLM treats it as additional context, not a
    // continuation of the last word.
    const effectivePrompt =
      submitRegenCount > 0
        ? `${trimmedPrompt} [variant #${submitRegenCount}]`
        : trimmedPrompt;

    const channel = createManifestStreamChannel();
    const finalize = (): void => {
      unsubChannelRef.current?.();
      unsubChannelRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setSubmitting(false);
      setStreamStartTs(null);
      streamStartTsRef.current = null;
      setStreamElapsedSec(0);
      streamHandleRef.current = null;
    };
    unsubChannelRef.current = channel.onmessage((event) => {
      switch (event.type) {
        case "preamble":
        case "chunk": {
          const delta = event.type === "preamble" ? event.content : event.delta;
          streamBufferRef.current += delta;
          scheduleStreamFlush();
          break;
        }
        case "complete": {
          // Persist + populate the Draft Buffer with the final
          // result. The streamBuffer may have lagged behind the
          // actual stream (rAF batches updates), so we use the
          // authoritative `result.content` from the complete event.
          // Store the ORIGINAL user prompt (not the variant-suffixed
          // version) so the Draft Buffer + Regenerate button always
          // show what the user typed.
          const result = event.result;
          const entry: BuiltSoulEntry = {
            ts: Date.now(),
            prompt: trimmedPrompt,
            name: name.trim() || null,
            tier,
            status: result.status,
            metrics: result.metrics,
            content: result.content,
            soul_blake3: result.soul_blake3,
            has_infra_block: result.has_infra_block,
            note: result.note,
            error: result.error,
          };
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LS_SOUL_BUILT, JSON.stringify(entry));
          }
          setBuiltSoul(entry);
          setStreamBuffer("");
          streamBufferRef.current = "";
          if (result.status === "error") {
            setError(result.error ?? "Unknown error");
            setStatus("degraded");
          } else {
            setStatus("ready");
            setError(null);
          }
          break;
        }
        case "error": {
          setError(event.error);
          setStatus("degraded");
          setStreamBuffer("");
          streamBufferRef.current = "";
          break;
        }
      }
    });

    try {
      const handle = await manifestSoulStream(
        {
          prompt: effectivePrompt,
          name: name.trim() || undefined,
          bootstrap_tier: tier,
          model: modelId ?? "",
        },
        channel,
      );
      streamHandleRef.current = handle;
      // Wait for the stream to settle (complete / error / cancel).
      // `finalize` is called from the channel's onmessage on
      // complete/error; the catch below handles synchronous throw;
      // the cleanup useEffect handles unmount-during-stream.
      await handle.done;
      finalize();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("degraded");
      finalize();
    }
  }, [
    name,
    prompt,
    submitting,
    tier,
    modelId,
    regenCount,
    scheduleStreamFlush,
  ]);

  // FID-014 — Regenerate. Re-runs the LLM with the persisted prompt
  // + a [variant #N] suffix to force a different output. The
  // counter increments on each click; resets to 0 on a fresh main
  // submit. The Draft Buffer must have a built soul (otherwise
  // there's no prompt to regenerate from — the button is disabled).
  //
  // Guard: also gate on `regenPending` (in addition to `submitting`)
  // to close the race where the user double-clicks Regenerate
  // during the regenPending window (between `setRegenPending(true)`
  // and the useEffect firing). Without this, the counter would
  // increment twice for a single intended action.
  const onRegenerate = useCallback((): void => {
    if (!builtSoul || submitting || regenPending) return;
    // Restore the persisted prompt to the textarea (in case the
    // user has been editing it) so the user can see what's being
    // submitted. This is a non-destructive "reset to last built
    // prompt" action — if the user wants to submit a NEW prompt,
    // they edit the textarea + click MANIFEST SOUL (not Regenerate).
    setPrompt(builtSoul.prompt);
    setName(builtSoul.name ?? "");
    setRegenCount((c) => c + 1);
    // The actual submit happens via a useEffect that watches
    // regenCount, so the state updates settle before the submit
    // reads the new count.
    setRegenPending(true);
  }, [builtSoul, submitting, regenPending]);

  // FID-014 — Trigger the submit after the regen state updates
  // settle. The `regenPending` flag prevents infinite re-fires.
  // The effect deps are INTENTIONALLY only `[regenPending, submitting]`
  // — `onManifestSubmit` is captured via a ref so the effect doesn't
  // re-run on every state tick (onManifestSubmit has many deps
  // and re-creates frequently, which would cause the effect to
  // re-fire unnecessarily even when regenPending is false).
  // (The `regenPending` state is declared near the top of the
  // component with the other useState calls — see the FID-014
  // block above — so it's in scope for `onRegenerate` +
  // `submitDisabled` + the Regenerate button's `disabled` prop.)
  const onManifestSubmitRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    onManifestSubmitRef.current = onManifestSubmit;
  });
  useEffect(() => {
    if (regenPending && !submitting) {
      setRegenPending(false);
      void onManifestSubmitRef.current();
    }
  }, [regenPending, submitting]);

  const onRevert = useCallback((): void => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LS_SOUL_BUILT);
    }
    setBuiltSoul(null);
    setStatus("ready");
    setError(null);
  }, []);

  // Copy to clipboard with two-strategy fallback (modern Clipboard
  // API → hidden-textarea execCommand). See FID-006 v3 hotfix
  // "COPY BUTTON FALLBACK" for the full rationale.
  const onCopy = useCallback(async (): Promise<void> => {
    if (!builtSoul || typeof window === "undefined") return;
    const text = builtSoul.content;
    let ok = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // Fall through to the legacy execCommand fallback.
      }
    }
    if (!ok && typeof document !== "undefined") {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      const sel = document.getSelection();
      const prevRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      ta.focus();
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      if (prevRange && sel) {
        sel.removeAllRanges();
        sel.addRange(prevRange);
      }
    }
    if (ok) {
      setError(null);
      setStatus("ready");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Clipboard write failed (no strategy succeeded)");
      setStatus("degraded");
    }
  }, [builtSoul]);

  // FID-013 — Bulk deploy with diff preview. Two-step flow:
  //   Step 1: User clicks "Deploy Swarm" → parse JSON, fetch
  //           baseline, compute diff, show `BulkDiffViewer` with
  //           Confirm + Cancel buttons. State: `bulkShowDiff=true`.
  //   Step 2: User clicks "Confirm & Deploy Swarm" → dispatch
  //           `bulk_manifest` IPC, on success update baseline,
  //           clear diff state. State: `bulkShowDiff=false`.
  //
  // Cancel button just clears the diff state (no IPC call).
  // Errors at any step surface via `bulkError` (existing red
  // banner at the bottom of the section).
  const onBulkDeploy = useCallback(async (): Promise<void> => {
    if (bulkSubmitting) return;
    setBulkError(null);
    setBulkResult(null);

    // Parse + validate (do this in both steps so validation errors
    // surface BEFORE we fetch the baseline for the diff preview).
    let parsed: AgentManifestPlan[];
    try {
      const raw: unknown = JSON.parse(bulkJson);
      if (!Array.isArray(raw)) {
        throw new Error("Bulk JSON must be an array of AgentManifestPlan");
      }
      for (const a of raw as AgentManifestPlan[]) {
        if (typeof a?.name !== "string" || typeof a?.soul !== "string") {
          throw new Error(
            "Each AgentManifestPlan requires `name: string` + `soul: string`",
          );
        }
      }
      parsed = raw as AgentManifestPlan[];
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
      return;
    }

    // Step 1: Show diff preview.
    if (!bulkShowDiff) {
      try {
        const baseline = await getSwarmBaseline();
        setBulkBaseline(baseline);
        const diff = previewSwarmDiff(baseline, parsed);
        setBulkDiff(diff);
        setBulkShowDiff(true);
      } catch (e) {
        setBulkError(
          `Failed to load baseline: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      return;
    }

    // Step 2: Confirm + deploy. Mock IPC persists the new
    // baseline on success (see `mock-ipc.ts:bulk_manifest`); we
    // re-set the local state too so the next diff is accurate
    // even before the storage event fires.
    setBulkSubmitting(true);
    try {
      const result = await bulkManifest({ agents: parsed });
      setBulkResult(result);
      if (result.status === "SWARM_DEPLOYED") {
        setBulkBaseline(parsed);
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkSubmitting(false);
      setBulkShowDiff(false);
      setBulkDiff(null);
    }
  }, [bulkJson, bulkSubmitting, bulkShowDiff]);

  // FID-013 — Cancel the diff preview and return to the idle
  // state. No IPC call (nothing was deployed). Clears the diff
  // state + any bulkError from the validation step + the stale
  // bulkResult banner from a previous successful deploy (the
  // preview step replaces the result UX; without clearing, the
  // old success banner would linger alongside the cleared preview).
  const onBulkCancel = useCallback((): void => {
    setBulkShowDiff(false);
    setBulkDiff(null);
    setBulkError(null);
    setBulkResult(null);
  }, []);

  const promptTrimmed = prompt.trim();
  // FID-014 — gate the MANIFEST SOUL button on `regenPending` too.
  // Without this, the user could click MANIFEST SOUL during the
  // small window between `setRegenPending(true)` and the
  // `regenPending` useEffect firing (which is when `submitting`
  // becomes true). A double-click would race the two submits,
  // auto-cancel the first, and burn the variant counter on a
  // submit that didn't actually produce output. Adding
  // `regenPending` to the guard closes the race.
  const submitDisabled = !promptTrimmed || submitting || regenPending;

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        {/* ─────────────────────────────────────────────────────────
            Section 1 — Soul Manifestation Engine (builder form)
            ───────────────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-4 p-5">
          <header>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Section 1 — Soul Manifestation Engine
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em]">
              Design the entities soul
            </h2>
            <p className="mt-2 text-xs text-muted">
              LLM-driven soul generation via OpenRouter. The system prompt
              forces every section to be UNIQUE to your prompt (no generic AAA
              filler).
            </p>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Entity Name
              </span>
              {/* FID-009 — Die icon OVERLAID inside the input (absolute
                  positioned on the right). Replaces the previous
                  side-by-side flex layout. Right padding on the input
                  prevents the die icon from overlapping typed text. */}
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Athena, Prometheus, Cipher…"
                  className="w-full rounded-md border border-[color:var(--input-border-color)] bg-surface/30 px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onGenerateName}
                  title={`Generate random name (${TOTAL_NAME_COUNT} across ${TOTAL_THEME_COUNT} themes)`}
                  aria-label="Generate random name"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted transition-colors hover:text-accent"
                >
                  <i className="fas fa-dice" aria-hidden />
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Bootstrap Tier
              </span>
              {/* `colorScheme: "dark"` hints the browser to use dark
                  colors for the dropdown options in dark mode. The
                  `bg-[color:var(--surface)]` overrides the default
                  white background on the closed select. */}
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as BootstrapTier)}
                style={{ colorScheme: "dark" }}
                className="rounded-md border border-[color:var(--input-border-color)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm text-foreground focus:border-accent focus:outline-none"
              >
                {(Object.keys(TIER_LABEL) as BootstrapTier[]).map((t) => (
                  <option
                    key={t}
                    value={t}
                    className="bg-[color:var(--surface)] text-foreground"
                  >
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <span className="mt-1 font-mono text-[10px] text-muted">
                {TIER_DESCRIPTION[tier]}
              </span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Manifest Prompt (Core Directive)
            </span>
            {/* FID-009 — Die icon OVERLAID inside the textarea (absolute
                positioned on the bottom-right). Replaces the hustler
                placeholder with a professional description; the
                placeholder text now explains what the system prompt
                does (forces every section to be UNIQUE to the prompt). */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the entity's core directive — its purpose, values, and operating philosophy. The system prompt forces every section to be UNIQUE to your prompt (no generic AAA filler). Try the die icon for a curated example."
                rows={4}
                className="w-full resize-none rounded-md border border-[color:var(--input-border-color)] bg-surface/30 px-3 py-2 pb-10 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={onGeneratePrompt}
                title={`Generate random prompt (${CURATED_PROMPTS.length} curated examples)`}
                aria-label="Generate random prompt"
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded text-muted transition-colors hover:text-accent"
              >
                <i className="fas fa-dice" aria-hidden />
              </button>
            </div>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onManifestSubmit()}
              disabled={submitDisabled}
              className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i
                className={
                  submitting
                    ? "fas fa-spinner animate-spin"
                    : "fas fa-feather-pointed"
                }
                aria-hidden
              />
              {submitting
                ? "MANIFESTATION SEQUENCE IN PROGRESS…"
                : "MANIFEST SOUL"}
            </button>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.2em] ${STATUS_COLOR[status]}`}
              aria-live="polite"
            >
              Status: {STATUS_LABEL[status]}
            </span>
            {error && (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-danger">
                {error.slice(0, 120)}
              </span>
            )}
          </div>
        </Card>

        {/* ─────────────────────────────────────────────────────────
            Section 2 — Draft Buffer (enterprise-grade metadata +
            rating grid + char counter + body + actions)
            ───────────────────────────────────────────────────────── */}
        {/* FID-010 — Live Stream Preview. Only visible while a
            stream is in flight. Shows the accumulating text +
            elapsed time + char count + Cancel button. Auto-hides
            when the stream completes/errors. */}
        {streamBuffer && (
          <Card className="flex flex-col gap-3 border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                  Streaming Soul Manifestation
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-[10px] text-muted"
                  data-testid="stream-stats"
                >
                  {streamBuffer.length.toLocaleString()} char
                  {streamBuffer.length === 1 ? "" : "s"} · {streamElapsedSec}s
                  elapsed
                </span>
                <button
                  type="button"
                  onClick={onCancelStream}
                  data-testid="cancel-stream"
                  className="flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-danger transition-colors hover:bg-danger/20"
                >
                  <i className="fas fa-stop" aria-hidden />
                  Cancel
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-auto rounded-md border border-default/40 bg-surface/40 p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
                {streamBuffer}
                <span
                  className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent"
                  aria-hidden
                />
              </pre>
            </div>
          </Card>
        )}

        <Card className="flex flex-col gap-4 p-5">
          <header>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Section 2 — Draft Buffer
            </p>
            <h2 className="mt-1 font-mono text-base font-semibold uppercase tracking-[0.18em]">
              Last Built Soul
            </h2>
            <p className="mt-2 text-xs text-muted">
              Persisted to{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-accent">
                localStorage["LS_SOUL_BUILT"]
              </code>
              . Copy to clipboard or Revert to clear.
            </p>
          </header>

          {builtSoul ? (
            <>
              {/* Metadata grid: 4 cards (NAME, TIER, STATUS, GENERATED) */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <RatingBox
                  label="NAME"
                  value={builtSoul.name ?? "Unnamed Agent"}
                  hint={
                    builtSoul.name
                      ? "soul designation"
                      : "no name set (will use 'Unnamed Agent')"
                  }
                />
                <RatingBox
                  label="TIER"
                  value={
                    TIER_LABEL[(builtSoul.tier as BootstrapTier) ?? "grounded"]
                  }
                  hint={
                    TIER_DESCRIPTION[
                      (builtSoul.tier as BootstrapTier) ?? "grounded"
                    ].split(" (")[0]
                  }
                />
                <RatingBox
                  label="STATUS"
                  value={
                    builtSoul.status === "complete"
                      ? "Complete"
                      : builtSoul.status === "template"
                        ? "Template"
                        : "Error"
                  }
                  color={
                    builtSoul.status === "complete"
                      ? "success"
                      : builtSoul.status === "error"
                        ? "danger"
                        : "warning"
                  }
                  hint={
                    builtSoul.status === "complete"
                      ? "LLM-generated"
                      : builtSoul.status === "template"
                        ? "static fallback (no API key)"
                        : "generation failed"
                  }
                />
                <RatingBox
                  label="GENERATED"
                  value={formatRelativeTime(builtSoul.ts)}
                  hint={new Date(builtSoul.ts).toISOString().slice(0, 10)}
                  title={new Date(builtSoul.ts).toISOString()}
                />
              </div>

              {/* Rating grid: 5 cards (LINES, SECTIONS, DEPTH, HASH, INFRA)
                  with FontAwesome icon prefixes (FID-009). The icons
                  are part of the label, not separate elements, so they
                  inherit the muted color and tracking. */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <RatingBox
                  label="LINES"
                  icon={<i className="fas fa-align-left" aria-hidden />}
                  value={builtSoul.metrics.lines}
                  hint="total lines"
                />
                <RatingBox
                  label="SECTIONS"
                  icon={<i className="fas fa-list" aria-hidden />}
                  value={builtSoul.metrics.sections}
                  hint="/ 18 target"
                  bar={builtSoul.metrics.sections / 18}
                />
                <RatingBox
                  label="DEPTH"
                  icon={<i className="fas fa-chart-line" aria-hidden />}
                  value={`${Math.round(builtSoul.metrics.depth_score * 100)}%`}
                  hint="semantic density"
                  bar={builtSoul.metrics.depth_score}
                  color={
                    builtSoul.metrics.depth_score >= 0.55
                      ? "success"
                      : builtSoul.metrics.depth_score >= 0.3
                        ? "warning"
                        : "danger"
                  }
                />
                <RatingBox
                  label="HASH"
                  icon={<i className="fas fa-hashtag" aria-hidden />}
                  value={builtSoul.soul_blake3?.slice(0, 8) ?? "—"}
                  hint="SHA-256 (browser)"
                  title={builtSoul.soul_blake3 ?? undefined}
                />
                <RatingBox
                  label="INFRA"
                  icon={<i className="fas fa-server" aria-hidden />}
                  value={builtSoul.has_infra_block ? "YES" : "NO"}
                  color={builtSoul.has_infra_block ? "accent" : "default"}
                  hint="## INFRASTRUCTURE_REQUIREMENTS block"
                />
              </div>

              {/* Character counter (moved from Section 1 in v2 reopen) */}
              <div className="flex items-center justify-between border-t border-default/40 pt-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Soul Body
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {builtSoul.content.length.toLocaleString()} char
                  {builtSoul.content.length === 1 ? "" : "s"} ·{" "}
                  {builtSoul.content.split("\n").length.toLocaleString()} lines
                </span>
              </div>

              {/* FID-009 — Soul body now uses the custom Markdown
                  renderer (`SoulBodyViewer`) instead of a plain `<pre>`
                  block. Supports headers, tables, lists, bold,
                  blockquotes, code, horizontal rules. Lightweight
                  (~250 lines), no external dependencies. */}
              <SoulBodyViewer content={builtSoul.content} />

              {/* FID-012 — SECTIONS BREAKDOWN. Collapsible by default
                  (18 cards would dominate the page). Shows one
                  SectionRatingCard per `## N. Title` section in the
                  soul body, with per-section metrics (lines, words,
                  density, completeness indicator). The global DEPTH
                  card in the rating grid above is the at-a-glance
                  summary; this is the drill-down breakdown. */}
              <details
                className="rounded-md border border-default/40 bg-surface/20"
                data-testid="sections-breakdown"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground">
                  <span>
                    [ SECTIONS BREAKDOWN ] — {sectionMetrics.length}{" "}
                    {sectionMetrics.length === 1 ? "section" : "sections"}
                    {" · "}
                    {sectionMetrics.filter((m) => m.completeness).length} /{" "}
                    {sectionMetrics.length} complete
                  </span>
                  <i
                    className="fas fa-chevron-right text-[10px] transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <div className="grid grid-cols-1 gap-1.5 border-t border-default/40 p-2 md:grid-cols-2">
                  {sectionMetrics.map((m) => (
                    <SectionRatingCard key={m.id} metric={m} />
                  ))}
                </div>
              </details>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-default/40 pt-3">
                {/* FID-014 — Regenerate button. Re-runs the LLM with
                    the persisted prompt + a [variant #N] suffix.
                    Disabled if no built soul or a stream is in
                    flight. The variant counter resets on a fresh
                    main submit (the next user click on MANIFEST SOUL
                    with a new prompt starts at #0). */}
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={!builtSoul || submitting || regenPending}
                  data-testid="regenerate"
                  title={
                    regenCount > 0
                      ? `Regenerate (last variant: #${regenCount})`
                      : "Regenerate with a new variant"
                  }
                  className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fas fa-rotate" aria-hidden />
                  {regenCount > 0 ? `Regen #${regenCount + 1}` : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    copied
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-default/60 text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  <i
                    className={copied ? "fas fa-check" : "fas fa-copy"}
                    aria-hidden
                  />
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={onRevert}
                  className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-danger transition-colors hover:bg-danger/20"
                >
                  <i className="fas fa-rotate-left" aria-hidden />
                  Revert
                </button>
                {builtSoul.error && (
                  <span
                    title={builtSoul.error}
                    className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-danger"
                  >
                    {builtSoul.error.slice(0, 120)}
                    {builtSoul.error.length > 120 ? "…" : ""}
                  </span>
                )}
                {builtSoul.note && !builtSoul.error && (
                  <span
                    title={builtSoul.note}
                    className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-warning"
                  >
                    {/* FID-009 fix: extended slice from 120 → 200 to
                        avoid the previous "generatio" truncation on
                        the template-fallback note (143 chars). Full
                        text is in the `title` attribute for hover. */}
                    {builtSoul.note.slice(0, 200)}
                    {builtSoul.note.length > 200 ? "…" : ""}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="font-mono text-xs text-muted">
              No built soul yet. Submit the form above to populate this buffer.
            </p>
          )}
        </Card>

        {/* ─────────────────────────────────────────────────────────
            Section 3 — Swarm Deployment (collapsible; was wasting
            vertical space when not generating multiple souls)
            ───────────────────────────────────────────────────────── */}
        <details className="rounded-lg border border-default/40 bg-surface/20 p-5">
          <summary className="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground">
            Section 3 — Swarm Deployment (click to expand)
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-muted">
              Dispatches{" "}
              <code className="text-accent">ControlFrame::BulkManifest</code>{" "}
              (pasteback: <code>types/mod.rs:84</code>). SEC #8 limit of 10
              agents (pasteback: <code>handlers/mod.rs:647-655</code>). FID-013
              — shows a diff preview against the active baseline before
              deploying.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                AgentManifestPlan[] (JSON)
              </span>
              {/* FID-013 — Readonly during the diff preview + deploy
                  steps so the diff doesn't go stale. To edit, user
                  must click Cancel first. */}
              <textarea
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                readOnly={bulkShowDiff || bulkSubmitting}
                placeholder='[{"name":"agent-1","soul":"…","identity":"…"}]'
                rows={6}
                className={`rounded-md border border-[color:var(--input-border-color)] bg-surface/30 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none ${
                  bulkShowDiff || bulkSubmitting
                    ? "cursor-not-allowed opacity-70"
                    : ""
                }`}
              />
            </label>

            {/* FID-013 — Diff preview panel. Visible only during
                the preview step (between "Deploy Swarm" and
                "Confirm & Deploy Swarm"). Shows the 3-way diff
                (added/modified/removed/unchanged) against the
                current active baseline. */}
            {bulkShowDiff && bulkDiff && (
              <div className="flex flex-col gap-2">
                <BulkDiffViewer diff={bulkDiff} />
                <p className="font-mono text-[10px] text-muted">
                  Baseline: {bulkBaseline.length} agent
                  {bulkBaseline.length === 1 ? "" : "s"} · Proposed:{" "}
                  {(() => {
                    try {
                      const p = JSON.parse(bulkJson);
                      return Array.isArray(p) ? p.length : "?";
                    } catch {
                      return "?";
                    }
                  })()}{" "}
                  agent(s)
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Idle: show "Deploy Swarm". Preview: show
                  "Confirm & Deploy Swarm" + "Cancel". */}
              {!bulkShowDiff && (
                <button
                  type="button"
                  onClick={() => void onBulkDeploy()}
                  disabled={bulkSubmitting}
                  className="flex items-center gap-2 rounded-md border border-accent bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i
                    className={
                      bulkSubmitting
                        ? "fas fa-spinner animate-spin"
                        : "fas fa-rocket"
                    }
                    aria-hidden
                  />
                  {bulkSubmitting ? "Deploying…" : "Deploy Swarm"}
                </button>
              )}
              {bulkShowDiff && (
                <>
                  <button
                    type="button"
                    onClick={() => void onBulkDeploy()}
                    disabled={bulkSubmitting}
                    data-testid="confirm-deploy"
                    className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i
                      className={
                        bulkSubmitting
                          ? "fas fa-spinner animate-spin"
                          : "fas fa-check"
                      }
                      aria-hidden
                    />
                    {bulkSubmitting ? "Deploying…" : "Confirm & Deploy Swarm"}
                  </button>
                  <button
                    type="button"
                    onClick={onBulkCancel}
                    disabled={bulkSubmitting}
                    data-testid="cancel-deploy"
                    className="flex items-center gap-2 rounded-md border border-default/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="fas fa-xmark" aria-hidden />
                    Cancel
                  </button>
                </>
              )}
              {bulkResult && !bulkShowDiff && (
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                    bulkResult.status === "SWARM_DEPLOYED"
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {bulkResult.status === "SWARM_DEPLOYED"
                    ? `${bulkResult.status} · ${bulkResult.count} agent${
                        bulkResult.count === 1 ? "" : "s"
                      }`
                    : `${bulkResult.status} · ${bulkResult.reason}`}
                </span>
              )}
              {bulkError && !bulkShowDiff && (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-danger">
                  {bulkError.slice(0, 120)}
                </span>
              )}
            </div>
          </div>
        </details>

        {/* Section 4 — REMOVED in v2 reopen (2026-07-13).
            The previous Section 4 was a 3-card "Active Baseline" view
            that showed workspace-savant's canonical persona (the
            chat's SOUL_PROMPT, which always says "Savant"). Spencer
            correctly called this "dummy data" and "CLEARLY not
            wired" — the manifest page is the BUILDER, not a viewer
            of the chat's persona. The canonical persona is shown in
            the chat page header (`src/app/chat/page.tsx`), not
            here. The 3 cards were:
              - Card 1: Identity & Vibe (showed SOUL_PROMPT)
              - Card 2: Evolution State (showed OCEAN traits)
              - Card 3: Operating Directives (showed file map)
            All 3 are now displayed elsewhere or are not needed in
            the manifest page's authoring flow. */}
      </div>
    </DashboardShell>
  );
}
