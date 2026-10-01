# Scope

Single-agent STRICT-mode scope boundary. This artifact exists because a scope decision made without
operator approval is a silent decision (Law 2): discovering an issue is not permission to drop it,
and dropping approved work requires the same approval as implementing it.

> **STATUS: CONFIRMED (2026-10-01, operator).** The prior M1–M7 daemon plan is superseded. The
> project is now a section-by-section rebuild described in `ARCHITECTURE.md`. Pillars: (1) the being
> is **proactive, not reactive**; (2) memory and brain land first, because nothing else can be
> evaluated until they work. Tooling: Bun + TypeScript strict + ESLint + Prettier.

## In Scope

- **Section 0 — toolchain and governance.** A green gate set on an empty `src/`.
- **Section 1 — memory.** L0 episodes, L1 progressive disclosure, L2 facts with provenance,
  L3 observations (quote-cited, proof-counted, refined not overwritten), L4 bounded retention.
  Dual private/shared store. Capability-typed read-only handles for sub-agents. Hybrid retrieval.
- **Section 2 — brain.** Interest and goal lifecycle with immutable origin lineage, fairness aging,
  recorded abandonment, and silence as a first-class outcome.
- **Sections 3–8.** Attention/wake, tools and capabilities, contact and silence, provider and
  context, runtime composition, longitudinal recovery and evaluation — in that order.

Sections enter scope through their own FID, in order. A section does not begin until the prior
section's gate set is green.

## Out of Scope

Each requires its own FID before it is touched:

- Porting v1 Rust source. `Savant-orig-backup/` is design evidence, never a build input.
- Vendoring CortexaDB or any other third-party engine. Bun's `bun:sqlite` + FTS5 is the substrate
  unless a measurement says otherwise, and the measurement becomes an FID.
- Multi-agent swarms, A2A delegation, or peer principals.
- A browser, canvas, image generation, or desktop surface.
- WASM / Docker / lambda skill runtimes and hypervisor sandboxing.
- Multiple messaging channels in the first tranche. One channel, proven.
- An HTTP gateway or dashboard.

## Operator decisions on the record

| ID  | Decision                                                                                                                                                                                                                                                                                                                  | Date       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1  | **TypeScript + Bun throughout.** No Rust in the new system.                                                                                                                                                                                                                                                               | 2026-10-01 |
| D2  | **Memory foundation is v1's design**, rebuilt clean, plus Hindsight's observation layer and OpenViking's L0/L1/L2 progressive disclosure.                                                                                                                                                                                 | 2026-10-01 |
| D3  | **L3 is designed now, implemented after L0–L2 proves out.** The schema is correct from day one; we do not build a belief layer on an unproven retrieval layer.                                                                                                                                                            | 2026-10-01 |
| D4  | **Memory fully, then brain.** The brain's contract depends on what memory can actually return.                                                                                                                                                                                                                            | 2026-10-01 |
| D5  | **Single package.** No `memory/` workspace.                                                                                                                                                                                                                                                                               | 2026-10-01 |
| D6  | **Provider-agnostic, not local-first.** Hosted models and local models such as Ollama are both first-class. "Local-first" was an unsupported claim I introduced on 2026-10-01; it is not a product property. Durable state is local, but the being is defined by acting on its own judgment, not by where inference runs. | 2026-10-01 |

## Evidence base for D1–D6

Read during the 2026-10-01 review, cited so these decisions are auditable rather than asserted:

| Finding                                                                                                                                 | Source                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| v1's `MemoryEnclave` grants sub-agents a type-level read-only handle — cross-agent memory corruption is impossible by type              | `Savant-orig-backup/crates/memory/src/engine.rs:117-160`                                |
| v1 scores retention with OCEAN × Ebbinghaus and four tiers                                                                              | `Savant-orig-backup/crates/memory/src/engine.rs:340-470`                                |
| v1's hybrid retrieval detects low-quality result sets by score variance and expands the query                                           | `Savant-orig-backup/crates/memory/src/engine.rs:1105-1128`                              |
| v1's hot-reload watcher holds a registry that live lookup never reads                                                                   | `Savant-orig-backup/crates/agent/src/swarm.rs:332-345` vs `tools/skill_lookup.rs:61-63` |
| Hindsight's observations carry exact supporting quotes and a proof count, refined rather than overwritten                               | `resources/memory/hindsight-main/README.md`                                             |
| OpenViking's L0/L1/L2 lets an agent scan summaries before reading source                                                                | `resources/memory/OpenViking-main/README.md`                                            |
| Hermes' background review is the strongest self-improvement loop reviewed; its proactivity is a user-authored cron schedule, not agency | `resources/hermes-agent-main/agent/background_review.py`, `cron/scheduler_tick.py`      |
| Hermes measures ~26% end-to-end cost reduction from byte-stable prompt caching                                                          | `resources/hermes-agent-main/agent/background_review.py`                                |
| No reviewed system models interest origin, fairness aging, or productive abandonment                                                    | absence across all reviewed trees                                                       |

## Recorded findings

Findings discovered during work that need an operator ruling. None may be dropped unilaterally.

| ID  | Finding                                                                                                                                                                                                                                                  | Status                                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | The pre-rebuild `package.json`, `tsconfig.json`, and `protocol.config.yaml` described a `memory/` workspace and an `src/cli.ts` entry that did not exist on disk; the lint toolchain was split between Biome scripts and an ESLint/Prettier expectation. | `[RESOLVED 2026-10-01 — Section 0 re-baselined to a single package with one toolchain.]`                                                                                                                                                                                                  | `git status` before Section 0; `package.json` scripts `build`/`test` referenced deleted paths                                                                                     |
| S2  | Section 0's first draft exported `PROJECT_NAME` / `PROJECT_DESCRIPTION` from `src/index.ts` that duplicated `package.json` and were consumed only by a test — two sources of truth for one fact (Law 13) and no production consumer (Law 4).             | `[RESOLVED 2026-10-01 — exports removed; identity is owned by package.json alone. The smoke test now asserts the real Section 0 deliverable: that every gate in protocol.config.yaml is wired in package.json and that test discovery is scoped away from the vendored trees.]`           | `src/index.ts:9-11` at the time of finding; `grep -rn "PROJECT_NAME" src/` returned only `src/index.test.ts`                                                                      |
| S3  | `bun test` with no path filter walked `resources/` and `Savant-orig-backup/` and did not terminate within 120s.                                                                                                                                          | `[RESOLVED 2026-10-01 — test script scoped to ./src. This is the same class of defect the pre-rebuild protocol.config.yaml warned about: unscoped globs over the vendored trees.]`                                                                                                        | `bun run test` timed out at 120s; `package.json:14` now reads `bun test ./src --timeout 30000`                                                                                    |
| S4  | Markdown tables in `ARCHITECTURE.md` and `SCOPE.md` exceed 100 columns.                                                                                                                                                                                  | RESOLVED 2026-10-01 — not a defect. The `max_line_length` ceiling in `protocol.config.yaml` is scoped by its own comment to project-owned TypeScript/TSX. Markdown tables are inherently wide; MD013 now enforces 100 columns on prose while exempting tables, code blocks, and headings. | `awk 'length > 100' ARCHITECTURE.md SCOPE.md` — all hits are table rows; `protocol.config.yaml` comment reads "Quality policy for project-owned TypeScript/TSX, including tests." |

## Section 0 outcome

Section 0 is complete. The deliverable was a green gate set, not product code.

| Gate       | Command                         | Result |
| ---------- | ------------------------------- | ------ |
| build      | `bun run build`                 | exit 0 |
| test       | `bun run test`                  | exit 0 |
| type_check | `bun run typecheck`             | exit 0 |
| lint       | `bun run lint --max-warnings 0` | exit 0 |
| lint_md    | `bun run lint:md`               | exit 0 |
| format     | `bun run format:check`          | exit 0 |

`src/index.ts` currently exports nothing. That is deliberate: it is the documented
composition root, and Section 1 adds the memory facade as its first real export. Section 1
opens through its own FID.

## Governance files

The ECHO-governed set at the repository root, and where each one lives:

| File                          | Role                                            | State                                              |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `ECHO.md`                     | Harness protocol, 10-agent roster               | Intact                                             |
| `echo-v0.1.2-single-agent.md` | Single-agent adaptation, governing this project | At root; `protocol.config.yaml` points here        |
| `CHANGELOG.md`                | Change record                                   | **Reset 2026-10-01** to an empty scaffold          |
| `LICENSE`                     | Apache-2.0 text                                 | Restored; `package.json` declares the same license |
| `.gitmessage`                 | Commit template for `ECHO.md` G8                | Restored                                           |
| `dev/SAVANT-VERSIONING.md`    | Base-10 counter with epistemic resets           | Restored, and corrected                            |
| `ARCHITECTURE.md`             | How the design is laid out in code              | Rewritten for the section plan                     |
| `SCOPE.md`                    | This file                                       | Rewritten for the section plan                     |

Two deliberate decisions behind that table:

- **`CHANGELOG.md` was reset, not restored.** Its prior contents documented 70 archived FIDs
  and the superseded M1–M7 plan. Carrying that forward would make the change history claim
  work that no longer describes this project. The prior text is preserved in git history via
  `git log -- CHANGELOG.md`. Operator ruled the reset 2026-10-01.
- **`dev/echo-v0.1.2-single-agent.md` stays deleted.** The authoritative copy moved to the
  repository root and `protocol.config.yaml` cites that path. Restoring the `dev/` copy would
  create two sources of truth for one protocol (Law 13).

## Open out-of-scope items

- **Local LLM inference.** Section 1's L3 consolidation may eventually want a local model for
  cheap summarization. It enters scope only through its own FID, after a measurement shows the
  hosted path is too slow or too expensive.
- **Retrieval evaluation harness.** Sections 1 and 8 both want measured retrieval quality. The
  harness enters scope with Section 1 if the build needs it to prove L2 works, otherwise at
  Section 8. Recording it here so it is not silently dropped.
