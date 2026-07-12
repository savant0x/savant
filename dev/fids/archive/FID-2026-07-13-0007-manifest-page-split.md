# FID: 0007 — `/manifest` page split (follow-up to FID-006 v3)

**Filename:** `FID-2026-07-13-0007-manifest-page-split.md`
**ID:** FID-2026-07-13-0007
**Severity:** low
**Status:** closed
**Created:** 2026-07-13
**Author:** Vera (ECHO Protocol, codebuff/minimax-m3 in Freebuff harness)
**Supersedes:** *(none)*
**Follows:** [`dev/fids/FID-2026-07-13-006-v3-soul-builder.md`] (the 470-line `/manifest` overshoot was documented in FID-006 v3 §Lessons Learned)
**Perfection Loop:** Completed 2026-07-13 (perfection pass on all 7 pending FIDs). No new work — this FID was already closed/superseded by the standards bump. Confirmed `src/app/manifest/page.tsx` is well under the new 1,000-line ceiling after the FID-006 v3 reopen + FID-010/012/013/014 polish. Status remains `closed`.

> Status transitions: **created → analyzed → fixed → verified → closed**.
> This FID is a **deferred split** — the work is described but not yet executed. Spencer to ratify before Loop 1 implementation. **2026-07-13 — superseded.** Spencer ratified a standards bump of `max_file_lines` from 400 → 1,000 in `coding-standards/typescript.md` ("bump the limit from 400 to 1,000 - because there are other files like page.tsx that also break 400 lines. I think 1,000 is healthy as long as we continue to build utility first"). The v3 `/manifest` page at ~470 lines is now well under the new 1,000-line ceiling, so the split is no longer required. Status advances to `closed` without Loop 1 implementation. The file stays in `dev/fids/` (not archived) per the operator-only archive discipline; Spencer may archive at release cut per ECHO §FID Auto-Archive if desired.

---

## Summary

Split `src/app/manifest/page.tsx` (~470 lines after FID-006 v3) into 3 leaf components under `src/app/manifest/_components/`, bringing the page back under the TS override `max_file_lines=400`. The 4 sections each have distinct concerns (form state, localStorage hydration, JSON parsing, read-only baseline display) and are independently testable. This is the same split pattern as `settings/page.tsx` (FID-0004 follow-on). The new components can be reused in future FIDs (e.g., a "Soul Builder sidebar widget" or a "Bulk Manifest command palette").

---

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript 5.7 (renderer)
- **Commit/State:** main @ `CHANGELOG.md` `[Unreleased]` window; FID-006 v3 closed; `src/app/manifest/page.tsx` is ~470 lines (over the 400-line limit per `code-reviewer-minimax-m3` v1 finding)

---

## Detailed Description

### Problem

FID-006 v3 replaced the v2 read-only 3-card viewer with a 4-section Soul Builder (Builder Form + Draft Buffer + Swarm Deployment + Active Baseline). The full page is ~470 lines, exceeding the TS override `max_file_lines=400`. The 4 sections each have distinct concerns:

- **Section 1 (Builder Form)** — owns form state (`name`, `prompt`, `tier`, `submitting`, `status`, `error`); dispatches `manifestSoul`; transitions Pending→Ready via setTimeout.
- **Section 2 (Draft Buffer)** — reads `localStorage["LS_SOUL_BUILT"]`; renders built soul preview; Copy + Revert handlers.
- **Section 3 (Swarm Deployment)** — owns bulk JSON state; dispatches `bulkManifest`; renders success metric.
- **Section 4 (Active Baseline)** — read-only v2 3 cards wired to `@/lib/soul`.

The page is a top-level orchestrator that owns 9 state variables and 4 callbacks. Extracting Section 1 + Section 3 into leaf components brings the page down to ~200 lines (just Section 2 + Section 4 inlined + 4 thin wrapper components). Section 2 (Draft Buffer) can be inlined because it shares the `builtSoul` state with Section 1's onManifestSubmit.

### Expected Behavior

After this FID:

- `src/app/manifest/_components/SoulBuilder.tsx` (NEW) — Section 1's form state + JSX. Exports a `<SoulBuilder onBuilt={(entry) => setBuiltSoul(entry)} />` component. Owns `name`, `prompt`, `tier`, `submitting`, `status`, `error` state. Calls `manifestSoul()` and calls back to the parent on success.
- `src/app/manifest/_components/SwarmDeployment.tsx` (NEW) — Section 3's JSON parsing + JSX. Exports a `<SwarmDeployment />` component (no callback needed; the result is purely local UI state). Owns `bulkJson`, `bulkSubmitting`, `bulkResult`, `bulkError` state.
- `src/app/manifest/page.tsx` (REWRITE) — ~200 lines. Section 2 (Draft Buffer) inlined (since it shares `builtSoul` state with Section 1 via callback). Section 4 (Active Baseline) inlined (read-only, no state). Sections 1 + 3 are `<SoulBuilder />` + `<SwarmDeployment />` invocations.
- All existing FID-006 v3 behavior preserved: form input, localStorage persistence, status transitions, JSON validation, SEC #8 enforcement, IPC contract fidelity.
- The `_components/` directory uses the Next.js App Router convention for colocated private components (not routed; the underscore prefix is conventional).

### Root Cause

FID-006 v3 was a substantial page rewrite (155 → 470 lines, +315 lines). The new sections are genuinely large (Section 1 is ~150 lines including form state + JSX; Section 3 is ~80 lines including JSON parsing + JSX). A `max_file_lines=400` overshoot was anticipated in §Lessons Learned but the alternative — a less featureful v3 — was rejected as a feature degradation. The follow-up split is the established pattern (per `settings/page.tsx` FID-0004).

### Evidence

> **Pasteback rule (LESSON-016).** No savant-orig file references in this FID — this is a renderer-side refactor, not a feature implementation. All claims about the v3 page's structure are pasted from `src/app/manifest/page.tsx` (read 2026-07-13).

#### PB-1: `src/app/manifest/page.tsx` is ~470 lines after FID-006 v3

```bash
$ wc -l src/app/manifest/page.tsx
470 src/app/manifest/page.tsx
```

**Claim:** The v3 page is 470 lines (over the 400-line limit per `code-reviewer-minimax-m3` v1).
**Self-check:** Direct `wc -l` output. **EQUIVALENT.**

#### PB-2: Section 1 owns 6 state variables + 1 callback

```bash
$ sed -n '78,85p' src/app/manifest/page.tsx
  // Section 1 — builder form state
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState<BootstrapTier>(DEFAULT_TIER);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BootstrapStatus>("ready");
  const [error, setError] = useState<string | null>(null);
```

**Claim:** Section 1 owns 6 state variables. Extracting into `<SoulBuilder />` removes 6 state hooks from the page.
**Self-check:** Direct sed excerpt. **EQUIVALENT.**

#### PB-3: Section 3 owns 4 state variables + 1 callback

```bash
$ sed -n '93,98p' src/app/manifest/page.tsx
  // Section 3 — swarm deployment state
  const [bulkJson, setBulkJson] = useState("[]");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkManifestResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
```

**Claim:** Section 3 owns 4 state variables. Extracting into `<SwarmDeployment />` removes 4 state hooks from the page.
**Self-check:** Direct sed excerpt. **EQUIVALENT.**

---

## Impact Assessment

### Affected Components

**NEW:**
- `src/app/manifest/_components/SoulBuilder.tsx` (~150 lines, includes form state + JSX + TIER_LABEL/TIER_DESCRIPTION maps)
- `src/app/manifest/_components/SwarmDeployment.tsx` (~80 lines, includes JSON parsing + JSX)

**EDIT:**
- `src/app/manifest/page.tsx` (470 → ~200 lines; becomes a top-level orchestrator)
- `CHANGELOG.md` (add a new entry under `[Unreleased] ### Changed`)

**UNTOUCHED:**
- `src/types/control-frames.ts`
- `src/lib/manifest-mock.ts`
- `src/lib/mock-ipc.ts`
- `src/lib/ipc.ts`
- `workspace-savant/` (5 files)
- `src/lib/soul.ts`
- `src/types/raw.d.ts`
- `next.config.mjs`
- `src/app/chat/page.tsx`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [ ] High: Major feature broken, no workaround
- [x] Low: Minor issue, cosmetic, or refactor

**Risk notes:** the split is a pure refactor — no new features, no schema changes, no IPC contract changes. The components are leaf nodes with no children. The localStorage key (`LS_SOUL_BUILT`) is shared via the parent callback. The SEC #8 enforcement stays in `mock-ipc.ts`. The form state is encapsulated in `<SoulBuilder />`. The bulk state is encapsulated in `<SwarmDeployment />`.

---

## Proposed Solution

### Approach

1. **`refactor(extract):` step** — Create `src/app/manifest/_components/SoulBuilder.tsx` with Section 1's form state + JSX. Add a callback prop `onBuilt: (entry: BuiltSoulEntry) => void` so the parent can update its `builtSoul` state.
2. **`refactor(extract):` step** — Create `src/app/manifest/_components/SwarmDeployment.tsx` with Section 3's JSON parsing + JSX. No callback prop (result is purely local UI state).
3. **`refactor(rewrite):` step** — Rewrite `src/app/manifest/page.tsx` to use the 2 new components. Section 2 (Draft Buffer) is inlined (reads `builtSoul` from parent state). Section 4 (Active Baseline) is inlined (read-only, no state). Page drops to ~200 lines.

### Steps

**Loop 1, Step 1 — extract `<SoulBuilder />` component**

1. Create `src/app/manifest/_components/SoulBuilder.tsx` (~150 lines):
   - Import `useState`, `useCallback`, `Card` from `@heroui/react`, `manifestSoul` from `@/lib/ipc`, types from `@/types/control-frames`.
   - Move `STATUS_LABEL`, `STATUS_COLOR`, `TIER_LABEL`, `TIER_DESCRIPTION`, `DEFAULT_TIER` constants into this file.
   - Move `BuiltSoulEntry` type (or import from a shared `types.ts`).
   - Move the 6 state hooks + the `onManifestSubmit` callback.
   - Move the Section 1 JSX (form + status badge).
   - Export the component with props `{ onBuilt: (entry: BuiltSoulEntry) => void }`.

**Loop 1, Step 2 — extract `<SwarmDeployment />` component**

2. Create `src/app/manifest/_components/SwarmDeployment.tsx` (~80 lines):
   - Import `useState`, `useCallback`, `Card`, `bulkManifest` from `@/lib/ipc`, types from `@/types/control-frames`.
   - Move the 4 state hooks + the `onBulkDeploy` callback.
   - Move the Section 3 JSX (textarea + button + success metric).
   - Export the component with no props.

**Loop 1, Step 3 — rewrite the page**

3. Rewrite `src/app/manifest/page.tsx` (~200 lines):
   - Keep the `import { useEffect, useState }` for the Draft Buffer's `builtSoul` state.
   - Keep the `LS_SOUL_BUILT` constant + `useEffect` for localStorage hydration.
   - Keep Section 2 (Draft Buffer) inlined (it reads `builtSoul` from parent state).
   - Keep Section 4 (Active Baseline) inlined (3 cards from `@/lib/soul`).
   - Replace Section 1's form JSX with `<SoulBuilder onBuilt={setBuiltSoul} />`.
   - Replace Section 3's bulk JSX with `<SwarmDeployment />`.

4. Update CHANGELOG.md with a `### Changed` entry: "Refactored `src/app/manifest/page.tsx` 470 → 200 lines by extracting Section 1 (Builder Form) into `<SoulBuilder />` and Section 3 (Swarm Deployment) into `<SwarmDeployment />` under `src/app/manifest/_components/`."

### Verification

Per protocol.config.yaml + package.json scripts:

- `npx tsc --noEmit` — typecheck (must pass; new components must be sound + the `<SoulBuilder onBuilt={...} />` callback must be type-safe)
- `npx prettier --check .` — formatting (must pass; the 3 file changes must be clean)
- `npm run build` — `next build` under `output: "export"` (must succeed; the new components are client-side only, no SSR impact)
- `wc -l src/app/manifest/page.tsx` — must return ≤ 250 lines (target: ~200; budget for comments + type imports)
- `wc -l src/app/manifest/_components/SoulBuilder.tsx` — must return ≤ 200 lines
- `wc -l src/app/manifest/_components/SwarmDeployment.tsx` — must return ≤ 120 lines
- `code-reviewer-minimax-m3` — review the 3 file changes for LESSON-018 fidelity preserved (no behavior changes; pure refactor)

---

## Perfection Loop

### Loop 0 — FID-Doc Convergence (pasteback-driven)

| PB | Claim | Pasteback | Self-check | Loop-0 Diff |
|---|---|---|---|---|
| PB-1 | v3 page is 470 lines (over 400-line limit) | `wc -l src/app/manifest/page.tsx` | EQUIVALENT | **PASS** |
| PB-2 | Section 1 owns 6 state variables | `src/app/manifest/page.tsx:78-85` | EQUIVALENT | **PASS** |
| PB-3 | Section 3 owns 4 state variables | `src/app/manifest/page.tsx:93-98` | EQUIVALENT | **PASS** |

**All 3 pastebacks PASS.** Loop 0 FID-doc convergence COMPLETE per LESSON-016. FID status: `analyzed`.

### Loop 1 — RED → GREEN → AUDIT (code, post-Spencer-ratify)

#### RED — issues identified (anticipated)

- [ ] `<SoulBuilder />` callback prop type safety: `onBuilt: (entry: BuiltSoulEntry) => void` — the parent's `setBuiltSoul` is `Dispatch<SetStateAction<BuiltSoulEntry | null>>` which is `(value: BuiltSoulEntry | null | ((prev: BuiltSoulEntry | null) => BuiltSoulEntry | null)) => void`. The callback type is narrower than the setter. **Fix:** use `useCallback` to wrap the setter, or widen the prop type to accept the full setter.
- [ ] Section 2 (Draft Buffer) needs `builtSoul` state to be hoisted to the page (since Section 1's onBuilt callback updates it). The page owns the `builtSoul` state, not the `<SoulBuilder />`. This is correct — the callback is the channel.
- [ ] The `_components/` directory needs to be outside the `app/` route (Next.js App Router treats any folder under `app/` as a route unless prefixed with `_`). The `_` prefix is the convention; it's the underscore that matters, not the directory name.

#### GREEN — fixes applied (3 steps, see §Steps)

- Step 1: `src/app/manifest/_components/SoulBuilder.tsx` (NEW)
- Step 2: `src/app/manifest/_components/SwarmDeployment.tsx` (NEW)
- Step 3: `src/app/manifest/page.tsx` (REWRITE) + `CHANGELOG.md` (EDIT)

#### AUDIT — verification

- [ ] `npx tsc --noEmit` — passes
- [ ] `npx prettier --check .` — passes (3 file changes)
- [ ] `npm run build` — `next build` under `output: "export"` succeeds
- [ ] `wc -l src/app/manifest/page.tsx` — ≤ 250 lines
- [ ] `wc -l src/app/manifest/_components/SoulBuilder.tsx` — ≤ 200 lines
- [ ] `wc -l src/app/manifest/_components/SwarmDeployment.tsx` — ≤ 120 lines
- [ ] `code-reviewer-minimax-m3` — APPROVE

### Change Delta

- `src/app/manifest/_components/SoulBuilder.tsx` (NEW) — ~150 lines
- `src/app/manifest/_components/SwarmDeployment.tsx` (NEW) — ~80 lines
- `src/app/manifest/page.tsx` (REWRITE) — 470 → ~200 lines (-270 lines)

Total new code: ~-40 lines net (extraction is a refactor; small efficiency gain from removed duplication).

---

## Resolution

*(Filled in at `verified` status, after AUDIT gates pass.)*

- **Fixed By:** *(pending)*
- **Fixed Date:** *(pending)*
- **Fix Description:** *(pending)*
- **Verified By:** *(pending — tsc, build, prettier, line-count + code-reviewer-minimax-m3)*
- **Commit/PR:** 3 steps (no git commit per destructive-commands rule)
- **Archived:** *(pending — at release cut per ECHO §FID Auto-Archive)*

---

## Lessons Learned

- **SPLIT PATTERN IS ESTABLISHED.** The `settings/page.tsx` FID-0004 follow-on split established the pattern: extract leaf components into a `_components/` directory under the page's folder, hoist shared state via callback props (or React Context for deeper trees), keep the page as a thin orchestrator. This FID applies the same pattern to `manifest/page.tsx`.
- **SECTION 2 STAYS INLINED.** Section 2 (Draft Buffer) shares state with Section 1 (the `builtSoul` entry from `onManifestSubmit`). Inlining Section 2 in the page avoids the prop-drilling that would result from extracting both into separate components. The page is the natural owner of `builtSoul` since it's the cross-section persistence target.
- **SECTION 4 STAYS INLINED.** Section 4 (Active Baseline) is read-only data from `@/lib/soul`. Extracting it would just add an import without any state encapsulation benefit. The 3 cards are pure JSX over imported data.
- **AWAITING SPENCER RATIFY.** This FID is a deferred split — the description is complete but the implementation is gated on Spencer ratify + a future turn. The FID-006 v3 implementation is verified and closed; the overshoot is documented; the follow-up is tracked.
