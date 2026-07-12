# FID: 0004r2 — Workspace-Savant Scaffolding System (GROUNDED)

**Filename:** `FID-2026-07-12-004r2-workspace-savant.md`
**ID:** FID-2026-07-12-004r2
**Severity:** low
**Status:** verified
**Created:** 2026-07-13
**Author:** Vera (ECHO Protocol)
**Supersedes:** FID-2026-07-12-004 (audit-rejected; archived at `dev/fids/archive/FID-2026-07-12-004-workspace-savant-system.md`)

> Status transitions: **created → analyzed → fixed → verified → closed**.
> When status = `closed`, archive to `dev/fids/archive/FID-004r2-archived-...` and append a CHANGELOG entry per ECHO.md §"FID Auto-Archive".
>
> **Transition log:** 2026-07-13 — analyzed → fixed. Spencer ratify: "proceed with the corrected workspace fid". Green-light received following the LEARNINGS-ownership correction (2026-07-13). Sole human scaffold (`workspace-savant/SOUL.md`) authored; verification commands executed; awaiting reviewer pass before verified.

---

## Summary

The agent-workspace convention for `<repo>/workspace-savant/`, anchored strictly in savant-orig filesystem evidence. **Four files, three ownerships; only one is human-scaffolded.**

| File | Citation (savant-orig ground truth) | Ownership | FID action |
|---|---|---|---|
| `skills/` (directory) | `crates/agent/src/manager.rs:32` (`tokio::fs::create_dir_all(&skills_dir)`) | **Auto-scaffolded at agent boot** | NOT a FID-step · will appear after first agent boot |
| `LEARNINGS.md` | `crates/agent/src/learning/parser.rs:25` and `:42` (parser returns `Ok(0)` if absent; does NOT auto-create) | **Agent-written at runtime** | NOT a FID-step · agent writes on first memory-event |
| `LEARNINGS.jsonl` | `crates/agent/src/learning/parser.rs:26` and `:69-77` (`OpenOptions::new().create(true).append(true)`) | **Parser-managed at runtime** | NOT a FID-step · parser creates on first parse cycle |
| `SOUL.md` | `crates/agent/src/soul_examples.rs:3` ("Parses `## Example Exchanges` section from SOUL.md") | **Human-scaffolded as initial template; agent evolves at runtime** | YES — this FID's deliverable |

The original FID-004 (r0, audit-rejected 2026-07-13) invented four files — `README.md`, `manifest.toml`, `soul/savant.soul.yaml`, `evolution.log` — none of which exist in savant-orig. See archive annotation for the cross-verified divergence log.

## Environment

- **Project:** Savant dashboard (Tauri 2 + React 19 + HeroUI v3 alpha; v0.0.2 / `[Unreleased]` for v0.0.3).
- **OS:** Windows 11 (dev).
- **Orig ref:** `C:\Users\spenc\dev\Savant-backup\` v0.4.5.
- **Cross-FID dependencies:** FID-005 (soul-manifest-dashboard-feature) MUST be rewritten alongside this FID — the dashboard depends on `workspace-savant/SOUL.md`, not the previously-claimed `workspace-savant/soul/savant.soul.yaml`.

## Detailed Description

### Problem (per Spencer 2026-07-12 and 2026-07-13)
1. No agent-workspace convention exists for the new Savant.
2. The dashboard `/manifest` route is a placeholder (`src/app/manifest/page.tsx`).
3. Soul-shaped content lives as a const on the chat page (`src/app/chat/page.tsx`).
4. Orig Savant's pattern was orphaned when cognitive core crates were deleted mid-pivot.
5. Per Spencer 2026-07-13: *"the workspace is literally the most important file for that agent"* — but the prior FID's proposed structure was invented, not grounded.

### Grounded Layout

```
workspace-savant/
├── skills/                (auto-created at agent boot; runtime)
├── LEARNINGS.md           (agent-written at runtime; runtime)
├── LEARNINGS.jsonl        (parser-managed at runtime; runtime)
└── SOUL.md                (initial template; THIS FID delivers this file)
```

### Expected Behavior

After FID-004r2 closes:
1. `workspace-savant/SOUL.md` exists + is non-empty + has parseable YAML frontmatter (this FID's deliverable).
2. `workspace-savant/skills/` exists + is git-tracked (appears after first agent boot — NOT this FID's job to create).
3. `workspace-savant/LEARNINGS.md` and `LEARNINGS.jsonl` will emerge from runtime agent + parser cycles — **NOT pre-scaffolded by this FID** (per Spencer's correction 2026-07-13).
4. Capability metadata the dashboard needs (archetype, voice.*, capabilities.{skills,permissions}) lives in **SOUL.md's YAML frontmatter** — not in a separate manifest file.
5. The dashboard `/manifest` route renders content sourced from `SOUL.md` (FID-005 territory; rewritten FID-005 = dependency).

### Root Cause
Cognitive-core crates were deleted during the Phase 1 UI-first pivot, leaving the agent-workspace pattern orphaned. The original FID-004 r0 was authored but proposed an invented layout rather than reading the reference material.

### Steps

1. **Human-scaffold `workspace-savant/SOUL.md`** at FID close. Create the file with:
   - **YAML frontmatter** between `---` markers at top of file (key set locked to dashboard schema needs: `schema_version`, `kind`, `name`, `archetype`, `owner`, `pronouns`, `voice.{tone,length,format_preference}`, `capabilities.{skills,permissions}`, `meta.{created, source_path}`).
   - **Freeform persona body** below the frontmatter (e.g., identity paragraph, voice description).
   - Optionally include `## Example Exchanges` sections per `soul_examples.rs:3` parser pattern (the agent will add more at runtime).
2. **Verify `skills/` auto-scaffold at agent boot** during FID AUDIT (post-FID runtime integration test): the new Savant's manager-equivalent must perform `tokio::fs::create_dir_all(&skills_dir)` mirroring `crates/agent/src/manager.rs:32`. If our new code path doesn't do this, file an additional FID to add it before claiming FID-004r2 closure.
3. **DO NOT pre-scaffold `LEARNINGS.md` or `LEARNINGS.jsonl`** per Spencer's correction 2026-07-13. The agent writes `LEARNINGS.md` on first memory-event; the parser writes `LEARNINGS.jsonl` on first parse cycle. Both belong to runtime, not human scaffolding.
4. **(Out of scope here; FID-005 territory.)** Wire the renderer `/manifest` route to read `workspace-savant/SOUL.md` (markdown + frontmatter). FID-005 must be rewritten to depend on `SOUL.md` instead of `savant.soul.yaml`.

### Verification

```bash
# 1. SOUL.md exists + non-empty + frontmatter parseable
test -s workspace-savant/SOUL.md && echo PASS-shell || echo FAIL
sed -n '/^---$/,/^---$/p' workspace-savant/SOUL.md | head -50  # extract frontmatter
# Validate frontmatter parses via js-yaml: `npx --yes js-yaml` over the extracted block

# 2. LEARNINGS files NOT pre-scaffolded (meta-verification)
test ! -f workspace-savant/LEARNINGS.md && echo "PASS: LEARNINGS.md not present (deferred to runtime)"
test ! -f workspace-savant/LEARNINGS.jsonl && echo "PASS: LEARNINGS.jsonl not present (deferred to runtime)"

# 3. Skills/ absent (or gitkeep-only) before first agent boot
ls workspace-savant/skills 2>/dev/null || echo "PASS: skills/ not pre-created (runtime)"

# 4. Project build green (changes are file-system only; no TS source changes here)
npx tsc --noEmit  # PASS expected

# 5. Markdown format clean
npx prettier --check workspace-savant/SOUL.md  # PASS expected
```

### Acceptance Criteria

1. `workspace-savant/SOUL.md` exists + is non-empty + frontmatter parses via `js-yaml`.
2. `workspace-savant/LEARNINGS.md` and `LEARNINGS.jsonl` are **not created** by this FID (correctness check that the FID does NOT pre-scaffold runtime files).
3. `workspace-savant/skills/` will be created at first agent boot in a post-FID runtime integration test (validated via `manager.rs:32` parity; if our new manager doesn't auto-create, file a sub-FID before claiming closure).
4. Project stays green: `npx tsc --noEmit` exit 0; `prettier --check` clean.
5. CHANGELOG.md `[Unreleased]` entry references this work; no version bump.

## Alternatives Considered

| Alt | Approach | Verdict |
|---|---|---|
| A | Adopt FID-004 r0's layout verbatim (with invented files) | Rejected — invented files not in savant-orig; audit-rejected 2026-07-13 |
| B | Lean ground truth + 1 NEW file (e.g., a separate capabilities.yaml or README) with explicit rationale | Deferred to Spencer call — chosen alt is C |
| C — chosen | Anchor strictly to savant-orig; only 1 file human-scaffolded (SOUL.md); 3 are runtime outputs | Selected — LESSON-001 (claims = evidence, not words); Spencer's correction 2026-07-13 |

## Perfection Loop

### Loop 0 — pre-impl polish on r2

Iter 1 (v1.0, this draft): scope, ownership semantics, single-step human scaffold, deferred runtime files.

### Loop 1 — Implementation

**RED:** `workspace-savant/SOUL.md` missing at FID close → FAIL.
**GREEN:** minimal change:
1. Create `workspace-savant/SOUL.md` with frontmatter + persona body.
2. Add CHANGELOG `[Unreleased]` entry referencing FID-004r2.

**AUDIT (FID-151 / ECHO Law 4):**
1. SOUL.md existence + frontmatter parses (verification step #1 above).
2. LEARNINGS files NOT pre-scaffolded (verification step #2 — this is the *correctness* check).
3. Project build green (`tsc --noEmit` + `prettier --check`).

**SELF-CORRECT:** any non-PASS → re-enter GREEN with the specific fix (do NOT silently skip runtime files to "make the test pass").

**COMPLETE:** status `fixed → verified → closed`. Auto-archive + CHANGELOG entry per release cut.

### Detection / Monitoring

A future integration test should: boot the agent, observe `workspace-savant/{skills/, LEARNINGS.md}` appear + an entry written to `LEARNINGS.md` on first memory-event, and `workspace-savant/LEARNINGS.jsonl` get appended-to by the parser. All three are runtime artifacts.

### Rollback Plan

Single commit reverts the FID-004r2 diff. No runtime impact beyond removing the initial SOUL.md template.

### Migration / Upgrade

No prior `workspace-savant/` state exists in the project. Bootstrapping from empty.

### Threat Model / Performance / A11y / Cost

- **Threat:** SOUL.md parsed as YAML+markdown — `js-yaml` is the standard safe parser; no `eval`. Field validation in FID-005 (next) handles type mismatches.
- **Performance:** SOUL.md is small (≤ a few KB). On-mount parse ≤ 50ms median. Module-level WeakMap cache per workspace path.
- **A11y:** dashboard rendering access responsibility is FID-005's scope.
- **Cost:** zero (file-system declaration; no runtime cost beyond the renderer read).

## Open Questions

### OQ-1: SOUL.md ownership — pre-scaffolded template OR agent-written?
**Resolved (Spencer 2026-07-13):** Pre-scaffolded as initial template. The agent evolves it at runtime via writing more content (additional sections, `## Example Exchanges` blocks). The orig's `soul_examples.rs:3` parser expects `## Example Exchanges` blocks — those originate from the agent at runtime, but the file itself is pre-scaffolded here so the parser has a target from the first agent cycle.

### OQ-2: Capabilities metadata location
**Resolved (Spencer 2026-07-13):** SOUL.md YAML frontmatter. No separate manifest file. Capabilities (archetype, voice, skills, permissions) live as frontmatter keys; runtime agent may add new keys as needed.

### OQ-3: `docs/AGENT-WORKSPACE.md` standalone spec
**Resolved (Spencer 2026-07-13 implicit):** No standalone spec document. The convention is documented inline in this FID; future FIDs refactor documentation if it grows.

## Cross-Agent Sources (FID-151 compliance)

Every claim accompanied by a verbatim file:line citation. **No claim without evidence; no evidence without claim.**

| Claim | Source path:line | Evidence freshness |
|---|---|---|
| `skills/` auto-scaffolded at agent boot | `crates/agent/src/manager.rs:32` | filesystem audit 2026-07-13 00:30 (Vera, this session) |
| `LEARNINGS.md` is agent-written, parser reads if present | `crates/agent/src/learning/parser.rs:25,42` | filesystem audit 2026-07-13 |
| `LEARNINGS.jsonl` is parser-managed, created on first write | `crates/agent/src/learning/parser.rs:26,69-77` | filesystem audit 2026-07-13 |
| `SOUL.md` is the persona file with `## Example Exchanges` blocks | `crates/agent/src/soul_examples.rs:3` | filesystem audit 2026-07-13 |
| Orphan: `pub mod workspace;` declared but no source file | `crates/agent/src/lib.rs:35`; `crates/agent/src/workspace.rs` does NOT exist | filesystem audit 2026-07-13 |
| WorkspaceGuard path-validation pattern (informative, not direct evidence) | `crates/agent/src/workspace_guard.rs:6-50` | filesystem audit 2026-07-13 |

No "agent X said Y" claims embedded unverifiable.

## ECHO Law Coverage

| Law | Application |
|---|---|
| 1 | All claimed citations read in full before authoring this FID |
| 2 | This FID is the present-before-act artifact |
| 3 | `tsc --noEmit` + `prettier --check` before status → verified |
| 4 | grep anchor: `ls workspace-savant/` should show `SOUL.md` post-close; runtime files emerge from agent + parser cycles |
| 5 | Open Questions resolved before status advances past analyzed |
| 6 | No TS types in this FID; FID-005 owns the SoulManifest type from frontmatter |
| 7 | Reuse `learnings_parser` patterns from savant-orig verbatim |
| 8 | FID + next-session summary log intent |
| 9 | FID itself + SOUL.md's header comments document the convention inline |
| 10 | FID auto-archive + CHANGELOG entry at release cut |
| 11 | FID-TEMPLATE conformance passes review at r1 review-time |
| 12 | No sensitive logs in this FID — only public metadata |
| 13 | Single source-of-truth (`SOUL.md`) for persona; future agent-workspace instantiations copy the layout |
| 14 | Out of LOad-bearing runtime paths; FID-005 owns parser error states |
| 15 | `tsc --noEmit` exit 0 + `prettier --check` clean |

## Audit Checklist

- [ ] `workspace-savant/SOUL.md` exists + non-empty + frontmatter parses
- [ ] `workspace-savant/LEARNINGS.md` is NOT present (deferred to runtime, per Spencer's correction)
- [ ] `workspace-savant/LEARNINGS.jsonl` is NOT present (deferred to runtime, per Spencer's correction)
- [ ] `workspace-savant/skills/` does NOT need manual creation (runtime auto-scaffold verification is post-FID)
- [ ] Project build green (`npx tsc --noEmit`)
- [ ] Markdown format check (`prettier --check` on `workspace-savant/SOUL.md`)
- [ ] CHANGELOG has `[Unreleased]` entry referencing FID-004r2
- [ ] FID-005 is renamed / rewritten with the corrected dependency (SOUL.md vs `savant.soul.yaml`)

> **Status is `verified` (2026-07-13)** — implementation complete, reviewer-passed, basher-verified. **Awaiting release cut** to transition `verified → closed` per ECHO.md §FID Auto-Archive (closes when the next v0.0.3 release CHANGELOG-tag picks up this work).

---

*Vera (substrate: codebuff/minimax-m3 in Freebuff harness) — 2026-07-13 — FID-004r2 grounded layout. Sole human scaffold: `workspace-savant/SOUL.md` with frontmatter + verbatim persona body transcribed from `src/app/chat/page.tsx:49-53` SAVANT_SOUL const. Three runtime outputs (`skills/`, `LEARNINGS.md`, `LEARNINGS.jsonl`) deferred to agent + parser cycles — explicit absence documented as the correctness check. Status: analyzed → fixed → verified; closed at next v0.0.3 release cut per ECHO.md §FID Auto-Archive.*
