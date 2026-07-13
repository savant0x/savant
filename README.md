<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="img/savant.png" alt="Savant Logo" width="180" />

**Sovereign agent substrate. Phase 1: Renderer-first with Rust core restored.**

A desktop-resident proactive AI shell built on Next.js 15, Tauri 2, and Rust. The 22-member cargo workspace is on disk and mechanically verified; the inner monologue subsystem is wired through the Tauri IPC for end-to-end reflection streaming.

</div>

---

## What's New in v0.0.4

- **Rust cognitive core restored (FID-016).** 22-member cargo workspace (`Savant/Cargo.toml`) — 21 savant-orig crates (`core, gateway, agent, skills, mcp, channels, canvas, cognitive, ipc, memory, dream, panopticon, obsidian, integrations, security, sandbox, echo, browser, toolforge, generation, schema`) + `lib/cortexadb/` (5.2M / 22,816 LOC). `cargo check --workspace` 0/0; `cargo build --workspace` 0/0.
- **`src-tauri` lib renamed (FID-016r2, SUB-FID of FID-016).** `[lib] name "savant_shell"` to disambiguate from `crates/core`'s `savant_core` (savant-orig identity, preserved verbatim). 4-file surgical edit. Closes 3 cargo filename-collision warnings from FID-016 AUDIT.
- **Reflections Viewer MVP (FID-017).** 5 Tauri commands (`start_consciousness` / `stop_consciousness` / `get_consciousness_state` / `trigger_reflection` / `initialize_app_state`) wire the savant-orig inner monologue subsystem to the Next.js dashboard at `/reflections`. 19-entry `LENSES` array ported from [`crates/agent/src/pulse/prompts.rs:147`](crates/agent/src/pulse/prompts.rs#L147) to [`src/lib/reflections/lenses.ts`](src/lib/reflections/lenses.ts). Markdown renderer swap from the hand-rolled `src/lib/markdown-lite.tsx` (~280 lines, only h1-h3 / `**bold**` / `*italic*` / `> blockquote` / `---` hr / HTML entities, deleted in FID-017) to `react-markdown@^10.1.0` + `remark-gfm@^4.0.1` (full CommonMark + GFM: nested lists, fenced code, tables, task lists, strikethrough, autolinks, all heading levels, hard line breaks, escape sequences).
- **License forward-effective MIT → Apache 2.0.** Apache 2.0 applies to v0.0.4 forward; v0.0.3 and earlier remain MIT. Adds patent grant + retaliation clause.

Full release notes in [`CHANGELOG.md`](CHANGELOG.md) `## v0.0.4 — 2026-07-13`. FID scaffold in [`dev/fids/`](dev/fids/).

---

<div align="center">

[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![Next.js](https://img.shields.io/badge/Next.js-15-%23000000?style=flat-square&logo=nextdotjs&logoColor=%2300fbff)](https://nextjs.org/)[![Tauri](https://img.shields.io/badge/Tauri-2.x-%23000000?style=flat-square&logo=tauri&logoColor=%2300fbff)](https://tauri.app/)[![Rust](https://img.shields.io/badge/Rust-1.86+-%23000000?style=flat-square&logo=rust&logoColor=%2300fbff)](https://www.rust-lang.org/)[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![HeroUI](https://img.shields.io/badge/HeroUI-v3_Alpha-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://heroui.com/)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](LICENSE)[![Status](https://img.shields.io/badge/Status-v0.0.4_Released-%23000000?style=flat-square&color=brightgreen)](CHANGELOG.md)

</div>

---

## Current State & Live Features

v0.0.4 ships the substrate baseline. Renderer is the live surface; the Rust core is on disk and mechanically verified but awaits Phase 2 wiring.

- **Tauri 2 Desktop Shell.** Rust shell providing OS-level persistent vault + secure OpenRouter inference client + the FID-017 reflections IPC. `cargo tauri dev` launches a native window with real Rust IPC; the mock IPC self-disables when `window.__TAURI_INTERNALS__` is set. Cross-platform vault at `%APPDATA%/savant/auth.json` (Windows) / `~/.config/savant/auth.json` (Unix).
- **Mock-IPC Browser Preview.** Iterate at Phase 1 velocity at `http://localhost:3000` via [`@tauri-apps/api/mocks`](https://www.npmjs.com/package/@tauri-apps/api) (installed in [`src/lib/mock-ipc.ts`](src/lib/mock-ipc.ts)). Master-key vault + Soul Builder + Reflections Viewer all work end-to-end without a Tauri host. Fast visual iteration; no Rust rebuild loop.
- **Two-Tier Credential Architecture.** Master key in OS app-data vault (5-strategy cascade: env vars → cwd `.env` → exe `.env` → JSON vault → UI prompt). `/v1/keys` provision derives a session subkey the chat outbound traffic uses. The master never reaches HTTP. Auto-rotation ≥24h. Cross-tab `localStorage` sync via `storage` event listener.
- **OpenRouter Inference.** reqwest-based chat-completions client. Surfaces 401 with active key source (`env` / `vault` / `none`) + key length so the user can identify which tier is the problem.
- **Soul Manifestation Engine.** LLM-powered builder ([`src/lib/manifest-mock.ts`](src/lib/manifest-mock.ts), [`src/lib/soul-generation-system-prompt.ts`](src/lib/soul-generation-system-prompt.ts)). System prompt leads with a `CRITICAL DIRECTIVE: PROMPT-DRIVEN IDENTITY` section that bans generic AAA/foundation/sovereign/WAL/CCT language and forces every section to be UNIQUE to the prompt's domain. 18-section AAA Master Framework template.
- **Reflections Viewer.** [`src/app/reflections/page.tsx`](src/app/reflections/page.tsx). Boot-time reader for `workspace-savant/REFLECTIONS.md` + `workspace-savant/SOUL.md` (Tauri-runtime SOUL.md fetch guarded by `if ("__TAURI_INTERNALS__" in window)`). Journal-style parser `split(/(^|\n)##\s+/)`. Streaming indicator + char count + Cancel button. `react-markdown@^10.1.0` + `remark-gfm@^4.0.1` for full CommonMark + GFM.
- **SSE Streaming.** OpenRouter chunked responses yield `preamble` / `chunk` / `complete` / `error` events. rAF-throttled state updates (50–200 chunks/sec) accumulate in a `useRef` and flush via `requestAnimationFrame`. AbortSignal-aware: the Cancel button stops the in-flight fetch + SSE parser cleanly.
- **ECHO Protocol Runtime.** 15 Laws + Perfection Loop FSM (RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE) + FID lifecycle (Created → Analyzed → Fixed → Verified → Closed → Archived). All agent work obeys the ECHO discipline; see [`ECHO.md`](ECHO.md).
- **TypeScript Strict Mode.** `strict: true` required in [`tsconfig.json`](tsconfig.json). Named exports only, no defaults. `unknown` over `any`. 73 vitest unit tests across 7 test files in `src/lib/*.test.ts` + 15 privacy.rs + 4 forensic_capture.rs + 2 Playwright round-trips.
- **Quality Gates.** `cargo check --workspace` + `cargo build --workspace` + `tsc --noEmit` + `prettier --check` + `markdownlint-cli` all pass. Quality bar (300/50/100 file/function/line caps) in [`protocol.config.yaml`](protocol.config.yaml).

---

## Architecture

```text

[ Next.js 15 + React 19 + HeroUI v3 renderer (App Router, static export; LIVE) ]
                                                                                  |
                                                                                  v
                                                                          [ Tauri 2 Rust shell ]    savant_shell::run() at src-tauri/src/lib.rs
                                                                                  |
                                                              +-------------------+-------------------+
                                                              |                   |                   |
                                                              v                   v                   v
                                                  master-key vault       OpenRouter client      Reflections IPC (FID-017)
                                                  (auth.json, OS-sp)     (reqwest, Bearer)       5 commands wire the consciousness
                                                                                                  state machine to the renderer

  Rust cognitive core — RESTORED ON DISK, mechanically verified (cargo check --workspace 0/0)
  21 savant-orig crates + lib/cortexadb/ + workspace-savant/SOUL.md anchor
  Phase 2 wires: trigger bus, SQLite WAL, dual-loop engine, iceoryx2 zero-copy IPC
```

The renderer (Next.js App Router, static export) is the live surface. The Tauri 2 Rust shell exposes auth + inference + reflections through typed IPC commands. The 21-crate cognitive core (FID-016 restore) builds clean but its trigger bus / SQLite WAL / dual-loop engine are still Phase 2 wiring — the crates are present on disk, the gates pass, but the runtime has not yet started exercising them.

---

## Quick Start

### Option A — Browser preview (no Tauri install)

```bash
git clone https://github.com/savant0x/Savant
cd Savant
npm install
npm run dev                                # → http://localhost:3000
```

Tauri IPC is mocked via `src/lib/mock-ipc.ts`. Master key vault + Soul Builder + Reflections Viewer all work end-to-end. Fast iteration; no Rust rebuild loop.

On first launch:

1. Settings page prompts for your OpenRouter master key (browser preview uses mock `localStorage` vault).
2. Derived session subkey auto-provisioned via OpenRouter `/v1/keys`.
3. `/manifest` builder + `/reflections` viewer become available.

### Option B — Tauri desktop (real Rust IPC)

```bash
git clone https://github.com/savant0x/Savant
cd Savant
cargo install tauri-cli --version "^2.0"
npm install
cargo tauri dev                            # Launches the desktop window (Next.js dev server on :3000)
```

On first launch:

1. MasterKeySetup screen prompts for OpenRouter API key → OS app-data vault.
2. InferenceSmokeTest screen: type, click Run. `POST https://openrouter.ai/api/v1/chat/completions` returns via HeroUI Card.
3. Reflections page streams from the Rust daemon (5 IPC commands wire the consciousness state machine).

> Web deployment is unsupported. Renderer is `output: "export"` in [`next.config.mjs`](next.config.mjs) (required by Tauri's `frontendDist: "../out"` in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json)). The `/api/env` route compiles to a static JSON file. Supported paths are browser preview (Option A) and Tauri desktop (Option B). The Tauri app reads env vars server-side via Rust IPC in production.

---

## Project Structure

```text
Savant/
├── Cargo.toml              # 22-member cargo workspace (src-tauri + 21 savant-orig crates)
├── Cargo.lock              # Locked dependency graph (~566M / 121K LOC across the 22 members + lib/cortexadb/)
├── package.json            # Next.js 15 renderer config + npm scripts
├── next.config.mjs         # Next.js config (with ?raw for .md files)
├── vitest.config.ts        # Unit test config (happy-dom env)
├── playwright.config.ts    # E2E test config (chromium)
├── tsconfig.json           # TypeScript strict mode
├── LICENSE                 # Apache 2.0 license (full text)
├── NOTICE                  # Attribution chain (Tauri, React, HeroUI, Next.js, Rust, ...)
├── README.md               # This file
├── CHANGELOG.md            # Release changelog
├── VERSION                 # Canonical version (last-RELEASED, 0.0.4)
├── STARTER-PROMPT.md       # ECHO Protocol boot sequence
├── protocol.config.yaml    # ECHO project config (commands, quality bar, autonomy)
├── ECHO.md                 # The 15 Laws + Perfection Loop FSM + FID lifecycle
├── MIGRATION.md            # Breaking protocol/file structure transitions
├── coding-standards/       # Per-language rules (Rust, TypeScript, Python, Go, Java, C#, x402)
├── templates/              # FID + session summary templates
├── public/                 # Static assets (favicon, manifest, sw, icons)
├── scripts/                # release.py + sync-agents.py
├── src/                    # Next.js 15 renderer
│   ├── app/                # App Router pages (home, chat, manifest, settings, reflections, health, ...)
│   ├── components/         # React components (dashboard-shell, rating-box, bulk-diff-viewer, soul-body-viewer, ...)
│   └── lib/                # Utilities + IPC
│       ├── mock-ipc.ts     # Phase 1 mock IPC (auto-disables when __TAURI_INTERNALS__ is set)
│       ├── soul.ts         # Build-time `?raw` re-export of workspace-savant/SOUL.md
│       ├── reflections/    # FID-017: lens array + reflection parser (port from crates/agent/src/pulse/prompts.rs)
│       ├── hooks/          # use-derived-rotation, use-lens-rotation, use-reflections, use-loaded-config
│       ├── manifest-mock.ts, swarm-diff.ts, prompt-generator.ts, name-generator.ts, ...
│       └── *.test.ts       # vitest unit tests (17 cases across the source-tree utilities)
├── src-tauri/              # Tauri 2 Rust shell (`[lib] name = "savant_shell"`)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs         # savant_shell::run() entry point
│       ├── lib.rs          # 8 IPC commands (setup_master_key, infer_openrouter, vault_list_profiles + FID-017: start/stop_consciousness, get_consciousness_state, trigger_reflection, initialize_app_state)
│       ├── security/       # master_key.rs (5-strategy cascade vault)
│       └── inference/      # openrouter.rs (reqwest chat-completions)
│   └── tests/              # 2 integration tests (master_key_test + inference_smoke_test)
├── crates/                 # 21 savant-orig crates (FID-016 restore, mechanically verified, reads clean)
│   ├── core/ gateway/ agent/ skills/ mcp/ channels/ canvas/ cognitive/ ipc/ memory/
│   └── dream/ panopticon/ obsidian/ integrations/ security/ sandbox/ echo/ browser/
│       toolforge/ generation/ schema/
├── lib/
│   └── cortexadb/          # 5.2M / 22,816 LOC — vector zero-copy substrate
├── dev/                    # Engineering operations
│   ├── fids/               # Runtime FIDs (gitignored, created on first run)
│   ├── fids/archive/       # Closed FIDs (auto-archived per ECHO §FID Auto-Archive)
│   ├── session-summaries/  # ECHO Protocol audit trail
│   └── LEARNINGS.md        # Cross-session retained knowledge
├── e2e/                    # Playwright round-trips (auto-derived session key)
└── workspace-savant/       # Agent resident workspace (FID-004r2)
    ├── SOUL.md             # Canonical persona (read by chat + manifest)
    ├── AGENTS.md           # Operating instructions
    ├── LEARNINGS.md        # Agent-written at runtime
    └── EVOLUTION.jsonl     # Parser-managed at runtime
```

### Rust Module Map

| Source                                  |  Status (v0.0.4)        | Purpose                                                                            |
| :-------------------------------------- | :---------------------: | :--------------------------------------------------------------------------------- |
| `src-tauri/`                            |          LIVE           | Tauri shell: vault + OpenRouter + Reflections IPC                                  |
| `crates/core`                           |  RESTORED, on disk      | lib basename `savant_core` (savant-orig identity); Phase 2 wires unified vault     |
| `crates/agent`                          |  RESTORED, on disk      | Agent + skills + learning parser; memory browser planned for v0.0.5+               |
| `crates/cognitive`                      |  RESTORED, on disk      | Dual-loop engine (fast + slow reflection); Phase 3 wiring                          |
| `crates/security`                       |  RESTORED, on disk      | Unified multi-profile vault (Phase 2 replacement for `src-tauri/src/security/`)   |
| `crates/ipc`                            |  RESTORED, on disk      | Atlas zero-copy IPC substrate (iceoryx2); Phase 2 wiring                           |
| `crates/memory`                         |  RESTORED, on disk      | CortexaDB + privacy.rs scanner; Phase 2 wiring                                     |
| `crates/echo`                           |  RESTORED, on disk      | ECHO Protocol core (renderer ECHO is Phase 1, daemon ECHO is later)                 |
| `crates/{11 more}`                      |  RESTORED, on disk      | Per FID-016; cargo workspace unified                                               |

---

## Development & Building

```bash
# Renderer (Phase 1)
npm run dev                      # Browser preview (mock IPC) at :3000
npm run build                    # Static export (Next.js)
cargo tauri dev                  # Tauri desktop (real Rust IPC)
cargo tauri build                # Tauri release executable

# Tests
npm run test                     # vitest unit tests
npm run test:e2e                 # Playwright E2E tests
npm run test:all                 # Unit + E2E

# Workspace-wide Rust build (FID-016 restore verification)
cargo check --workspace          # 0 errors, 0 warnings
cargo build --workspace          # 0 errors, 0 warnings

# Quality gates
npx tsc --noEmit                 # TypeScript type-check
npx prettier --check .           # Prettier format check
npx markdownlint-cli '**/*.md'   # Markdown lint
```

---

## Roadmap

| Version | Phase | Status   | Focus                                                                                                              |
| :------ | :---: | :------- | :----------------------------------------------------------------------------------------------------------------- |
| v0.0.1  |   1   | SHIPPED  | Tauri 2 shell + master-key vault + OpenRouter smoke-test                                                           |
| v0.0.2  |   1   | SHIPPED  | Auto-derived session key (FID-0003) + two-tier credential + vitest/Playwright test framework                        |
| v0.0.3  |   1   | SHIPPED  | Soul Builder (FID-006 v3) + LLM streaming (FID-010) + swarm diff (FID-013) + Perfection Loop (FID-009)              |
| v0.0.4  |   1   | **NOW**  | Rust core restored (FID-016) + Reflections Viewer (FID-017) + lib rename (FID-016r2) + License MIT→Apache 2.0       |
| v0.0.5  |   1   | NEXT     | Memory browser + skills marketplace + Phase 2 prelude (trigger bus + SQLite WAL prep)                              |
| v0.1.0  |   2   | PLANNED  | Trigger bus + hybrid tick + SQLite WAL + dual-loop init + Rust module split (trigger/, state/, cognitive/)         |
| v0.2.0  |   3   | PLANNED  | Tiered inference (fast + slow reflection) + observability + 16-provider chain                                      |
| v0.3.0  |   4   | PLANNED  | Mandatory Security Scanner + Two-Tier Agent System + Distributed Memory Substrate + Channels                      |
| v0.4.0  |   5   | PLANNED  | Full UI shell (multi-pane dashboard + agent observability) + MCP + Windows DPAPI + release signing                 |

Each phase lives as a FID under [`dev/fids/`](dev/fids/) as it ships.

---

## Documentation

- [`ECHO.md`](ECHO.md) — The 15 Laws + Perfection Loop FSM + FID lifecycle + circuit breakers. The protocol this project obeys.
- [`CHANGELOG.md`](CHANGELOG.md) — Release history and changes (reverse chronological).
- [`MIGRATION.md`](MIGRATION.md) — Breaking protocol/file structure transitions.
- [`protocol.config.yaml`](protocol.config.yaml) — Build commands, quality bar, autonomy level, paths, testing, FID config.
- [`dev/LEARNINGS.md`](dev/LEARNINGS.md) — Cross-session retained knowledge + codified lessons.
- [`dev/session-summaries/`](dev/session-summaries/) — ECHO Protocol audit trail per release/session.
- [`coding-standards/`](coding-standards/) — Per-language rules (Rust, TypeScript, Python, Go, Java, C#, x402).
- [`templates/`](templates/) — FID + session summary templates.
- [`LICENSE`](LICENSE) — Apache 2.0 license (full text).
- [`NOTICE`](NOTICE) — Attribution chain (Tauri, React, HeroUI, Next.js, Rust, build/test tooling).

---

## License

Apache 2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

Forward-effectivity: v0.0.3 and earlier releases remain under their original MIT license; the MIT → Apache 2.0 change applies from v0.0.4 forward. Apache 2.0 grants an explicit patent license from contributors to users, with a retaliation clause. Trademarks are NOT granted — the "Savant" name is reserved for the official project per §6 of the license.

---

<div align="center">

_Savant is a sovereign substrate, in flight._

**Savant** &bull; 2026

</div>
