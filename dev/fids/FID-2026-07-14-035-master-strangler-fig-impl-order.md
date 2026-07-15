# FID-035: Master-FID — Stranglet-Fig Tauri→CLI Architecture Build Order (6 Open FIDs)

**Filename:** `FID-2026-07-14-035-master-strangler-fig-impl-order.md`
**ID:** FID-2026-07-14-035
**Severity:** high
**Status:** analyzed
**Created:** 2026-07-14
**Author:** Buffy (ECHO agent, on Spencer's *"create a master-fid, outline the correct implemtation order to properly do ALL of the open fids properly. You're building a house, layer by layer, we need to ensure each layer stacks nearltly, not a messy build"* directive)
**Role:** **Orchestration FID** — tracks the 6 open FIDs through a layered, dependency-driven impl. NOT a code change itself; it codifies the build contract.

---

## Summary

Orchestration FID for the 6 open FIDs (**028, 029, 030, 032, 033, 034**) plus the closed **FID-031** (Layer 0 foundation). Establishes a strict **6-LAYER BUILD ORDER** where each layer's verification gates must pass 100% before the next layer begins. Prevents the *"messy build"* anti-pattern where FIDs are impl'd in arbitrary order, generating cross-cutting conflicts + cascading rework. Codifies the named dependency edges between FIDs + the strict verification gate between layers. All FIDs are **ALL-OR-NOTHING per LESSON-038** (cannot split a FID mid-stream because they wire IP contracts that must land atomically).

---

## Layered Build Architecture

### Layer 0 — Foundation **[ CLOSED ✓ ]**

- **FID-031 (gateway expansion)**: 33 new `/v1/*` endpoints + `embedded-web` feature flag + 10 smoke tests + `tower_0_5` aliased dev-dep. Build VERIFIED GREEN (`cargo check -p savant_gateway` + `cargo check -p savant_gateway --tests` both exit 0). File archived to `dev/fids/archive/`.
- **Provides for Layers 1-5**: HTTP runtime surface (`/v1/*` 33 endpoints); shared `GatewayState`; rust-embed + `ServeDir` + `ServeFile` (the `embedded-web` feature); SSE handler pattern; auth + rate-limit + CORS layers (all moved to the main app router so any future nested router inherits them).
- **Verified LESSONs**: LESSON-027 holds (5 anchors + 1 cascade-prose alternation), LESSON-038 holds (0 violations across all active FIDs), LESSON-054 codified gateway-expansion discipline.

---

### Layer 1 — Conservative Renderer Feature (no new crate, no kernel refactor)

Layer 1 has **TWO FIDs that can impl in PARALLEL** (different routes, no shared files):

**Layer 1a — FID-029 (chat persistence)**

- **Scope**: 1-field Rust `SessionState.title: Option<String>` amendment (rkyv-backward-compatible) + 5 renderer-side IPC commands + `useChatHistory` hook + 5 chat sub-component split + chat page rewrite.
- **Approx LoC**: ~1500 LoC across ~10 files:
  - 1 Rust file amend: `crates/memory/src/models.rs` (SessionState struct — add `title: Option<String>` as LAST field + roundtrip test confirming old data deserializes with `title: None`)
  - 1 NEW TypeScript hook: `src/lib/hooks/use-chat-history.ts` (mirrors `useReflections` pattern)
  - 1 NEW TypeScript data file: `src/lib/chat-data.ts` (types + localStorage key constants + helpers)
  - 5 MODIFIED TypeScript files: `src/lib/ipc.ts` (+ 6 IPC wrappers: `listChatSessions` / `loadChatHistory` / `persistChatTurn` / `deleteChatSession` / `searchChatHistory` / `toggle_chat_session_pin`), `src/lib/mock-ipc.ts` (+ 6 mock cases, per-session localStorage keys, NOT a single aggregate key — perf cliff avoidance + QuotaExceeded remediation dropping oldest 10%)
  - 5 NEW TypeScript sub-components: `src/app/chat/components/{chat-sidebar,chat-composer,chat-message-list,chat-header,chat-search-results}.tsx`
  - 1 MODIFIED TypeScript page: `src/app/chat/page.tsx` (full rewrite into ~150-line thin composer)
- **Depends on Layer 0**: ✓ — but **INDIRECT ONLY** (project pattern inherited). The chat persistence is wired through Tauri's IPC at `src-tauri/src/lib.rs`, NOT through the gateway's `/v1/*` endpoints. Future agents should NOT interpret this as needing the gateway's 33 endpoints.
- **Blocks Layer 3**: FID-032 will swap the IPC bridge to `fetch`. FID-029's mock layer (`mock-ipc.ts`) is the template FID-032 replaces. FID-032 must refactor ALL wrappers in `src/lib/ipc.ts` AFTER FID-029 lands — that's **22 existing + 5 new = 27 TOTAL wrappers**, not 22 (per code-reviewer Minor 1 + Nit 2).
- **Verification gate** (must pass 100% before Layer 2 starts):
  ```
  cargo check --workspace --tests           # SessionState roundtrip + workspace
  pnpm type-check                            # TS
  pnpm vitest                                # IPC + hook tests
  pnpm lint:docs                             # LESSON-027
  pnpm lint:defer                            # LESSON-038
  ```
- **Risks**:
  - chat page rewrite is large (~700 LoC → split into 5 sub-components to stay <300 LoC each per §Verifier Pass MEDIUM #6)
  - rkyv backward-compat for `title` field requires a roundtrip test (old on-disk data → new struct must deserialize with `title: None`)
  - `crypto.randomUUID()` ID generation (NOT `randomHex(16)`) — critical for future UUID parsing in Rust
  - sequential persist order (user message in React state first, OpenRouter fetch, then `persistTurn(user, assistant)` back-to-back) prevents the orphan-user-message problem on tab refresh mid-fetch

**Layer 1b — FID-028 (memory graph viz)** [CAN RUN PARALLEL WITH LAYER 1a]

- **Scope**: new dashboard route `/cognition-metrics` + R3F `Canvas` + d3-force-3d in Web Worker + `InstancedMesh` nodes + custom `ShaderMaterial` for GPU comet trails + `UnrealBloomPass` + Inspector + TimelineScrubber + 2 gateway handlers (`GET /api/memory-graph` + `POST /api/memory-graph/neighbors`).
- **Approx LoC**: ~1500 LoC across ~10 NEW files + 7 new npm deps + 1 NEW Rust handler file:
  - 1 NEW Rust file: `crates/gateway/src/handlers/memory_graph.rs` (2 handlers: `get_memory_graph` + `get_neighbors`)
  - 7 NEW npm deps: `three` (r160+) + `@react-three/fiber` (v8) + `@react-three/drei` (v9) + `@react-three/postprocessing` (v2) + `postprocessing` (v6) + `d3-force-3d` + `three-stdlib`
  - 1 NEW dashboard route: `src/app/cognition-metrics/page.tsx`
  - 1 NEW client module: `src/lib/memory-graph-client.ts` + `src/lib/mock-memory-graph.ts`
  - 1 NEW Worker: `src/workers/memory-layout.worker.ts` (DOM-free dependency check before commit per LESSON-031 re-grep)
  - 5 NEW R3F components: `src/components/memory-graph/{GraphScene,Nodes,Edges,InspectorPanel,TimelineScrubber}.tsx`
  - 1 MODIFIED workspace member: `crates/gateway/src/handlers/mod.rs` (re-export memory_graph submodule)
  - 1 MODIFIED server route: `crates/gateway/src/server.rs` (mount the 2 new handlers)
- **Depends on Layer 0**: ✓ (gateway handlers mount to existing axum Router).
- **Independent of Layer 1a**: Can run in PARALLEL with FID-029 across MULTIPLE turns, NOT in the same turn (both modify `package.json` — FID-028 adds 7 new three.js-family deps; FID-029 may add no new npm deps but the file is shared; package.json merge conflicts in same-turn). No shared TS source files; both are renderer-side but different routes (`/chat` vs `/cognition-metrics`).
- **Verification gate**:
  ```
  cargo check -p savant-gateway --tests      # New handlers
  cargo clippy -p savant-gateway            # No warnings
  pnpm vitest                                # Worker + client tests
  pnpm type-check                            # TS
  pnpm test:e2e                              # Browser smoke at /cognition-metrics
  ```
- **Risks**:
  - 7 new npm deps bump `package.json` size (~50MB+)
  - Web Worker bundling requires `next.config.mjs` worker support (or Blob URL fallback)
  - bloom post-processing GPU-intensive on weak hardware
  - d3-force-3d DOM-dependency check is a GATE (must verify zero `window`/`document`/Node.js deps)

---

### Layer 2 — CLI Runtime Host (new entry point)

- **FID-030 (CLI scaffold)**
- **Scope**: new `crates/cli/` crate + `clap`-based subcommand tree + in-process `savant_gateway::server::start_gateway(state, port).await` per ZeroClaw runtime-host pattern + dev-mode `next dev` spawn + `webbrowser::open` + `ctrlc::set_handler` + port negotiator + cross-platform signal handling.
- **Approx LoC**: ~1000 LoC across ~15 NEW files + 3 new workspace deps + 1 MODIFIED workspace `Cargo.toml` + 1 MODIFIED root `package.json`:
  - 1 NEW crate: `crates/cli/` (added to workspace `members`)
  - 1 MODIFIED workspace: `Cargo.toml` (root — add `clap` + `webbrowser` + `nix` to `[workspace.dependencies]` + `"crates/cli"` to `members`)
  - 1 MODIFIED workspace: `package.json` (add `"savant"` + `"savant:dev"` + `"savant:fast"` scripts)
  - 15 NEW Rust files: `crates/cli/src/{main,cli,error,api_client,process,port,signal,browser}.rs` + `crates/cli/src/commands/{mod,dev,chat,memory,vault,doctor}.rs`
  - 1 NEW smoke test: `crates/cli/tests/cli_smoke_test.rs` (clap parser + port negotiator + signal handler)
  - 3 new workspace deps: `clap = "4"` + `webbrowser = "0.8"` + `nix = "0.27"`
- **Depends on Layer 0**: ✓ (gateway is the in-process runtime host).
- **Independent of Layer 1a + 1b**: Can run in PARALLEL with Layer 1 (no shared files in `src/`; only `Cargo.toml` workspace `members` adds new entry).
- **Blocks Layer 3**: FID-032 uses the CLI's `dev` mode (`SAVANT_USE_CLI=1 pnpm dev` triggers `savant dev --watch`).
- **Verification gate**:
  ```
  cargo check -p savant_cli
  cargo test -p savant_cli                   # Smoke test for clap + port negotiator + signal handler
  cargo clippy -p savant_cli -- -D warnings  # No warnings
  cargo run --bin savant -- --help           # Subcommand tree prints
  cargo run --bin savant -- doctor --help    # Doctor subcommand help
  ```
- **Risks**:
  - new crate adds 3 transitive deps
  - port negotiator on stale `next dev` is graceful-degradation case (try preferred +0..+9)
  - signals on Windows require `taskkill /F /T` for tree cleanup (a future FID can use JobObjects)

---

### Layer 3 — Renderer API Modernization (depends on Layer 2)

- **FID-032 (api-client refactor)**
- **Scope**: new `src/lib/api-client.ts` (REST via `fetch`) + `src/lib/api-stream.ts` (WebSocket + SSE consumer) + 22+ renderers in `src/lib/ipc.ts` swap internals from `invoke<T>("snake_case_command", args)` to `apiClient.request<T>(method, url, body)`. Public function signatures stay identical → **no caller code changes**.
- **Approx LoC**: ~800 LoC across ~5 NEW/MODIFIED files:
  - 4 NEW TypeScript files: `src/lib/api-client.ts` + `src/lib/api-stream.ts` + `src/lib/api-config.ts` + `src/lib/api-errors.ts`
  - 1 MODIFIED TypeScript file: `src/lib/ipc.ts` (22 wrapper internals swap from `invoke` → `fetch`)
  - 1 MODIFIED `package.json` (move `@tauri-apps/api` to `devDependencies`)
- **Depends on Layer 2 + Layer 0 + Layer 1a (FID-029)**: ✓ — three hard dependencies (CLI runs the runtime that points at the gateway; gateway has the `/v1/*` endpoints; FID-029's 5 new IPC wrappers in `src/lib/ipc.ts` MUST land first so FID-032's swap covers all 22 + 5 = 27 wrappers, not just 22).
- **Independent of Layer 4**: Can run in PARALLEL with FID-033's shell work (FID-032 is renderer-side; FID-033 is Tauri-side).
- **Verification gate**:
  ```
  pnpm type-check                            # TS
  pnpm vitest                                # 22 wrappers tested via mock layer
  pnpm test:e2e                              # Playwright smoke for at least 3 endpoints
  cargo check -p savant_cli --tests          # CLI commands still work
  ```
- **Risks**:
  - changing internals of 22 wrappers without breaking public function signatures requires careful pattern-matching
  - SSE parsing in browser requires correct `EventSource` handling + `AbortSignal` propagation
  - `__TAURI_INTERNALS__` checks must be removed carefully without affecting unmigrated callers (none after FID-033 removes Tauri)

---

### Layer 4 — Optional Desktop Shell (depends on Layer 3) [OPTIONAL]

- **FID-033 (Tauri repackaging)**
- **Scope**: new `crates/savant_desktop/` thin shell crate + `src-tauri/` MOVED to `apps/tauri/` per ZeroClaw monorepo shape (NOT deleted; per USER's *"fid-033 repackages tauri"* directive). `apps/tauri/src/main.rs` gutted from ~700 LoC to ~150 LoC (drops 13 IPC commands + `AppState` + `SkillExecutionRegistry`).
- **Approx LoC**: ~500 LoC across ~10 NEW/MODIFIED files:
  - 1 NEW crate: `crates/savant_desktop/` (added to workspace `members`)
  - 1 NEW tunnel workspace member: `apps/tauri/` (MOVED from `src-tauri/`)
  - 4 NEW Rust files: `crates/savant_desktop/src/{lib,webview,process,tray}.rs`
  - 1 NEW smoke test: `crates/savant_desktop/tests/desktop_config_test.rs`
  - 4 MODIFIED workspace: `Cargo.toml` (add `"crates/savant_desktop"` + `"apps/tauri"` to `members`, swap `"src-tauri"` for `"apps/tauri"`)
  - 1 MODIFIED Tauri app: `apps/tauri/Cargo.toml` (drops deps on `savant_memory` etc.; depends on `savant_desktop`)
  - 1 MODIFIED Tauri app: `apps/tauri/src/main.rs` (~150 LoC thin shell — drop all 13 IPC commands + drop `AppState`)
- **Depends on Layer 3**: ✓ (Tauri webview calls `fetch` against the gateway `/v1/*` endpoints via the api-client).
- **Optional layer**: may be skipped; the dashboard works via browser + CLI without `apps/tauri/`.
- **Verification gate**:
  ```
  cargo check -p savant_desktop
  cargo check -p savant-desktop              # Tauri app
  cargo test -p savant_desktop               # Config tests
  cargo tauri build                          # In apps/tauri/ — bundles .app / .exe / .AppImage
  ```
- **Risks**:
  - the `mv src-tauri/ → apps/tauri/` operation is a one-way move (must be carefully verified)
  - the gutted `main.rs` must drop workspace deps (`savant_memory`, `savant_vault`, etc.) cleanly
  - tray icon OS-specific behavior varies per platform
  - CORS must include Tauri-internal origins (`tauri://localhost`, `asset://`) — strict `localhost:3000` rules miss them

---

### Layer 5 — Kernel Abstraction [HIGHEST RISK; do LAST]

- **FID-034 (kernel trait adoption)**
- **Scope**: 4 NEW traits in `crates/core/src/traits/` (`ModelProvider` + `Memory` + `Tool` + `Channel`) with `async_trait` + `name()` + `capabilities()` methods + ~20 impl blocks for existing concrete types + `crates/agent/src/orchestrator.rs` refactored to use trait objects + new `kernel-only` feature flag.
- **Approx LoC**: ~600 LoC across ~10 NEW/MODIFIED files:
  - 6 NEW Rust files in `crates/core/src/traits/`: `mod.rs` + `model_provider.rs` + `memory.rs` + `tool.rs` + `channel.rs` + `capabilities.rs`
  - 1 MODIFIED core crate: `crates/core/Cargo.toml` (add `async-trait = "0.1"` dep) + `crates/core/src/lib.rs` (re-export traits)
  - 5 MODIFIED concrete crates: `crates/integrations/src/{openrouter,kilo}.rs` (impl `ModelProvider`) + `crates/memory/src/lib.rs` (impl `Memory`) + `crates/toolforge/src/lib.rs` (impl `Tool` per tool type) + `crates/channels/src/lib.rs` (impl `Channel` per channel type)
  - 1 MODIFIED agent: `crates/agent/src/orchestrator.rs` (refactor to `Box<dyn ModelProvider>` + trait-bound storage)
  - 1 MODIFIED runtime: `crates/runtime/Cargo.toml` (add `kernel-only` feature flag) + `crates/runtime/src/lib.rs` (make `Runtime` generic over traits)
  - 1 MODIFIED CLI: `crates/cli/src/commands/dev.rs` (register concrete types at startup)
  - 1 new dep: `async-trait = "0.1"`
- **Depends on ALL prior layers**: ✓ (the impl blocks touch every concrete type that's used by Layers 1-4).
- **DO LAST**: doing this before Layers 1-4 would churn the SDK + require re-doing verification gates throughout.
- **Verification gate**:
  ```
  cargo check -p savant_core --tests         # Trait defs
  cargo check --workspace --tests            # All 20 impls compile
  cargo test -p savant_agent                 # Orchestrator uses the traits correctly
  pnpm lint:docs
  pnpm lint:defer
  cargo clippy --workspace -- -D warnings    # No warnings
  ```
- **Risks**:
  - breaking the orchestrator's compile breaks the agent loop invariant
  - the `Box<dyn Memory>` dispatch requires `Send + Sync` bounds (careful with rkyv Archive traits)
  - `async_trait` macro requires careful return-type handling for trait-object compatibility
  - 20 impl blocks = 20 places where compilation can break; the verification gate must be a FULL `cargo check --workspace --tests`

---

## Build Order (Strict Sequence)

Per Spencer's direct directive: *"you're building a house, layer by layer, we need to ensure each layer stacks nearltly, not a messy build"*. The strict sequence is:

1. **Layer 1a — FID-029 (chat persistence)** — Rust `SessionState` field amend + renderer IPC + hook + 5 sub-components. **No other FID can run until this layer is verified.**
2. **Layer 1b — FID-028 (memory graph viz)** — R3F + 2 gateway handlers + 7 npm deps. **Can start AFTER Layer 1a is verified.** Independent of Layer 1a (different routes, no shared files).
3. **Layer 2 — FID-030 (CLI scaffold)** — new entry point. **Can start AFTER Layer 1b is verified.** Adds `crates/cli/` (no shared files with Layer 1).
4. **Layer 3 — FID-032 (api-client refactor)** — renderer's fetch swap. **Depends on Layer 2** (CLI runs the runtime). Depends on Layer 0 (gateway `/v1/*`).
5. **Layer 4 — FID-033 (Tauri repackaging)** — optional shell. **Depends on Layer 3** (Tauri webview uses api-client). **[OPTIONAL — may be skipped without blocking the rest.]**
6. **Layer 5 — FID-034 (kernel trait adoption)** — kernel refactor LAST. **Depends on ALL prior layers.** Touches 23 crates.

For each FID in the sequence:

- **Impl in FULL** (per LESSON-038 all-or-nothing rule; see §All-or-Nothing Per FID below).
- **Verify BEFORE the next FID starts**: each FID's verification gate must pass 100% before the next FID begins.
- **Archive the FID**: only after the impl is verified close + move to `archive/`.
- **Codify the LESSON**: each FID's quirks (e.g., FID-029's rkyv backward-compat pattern, FID-030's port negotiation) become new LESSONs in `dev/LEARNINGS.md` per the FID's §Lessons Learned section.
- **CHANGELOG entry**: each FID gets a `**FID-XXX closed (YYYY-MM-DD; ...)` entry appended to the nearest `## [Unreleased]` section with REAL impl stats (LoC + files + verification commands + LESSONs preserved).

---

## All-or-Nothing Per FID (LESSON-038 Reinforced)

Per the user's explicit FID-LESSON-038 rule: agents must NOT defer or split FIDs without Spencer's explicit approval. For these 6 open FIDs:

- **Cannot split FID-029 impl**: the SessionState amend + IPC + hook + page rewrite are tightly coupled; partial work would break the persistence contract.
- **Cannot split FID-028 impl**: the R3F scene + d3-force worker + 2 gateway handlers + visual data contract must land together.
- **Cannot split FID-030 impl**: the new `crates/cli/` crate can't be half-built (workspace members must compile).
- **Cannot split FID-032 impl**: 22 IPC wrappers must all swap together (mixed `invoke` + `fetch` would create dead paths).
- **Cannot split FID-033 impl**: the `src-tauri/` → `apps/tauri/` move + the gutted `main.rs` + the new `savant_desktop` crate must land together (no half-Tauri state).
- **Cannot split FID-034 impl**: the trait surface + ~20 impl blocks + orchestrator refactor are coupled (no trait surface that only impls 3 of 20 types).

Each FID is impl'd in full or not at all. If a FID is too large for a single turn, the work continues across multiple turns within the same layer (no partial close).

---

## Cross-Layer Invariants

For each layer transition (must hold before next layer starts):

1. **LESSON-027 (doc-drift)**: `pnpm lint:docs` exit 0 → 5 anchors + 1 cascade-prose alternation.
2. **LESSON-038 (no-unilateral-defer)**: `pnpm lint:defer` exit 0 → 0 violations.
3. **LESSON-027 + markdown chain**: `pnpm lint:ci` exit 0 → both `pnpm lint:docs` + `pnpm lint:markdown` green (per code-reviewer Minor 3 — markdown linting is part of the `pnpm lint:ci` chain).
4. **Cargo**: `cargo check --workspace --tests` exit 0 (every layer must keep the full workspace green — Layer 5 is the full test of this).
5. **Cargo clippy**: `cargo clippy --workspace -- -D warnings` exit 0 (catches style + lints that `cargo check` misses; important for FID-034's 20 impl blocks).
6. **Cargo build**: `cargo build --workspace` exit 0 (catches incremental build issues that ripple through all 23 touched crates — Layer 5 specifically).
7. **TS**: `pnpm type-check` exit 0 + `pnpm vitest` exit 0 (renderer-side invariants).
8. **End-to-end smoke**: at least one Playwright e2e test per layer at `playwright.config.ts`, not just a sample (per code-reviewer Minor 3).
9. **For Layer 2+**: `savant --help` + `savant memory --help` + `savant doctor --help` exit 0 (CLI subcommand tree intact).

If any cross-layer invariant breaks between FID closes, the next layer does NOT start until the invariant is restored.

---

## Lessons Learned

- **Strangler-fig layers stack neatly**: do foundation → renderer → CLI → API swap → optional shell → kernel abstractions IN ORDER.
- **Spec-doc phase completion is NOT close-out**: FIDs close ONLY after the actual Rust+TS impl is verified (cargo check + vitest + browser smoke).
- **Verification gates per layer**: each layer's exit criteria must be 100% before the next layer starts.
- **FID-031 (closed) is the foundation**: it provided the gateway `/v1/*` surface that Layer 1-3 FIDs consume.
- **FID-034 (kernel traits) is LAST**: kernel refactor touches 23 crates; doing it last avoids cascading SDK churn.
- **All-or-nothing per FID (LESSON-038)**: each FID is impl'd in full or not at all. Partial impl is NOT permitted.
- **FID-029 + FID-028 can run in PARALLEL turns** (Layer 1a + 1b; no shared files).
- **FID-030 can run in PARALLEL with Layer 1's PARALLEL execution** (different layers, different files: `crates/cli/` doesn't touch `src/`).
- **FID-032 + FID-033 can also run in PARALLEL turns** (but FID-033 depends on Layer 3 being verified; FID-032 doesn't).

---

## Cross-References

- **FID-022** (`dev/fids/archive/FID-2026-07-14-022-lesson-027-doc-drift-linter.md`) — the `pnpm lint:docs` discipline (LESSON-027).
- **FID-026** (`dev/fids/archive/FID-2026-07-14-026-lint-defer-no-unilateral-defer-tool.md`) — the `pnpm lint:defer` discipline (LESSON-038).
- **FID-031** (`dev/fids/archive/FID-2026-07-14-031-http-websocket-api.md`) — Layer 0 foundation; ✓ closed.
- **FID-035 (this master-FID)** — orchestration + layered build order.
- **Path: Layer 1**:
  - **029** (`dev/fids/FID-2026-07-14-029-chat-persistence.md`) — chat persistence
  - **028** (`dev/fids/FID-2026-07-14-028-agent-memory-graph-visualization.md`) — memory graph viz [parallel with 029]
- **Path: Layer 2**: **030** (`dev/fids/FID-2026-07-14-030-cli-scaffold.md`) — CLI scaffold
- **Path: Layer 3**: **032** (`dev/fids/FID-2026-07-14-032-api-client-refactor.md`) — api-client refactor
- **Path: Layer 4 [OPTIONAL]**: **033** (`dev/fids/FID-2026-07-14-033-tauri-repackaging.md`) — Tauri repackaging
- **Path: Layer 5 [LAST]**: **034** (`dev/fids/FID-2026-07-14-034-kernel-trait-adoption.md`) — kernel trait adoption

**LESSONs cited**:
- **LESSON-019** — release-only-versioning discipline
- **LESSON-027** — doc-drift invariant (anchored by `pnpm lint:docs`)
- **LESSON-030** — file-based commit/tag pattern (for FID completion commits)
- **LESSON-031** — re-grep verification gate (for the FID-028 d3-force-3d DOM-dep check)
- **LESSON-038** — no-unilateral-defer (FORBIDS splitting FIDs without Spencer's approval)
- **LESSON-049** — verifier-pass + 4-field Q&A template convention
- **LESSON-051** — explicit scope-ratify
- **LESSON-053** (planned post-FID-030) — CLI-as-runtime-host discipline
- **LESSON-054** — gateway-expansion discipline (FID-031)
- **LESSON-055** (planned post-FID-032) — api-client refactor discipline
- **LESSON-056** (planned post-FID-033) — Tauri-as-optional-shell discipline
- **LESSON-057** (planned post-FID-034) — trait-driven architecture discipline

**Protocol references**:
- **ECHO Protocol v0.1.1** (`ECHO.md`)
- **`templates/FID-TEMPLATE.md`** — the canonical FID structure (used for FID-035 itself)
- **`coding-standards/release-workflow.md`** — the release discipline
- **`dev/LEARNINGS.md`** — the LESSON registry

---

> When this master-FID is implemented (the 6 underlying FIDs close), move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md` `**FID-035 closed (2026-07-14; 6 layered FIDs closed; Layer 0-5 verified)**`.
