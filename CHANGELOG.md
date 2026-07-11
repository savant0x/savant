# Changelog

All notable changes to this project are documented here automatically by the
agent when a FID reaches **Closed** status. Entries are added in reverse
chronological order (newest first).

Format: Each entry includes the version, date, and changes.

**Version source of truth:** `VERSION` file at project root. All other files
(`protocol.config.yaml`, `README.md`, `CHANGELOG.md`) should match. When
bumping, update `VERSION` first, then propagate.

**Versioning rule:** This project uses the "10 patch releases per minor
number" rule. See `coding-standards/release-workflow.md` for the full spec.

---

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
