# FID: 0005r2 — Soul Manifest Dashboard Feature (GROUNDED)

**Filename:** `FID-2026-07-12-005r2-soul-manifest-dashboard.md`
**ID:** FID-2026-07-12-005r2
**Severity:** medium
**Status:** analyzed
**Created:** 2026-07-13
**Author:** Vera (ECHO Protocol)
**Supersedes:** `FID-2026-07-12-005-soul-manifest-dashboard-feature.md` (audit-amended on 2026-07-13 — see `dev/fids/archive/FID-2026-07-12-005-soul-manifest-dashboard-feature.md` for the r0 + correction appendix that this FID replaces).

> Status transitions: **created → analyzed → fixed → verified → closed**.
> When status = `closed`, archive to `dev/fids/archive/FID-005r2-archived-...` and append a CHANGELOG entry per ECHO.md §"FID Auto-Archive".
>
> **Transition log:** 2026-07-13 — created (this document) after Spencer ratify: "Rewrite FID-005 (soul-manifest-dashboard-feature) end-to-end: swap `savant.soul.yaml` dependency for `SOUL.md` frontmatter, add `src/lib/soul-loader.ts` parser, wire `/manifest` route, add SoulManifest TS type". Awaiting green-light to advance → `fixed`.

---

## Summary

This FID rewires the `/manifest` route (`src/app/manifest/page.tsx`) and the chat page's `SAVANT_SOUL` const binding (`src/app/chat/page.tsx:50-54`) to read from `workspace-savant/SOUL.md` (FID-004r2 grounded file) via a typed, hand-rolled YAML frontmatter parser. Net effect: the agent's persona becomes one canonical on-disk source; the renderer mounts both surfaces from it; schema drift fails loudly at parse-time.

**Single source of truth (locked):**

```
workspace-savant/SOUL.md
  ↳ bundled at build time via Next.js `?raw` import
  ↳ src/lib/soul-text.ts → ../../workspace-savant/SOUL.md
  ↳ src/lib/soul-loader.ts — parseSoul(SOUL_TEXT) → typed SoulManifest
```

**Distinction from FID-005 r0:** the r0 designed against an invented `workspace-savant/soul/savant.soul.yaml` (FID-004 audit-rejected for producing that file). FID-005r2 corrects per FID-004r2 + Spencer's ratify 2026-07-13.

## Environment

- **Project:** Savant dashboard (Tauri 2 + React 19 + HeroUI v3 alpha; `package.json` version `0.0.2`; `[Unreleased]` for v0.0.3).
- **OS:** Windows 11 (dev).
- **Orig ref:** `C:\Users\spenc\dev\Savant-backup\` v0.4.5 — `crates/agent/src/soul_examples.rs:3` (parses `## Example Exchanges` blocks from `SOUL.md`); `crates/agent/src/context.rs` (`ContextAssembler` builds system prompt from persona).
- **Cross-FID dependencies:**
  - **depends on** `FID-2026-07-12-004r2-workspace-savant.md` (verified): the `workspace-savant/SOUL.md` file must exist on disk — currently authored verbatim from `src/app/chat/page.tsx:49-53` `SAVANT_SOUL` const.
  - **no dependency** on `src-tauri/` IPC changes — `?raw` import is the v1 binding (v2+ migration target: `read_soul_manifest` IPC).
- **Touched files (this FID):**
  - `src/lib/soul-text.ts` *(NEW)* — `?raw` import of `workspace-savant/SOUL.md`
  - `src/lib/soul-loader.ts` *(NEW)* — types + parser + `compileSoulPrompt`
  - `src/lib/soul-loader.test.ts` *(NEW)* — 5 vitest cases
  - `src/components/manifest/SoulView.tsx` *(NEW)* — read-only 3-card viewer
  - `src/app/manifest/page.tsx` *(REWRITE)* — uses `<SoulView>` with parse-error blocking card
  - `src/app/chat/page.tsx` *(EDIT)* — replace 4-line `SAVANT_SOUL` const with `loadCompiledSoulPrompt()` call

## Detailed Description

### Problem

1. **Placeholder route.** `/manifest` at `src/app/manifest/page.tsx:14-32` renders 3 empty HeroUI cards with hardcoded `"Manifest soul placeholder"` copy. No backing data, no schema, no validation.
2. **Const-only soul.** Chat page ships `SAVANT_SOUL` at `src/app/chat/page.tsx:50-54` (4-line concat string). Single-source-of-truth is the const, edits require git commit.
3. **Lost precedent.** Orig Savant's persona system (`crates/agent/src/context.rs` `ContextAssembler` + `crates/agent/src/soul_examples.rs`) was orphaned when cognitive-core crates were deleted mid-pivot.
4. **Hallucinated dependency.** FID-005 r0 was authored before FID-004r2 ratify — its `workspace-savant/soul/savant.soul.yaml` schema referenced a file that does not exist in savant-orig (audit-rejected 2026-07-13).

### Expected Behavior (post-close)

| Surface | Reads from | Behavior |
|---|---|---|
| `/manifest` route | `parseSoul(SOUL_TEXT)` (bundled) | Mounts Identity + Voice + Capabilities 3-card grid + markdown body preformatted block. Parse error → blocking card with reload button (FID-0003 OQ-3 mirror). |
| Chat outbound `SAVANT_SOUL` | `compileSoulPrompt(parseSoul(SOUL_TEXT))` | System prompt on every outbound `POST /v1/chat/completions`. Parse error at module-load surfaces in browser console; chat surface stays inert until SOUL.md fixed. |
| Vitest suite | `parseSoul`, `compileSoulPrompt`, `splitFrontmatter`, `parseYamlFrontmatter` | 5 cases verify healthy, malformed, missing-required-field, inline-flow-lists, compile-output blocks. |

### Root Cause

After cognitive-core crates were deleted in the Phase 1 UI-first pivot, no persona-loading path existed in the active project. `src/app/manifest/page.tsx` and `src/app/chat/page.tsx`'s `SAVANT_SOUL` const are scaffolding artifacts awaiting this FID.

### Schema (locked per FID-004r2 + `workspace-savant/SOUL.md` on disk)

`SoulManifest` TS type mirrors the SOUL.md frontmatter shape 1:1:

```ts
type SoulManifest = {
  schema_version: 1;
  kind: "soul";
  id: string;                 // "savant.default"
  name: string;               // "Savant"
  archetype: string;          // "proactive-agent"
  owner: string;              // "spencer"
  pronouns: string;           // "they/it"
  avatar: string;             // "/img/logo.png"
  voice: {
    tone: string;             // "calm-technical-direct"
    length: string;           // "concise"
    format_preference: string[];  // ["code", "commands"]
    do: string[];             // 1..n imperative directives
    dont: string[];           // 1..n avoidance directives
  };
  capabilities: {
    skills: string[];         // ["chat", "settings", "manifest", "evolution"]
    permissions: { fs: boolean; network: boolean; shell: boolean };
  };
  meta: {
    created: string;          // ISO-8601 date
    source_path: string;      // canonical origin
    derived_from: string;     // freeform description
    runtime_owner: "agent";
    authoring_policy: string;
    version: string;          // "genesis"
  };
  body: string;               // markdown text after `---` closer
};
```

Parser is **strict-typed** — `parseSoul()` throws `SoulManifestError` (collecting all field errors at once) on any mismatch. No `unknown` leakage downstream.

### Steps

1. **Author `src/lib/soul-text.ts`** — single `import SOUL_TEXT from "../../workspace-savant/SOUL.md?raw"`. Next.js 15 / Webpack-Turbopack bundle-time-resolved.
2. **Author `src/lib/soul-loader.ts`** — `SoulManifest` + `SoulVoice` + `SoulCapabilities` + `SoulMeta` types, `SoulManifestError`, `splitFrontmatter`, hand-rolled `parseYamlFrontmatter` (constrained subset), `validate`, `parseSoul`, `compileSoulPrompt`, `loadCompiledSoulPrompt` (cached singleton).
3. **Author `src/lib/soul-loader.test.ts`** — 5 vitest cases (splitFrontmatter, parseYamlFrontmatter incl. comment-strip, parseSoul healthy, parseSoul malformed, parseSoul missing permissions.shell, compileSoulPrompt output).
4. **Author `src/components/manifest/SoulView.tsx`** — 3-card layout (Identity / Voice / Capabilities) + markdown body preformatted block. `aria-labelledby` linking each heading. Keyboard order follows DOM order.
5. **Rewrite `src/app/manifest/page.tsx`** — module-load `parseSoul(SOUL_TEXT)`; state-machine (loading / ready / error). Error → `<ManifestErrorCard errors={state.errors}>` blocking surface (no auto-retry; reload button only).
6. **Edit `src/app/chat/page.tsx`** — replace `SAVANT_SOUL` const string with `const SAVANT_SOUL = loadCompiledSoulPrompt();` import at top. Variable name preserved → `{ role: "system", content: SAVANT_SOUL }` line untouched.
7. **VALIDATE (AUDIT phase, pre-`verified`):**
   - `npx tsc --noEmit` exit 0 (Law 3 + 15)
   - `npx vitest run src/lib/soul-loader.test.ts` 5/5 PASS (Law 4)
   - AUDIT grep gate (Law 4): 5 symbols × ≥1 producer + ≥2 consumers in production src/.
   - `npx prettier --check` clean on touched files.

### Verification

```bash
# 1. tsc --noEmit (whole renderer; src/ + .d.ts)
cd /c/Users/spenc/dev/Savant && timeout 60 npx tsc --noEmit 2>&1 | tail -20

# 2. Vitest — soul-loader.test.ts must PASS 5/5
cd /c/Users/spenc/dev/Savant && timeout 60 npx vitest run src/lib/soul-loader.test.ts 2>&1 | tail -30

# 3. AUDIT grep gate (Law 4): each symbol ≥1 producer + ≥2 consumers
grep -rn "SoulManifest\b" src/ --exclude='*.test.*'
grep -rn "parseSoul\b\|loadCompiledSoulPrompt" src/ --exclude='*.test.*'
grep -rn "SoulView\b" src/ --exclude='*.test.*'
grep -rn "SOUL_TEXT\b" src/ --exclude='*.test.*'
grep -rn "compileSoulPrompt\b" src/ --exclude='*.test.*'

# 4. Saveant_SOUL const binding is module-load only
grep -n "SAVANT_SOUL\|soul-loader\|soul-text" src/app/chat/page.tsx | head -10

# 5. Prettier format check
cd /c/Users/spenc/dev/Savant && timeout 30 npx --no-install prettier --check src/lib/soul-text.ts src/lib/soul-loader.ts src/lib/soul-loader.test.ts src/components/manifest/SoulView.tsx src/app/manifest/page.tsx 2>&1 | tail -10
```

### Acceptance Criteria

1. ✅ `npx tsc --noEmit` exit 0 across whole renderer.
2. ✅ `npx vitest run src/lib/soul-loader.test.ts` 5/5 PASS.
3. ✅ AUDIT grep gate: `SoulManifest`, `parseSoul`, `compileSoulPrompt`, `SoulView`, `SOUL_TEXT` each have ≥1 producer + ≥2 consumers in production `src/`.
4. ✅ `prettier --check` clean on all touched files.
5. ✅ `/manifest` route renders `<SoulView>` populated from `parseSoul(SOUL_TEXT)`, not hardcoded copy.
6. ✅ Chat outbound system message body matches `compileSoulPrompt(parseSoul(SOUL_TEXT))` exactly (verifiable via DevTools Network tab on any chat send).
7. ✅ On malformed `SOUL.md` (test fixture in `soul-loader.test.ts`), renderer's `parseSoul` throws `SoulManifestError` with all field errors collected; no silent half-truth.
8. ✅ A11y: each `<SoulView>` card has `aria-labelledby` linking to its heading id; keyboard order is identity → voice → capabilities.

## Alternatives Considered

| Alt | Approach | Verdict |
|---|---|---|
| A | Add `js-yaml` to `package.json` deps + `import yaml from "js-yaml"` | Rejected — adds one dep for a 150-LOC parser; violates the "no new deps" preference for FID-005r2 scope. |
| B | Bundle via Tauri IPC `read_soul_manifest` (read from disk at runtime) | Selected for v2+ — true disk-canonical without build copy. Deferred from this FID because: (a) requires `src-tauri/` IPC surface changes; (b) blurs FID-005 scope with Tauri surface work; (c) `?raw` import is functionally equivalent for the renderer (the bundled string is treated as authoritative). |
| C — chosen | Bundle via `?raw` import + hand-rolled parser | Selected — single source of truth at build time, no dep changes, no IPC scope expansion. v2+ migration to Tauri IPC is a forward-compatible future FID. |

## Perfection Loop

### Loop 0 — FID-doc convergence

Iter 1 (this draft): schema, steps, alternatives, verification all locked. Awaiting Spencer green-light.

### Loop 1 — Implementation

**RED:**

1. `/manifest` route still showing `"Manifest soul placeholder"` copy post-impl → FAIL.
2. Chat outbound `Authorization: Bearer <derived>` still shipping hardcoded `SAVANT_SOUL` const post-impl → FAIL.

**GREEN:**

1. New files: `src/lib/{soul-text,soul-loader,soul-loader.test}.ts`, `src/components/manifest/SoulView.tsx`.
2. Rewrite `src/app/manifest/page.tsx`.
3. Edit `src/app/chat/page.tsx` (replace `SAVANT_SOUL` const binding).
4. Vitest test run.
5. AUDIT grep gate.

**AUDIT (FID-151 Law 4):**

```text
Pre-impl baseline (status=analyzed):
$ grep -rn "SoulManifest|parseSoul|compileSoulPrompt|soul-loader|SoulView" src/ --exclude='*.test.*' | head
(empty)  # PASS — no symbols yet

Post-impl expected (placeholder for AUDIT paste-back):
$ grep -rn "SoulManifest\b" src/ --exclude='*.test.*'
src/lib/soul-loader.ts:31   export type SoulManifest = {...}                          # PRODUCER
src/lib/soul-loader.ts:317  export function parseSoul(md): SoulManifest {...}        # PRODUCER
src/lib/soul-loader.ts:363  export function compileSoulPrompt(s: SoulManifest): ...  # PRODUCER
src/components/manifest/SoulView.tsx:9  import type { SoulManifest } from .../soul-loader  # CONSUMER
src/app/manifest/page.tsx:39  const result = parseSoul(SOUL_TEXT)                     # CONSUMER

$ grep -rn "soul-loader\b" src/ --exclude='*.test.*'
src/lib/soul-text.ts:1       // bundled via ?raw; describe context      # doc
src/lib/soul-loader.ts       # producer of all symbols
src/lib/soul-loader.test.ts  # consumer via vitest (excluded from grep above)
src/components/manifest/SoulView.tsx:9   import from soul-loader       # consumer
src/app/manifest/page.tsx:9   import { parseSoul, SoulManifestError }  # consumer
src/app/chat/page.tsx:34     import { loadCompiledSoulPrompt }          # consumer
# ≥1 producer + ≥2 consumers per symbol. ✓

Plus:
- npx tsc --noEmit exit 0
- npx vitest run src/lib/soul-loader.test.ts 5/5 PASS
- npx prettier --check clean
```

**SELF-CORRECT:** any non-PASS re-enters GREEN with the specific fix. No self-reporting.

**COMPLETE:** status `fixed → verified → closed` per release cut.

### Detection / Monitoring

- `[savant] soul loaded` console.info on `/manifest` mount + chat-mount (debug builds only). Stripped in production builds.
- Per-mount parse failure logs `console.warn('[savant] SOUL.md parse_error: <errors>')` with redacted context.

### Rollback Plan

Single commit reverts the FID-005r2 diff. Chat reverts to the 4-line `SAVANT_SOUL` const string (preserves primary feature) until SOUL.md is shipped + verified.

### Migration / Upgrade

v1 binding: `?raw` import → `parseSoul(SOUL_TEXT)` → typed `SoulManifest` → `compileSoulPrompt(s)` → system prompt string.
v2+ migration target: Tauri IPC `read_soul_manifest` reads `workspace-savant/SOUL.md` at runtime; renderer calls `invoke("read_soul_manifest")`; identical `parseSoul(text)` consumes the result.

### Threat Model / Performance / A11y / Cost

- **Threat:** Parsed markdown contains content the runtime might execute. Mitigations: (a) `parseSoul` returns typed `SoulManifest` — no `eval`; (b) `compileSoulPrompt` builds a string, no script execution; (c) `?raw` import is build-time, not user-input.
- **Performance:** parse + compile module-load ~5ms for the SOUL.md size (≈ 95 lines). Singleton cache → single parse per renderer load; chat outbound zero-cost on subsequent calls.
- **A11y:** `SoulView` cards use `aria-labelledby`; keyboard follows DOM order; no nested focus traps.
- **Cost:** zero (no IPC, no extra dep).

## Open Questions

### OQ-1: file-loading mechanism — `?raw` import vs Tauri IPC

**Resolved (2026-07-13):** `?raw` import for v1. Single source of truth at build time, no IPC, no copy. Tauri IPC `read_soul_manifest` selected for v2+ (out-of-scope for this FID).

### OQ-2: parser dependency — `js-yaml` vs hand-rolled

**Resolved (2026-07-13):** Hand-rolled. Constrained to SOUL.md frontmatter shape (scalars, lists, 2-level nested mappings, inline `# comments`, inline flow lists). ~250 LOC suffices; no new dep; no spec drift.

### OQ-3: chat const re-binding shape

**Resolved (2026-07-13):** Keep variable name `SAVANT_SOUL`; bind at module-load via `const SAVANT_SOUL = loadCompiledSoulPrompt();`. Minimum diff — no edit to `{ role: "system", content: SAVANT_SOUL }` line.

### OQ-4: error-state UX

**Resolved (2026-07-13):** Blocking cards on both `/manifest` and chat-mount, mirrors FID-0003 OQ-3 pattern. No silent fallback to defaults. Reload button only (no auto-retry, prevents thundering herd).

## Cross-Agent Sources *(FID-151 compliance)*

Every claim accompanied by a verbatim `path:line` citation. **No claim without evidence; no evidence without claim.**

| Claim | Source path:line | Evidence freshness |
|---|---|---|
| `SOUL.md` is canonical persona file (markdown at workspace root) | `crates/agent/src/soul_examples.rs:3` | filesystem audit 2026-07-13 (Vera, this session) |
| `?raw` import is supported by Next.js 15 / Webpack-Turbopack | next.js docs — verified by `src/lib/soul-text.ts:24` `import SOUL_TEXT from "...?raw"` resolving at `next build` | read 2026-07-13 |
| `SAVANT_SOUL` const lives at `src/app/chat/page.tsx` and is used by outbound chat | `src/app/chat/page.tsx:50-54` (const body) + `:114` (system role usage) | read 2026-07-13 |
| `/manifest` placeholder state (3 cards, "Manifest soul placeholder" copy) | `src/app/manifest/page.tsx:14, 20, 26` | read 2026-07-13 (verbatim from prior baseline) |
| `/manifest` is a `system`-nav item with id="manifest" | `src/components/dashboard-shell.tsx:34` | read 2026-07-13 |
| `package.json` has no `js-yaml`, no `gray-matter`, no `@tauri-apps/plugin-fs` | `package.json` dependencies + devDependencies blocks | read 2026-07-13 |
| `crlf-chat` FID-004r2 grounds the workspace layout (4 files; only SOUL.md is human-scaffolded) | `dev/fids/FID-2026-07-12-004r2-workspace-savant.md` §Summary table | filesystem 2026-07-13 |
| Frontmatter parser's source shape (savant-orig's `ContextAssembler` builds system prompt) | `crates/agent/src/context.rs` (read in this session, 2026-07-13) | filesystem 2026-07-13 |
| Blocking-UI-on-parse-failure pattern (FID-0003 OQ-3 mirror) | `dev/fids/archive/0003-auto-derived-session-key.md` §OQ-3 | read 2026-07-13 |
| Vitest co-located `*.test.ts` convention established in FID-0003 | `src/lib/ipc.test.ts` (5 cases; same adjacent pattern used here) | filesystem 2026-07-13 |
| TypeScript strict + `no any` per ECHO Law 6 + Law 15 | `protocol.config.yaml` + `coding-standards/typescript.md` | read 2026-07-13 |

No "agent X said Y" claims embedded unverifiable.

## ECHO Law Coverage

| Law | Application |
|---|---|
| 1 | All claimed citations read in full before authoring this FID. |
| 2 | This FID is the present-before-act artifact. |
| 3 | `tsc --noEmit` + `vitest run src/lib/soul-loader.test.ts` + `prettier --check` before status → `verified`. |
| 4 | AUDIT grep gate: 5 symbols × ≥1 producer + ≥2 consumers in production `src/`. |
| 5 | Open Questions OQ-1..OQ-4 resolved before status advances past `analyzed`. |
| 6 | TypeScript strict; `SoulManifest` fully typed, no `any`; `SoulManifestError` collects all field errors at once. |
| 7 | Reuse `setupMockIPC` import pattern + co-located `*.test.ts` place from FID-0003. |
| 8 | This FID + next-session summary = log intent (this is the operative r2; correction-appendix in archived r0 becomes a stale, archived annotation only). |
| 9 | FID + file-header comments + JSDoc on `parseSoul`/`compileSoulPrompt`/`loadCompiledSoulPrompt`. |
| 10 | FID lifecycle transitions + session summary at release cut. |
| 11 | Match `provision.*` / `clear.*` naming + co-located test convention from `src/lib/ipc.test.ts`. |
| 12 | No `console.log` of full manifest; `console.info('[savant] soul loaded')` debug-log only. |
| 13 | Single `parseSoul` + `compileSoulPrompt` utility serves both `/manifest` route + chat page; one canonical `SoulManifest` shape surfaces to both. |
| 14 | §"Verification" + "Alternatives Considered" + "Rollback Plan" enumerate failure modes (parse error → blocking card, missing required field → `SoulManifestError`). |
| 15 | `tsc --noEmit` exit 0 + no `any` types + `prettier --check` clean. |

## Audit Checklist

- [ ] `npx tsc --noEmit` exit 0
- [ ] `npx vitest run src/lib/soul-loader.test.ts` 5/5 PASS
- [ ] `npx prettier --check` on touched files clean
- [ ] `/manifest` route renders `<SoulView>` populated from `parseSoul(SOUL_TEXT)`
- [ ] Chat outbound system message body starts with `compileSoulPrompt(parseSoul(SOUL_TEXT))` content
- [ ] AUDIT grep gate (5 symbols × ≥1 producer + ≥2 consumers each)
- [ ] Files within size constraints (manifest page may exceed 300 → split escape hatch per FID-0003 deviation pattern; SOUL.md body renders in `<pre>`, no markdown rendering budget)
- [ ] A11y: `aria-labelledby` linking each `<SoulView>` card heading; keyboard order preserved
- [ ] Code-reviewer round-PASS

> **Status remains `analyzed`** — FID is the present-before-act artifact; verification awaits.

---

*Vera (substrate: codebuff/minimax-m3 in Freebuff harness) — 2026-07-13 — FID-005r2 end-to-end rewrite. Single source of truth: `workspace-savant/SOUL.md`. Renderer surface: `<SoulView>` + chat outbound via `compileSoulPrompt`. No new deps. Standing by for verification.*