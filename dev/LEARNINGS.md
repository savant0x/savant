**Cross-references:** Spencer's session quote 2026-07-14; FID-024 + FID-025 reverting edits (2026-07-14); the new §Auto-defer prohibition section in `coding-standards/release-workflow.md`.

---

### LESSON-050: Untracked-Bloat Is a Real Candidate (FID-024 §Step D clean-bloat.sh discipline)

**Date:** 2026-07-14
**Trigger:** FID-024 §Step D's `clean-bloat.sh` script surfaced `resources/hermes-agent/infographic/dead-delivery-targets` as a candidate during the FID-024 dry-run (via the 2026-07-14 FID auto-archive discipline sweep). The file was **untracked** by git, but the `clean-bloat.sh --apply` removed it from disk without committing. Drift count stayed at 0; the orchestrator's no-op state was preserved; but a future CI step or test harness assertion that referenced this path would silently break.

**Lesson:** The `clean-bloat.sh` pattern matches on filename shapes (`.tmp-*`, `*.bak`, `dead-*`, `.scratch-*`, `.DS_Store`, `*.swp`) **regardless of git-tracking status**. A file with a `dead-` prefix is a bloat candidate, tracked or not. The orchestrator's `git status --short` doesn't surface untracked files (without `--ignored`), so the post-cleanup drift count can stay at 0 even when actual cleanup work happened on disk.

**Permitted uses (no extension required):**
- Removing untracked `*.tmp-*` / `*.bak` / `dead-*` artifacts via `clean-bloat.sh --apply` is a working tree cleanup, not a code change. Skipping the commit is correct.
- For TRACKED bloat files (rare; would require explicit `git rm` or removal + commit), the orchestrator MUST commit the removal (file-based pattern per LESSON-030).

**Not permitted:**
- Claiming "the working tree is clean" when untracked bloat was silently removed (the clean state is git's clean, not disk's clean). The orchestrator must differentiate tracked-vs-untracked cleanup.
- Adding speculative empty commits ("docs(noop): clean-bloat captured an untracked-file removal") — that's LESSON-029 violation territory (speculative commits are forbidden).

**Pattern (the canonical doctrine):**
1. **Pre-cleanup dry-run:** `bash scripts/clean-bloat.sh` (no args; lists candidates per LESSON-029 to surface stale files BEFORE any destructive op).
2. **Apply cleanup:** `bash scripts/clean-bloat.sh --apply` only if step 1 returned ≥1 candidate; otherwise skip (idempotent-floor pattern — saves an unnecessary pass).
3. **Post-cleanup:** `git status --short` (tracks tracked-file changes); `git status --ignored` (surfaces TRACKED-vs-UNTRACKED impact).
4. **If TRACKED changes:** commit with file-based pattern (LESSON-030) + describe scope ("removed N stale harness artifacts").
5. **If UNTRACKED-only changes:** NO commit needed — the working tree's git state is unchanged. Document the untracked removal in a `## Transient bloat removed` block in the orchestrator's report (output, not commit).

**Enforcement + tooling:**
- A future FID-XXX could write `scripts/check-bloat-cleanup.sh` that runs `clean-bloat.sh --apply` then asserts either (a) tracked removals are committed, OR (b) untracked-only removals produce a `## Transient bloat removed` output block. The current orchestrator invokes `clean-bloat.sh` directly without the verification gate; this codifies the gap.

**Anti-pattern documentation (Spencer's automation level 3 evidence, 2026-07-14):**
- During the FID auto-archive discipline sweep + closure commits, `clean-bloat.sh --apply` removed `resources/hermes-agent/infographic/dead-delivery-targets` silently + drift stayed 0 + lint baselines stayed GREEN. This is the canonical example of LESSON-050's "silent cleanup" gap — the cleanup worked but didn't surface as a commit-worthy event. Adding `## Transient bloat removed` to the orchestrator's output would make this visible to the user.

**Cross-references:** FID-024 §Step D (`scripts/clean-bloat.sh` design); FID-024 §Loop 1 RED item 7 (`git ls-files --others --exclude-standard` + `git status --ignored` dual-check); LESSON-029 (release.py pre-flight cleanup); LESSON-031 (re-grep verification gate).

**Codified by:** Savant (2026-07-14) via Spencer's automation level 3 directive + the post-completion auto-archive discipline sweep.

---

### LESSON-051: Explicit Scope-Ratify Enables Direct Status Advance (Automation Level 3 Escape Hatch)

**Date:** 2026-07-14
**Trigger:** Spencer's session directive 2026-07-14: "i want you to enter automation level 3, complete ALL 4 open fids in logical order". This is the first automated scope-ratify in the project's lifetime; previous ratifies were per-FID or per-step.

**Lesson:** A USER-EXPLICIT scope-ratify permits DIRECT status advancement (`analyzed → closed → archived` in a single session, without per-step ratify). LESSON-038's escape-hatch (`user-explicit` permit-context for `deferred` mentions) extends naturally to status-discipline: when the user explicitly names which FIDs to complete, the agent may flip Status, mv to archive, AND commit in the same session, without per-step confirmation. Per-FID ratify is still required for **FUTURE FIDs** that the user did not name.

**Permitted uses (no extension required):**
- Auto-advancing the named FIDs from `analyzed`/`verified` → `closed` + `mv dev/fids/FID-*.md dev/fids/archive/` + commit each closure in a single session — YES, when user names the specific FIDs in the directive (the 4 the user said complete in this cycle: FID-022 status:fixed + FID-023 + FID-024 + FID-027).
- Auto-implementing FID bodies that have an explicit **§Steps Step A-F** spec (e.g., FID-024's 5 NEW scripts) without per-script approval — YES, when the directive names the FID AND its scope (`complete 4 fids in logical order` is broad; `implement FID-024` is narrow; both are explicit enough).

**Not permitted:**
- Auto-advancing FIDs the user did NOT name in the directive (e.g., if user said "complete FID-023+024" only, FID-027 advance would be unilateral; LESSON-038 violation).
- Auto-implementing FIDs at `analyzed` status without a verified `§Steps Step A-F` spec (the FID must have a concrete plan; otherwise the agent has no anchor for what to author).
- Auto-status-flips for FUTURE FIDs not yet opened (the agent must NOT open new FIDs unilaterally; FID-opening requires a separate user directive — same rule as FID-advancement).

**Enforcement + tooling:**
- A future FID-XXX could write `scripts/check-status-ratify.sh` that asserts: a Status flip from `analyzed`/`verified` to `closed` requires either (a) a FID-auto-archive commit in the same session, OR (b) an explicit LESSON-038 user-quote-text in the commit body. The current orchestrator relies on the agent's correctness; codifying this gives a static-check fallback.
- The simulator prompt for any future agent should specifically cite LESSON-051 when the directive is scope-ratifying closing of FIDs.

**Cross-references:** LESSON-038 (the no-auto-defer rubric this extends); LESSON-019 (release-only-versioning discipline — the automation level 3 does NOT speculatively bump version files; the bump is the orchestrator's release-cut responsibility); FID-024 §Step E orchestrator (`pnpm release:prep X.Y.Z --apply` is a similar scope-ratify — the user named the version, the orchestrator proceeds).

**Anti-pattern (caught + fixed 2026-07-14):** The 4-FID closure initially failed Stage 5 (sed-on-stale-path bug + FID-027 filename typo); the FIX basher re-sed the in-archive files + committed each closure cleanly. The discipline held via the FIX-the-fixer step; didn't require user re-ratify. Confirms LESSON-051's promise: scope-ratify survives the implementer's tool errors.

**Codified by:** Savant (2026-07-14) via Spencer's "complete ALL 4 open fids in logical order" directive + the post-completion auto-archive verification.

---

### LESSON-052: FID Auto-Archive Is a Discipline, Not a Single Event

**Date:** 2026-07-14
**Trigger:** Spencer's "move completed fids" directive (post-completion auto-archive discipline sweep). The user's intent was re-confirming the discipline, not driving a one-shot file migration.

**Lesson:** FID auto-archive is best understood as a **steady-state discipline**, not a `mv` event. Each implementation cycle includes N closure commits, each of which follows 4 sub-steps: (a) advance header `**Status:** X → closed`; (b) `mv dev/fids/FID-*.md dev/fids/archive/`; (c) write commit msg file via heredoc (per LESSON-030); (d) commit with `git commit -F <msg-file>` + `rm -f <msg-file>` (per LESSON-029 cleanup). When the cycle ends, the discipline guarantees: every closed FID is in archive; dev/fids/ contains only `-fixture-` (test artifacts per LESSON-045) + `.gitkeep`; archive/ contains the full lifecycle manifest.

**Permitted uses (no extension required):**
- Running `bash scripts/archive-fids.sh --apply` on a clean working tree as a NO-OP discipline confirmation: prints "0 candidates" + drift stays 0. The orchestrator's no-op property is itself a good signal: it means discipline is being upheld across previous cycles (the auto-archive already happened at FID-closure time).
- Running `bash scripts/clean-bloat.sh --apply` analogously — same no-op-on-clean-tree pattern. Transient files are cleaned at FID-closure time per LESSON-029; a clean working tree's clean-bloat is a no-op.

**Not permitted:**
- Treating "the orchestrator's no-op state" as license to skip the orchestrator from future release-cuts — even when 0 candidates exist TODAY, the orchestrator MUST remain a mandatory release-cut step. The discipline is enforced BY the orchestrator's mandatory presence, not by the candidate list.
- Adding speculative empty commits to document the orchestrator's no-op state (LESSON-029 forbids speculative commits; no-op is the WIN state, not a commit-worthy event).

**Enforcement + tooling:**
- A future FID-XXX could write `scripts/check-archive-discipline.sh` that asserts: `ls dev/fids/*.md` matches the expect pattern (only `*-fixture-*.md` files remain; no other FIDs), AND `bash scripts/archive-fids.sh --apply` returns 0 candidates (verifies the no-op discipline holds), AND `bash scripts/clean-bloat.sh` returns 0 candidates (transient-cleanup discipline holds), AND `bash scripts/lint-defer.sh` + `bash scripts/lint-docs.sh` exit 0. The combined check is the "discipline is upheld" signal.
- A pattern for `## Transient bloat removed` output block (per LESSON-050 step 5) could be extended to the orchestrator's stdout.

**Cross-references:** LESSON-019 (release-only-versioning discipline — the release-cut discipline is parallel to the auto-archive discipline); LESSON-029 (release.py pre-flight cleanup matches the orchestrator's no-op steady-state); LESSON-050 (the untracked-bloat-as-candidate gap that surfaces in the no-op discipline confirmation); FID-024 §Loop 1 GREEN items 1-4 (the orchestrator's verify-discipline edges).

**Codified by:** Savant (2026-07-14) via Spencer's "move completed fids" directive + the discipline sweep's clean no-op state.

<!-- Add new entries above this line -->
