# Changelog

All notable changes to this project are documented here automatically by the
agent when a FID reaches **Closed** status. Entries are added in reverse
chronological order (newest first).

Format: Each entry includes the version, date, and changes.

**Version source of truth:** `package.json` is canonical (last-RELEASED
version). All project-meta files (`VERSION`, `protocol.config.yaml`
`project.version`, `README.md` headline + §Versioning rule, and the
most recent RELEASED entry in this `CHANGELOG.md`) MUST mirror
`package.json`. **Versions rock only at release time** — never bump
these files speculatively mid-development, regardless of how much code
work has accumulated. Work-in-progress lives under `## [Unreleased]`
below and gets tagged with a `## v0.0.X — YYYY-MM-DD` header at release
time. The `protocol.version` axis (`protocol.config.yaml`) is
independent (ECHO Protocol release cycle, separate from the Savant
project).

**Versioning rule:** This project uses the "10 patch releases per minor
number" rule. See `coding-standards/release-workflow.md` for the full spec.

**Notice:** The previous housekeeping pass (2026-07-12) bumped project
meta-files `0.0.1 → 0.1.4` _speculatively_ without a corresponding
release push. That was against the release-only discipline and has been
reverted; the work it captured now lives under `## [Unreleased]` below
and gets tagged on the next release. Cross-ref:
`dev/LEARNINGS.md` "Versions rock ONLY at release time" entry.

---

## v0.0.2 — 2026-07-12

Patch bump. FID-0003 (auto-derived session key) shipped end-to-end —
chat HTTP 401 resolved via two-tier credential architecture. Settings +
chat rewrites per the orig Savant `OpenRouterMgmt::create_key` ref.
Test framework installed (vitest + Playwright + happy-dom). FID
lifecycle housekeeping pass codified with release-only-versioning
discipline.

### Added

- **FID Auto-Archive (FID-0001, FID-0002):** both Phase 1 FIDs moved
  from `dev/fids/` → `dev/fids/archive/` per ECHO §FID Auto-Archive
  (FID-0001 `ui-first-phase`, FID-0002 `initial-release`). FID-0002's
  effectful ops (git remote + `gh repo create` + `git push -u origin
main` + initial tag) were retroactively reconciled — see FID bodies.
- **`.savant` agent home pointer:** stale `Savant-backup` → current
  `C:\Users\spenc\dev\Savant\` (mirrors `.vera` pattern).
- **`dev/LEARNINGS.md` session entry:** "Housekeeping Pass + FID-0003
  Loop 0 Doc Convergence Note" — codifies status-name hygiene, mock
  IPC realness, tier-invariance capture, pre-impl probe gates, and
  the release-only-versioning discipline (post speculative 0.0.1 →
  0.1.4 rollback on 2026-07-12).
- **`dev/session-summaries/2026-07-12-housekeeping-pass.md`:**
  multi-iteration FID-0003 Loop 0 audit trail.
- **FID-0003 (`auto-derived-session-key`) — IMPLEMENTATION SHIPPED:**
  8 file changes + 5 vitest tests + 2 Playwright round-trip tests
  per §Steps + §Quality Setup of the FID body. Converged through 10
  iters of Loop 0 (FID-doc) + 3 turns of Loop 1 (RED → GREEN → AUDIT
  on code). Status: `verified` → **`closed`** at this release cut +
  auto-archived to `dev/fids/archive/0003-auto-derived-session-key.md`
  per ECHO §FID Auto-Archive.
- **`scripts/release.py` boilerplate fix:** `REPO_SLUG` default
  boilerplate artifact `fame0528/savant-protocol` → **`savant0x/Savant`**
  per project separation (boilerplate→Savant cutover); `--repo` flag
  added for fork workflows. `scripts/sync-agents.py` docstring
  banner aligned to project source path. Both scripts documented.
- **`scripts/` enhancements:** both Python scripts' docstrings + module
  comments updated. `scripts/release.py` now exports `--repo` for
  repo-agnostic GitHub Release API calls (default `savant0x/Savant`).
- **Test framework installed (devDependencies):** `vitest@^2.1.0` +
  `@playwright/test@^1.49.0` + `happy-dom@^15.11.0`. New npm scripts
  `test` / `test:watch` / `test:e2e` / `test:all`. Config files:
  `vitest.config.ts` (happy-dom env, src/**/_.test._, @/* alias) +
  `playwright.config.ts` (testDir ./e2e, chromium, webServer npm run
  dev, baseURL :3000).
- **New source files:** `src/lib/ids.ts` (`randomHex(n)` utility via
  `crypto.getRandomValues` for OpenRouter `agent_name` uniqueness);
  `src/lib/hooks/use-derived-rotation.ts` (NEW useDerivedRotation hook
  per OQ-4 daily-cron — mount-time scan + minute-tick interval); `src/lib/ipc.test.ts`
  (5 vitest cases — 4 provisionSessionKey parser + 1 clearSessionKey
  hash regression); `e2e/auto-derived.spec.ts` (2 Playwright round-trip
  tests, env-gated on `SAVANT_TEST_MASTER`).
- **Source file modifications:** `src/lib/ipc.ts` (+ `SessionKey` type
  - `normalizeProvisionResponse` + `provisionSessionKey` +
    `clearSessionKey` IPC bridge); `src/lib/mock-ipc.ts` (real
    `provision_session_key` POST `/v1/keys` + `clear_session_key`
    DELETE `/v1/keys/{hash}` cases; module-scoped `mockMasters` for
    cross-call continuity); `src/lib/hooks/use-loaded-config.ts`
    (`LS_DERIVED` constant + `parseDerivedSession` reader); `src/app/settings/page.tsx`
    (full rewrite — dual-stage handleSaveKey + Session Key card a11y +
    Rotate + Disconnect + cross-tab `storage` listener; **deviation:
    747 lines, +87% over TS override `max_file_lines=400`** — tracked
    as FID-0004 follow-on split); `src/app/chat/page.tsx` (full rewrite
    — reads `LS_DERIVED` with try/catch wrap, blocking `<dialog>` modal
    per OQ-3, `Authorization: Bearer ${derived.key}` swap, Retry
    handler).
- **Documentation polish (Law 11):** Prettier formatting cleaned on
  CHANGELOG.md, ECHO.md, MIGRATION.md, next-env.d.ts,
  protocol.config.yaml, README.md.

### Fixed

- **FID-2026-0711-003 (`auto-derived-session-key`):** chat HTTP 401
  `User not found` resolved. Master key no longer held in browser
  `localStorage` (eliminated single-tier collapse that the orig
  Savant two-tier architecture prevented). Chat reads derived
  `SessionKey` from `LS_DERIVED` with try/catch `JSON.parse` wrapping +
  blocking `<dialog>` modal on empty/invalid state. OpenRouter
  `/v1/keys` provisioned per Save Master Key with
  `agent_name="savant-${randomHex(8)}"`. Reference impl in
  `C:\Users\spenc\dev\Savant-backup\crates\agent\src\providers\mgmt.rs`
  (`OpenRouterMgmt::create_key`).

### Changed

- **Version-rocking discipline codified:** `package.json` is canonical
  source of truth; meta-files never bump speculatively mid-development;
  work-in-progress lives under `## [Unreleased]` in `CHANGELOG.md`
  awaiting next-release tagging. The previous speculative
  project-version bump (`0.0.1 → 0.1.4` across 4 anchors) was
  reverted on 2026-07-12; meta-files now match `package.json=0.0.2`
  (single patch-digit bump per release-only discipline).
- **`scripts/release.py` behavior:** keeps `git` push (uses local
  remote `origin`), `--repo` override applies ONLY to the GitHub
  Release API call (Release notes / fetch-existing-release checks).

## v0.0.1 — 2026-07-11

First release of Savant — the proactive AI agent desktop shell, built on
Tauri 2 + React 19 + HeroUI v3 alpha. Phase 1 of a multi-phase build.

### Added

- **Tauri 2 + Next.js 15 + React 19 + HeroUI v3 alpha scaffolding** — desktop shell, renderer (App Router + static export), IPC command surface.
- **`src-tauri/src/security/master_key.rs`** — generalized multi-profile `Vault` (5-strategy cascade: env vars → cwd `.env` → exe `.env` → JSON vault file → UI prompt).
- **Vault storage paths:** Windows `%APPDATA%/savant/auth.json`; Unix `~/.config/savant/auth.json`. Unix perms enforced 0o600 (Windows DPAPI deferred to Phase 5).
- **`src-tauri/src/inference/openrouter.rs`** — reqwest-based chat-completions client; reads `openrouter-default` profile from vault; returns `Result<String, InferenceError>`.
- **Three Tauri IPC commands:** `setup_master_key`, `infer_openrouter`, `vault_list_profiles`.
- **HeroUI v3 alpha integration** — CSS-first, no Provider wrapper required, no Tailwind plugin required. Interactive components use `'use client'` directives for Next.js App Router compatibility.
- **Smoke-test screen** — first end-to-end test of the build pipeline; proves UI → IPC → daemon → OpenRouter → response → UI round-trip.
- **FID-2026-07-11-001** — Phase 1 FID (`dev/fids/0001-ui-first-phase.md`).
- **FID-2026-07-11-002** — initial release FID (`dev/fids/0002-initial-release.md`).

### Changed

- **`protocol.config.yaml`** — `language: "CHANGE_ME"` → `"rust"` (ECHO HALT corner cleared). Commands rewritten for Tauri + npm workflow. Project name `savant-core`; project version 0.0.1.
- **Build phase order** — UI-first (was: cognitive-core-first). Phase 1 = Tauri scaffolding; Trigger Bus → Hybrid Tick deferred to Phase 2.
- **`.gitignore`** — Tauri/Rust/Vite/SQLite/vault-secret patterns added; `resources/` and `prompts/` excluded from repo.
- **`coding-standards/release-workflow.md`** — version-bumping section rewritten to enforce "10 patch releases per minor number" (no feature-flag minor bumps).

### Toolchain confirmed (Windows 11 dev box)

- `rustc 1.94.0` + `cargo 1.94.0` + `tauri-cli 2.10.1`
- `node v25.2.1` + `npm 11.13.0` + `next ^15.0.0` (App Router, static export)
- HeroUI v3 alpha caveat: pin via lockfile; alpha API may shift.

### Reference (non-code)

- **hermes-rs `OAUTH_DESIGN.md`**: not a Tauri fork but its auth profile + provider-coverage schema informed the generalized Vault design.
- **HeroUI LLMS at `docs/full-llms.txt`**: 162,699 lines. v3 alpha line 527/531/727 explicitly state CSS-first architecture (no Provider + no Tailwind plugin).

<!-- Agent entries are added below this line -->
