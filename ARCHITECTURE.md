# Savant — Architecture

> **Status:** Section-by-section rebuild, 2026-10-01. This document describes the plan and the
> code as it lands. `Savant-orig-backup/` is read-only reference material, not this repository.

## What this repository is

One Bun + TypeScript package building a **proactive digital being**: a long-running
process that wakes on its own, decides what matters, acts, and remembers what it learned.

It is not an assistant that waits to be asked. It is not a framework. It is not the ECHO harness
(`ECHO.md` at the root governs the harness; this file governs the product).

Inference is provider-agnostic: hosted models and local models such as Ollama are both
first-class, and no deployment shape is decided until Section 6. Durable state is local
(`bun:sqlite` on disk), but "local-first" is not a product claim — the being is defined by
acting on its own judgment, not by where its inference runs.

## The one idea

Most agents are **reactive** — a prompt arrives, the model responds, the transcript is forgotten.
Savant is **proactive**: it maintains durable state, holds interests, and selects work it considers
worth doing without an inbound request.

Everything below serves that. A capability that does not advance self-directed action is deferred.

## Reference material (read-only, never imported)

| Path                  | What it is                                                                  | Status                          |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `Savant-orig-backup/` | v1 — ~131k lines of Rust across 25 crates, plus a 32k-line Next.js renderer | Read-only design evidence       |
| `resources/memory/`   | 10 third-party agent memory systems                                         | Read-only prior art             |
| `resources/`          | openclaw, hermes-agent, mastra, langgraph, openai-agents-js, pi             | Read-only competitive reference |

**Nothing under these paths may be imported, vendored, or built against.** They exist so that a
question like "did v1 already solve this?" is answered by reading code, not by re-deriving it.

## Build order

Nine sections. Each one ends in something demonstrable — never "substrate ready, brain later."

| §   | Section                | Demonstrable outcome                                                            |
| --- | ---------------------- | ------------------------------------------------------------------------------- |
| 0   | Toolchain & governance | `build`, `test`, `typecheck`, `lint`, `lint:md`, `format:check` all green       |
| 1   | **Memory**             | Retain → retrieve with citations; contradiction survives; forgetting is bounded |
| 2   | **Brain**              | An interest produces a self-originated pursuit that continues or is abandoned   |
| 3   | Attention & wake       | Entropy-driven wake gate; unchanged world costs nothing                         |
| 4   | Tools & capabilities   | One registry; hot-swap; atomic activation; rollback                             |
| 5   | Contact & silence      | Proactive message or honest silence, with custody of every send                 |
| 6   | Provider & context     | Pinned provider, cache-safe prompt, bounded context                             |
| 7   | Runtime composition    | Everything reachable from one production entry point                            |
| 8   | Longitudinal           | Recovery, audit, evaluation                                                     |

Sections 1 and 2 are the thesis. Nothing after them matters if they fail.

### Section 1 — Memory

Five layers, each answering a question the brain must ask:

| Layer | Holds                                                       | Property                              |
| ----- | ----------------------------------------------------------- | ------------------------------------- |
| L0    | Episodes — every interaction, tool result, wake             | Append-only, lossless                 |
| L1    | Progressive disclosure — abstract + overview per episode    | Cheap scan, deep read on demand       |
| L2    | Facts — atomic claims with source references                | Contradiction-flagged                 |
| L3    | Observations — beliefs backed by cited facts, proof-counted | Refined, never silently overwritten   |
| L4    | Retention — OCEAN × Ebbinghaus, four tiers                  | Bounded growth; forgetting is audited |

Cross-cutting: dual database (private / shared), capability-typed read-only handles for
sub-agents, hybrid retrieval (BM25 + vector + graph, RRF fusion, sufficiency detection).

### Section 2 — Brain

The part no reviewed system has. v1 and Hermes both have a background review loop; neither has
agency. Both are reactive with maintenance jobs.

- **Interests** — origin is immutable and audited; evidence, bounded next step, stop conditions
- **Goals** — assigned / derived / self-originated, never reclassified to flatter the record
- **Fairness aging** — a quiet interest cannot starve forever
- **Abandonment** — giving up is a recorded success, not a failure
- **Silence** — a first-class outcome with a reason

## Verification gates

Defined in `protocol.config.yaml`, wired to `package.json`. Every change runs all of them.

| Gate       | Command                     |
| ---------- | --------------------------- |
| build      | `bun run build`             |
| test       | `bun test`                  |
| type_check | `tsc --noEmit`              |
| lint       | `eslint . --max-warnings 0` |
| lint_md    | `markdownlint-cli2`         |
| format     | `prettier --check .`        |

Quality ceilings — 300 file lines, 50 function lines, 100 columns, complexity 10, 4 parameters,
nesting depth 3 — are in `protocol.config.yaml` under `quality`, and are repeated as language
overrides in `coding-standards/typescript.md`, which wins where the two disagree.

## Governance

| Concern                                                 | Authority                                |
| ------------------------------------------------------- | ---------------------------------------- |
| Harness protocol                                        | `ECHO.md` (root)                         |
| Approved scope and the audit trail of anything deferred | `SCOPE.md`                               |
| Commands, quality ceilings, machine-readable contract   | `protocol.config.yaml`                   |
| TypeScript conventions, type safety, error handling     | `coding-standards/typescript.md`         |
| FID lifecycle in practice                               | `templates/FID-TEMPLATE.md`, `dev/fids/` |
| Durable engineering invariants                          | `dev/LEARNINGS.md`                       |
| Version                                                 | `VERSION`                                |

## Local-only paths

| Path                                | Why                                                    |
| ----------------------------------- | ------------------------------------------------------ |
| `resources/`, `Savant-orig-backup/` | Vendored reference trees. Gitignored by design.        |
| `.savant/`                          | Runtime state (database, workspace, logs). Gitignored. |
| `dist/`                             | Build output. Gitignored.                              |

**A citation that does not resolve on disk is a defect, not a shorthand.** Every path named in this
file must exist.
