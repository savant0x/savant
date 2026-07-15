# Release Workflow Standards

<!-- Load this for all projects — defines the mandatory release cycle -->

## Mandatory Release Cycle

Every time code is pushed:

1. **Update CHANGELOG.md** — add entries for all changes since last push
2. **Review README.md** — update test counts, version references, any stale data
3. **Commit docs** — `git add CHANGELOG.md README.md && git commit -m "docs: ..."`
4. **Push** — `git push`
5. **Create/update release** — tag + release notes on GitHub (or equivalent)

**Never push code without updating CHANGELOG + README first. Never skip the release.**

## CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):

```markdown
## [VERSION] — YYYY-MM-DD

### Added
- New features

### Fixed
- Bug fixes

### Changed
- Modifications to existing behavior

### Removed
- Deprecated features
```

Group entries by FID when applicable. Include file references in parentheses.

## README Maintenance

On every release, verify:

- [ ] Version number matches Cargo.toml / package.json
- [ ] Test count matches `cargo test` output
- [ ] FID count matches `dev/fids/` directory
- [ ] All referenced features still exist
- [ ] No stale links or descriptions

## AGENTS.md

Each project should have an `AGENTS.md` at the root with:

- Project-specific release workflow (may override this standard)
- Build & test commands
- Protocol version reference
- Any project-specific conventions

## Version Bumping — "10 patch releases per minor number" rule

Savant versions count the patch digit 10 times before bumping the minor
digit. This prevents the minor digit from growing absurdly fast as features
land.

```text
v0.0.1 → v0.0.2 → ... → v0.0.10 → v0.1.0 → v0.1.1 → ... → v0.1.10 → v0.2.0 → ...
```

- **Patch** (v0.1.5 → v0.1.6): Bug fixes, small improvements, internal refactors.
- **Minor** (v0.1.10 → v0.2.0): New feature announcements, non-breaking changes. **Do not bump to v0.2.0 from v0.1.5** — count the patch to v0.1.10 first.
- **Major** (v0.x → v1.0.0): Breaking changes, major architecture shifts, protocol version upgrades. Reserved for stability milestones.

Update `VERSION` first, then propagate to `protocol.config.yaml`
`project.version`, `CHANGELOG.md` top entry, and any other version
reference (README badge, package.json keyword, Cargo.toml). All four
must match.

## Pre-flight Check (LESSON-029)

`scripts/release.py`'s clean-tree pre-flight check is **local-only**
(`git status --porcelain` is consulted; remote is not). When the
script fails on a temp file or untracked file, the user (or agent)
MUST clean up before retrying.

**Companion tooling:** `scripts/release-check.sh` runs the 3-gate
pre-flight BEFORE invoking `release.py`:

1. **Gate 1 — clean working tree**: `git status --porcelain | wc -l`
   must equal 0 (mirrors `release.py`'s local check).
2. **Gate 2 — transient temp files**: `find` for `.tmp-*` + `*.bak`
   patterns across the repo (excludes `node_modules/`, `.git/`,
   `target/`, `.next/`). LESSON-030 temp files MUST be removed
   before invoking `release.py` (per `dev/LEARNINGS.md` LESSON-029
   cleanup discipline).
3. **Gate 3 — remote tag presence**: `git ls-remote --tags origin
   "v$VERSION"` is advisory (warns if missing or wrong-sha; does
   NOT hard-fail because some workflows push tags out-of-band).

**Canonical workflow:**

```bash
# Pre-flight + release in one chained command:
pnpm release:check 0.0.6 && python scripts/release.py 0.0.6

# Or staged (pre-flight first, then release once GREEN):
pnpm release:check 0.0.6
python scripts/release.py 0.0.6
```

Exit codes match the gate that failed (1 = Gate 1, 2 = Gate 2,
3 = Gate 3, 4 = invalid args; 0 = all GREEN). Wired as
`pnpm release:check`.

## File-Based Commit/Tag Pattern (LESSON-030)

The multi-`-m` pattern (`git commit -m 'subject' -m 'body para 1'
-m 'body para 2' ...`) is brittle when commit + tag messages contain
special characters (backticks, em-dashes, multi-byte UTF-8, multi-line
bodies). The basher's bash shell-escape sequence can mangle these
characters, producing `git commit` failures that are hard to debug.

**Default-for pattern:** any commit + tag message with special
characters (backticks, em-dashes, multi-line bodies) should use the
file-based pattern:

```bash
# Step 1: write the message to a temp file via write_file (handles
# all character escaping correctly: backticks, em-dashes, UTF-8)
# Example: dev/.tmp-v0.0.6-commit.txt
# Subject: docs(vault): FID-022 doc-drift linter + LESSON-028/029/030/031 tools
#
# Body paragraph 1: full description...
# Body paragraph 2: cross-references...
# Body paragraph 3: lesssons learned...

# Step 2: commit using the file
bash scripts/commit-with-message.sh dev/.tmp-v0.0.6-commit.txt
# OR: git commit -F dev/.tmp-v0.0.6-commit.txt

# Step 3: tag using the file
bash scripts/tag-with-message.sh v0.0.6 dev/.tmp-v0.0.6-tag.txt
# OR: git tag -a v0.0.6 -F dev/.tmp-v0.0.6-tag.txt

# Step 4: REMOVE THE TEMP FILES before invoking release.py
rm -f dev/.tmp-v0.0.6-*.txt
```

**Companion tooling:** `scripts/commit-with-message.sh` +
`scripts/tag-with-message.sh` codify the file-based pattern as
1-command wrappers with pre-flight checks (msg-file exists + non-empty
+ conventional-commits subject for commits; tag-name matches
semver-with-v-prefix + tag-doesn't-already-exist for tags). Wired as
`pnpm git:commit` + `pnpm git:tag`.

**LESSON-029 cleanup discipline:** after a successful commit + tag,
the user (or agent) MUST `rm -f` the temp message files BEFORE
running `release.py`, because `release.py` requires a clean tree.
The `release-check.sh` Gate 2 enforces this automatically.

### Relaxed Subject-Length Discipline (LESSON-058)

The strict <=72-char hard limit from LESSON-030's preflight was relaxed
to a **100-char SOFT cap** with a **>100-char HARD FAIL** per Spencer's
"expand the 75char limit" directive (2026-07-15). The trigger was the
v0.0.6 close-out commit `e464a08` at 75 chars.

**Three-tier rule:**

| Subject length | Behavior | Codified by |
| :--- | :--- | :--- |
| **<= 72 chars** | **Canonical** (no warning, conventional-commits readability) | LESSON-030 |
| **73-100 chars** | **Soft cap** (`[WARN]` only; commit succeeds) | LESSON-058 |
| **> 100 chars** | **Hard cap** (HARD FAIL exit 1; rewrite the subject) | LESSON-058 |

**Rationale:** The 72-char best-practice is preserved (conventional-commits
readability + HEREDOC shell-escape brittleness avoidance). But accepting
73-100 chars accommodates the realistic case where a subject needs a
slightly-longer FID-ID + scope + summary. The 100-char hard cap stays
the typo / laziness guard.

**Tooling:** `scripts/commit-with-message.sh` enforces the three-tier
rule via the `SUBJECT_LEN` checks (updated 2026-07-15). A future
FID-XXX could add `scripts/check-commit-subject-length.sh` for
`pnpm lint:ci` CI enforcement.

**Cross-references:** LESSON-030 (the file-based pattern); LESSON-058 (the relaxed limit); `scripts/commit-with-message.sh`; the v0.0.6 close-out commit `e464a08`.

## Checkpoint Release Discipline (Build-Freely + Push-at-Release)

**Codified 2026-07-14** per Spencer's meta-policy directive: the project
ships in **checkpoints**, not per-feature. Between releases, work
freely + commit locally without pushing; at the release cut, a
fully-automated pipeline sweeps the codebase clean before the push.

### Between-Release Commit Policy

- **Work freely** — new FIDs, code, docs, and tooling can be authored +
  committed locally without push.
- **No per-feature pushes** — only push at the release cut. Per-feature
  pushes pollute the published history + bloat the diff on every
  `git log` review.
- **Drift is acceptable** — uncommitted authoring work, in-progress
  refactors, and investigation scratch DON'T need to land at every
  checkpoint; they accumulate naturally until the release sweep.
- **Discipline floor** — the LESSON-027 substring-match invariant
  (5 anchors + 1 cascade-prose canonical) is the bare-minimum
  invariant that must hold between releases. Run `pnpm lint:docs`
  occasionally to verify; the LESSON-027 invariant is the only
  guarantee against drift that compounds silently.

### Release-Checkpoint Workflow (1-pass automated)

The release cut is a single user-ratable command that orchestrates
the full sweep:

```bash
pnpm release:prep 0.0.6         # the orchestrator (FID-024 §Step A)
```

**Step A: `scripts/release-prep.sh` — orchestrator (NEW; FID-024)**
runs the following in sequence:

1. **`scripts/archive-fids.sh`** — move all active FIDs in `dev/fids/`
   to `dev/fids/archive/` + flip their `**Status:**` field to
   `closed` + verify §Closed footer copy ("When status is set to
   **Closed**, move this file to `dev/fids/archive/` and append an
   entry to `CHANGELOG.md`."). After this, `dev/fids/` is empty
   (only `.gitkeep` remains).

2. **`scripts/bump-version.sh`** — bump the 5 version-bearing files
   in **lockstep** (per LESSON-019 release-only-versioning discipline):
   - `VERSION` (single line)
   - `package.json` (the `"version"` field)
   - `protocol.config.yaml` (`project.version` field under `project:`)
   - `src-tauri/tauri.conf.json` (the `"version"` field)
   - `Cargo.toml` (`[workspace.package] version` field; `src-tauri/Cargo.toml`
     inherits via `version.workspace = true`)
   The script validates all 5 hit the same target version before
   proceeding; mismatch → exit 1.

3. **`scripts/refresh-readme.sh`** — refresh README sections that
   quote stale state:
   - Status badge: `[![Status](https://img.shields.io/badge/Status-v<X.Y.Z>_Released-...)]`
   - "What's New in v<X.Y.Z>" section insertion (between the previous
     version block + the FOOTER references; preserves the Keep-a-Changelog
     format)
   - Architecture table status column (`Status (v<X.Y.Z>)` row in the
     current-status table)
   - Update the `Verification` / `Test count` / `FID count` lines if present

4. **`scripts/clean-bloat.sh`** — remove transient + dead files:
   - `.tmp-*.txt`, `.tmp-*.md`, `.tmp-*.py`, `.tmp-*.sh`
   - `.scratch-*`, `dead-*`, `*.bak`, `.DS_Store`
   - Filtered out of `node_modules/`, `.git/`, `target/`, `.next/`,
     and `src-tauri/target/` to avoid touching build artifacts
   - Dry-run by default; pass `--apply` to actually remove

5. **Verification gates** (run BEFORE the tag/push):
   - `bash scripts/lint-docs.sh` — LESSON-027 invariant check (exit 0)
   - `pnpm lint:ci` — markdown + doc-chain (exit 0)
   - `pnpm test` — vitest suite (0 failures)
   - `bash scripts/release-check.sh <new-version>` — LESSON-029 3-gate
     pre-flight (clean tree + 0 transient files + remote tag advisory)

6. **`python scripts/release.py <new-version>`** — existing release
   script. Reads from CHANGELOG.md, creates git tag + push + GitHub
   release with the new version's release notes extracted from the
   CHANGELOG entry.

**Step B: Spencer ratification** — `.git status` shows a single
well-formed ort with the version bump + arch-FID + README refresh +
bloat-cleanup; Spencer reviews; commits + pushes via
`git push origin main v<new-version>` (pushes both the main commit
+ the annotated tag).

**Step C: Post-release state** (workspace ready for next round):
- `dev/fids/` is empty (auto-archive moved everything)
- New `## [Unreleased]` section auto-added to `CHANGELOG.md` (the
  empty placeholder for the next round's work)
- `package.json` `version` field at the new release's number
- All 5 version-bearing files in lockstep (per LESSON-019)
- 0 `.tmp-*` files lingering (LESSON-029)

### New Package.json Scripts (FID-024 §Step F)

```jsonc
{
  "scripts": {
    "release:prep": "bash scripts/release-prep.sh",
    "release:archive": "bash scripts/archive-fids.sh",
    "release:bump": "bash scripts/bump-version.sh",
    "release:readme": "bash scripts/refresh-readme.sh",
    "release:clean": "bash scripts/clean-bloat.sh",
    "release": "pnpm release:prep"  // alias; presupposes version arg via $npm_config_version
  }
}
```

### Why Build-Freely + Push-at-Release

- **History clarity**: pushes at checkpoint-cut (every several weeks
  / months) produce 1 clean release commit per cycle, vs. 30+ mini-commits
  per cycle.
- **Rollback simplicity**: a mis-shipped release can be reverted
  with a single tag delete; per-feature commits scatter the rollback
  surface area.
- **Reviewer sanity**: contributors reviewing `git log v0.0.5..v0.0.6`
  see 5-15 substantive commits + 1 version-bump + 1 release-notes
  commit, not the 80+ commits from a checkin-by-checkin cadence.
- **WAL-style durability**: per the Savant substrate's CORE LAW 3
  ("WAL is Law — Every state change must be durable, atomic, logged
  immediately"), release-time commits act as durable checkpoints,
  mirroring the per-revision WAL guarantees.

### Bounded Behavior: Empty `[Unreleased]` at Release-Time

The discipline explicitly REJECTS speculative version bumping. The
new `## [Unreleased]` fires at release-time as the empty
post-release seed; agents/FIDs fill it with content as the next
cycle progresses. Weeks of in-progress work accumulates UNDER
`[Unreleased]` (and in `dev/fids/`, `dev/LEARNINGS.md`, `dev/session-summaries/`)
without ever bumping version files speculatively. Per LESSON-019:
"NEVER bump these files speculatively mid-development, regardless
of how much code work has accumulated."

### Bounded Behavior: No Unilateral Defer

Agents must NEVER mark a FID as `deferred` (or annotation-equivalent: `impl deferred until X`, `impl-sub-package of Y`, etc.) without Spencer's explicit approval for THAT specific FID's deferral. Codified as **LESSON-038** (2026-07-14) per Spencer's session rule: *"We NEVER defer something without my clear approval."*

This section is a sibling of `### Bounded Behavior: Empty [Unreleased] at Release-Time` — both rule out agentic behavior that extends into territory Spencer has not explicitly approved.

**Permitted (no extension required):**

- Annotating Spencer's VERBATIM quotes about deferral policy (no extension, just documentation).
- Codifying a user-explicit deferral DIRECTLY in a FID's `Resolution:` section.
- Aggregating fid-level defer status into a separate decision file at Spencer's request.

**Not permitted:**

- Inferring "release cut gate" statements imply "FID-X impl is deferred".
- Extending doc-only push-defer to implementation-defer of the SAME FID.
- Adding `deferred` annotations to OTHER FIDs based on a related FID's deferral.

**Enforcement:**

- This documentation rule is the standing rule: every FID-author session that considers `deferred` framing must PAUSE and ASK Spencer if no explicit approval exists for that specific FID's deferral.
- A future FID-XXX could write a `scripts/lint-defer.sh` static checker that flags any FID body containing the phrase `deferred` without an adjacent user-quote citation (per LESSON-031 re-grep pattern).

**Compliance remediation (2026-07-14):**

- **FID-024 §Status footer + §Resolution:** removed the unilateral "impl deferred until v0.0.6 feature batch lands" annotation in §Status footer (replaced with "awaiting separate Spencer ratification" framing) AND softened §Resolution "Impl Deferral Note" → "User policy references (verbatim)" preserving Spencer's direct quotes with LESSON-038 cross-reference. The user's "defer this docs-only push" directive covers docs-only, NOT FID-024's tool-implementation OR documentation-implementation-extension.
- **FID-025 §Status footer + §Resolution + §Cross-References:** removed the unilateral "impl deferred" annotations; replaced with LESSON-038 references. Implementation timing is at Spencer's separate discretion.
- This release-workflow.md document gets the standing-rule addition; future FIDs inherit the rule automatically.

### Cross-References

- **FID-024** (`dev/fids/FID-2026-07-14-024-checkpoint-release-discipline.md`)
  — implementation record for the 5 NEW scripts + this policy update
- **LESSON-019** — release-only-versioning discipline (the bedrock
  for the lockstep bump)
- **LESSON-027** — doc-drift invariant (between-release floor)
- **LESSON-029** — `release.py` pre-flight is local-only (the
  orchestrator's pre-flight chain echoes this)
- **LESSON-030** — file-based commit/tag (the orchestrator's
  tag/push block uses `git tag -F <message-file>`)
