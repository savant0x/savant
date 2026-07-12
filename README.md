<!-- markdownlint-disable MD033 -->
<div align="center">

# Savant v0.0.3

**The proactive AI agent desktop shell — built with Tauri 2 + React 19 + HeroUI v3.**

> Savant is not a chatbot. It is a desktop-resident proactive agent that watches
> your task graph, ticks when you don't, surfaces suggestions before you ask,
> and is engineered to never lose state.

</div>

## 30-Second Quickstart

There are two ways to run Savant. Pick the one that matches what you're doing.

### Option A — Browser preview (no Tauri install required)

```bash
git clone https://github.com/savant0x/Savant
cd Savant
npm install                                # Next.js 15 + React 19 + HeroUI v3 alpha
npm run dev                                # → http://localhost:3000
```

Open `http://localhost:3000` in any browser. Tauri IPC is mocked via
`@tauri-apps/api/mocks` (installed in `src/lib/mock-ipc.ts`), so the
dashboard renders and `MasterKeySetup` + `InferenceSmokeTest` work end-to-end
without a Tauri host. Fast visual iteration on the UI; no Rust rebuild loop.

### Option B — Tauri desktop (real IPC)

```bash
git clone https://github.com/savant0x/Savant
cd Savant
cargo install tauri-cli --version "^2.0"   # v2.10.1 verified on Windows 11 dev box
npm install                                # Next.js 15 + React 19 + HeroUI v3 alpha
cargo tauri dev                            # launches the desktop window (Next.js dev server on :3000)
```

On first launch:

```text
1. MasterKeySetup screen prompts for your OpenRouter API key
2. Stored in OS app-data vault:
     Windows: %APPDATA%/savant/auth.json
     Unix:    ~/.config/savant/auth.json
3. InferenceSmokeTest screen has a textarea — type anything, click Run
4. Response from POST https://openrouter.ai/api/v1/chat/completions
   appears in a HeroUI Card below the input
```

That round-trip — UI → IPC → daemon → inference → response → UI — is the
v0.0.1 proof point and the integration test for every subsequent phase.

> **Mock vs real IPC:** in browser preview (Option A) the `invoke()` calls are
> intercepted by `src/lib/mock-ipc.ts` and return synthetic data. In the
> Tauri desktop (Option B), `window.__TAURI_INTERNALS__` is set, the mock
> self-disables, and the real Rust daemon handles every call.
>
> **Web deployment is not supported.** Savant's renderer is built with
> `output: "export"` in `next.config.mjs` (required by the Tauri static
> export at `frontendDist: "../out"` in `tauri.conf.json`). The
> `/api/env` route is compiled to a static JSON file at build time and
> cannot read server env vars at runtime in a static export. The two
> supported paths are the browser preview (Option A, dev server with
> mocked IPC) and the Tauri desktop (Option B, real Rust IPC). Hosting
> the static export on a web server is not a supported target — drop
> `output: "export"` and maintain a separate dynamic build config if
> you need that. The Tauri app reads the env var server-side via Rust
> IPC in production, so the env var tier remains functional.

---

## What's in this repo

| Path                       | Purpose                                                                                                    |
| :------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `src-tauri/`               | Tauri 2 Rust daemon: master-key vault, OpenRouter client, IPC command surface                              |
| `src/`                     | React 19 + HeroUI v3 alpha renderer on Next.js 15 App Router (file-based routing, static export)           |
| `src-tauri/src/security/`  | Generalized multi-profile `Vault` (5-strategy cascade)                                                     |
| `src-tauri/src/inference/` | `openrouter` provider client (reqwest chat-completions)                                                    |
| `ECHO.md`                  | The protocol this project obeys. 15 Laws + Perfection Loop FSM + FID lifecycle + circuit breakers          |
| `protocol.config.yaml`     | Build commands, quality bar, autonomy level                                                                |
| `coding-standards/`        | Rust / TypeScript / Python / Go / Java / C# / x402                                                         |
| `templates/`               | FID + session summary templates                                                                            |
| `scripts/`                 | `release.py` (version bumps + CHANGELOG propagation), `sync-agents.py` (multi-agent protocol distribution) |
| `dev/fids/`                | Runtime FID state (gitignored, created on first run; closed FIDs auto-archive to `dev/fids/archive/`)      |
| `dev/LEARNINGS.md`         | Cross-session agent knowledge (tracked)                                                                    |

Heavy reference material and research notes are gitignored:

- `resources/` — local reference projects and external codebases
- `prompts/` — research notes and template prompts

---

## Architecture

**v0.0.3 status:** the renderer is the live surface and ships the
Soul Builder, SSE streaming, and Swarm Deployment diffing. The
Tauri 2 daemon provides the master-key vault + OpenRouter inference
client as a thin IPC layer over the renderer. The Rust cognitive
core (Trigger, State, Cognitive loops) is **not yet built** — the
slots below are reserved for follow-on work, not live today.

```text
[ Next.js 15 + React 19 + HeroUI v3 renderer (App Router, static export; LIVE v0.0.3) ] <-- IPC --> [ Tauri 2 Rust daemon (auth + inference; LIVE v0.0.3) ]
                                                          |
                                                          +-- master-key vault (auth.json, OS-specific path)
                                                          +-- OpenRouter client (reqwest, Bearer auth)
                                                          |
                                                          |   [ Rust cognitive core — NOT YET BUILT ]
                                                          +-- - - - Phase 2: trigger bus + hybrid tick
                                                          +-- - - - Phase 2: SQLite WAL durable state
                                                          +-- - - - Phase 3+: dual-loop cognitive engine
```

---

## Engineering discipline

Savant is built under the **ECHO Protocol** — a 15-Law engineering discipline
that any agent reading this repo is expected to obey. Highlights:

- **15 Laws** — 4 immutable process laws + 11 extended code laws. Read `ECHO.md` for the full list.
- **Perfection Loop FSM** — RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE. Mandatory transitions. Two independent audit methods (no self-reporting).
- **Circuit breakers** — 10% character-change cap per pass, convergence detection, oscillation detection, hard stop at 10 iterations.
- **FID lifecycle** — Created → Analyzed → Fixed → Verified → Closed → Archived. Active FIDs are gitignored; closed FIDs auto-archive + CHANGELOG entry.
- **Quality bar** — 300 / 50 / 100 file/function/line caps. Full table in `protocol.config.yaml`.

---

## Versioning

Savant uses the **"10 patch releases per minor number"** rule:

```text
v0.0.1 → v0.0.2 → ... → v0.0.10 → v0.1.0 → v0.1.1 → ... → v0.1.10 → v0.2.0 → ...
```

Count the patch digit 10 times before bumping the minor digit.

The current version is `v0.0.3` and lives in four places that must always
match the canonical `package.json`: the `VERSION` file,
`protocol.config.yaml` `project.version`, the most recent RELEASED entry
in `CHANGELOG.md`, and the `README.md` headline. **Versions rock only at
release time** — never bump these files speculatively mid-development,
regardless of how much code work has accumulated. Work-in-progress lives
under `## [Unreleased]` in `CHANGELOG.md` and gets tagged with a version
header at release time. Each release is one patch-digit bump.

See `coding-standards/release-workflow.md` for the full rule. Cross-ref:
`dev/LEARNINGS.md` "Versions rock ONLY at release time" entry (codified
2026-07-12 after the speculative `0.0.1 → 0.1.4` rollback).

---

## Roadmap

| Version | Phase | Shipped                                                                                                                                               |
| :------ | :---- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.0.1  | 1     | Tauri 2 shell + master-key vault + OpenRouter smoke-test                                                                                              |
| v0.0.2  | 1     | Auto-derived session key (FID-0003) + two-tier credential architecture + vitest/Playwright test framework                                             |
| v0.0.3  | 1     | **Now.** Soul Builder (FID-006 v3) + LLM streaming (FID-010) + swarm diff (FID-013) + Perfection Loop (FID-009) + env key security + dev server fixes |
| v0.0.10 | 1     | Phase 1 stabilization (before minor bump)                                                                                                             |
| v0.1.0  | 2     | Trigger bus + hybrid tick + SQLite WAL durable state + dual-loop init                                                                                 |
| v0.1.10 | 2     | Phase 2 stabilization (before minor bump)                                                                                                             |
| v0.2.0  | 3     | Tiered inference (fast loop + slow reflection) + observability                                                                                        |
| v0.3.0  | 4     | Full UI shell (multi-pane dashboard + agent observability)                                                                                            |
| v0.4.0  | 5     | Windows DPAPI hardening + release signing + auto-update                                                                                               |

Each phase lives as a FID under `dev/fids/` as it ships.

---

## License

MIT — see [`LICENSE`](LICENSE).
