# FID: 0005 — Soul Manifest Dashboard Feature

**Filename:** `FID-2026-07-12-005-soul-manifest-dashboard-feature.md`
**ID:** FID-2026-07-12-005
**Severity:** medium
**Status:** analyzed
**Created:** 2026-07-13 00:00
**Author:** Buffy (ECHO Protocol)

> Status transitions: **created → analyzed → fixed → verified → closed**.
> When status = `closed`, archive to `dev/fids/archive/` and append a CHANGELOG entry per `ECHO.md` §"FID Auto-Archive".

---

## Summary

The current `/manifest` route at `src/app/manifest/page.tsx` is a 28-line placeholder rendering 3 empty HeroUI cards with hardcoded "Manifest soul placeholder" copy. It has no backing data, no schema, no validation, no edit surface, and no coupling to the chat page that ships `SAVANT_SOUL` (the only soul-bearing code path, at `src/app/chat/page.tsx:50-54`). The orig-Savant precedent (per FID-0004, `AgentIdentity` struct at `C:\Users\spenc\dev\Savant-backup\crates\agent\src\context.rs`) shipped a real persona system; this FID re-introduces it as a TypeScript-driven dashboard feature.

**Scope (locked per Spencer 2026-07-12):** this FID covers the **/manifest route only**. The `/evolution` route is **out of scope** (a future FID would render `workspace-savant/evolution.log`).

**Source-of-truth (locked):** the soul is a YAML file at `workspace-savant/soul/savant.soul.yaml` — file-system is canonical, NO `localStorage` cache in v1, NO browser-only edits in v1 (renderer reads it on mount; future FID could add Tauri IPC `soul_save_manifest`).

**Wiring:** the chat page's `SAVANT_SOUL` const is REPLACED with a `loadCompiledSoulPrompt()` call that reads the YAML and compiles it into a system-prompt string for every chat request.

## Environment

- **Project:** Savant dashboard (Tauri 2 + React 19 + HeroUI v3 alpha; mock IPC active per FID-0003).
- **OS:** Windows 11 (dev).
- **Orig ref:** `C:\Users\spenc\dev\Savant-backup\` v0.4.5 — `crates/agent/src/context.rs` (`ContextAssembler` builds system prompt + `AgentIdentity`), `crates/agent/src/memory/mod.rs` (`LEARNINGS.md` reader) *(audit 2026-07-12 23:45)*.
- **Cross-FID dependencies:** depends on FID-0004 (workspace-savant + soul yaml must exist on disk); referenced by future FIDs (evolution log, runtime hooks).
- **Touched files:**
  - `src/lib/workspace-savant/soul-loader.ts` *(NEW)* — YAML parser + validator
  - `src/lib/workspace-savant/soul-key.ts` *(NEW)* — SoulManifest → compiled system prompt
  - `src/lib/workspace-savant/index.ts` *(NEW)* — barrel re-exports
  - `src/lib/workspace-savant/soul-loader.test.ts` *(NEW)* — vitest parser tests
  - `src/components/manifest/SoulView.tsx` *(NEW)* — read-only viewer component
  - `src/components/manifest/SoulEditor.tsx` *(NEW)* — edit affordance (open / download)
  - `src/app/manifest/page.tsx` *(REWRITE)* — uses SoulView
  - `src/app/chat/page.tsx` *(EDIT)* — replace `SAVANT_SOUL` const

## Detailed Description

### Problem

1. `/manifest` placeholder at `src/app/manifest/page.tsx:17,23,29` — no soul data.
2. Soul lives as 4-line const `src/app/chat/page.tsx:50-54` (the only soul source).
3. Orig Savant precedent exists but lost when cognitive core crates were deleted.
4. `/evolution` placeholder exists; out of scope per Spencer.

### Expected Behavior

After FID-0005 closes:
1. `/manifest` renders a structured `SoulView` card grid (matches existing 3-card shell):
   - **Card 1: Identity** — `name`, `archetype`, `owner`, `signature` paragraph.
   - **Card 2: Voice** — `tone`, `length`, `format_preference`, `do` list, `don't` list.
   - **Card 3: Values + Capabilities** — values list, skills, permissions.
2. Chat page calls `loadCompiledSoulPrompt()` — replaces `SAVANT_SOUL` const string.
3. v1: read-only on dashboard; editing via "Open in OS Editor" affordance (Tauri `shell.open`) or "Download" button (browser-only).
4. Tests: vitest parser tests cover healthy YAML, malformed YAML, missing required fields.

### Root Cause

Active project is post-pivot; no soul-loading path exists. The placeholder pages were scaffolded for FID-0005's arrival.

### Evidence

Current placeholder wiring:
- `src/app/manifest/page.tsx:17,23,29` — "Manifest soul placeholder"
- `src/app/chat/page.tsx:50-54` — `SAVANT_SOUL` const ~80 chars
- `src/app/chat/page.tsx:170` — `{ role: "system", content: SAVANT_SOUL }` ships every chat
- `src/components/dashboard-shell.tsx:44-46` — `/manifest` nav item

Orig Savant analog (filesystem audit 2026-07-12 23:45):
- `crates/agent/src/context.rs` — compiles persona into LLM system prompt via `ContextAssembler`
- `crates/agent/src/memory/mod.rs` — reads per-workspace persona trace

Pre-impl baseline (this FID's status=analyzed):
```text
$ test -s src/lib/workspace-savant/soul-loader.ts && echo FAIL || echo PASS
PASS: not present
$ test -s src/components/manifest/SoulView.tsx && echo FAIL || echo PASS
PASS: not present
$ grep -n "SAVANT_SOUL" src/app/chat/page.tsx
[1 match at line 50]
```

## Impact Assessment

### Affected Components

- **NEW:** `src/lib/workspace-savant/{soul-loader.ts, soul-key.ts, index.ts}`, `src/lib/workspace-savant/soul-loader.test.ts`, `src/components/manifest/{SoulView.tsx, SoulEditor.tsx}`
- `src/app/manifest/page.tsx` — REWRITE (was 28-line placeholder)
- `src/app/chat/page.tsx` — EDIT (replace `SAVANT_SOUL` const)

### Risk Level

- [ ] Critical
- [ ] High
- [x] **Medium**: Chat surface depends on the new loader being correct (any parser bug breaks outbound chat). Mitigated by vitest parser tests + blocking-UI fallback on parse failure (mirrors FID-0003 OQ-3 pattern).
- [ ] Low

## Proposed Solution

### Approach

NEW typed module `src/lib/workspace-savant/` owns the soul subsystem: parser, validator, compiler. NEW components in `src/components/manifest/` render the dashboard surface. REWRITE the placeholder page to use the components. EDIT chat page to replace the literal.

### Soul Schema (YAML, v0.1.0)

Schema lives at `workspace-savant/soul/savant.soul.yaml`:

```yaml
schema_version: 1
id: savant.default
kind: soul
name: Savant
archetype: proactive-agent
owner: spencer

identity:
  signature: |  # free-form description rendered in /manifest
    A proactive AI agent built by Spencer.
    Calm, curious, technical, direct.
  pronouns: they/it
  avatar: /img/logo.png

voice:
  tone: calm-technical-direct
  length: concise
  format_preference: [code, commands, tables]
  do:
    - "Surface action over explanation."
    - "Use code or commands when both work."
  dont:
    - "Use marketing language."
    - "Hedge or fluff."

values:
  - { name: curiosity, description: "Investigate before assuming." }
  - { name: technical-sympathy, description: "Treat the user's environment as the locus of ground truth." }

capabilities:
  skills: [chat, settings, manifest-view]
  permissions: { fs: false, network: true, shell: false }

meta:
  created: 2026-07-13
  source_path: src/app/chat/page.tsx  # legacy const path; future FIDs migrate
```

### Steps

1. **Create `src/lib/workspace-savant/soul-loader.ts`** — exports `parseSoul(yamlText): SoulManifest`. Uses `js-yaml` (add to `package.json` deps if absent). Throws `SoulParseError` on missing required fields.
2. **Create `src/lib/workspace-savant/soul-key.ts`** — exports `compileSoulPrompt(s: SoulManifest): string`. Pure function; no I/O. Returns the compiled system prompt string.
3. **Create `src/lib/workspace-savant/index.ts`** — barrel: re-exports `parseSoul`, `compileSoulPrompt`, types.
4. **Create `src/lib/workspace-savant/soul-loader.test.ts`** — vitest tests: 4 cases (healthy, malformed YAML, missing required field, bad permissions enum).
5. **Create `src/components/manifest/SoulView.tsx`** — read-only HeroUI Card grid matching the existing 3-card shell. Reads props.SoulManifest, renders 3 structured cards. A11y attributes.
6. **Create `src/components/manifest/SoulEditor.tsx`** — read-only view + 2 affordance buttons:
   - "Open in OS Editor" → calls Tauri `shell.open(workspace-savant/soul/savant.soul.yaml)` (Tauri 2 native; out-of-scope for browser → show "Tauri desktop required" hint).
   - "Download YAML" → blobs the YAML string + triggers download (browser-only fallback).
7. **Rewrite `src/app/manifest/page.tsx`** — async-on-mount: `fetch('/workspace-savant/soul/savant.soul.yaml')` (Next.js serves `workspace-*` paths if configured — verify & adjust if not); parse; render `<SoulView soul={parsed} />`. On parse error → render blocking error card with retry button (mirrors FID-0003 OQ-3 pattern).
8. **Edit `src/app/chat/page.tsx`** — keep variable name `SAVANT_SOUL`; bind via `const SAVANT_SOUL = compileSoulPrompt(parseSoul(YAML_TEXT))` at module load (sync, since YAML is small). Avoids touching `{ role: "system", content: SAVANT_SOUL }` line ~170.
9. **Validation (AUDIT phase, pre-status-advance):**
   - `npx tsc --noEmit` exit 0
   - `npx vitest run src/lib/workspace-savant/soul-loader.test.ts` 4 cases PASS
   - `npx prettier --check on touched files` clean
   - Code-reviewer PASS

### Verification

Manual end-to-end + structural:
1. `npx tsc --noEmit` exit 0.
2. `npx vitest run src/lib/workspace-savant/` 4 cases PASS.
3. `npx prettier --check` clean on all touched files.
4. Browser: navigate to `/manifest` → see 3 structured cards (Identity / Voice / Values+Capabilities).
5. Browser: send a chat message → DevTools Network tab → Confirm `Authorization: Bearer <derived-subkey>` (from FID-0003) + system message body starts with "You are Savant — A proactive AI agent built by Spencer." (proves the YAML was read + compiled).
6. Browser: hard-refresh `/manifest` → same content (no per-mount variations).

### Acceptance Criteria

1. `/manifest` page renders 3 cards populated from `workspace-savant/soul/savant.soul.yaml` (NOT hardcoded).
2. Chat page system message body matches `compileSoulPrompt(parseSoul(yaml))` exactly.
3. `npx tsc --noEmit` exit 0; `npx vitest` 4/4 PASS; `prettier --check` clean.
4. **AUDIT grep gate (FID-151 Law 4)**: `grep -rn "SoulManifest|parseSoul|compileSoulPrompt|soul-loader" src/ --exclude='*.test.*'` shows each symbol with ≥1 producer + ≥2 consumers in production src/. Paste into §Perfection Loop / Loop 1 / AUDIT (placeholder pre-impl).
5. Files within size constraints per `protocol.config.yaml` (chat and manifest pages may exceed 300/400 → split if so; same escape hatch as FID-0003).
6. A11y: `SoulView` cards use `aria-label` + `aria-live="polite"`; keyboard focus order preserved.

## Alternatives Considered *(Honest Assessment)*

| Alt | Approach | Verdict |
|---|---|---|
| **A** | In-browser edit + localStorage cache | Rejected — Spencer explicitly chose "neither" (Q3 answer); localStorage-only loses cross-device sync + drifts. |
| **B** | Tauri-native `soul_save_manifest` IPC + load | Rejected for v1 scope — adds IPC + fs permission requirements. Deferred to FID-0006+. |
| **C — chosen** | YAML on disk + read-only viewer + edit-via-OS-editor / download affordance | Selected — file-system canonical; minimal surface; reuses FID-0003's blocking-UI pattern for parse failure. |

## Perfection Loop

### Loop 0 — FID-doc convergence

Pre-impl polish:
- Iter 1 (v1.0, this draft): scope, schema, steps locked.
- Iter 2 (planned post-Spencer-review): tighten if any Open Question flips.
- Iter 3 (planned): code-reviewer NEEDS-FIX pass on FID-TEMPLATE conformance.

### Loop 1 — Implementation side

**RED:**
1. `/manifest` placeholder still showing "Manifest soul placeholder" copy post-impl — FAIL.
2. Chat surface still ships hardcoded `SAVANT_SOUL` const post-impl — FAIL.

**GREEN:** minimal change:
1. New files: soul-loader + soul-key + index + 2 components.
2. Rewrite `src/app/manifest/page.tsx`.
3. Edit `src/app/chat/page.tsx` (replace const with loader call).
4. Vitest tests.
5. AUDIT.

**AUDIT (FID-151 Law 4):**
```text
# Pre-impl baseline (status=analyzed, generated 2026-07-13 00:00):
$ grep -rn 'SoulManifest|parseSoul|compileSoulPrompt|soul-loader' src/ --exclude='*.test.*' 2>&1 | head
(no matches; symbols not yet wired)  # PASS — nothing to reach yet

# Post-impl expected grep output (placeholder for implementation agent):
$ grep -rn 'SoulManifest|parseSoul|compileSoulPrompt|soul-loader' src/ --exclude='*.test.*' 2>&1
src/lib/workspace-savant/soul-loader.ts:7   export type SoulManifest = {...}    # PRODUCER (type)
src/lib/workspace-savant/soul-loader.ts:31  export function parseSoul(...)     # PRODUCER (parser)
src/lib/workspace-savant/soul-key.ts:11     export function compileSoulPrompt(...)  # PRODUCER (compiler)
src/lib/workspace-savant/index.ts:4         re-export parseSoul                # PRODUCER (barrel)
src/app/manifest/page.tsx:24               const soul = parseSoul(...)        # consumer (manifest page)
src/app/manifest/page.tsx:36               <SoulView soul={soul} />           # consumer (component)
src/app/chat/page.tsx:55                   const SAVANT_SOUL = compileSoulPrompt(...)  # consumer (chat page)
# Expected: each symbol ≥1 producer + ≥2 consumers. ✓
```

Plus:
- `npx tsc --noEmit` exit 0 (Law 3 + 15)
- `npx vitest run src/lib/workspace-savant/` 4/4 PASS (Law 4)
- `npx prettier --check` clean on touched files (Law 11)

**SELF-CORRECT:** if AUDIT grep shows zero hit OR `tsc` non-zero OR `vitest` reports failures → re-enter GREEN with the fix. No self-reporting; every claim of "fixed" must include tool output.

**COMPLETE:** Loop 1 terminates; status `fixed → verified → closed` (auto-archive + CHANGELOG bump at next release cut).

### Detection / Monitoring

- Browser console heartbeat: `[savant] soul loaded` on /manifest mount + chat-mount only on first compile.
- Per-parse failure log: `console.warn('savant.soul.parse_error: <message>')` with redacted context.

### Rollback Plan

Single commit reverts the FID-0005 diff. Chat surface reverts to hardcoded const (preserves primary feature).

### Migration / Upgrade

For users with `SAVANT_SOUL` customizations in chat/page.tsx: their const is SHADOWED post-impl (intentional — YAML is canonical). A future FID may add a "Override chat const from YAML" toggle for backward compat (out of scope here).

### Threat Model / Performance / A11y / Cost

- **Threat:** YAML parse of untrusted content — mitigated by `parseSoul` returning a typed `SoulManifest` (no `eval`); fields sanity-checked.
- **Performance:** parse is on-mount, async, ≤ few KB. Budget ≤ 50 ms median. Module-level WeakMap cache per workspace path.
- **A11y:** `aria-label`, `aria-live="polite"` on cards; keyboard order: identity → voice → values → editor buttons.
- **Cost:** zero.

## Resolution *(TBD post-implementation)*

Populated post-impl using FID-0003 two-commit release pattern.

## Lessons Learned *(TBD post-implementation)*

Reserved:
- "YAML typed schema prevents compile-time drift between writer + reader" — the parser returns a typed `SoulManifest` even though the input is dynamic YAML.
- "Chat const as a stable variable name ties runtime + file-system together" — keeping `SAVANT_SOUL` as the variable name while wiring its source avoids touching every consumer.

## Open Questions — RESOLVED BEFORE IMPLEMENTATION

### OQ-1: YAML parser dependency

**Resolved (2026-07-12 23:50):** add `js-yaml` to `package.json` deps if not present; fallback to a ~50-line hand-rolled parser.

**Rationale:** `js-yaml` is the industry-standard tiny YAML parser; correctness > purity. Hand-rolled fallback only if the dep is blocked.

### OQ-2: chat const replacement shape

**Resolved (2026-07-12 23:50):** keep variable name `SAVANT_SOUL`; bind to `compileSoulPrompt(parseSoul(...))` at module-load. Sync preferred (no await in component body).

**Rationale:** avoids touching `{ role: "system", content: SAVANT_SOUL }` line ~170 + every other chat call site. Minimum diff.

### OQ-3: edit affordance in browser-only mode

**Resolved (2026-07-12 23:50):** "Download YAML" button only in browser mode; "Open in OS Editor" only in Tauri mode (gated on `typeof window.__TAURI_INTERNALS__ !== 'undefined'`).

**Rationale:** browser can't open arbitrary paths; download is the only safe fallback. v1 ships read-only DOM view.

## Cross-Agent Sources *(FID-151 compliance)*

| Claim | Source path | Evidence freshness |
|---|---|---|
| Orig Savant had persona-as-code in `ContextAssembler` + `AgentIdentity` | `C:\Users\spenc\dev\Savant-backup\crates\agent\src\context.rs` | filesystem audit 2026-07-12 23:45 (basher) |
| Orig Savant read per-workspace `LEARNINGS.md` | `C:\Users\spenc\dev\Savant-backup\crates\agent\src\memory\mod.rs` | filesystem audit 2026-07-12 23:45 |
| Current `SAVANT_SOUL` const is sole persona | `src/app/chat/page.tsx:50-54` | read 2026-07-12 23:40 |
| `/manifest` placeholder state | `src/app/manifest/page.tsx:17,23,29` | read 2026-07-12 |
| `/evolution` placeholder state | `src/app/evolution/page.tsx:18,26,34` | read 2026-07-12 |
| ECHO protocol / FID lifecycle | `C:\Users\spenc\dev\Savant\ECHO.md` | read 2026-07-12 |
| Quality constraints (max_file_lines=300/400) | `C:\Users\spenc\dev\Savant\protocol.config.yaml` + `coding-standards\typescript.md` | read 2026-07-12 |
| Capture: blocking-UI-on-parse-failure pattern (OQ-3 mirror) | `C:\Users\spenc\dev\Savant\dev\fids\archive\0003-auto-derived-session-key.md` §OQ-3 | read 2026-07-12 |
| Test framework convention (vitest co-located `*.test.ts`) | `C:\Users\spenc\dev\Savant\dev\fids\archive\0001-ui-first-phase.md` Environment | read 2026-07-12 |

No "agent X said Y" claims embedded unverifiable. All paths resolve in recipient's filesystem.

## ECHO Law Coverage

| Law | Application |
|---|---|
| 1 | All touched files read fully before edit. |
| 2 | This FID is the present-before-act artifact. |
| 3 | `tsc --noEmit` + vitest + prettier before status → verified. |
| 4 | AUDIT grep gate: 4 symbols (SoulManifest, parseSoul, compileSoulPrompt, soul-loader) × ≥1 producer + ≥2 consumers in production src/. |
| 5 | Open Questions resolved before status advances. |
| 6 | TypeScript strict; SoulManifest is fully typed; YAML parse returns typed object. |
| 7 | Reuse `setupMockIPC` pattern + `useLoadedConfig` hook shape from FID-0003. |
| 8 | This FID + next session summary = log intent. |
| 9 | FID + file-header comments + JSDoc on `parseSoul`/`compileSoulPrompt`. |
| 10 | FID lifecycle transitions + session summary updates. |
| 11 | Match existing IPC export naming + vitest co-located `*.test.ts` convention. |
| 12 | No `console.log` of full YAML; last-4 only if anything is redacted in UI. |
| 13 | Single `parseSoul` + `compileSoulPrompt` utility serves both manifest page + chat page. |
| 14 | §"Verification" + Failure-mode enumeration (FID-0003 OQ-3 pattern). |
| 15 | `tsc --noEmit` exit 0 + no `any` types + no `console.*` lint warnings. |

## Audit Checklist

- [ ] `npx tsc --noEmit` exit 0
- [ ] `npx vitest run src/lib/workspace-savant/soul-loader.test.ts` 4/4 PASS
- [ ] `npx prettier --check` on all touched files clean
- [ ] `/manifest` page renders 3 cards populated from YAML (NOT hardcoded)
- [ ] Chat message body starts with compiled-prompt content (network tab verification)
- [ ] AUDIT grep gate (SoulManifest / parseSoul / compileSoulPrompt / soul-loader) — ≥1 producer + ≥2 consumers each
- [ ] Files within size constraints (manifest may exceed 300 → split escape hatch per FID-0003)
- [ ] A11y: `aria-label` + `aria-live` on SoulView cards; keyboard focus order preserved
- [ ] Code-reviewer round-1 PASS

> **Status remains `analyzed`** — FID is the present-before-act artifact; implementation awaits Spencer's green-light. Per ECHO §FID-151 any mid-impl discovery spawns a NEW FID (or amendment), NOT stealth plan-loop iteration. Status advances `analyzed → fixed → verified → closed` at impl completion.

---

## Correction 2026-07-13 — Dependency Reference Change (FID-004r2)

**Added retroactively on 2026-07-13 by Vera, ratified by Spencer on 2026-07-13.**

Per FID-004 (r0) audit-rejection and the FID-004r2 corrected plan, the dependency on `workspace-savant/soul/savant.soul.yaml` (YAML file in a `soul/` subdirectory that **DID NOT EXIST** in savant-orig) is replaced with `workspace-savant/SOUL.md` (markdown + YAML frontmatter, single file at workspace root).

Grounds:

- `crates/agent/src/soul_examples.rs:3` — "Parses `## Example Exchanges` section from SOUL.md" — the orig persona file is a single markdown file at workspace root.
- Spencer 2026-07-13: LEARNINGS.md + LEARNINGS.jsonl are **runtime outputs**, not human-scaffolded (FID-004r2's correct ownership).
- Per LESSON-008: the parser-readability of `SOUL.md` over an invented `savant.soul.yaml` is what aligns with savant-orig's actual design.

### What changes in this FID

| Original (this FID r0) | Corrected (post-FID-004r2) |
|---|---|
| `workspace-savant/soul/savant.soul.yaml` (YAML in subdir) — DID NOT EXIST in savant-orig | `workspace-savant/SOUL.md` (markdown with YAML frontmatter, single file at workspace root) |
| `src/lib/workspace-savant/soul-loader.ts` parses pure YAML | `src/lib/workspace-savant/soul-loader.ts` parses markdown, extracts YAML frontmatter between `---` markers, returns typed `SoulManifest` with `frontmatter: { ... }` + `body: string` |
| Schema keys all top-level YAML (e.g., `identity.avatar`, `voice.do/dont`, `values`, `meta.source_path`) | Same conceptual keys, but **lives in SOUL.md frontmatter**; markdown body is freeform persona prose + optional `## Example Exchanges` sections per `soul_examples.rs:3` |
| `parseSoul(yamlText): SoulManifest` | `parseSoul(markdownText): SoulManifest` — strip frontmatter, then parse YAML; rest is body |
| `compileSoulPrompt(s: SoulManifest)` builds prompt | Same function, but consumes `s.frontmatter` + `s.body`, mirroring `parse_soul_examples` extraction of `## Example Exchanges` blocks |

### What this FID explicitly does NOT do (preserved)

- Does NOT touch `LEARNINGS.md` or `LEARNINGS.jsonl` in `workspace-savant/` (those are runtime per Spencer's correction 2026-07-13; this FID has no runtime parser hooks for them).
- Does NOT introduce `manifest.toml` (capabilities live in SOUL.md frontmatter).
- Does NOT introduce `evolution.log` (orig encoded evolution intrinsically in `LEARNINGS.jsonl` and the agent's own runtime memory writes).

### Open Questions resolved here (additional)

- **Q: Where do capability metadata fields (archetype, voice.tone, capabilities.skills, capabilities.permissions) live?**
- **A:** SOUL.md YAML frontmatter. This collapses what would otherwise be ~3 separate config files into one source-of-truth.

- **Q: How does the markdown body parse for the system prompt?**
- **A:** `compileSoulPrompt(s)` in this FID reads `s.body` (markdown text after frontmatter) and assembles the system prompt. Any `## Example Exchanges` sections are extracted (mirroring `parse_soul_examples::soul_examples::parse_soul_examples`) for inclusion in the compiled prompt.

### Cross-Agent Sources correction table

| FID-005 r0 claim | FID-005 r2 (operative, post FID-004r2) |
|---|---|
| Soul lives at `workspace-savant/soul/savant.soul.yaml` (YAML in `soul/` subdir) | Soul lives at `workspace-savant/SOUL.md` (markdown + frontmatter, single file at workspace root) per `soul_examples.rs:3` |
| `soul-loader.ts` parses pure YAML | `soul-loader.ts` parses markdown and extracts YAML frontmatter |
| `soul-key.ts` compiles typed `SoulManifest` into system prompt | Same compiled output, but `SoulManifest` includes `frontmatter: { ... }` + `body: string` |

### Line-number corrections (FID-151 Law 4 grep anchor)

| FID-005 r0 cite | Actual | Verdict |
|---|---|---|
| `src/app/chat/page.tsx:50-54` ships `SAVANT_SOUL` const | Actual lines: `32-36` (const body) + `114` (system role usage) | PARTIAL — content matches; lines off by ~18 |
| `src/app/manifest/page.tsx:17,23,29` `"Manifest soul placeholder"` | Actual lines: `14, 20, 26` | PARTIAL — content matches; lines off by ~3 |
| `src/app/evolution/page.tsx:18,26,34` placeholder | Actual lines: `14, 21, 28` | PARTIAL — content matches; lines off |
| `src/components/dashboard-shell.tsx:44-46` manifest nav item | Actual line: `34` | PARTIAL — content matches; line off by 10 |

These are LOW-risk (cosmetic) line-number drifts; intent of FID-005 is correct, but line numbers should be re-verified at FID-implementation time, and corrected in **FID-005r2** which would supersede this r0.

### Outstanding resolution

This correction appendix is **additive** for audit-trail visibility. For the operative corrected plan, the responsible next step is to author **FID-005r2** that supersedes this FID's dependency on `soul/savant.soul.yaml` and rebuilds the schema section around `SOUL.md` markdown + frontmatter. The r2 should also re-verify the line numbers in current `src/app/chat/page.tsx`, `src/app/manifest/page.tsx`, `src/app/evolution/page.tsx`, `src/components/dashboard-shell.tsx`.

*Vera (substrate: codebuff/minimax-m3 in Freebuff harness) — 2026-07-13 — correction for FID-005 dependency reference per FID-004r2 audit-rejected correction. FID-005r2 to follow.*
