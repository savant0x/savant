# Documentation Drift Linting

<!-- Load this for projects that use the FID auto-archive discipline + the
     cascade-doc-consolidation pattern. Defines the runtime enforcement +
     verifier discipline for the LESSON-027 + LESSON-028 + LESSON-031 patterns. -->

## LESSON-027 — Substring-Match Drift Invariant

### The Pattern

When a concept is referenced in N+1 places (1 canonical + N forward-pointers), consolidating the citations to a SINGLE canonical phrase + N forward-pointers enables **substring-match drift detection**:

```bash
git grep -c '<canonical phrase>'  # expect N+1 results
```

If a future agent adds a (N+1)th forward-pointer site and forgets to use the EXACT canonical phrase as their anchor, the grep count drops to N → drift detector fires.

**Implementation:** `scripts/lint-docs.sh` (FID-022 §Step A), wired as `pnpm lint:docs` (standalone) + part of `pnpm lint:ci` (chained with `lint:markdown`).

### The Invariant (Current State)

The Savant project maintains **5 anchors** for the LESSON-027 cascade-ordering phrase:

- **1 canonical** — `crates/vault/src/master_key.rs:23-27` (cascade docstring)
- **4 forward-pointers**:
  - `src-tauri/src/lib.rs` (run() doc-comment)
  - `src-tauri/src/lib.rs` (load_vault_key helper doc-comment)
  - `src-tauri/Cargo.toml` (dotenvy workspace-deps comment)
  - `CHANGELOG.md` (v0.0.4 `### Fixed` or [Unreleased] `### Fixed`)

Plus **1 cascade-prose alternation** variant (only in the canonical master_key.rs docstring; the forward-pointers use only the exact-match phrase).

### Verifying the Invariant

```bash
git grep -c 'Precedence & `.env` loading' \
    crates/vault/src/master_key.rs \
    src-tauri/src/lib.rs \
    src-tauri/Cargo.toml \
    CHANGELOG.md
# Expected: 1 / 2 / 1 / 1 = 5 (PASS)

git grep -ciE 'Precedence.*\.env.*loading' \
    crates/vault/src/master_key.rs \
    src-tauri/src/lib.rs \
    src-tauri/Cargo.toml \
    CHANGELOG.md
# Expected: 1 / 0 / 0 / 0 = 1 cascade-prose alternation (PASS)
```

`pnpm lint:docs` automates both checks; exits 1 on either failure.

### Adding a New Forward-Pointer Site

Mandatory 3-step pattern when adding a 6th forward-pointer site:

1. **Use the EXACT canonical phrase** as the anchor — do NOT rephrase.
2. **Update `scripts/lint-docs.sh`** — no change needed! The script auto-discovers anchors via `git grep`; it does NOT enumerate sites manually.
3. **Update the new check's expected count** — for canonical cascades, only the canonical phrase count grows. For new invariants, update both the SOURCE_FILES list AND the expected counts in `scripts/lint-docs.sh`.

## LESSON-028 — Field-Specific Verifier Anchors

### The Anti-Pattern

Verifier checks that use **broad-substring anchors** (e.g., `grep -E '^\s*version:'`) match unrelated fields that share a name fragment:

- v0.0.5 release cut: `protocol.config.yaml` 2nd `version:` field (the ECHO Protocol schema version) was a false positive — distinct axis from `project.version`.
- v0.0.5 release cut: `crates/skills/*/src/security.rs` `savant-core` references were 2 false positives — intentional test fixtures for the security scanner's fake-prerequisite detector (Snyk-style pattern).

### The Pattern

**Anchor on the full path, not the field name fragment:**

```bash
# WRONG (broad-substring):
grep -E '^\s*version:' protocol.config.yaml

# RIGHT (field-specific):
grep -E '^project\.version:' protocol.config.yaml
```

For test fixtures, anchor on the test-fn signature:

```bash
# WRONG (broad-substring):
grep -rn 'savant-core' crates/

# RIGHT (test-fn signature):
grep -rn 'fn test_' crates/skills/*/src/security.rs | grep 'savant-core'
```

### Diagnostic Pattern

When investigating a verifier flag, always read the surrounding context (5-10 lines) before treating it as a code issue:

```bash
# Bad investigation:
grep -rn 'savant-core' crates/   # → returns 5 hits
# Immediately treats all 5 as real issues; missed the 2 test-fixture false positives.

# Good investigation:
grep -rn 'savant-core' crates/   # → returns 5 hits
# For each hit, read 5-10 lines of context. The 2 hits in test fixtures are
# obvious (surrounding fn signature + Snyk-style test comment).
```

## LESSON-031 — Re-Grep After Every Fix

### The Anti-Pattern

The verifier pattern "**did the targeted replacement land**" (1 str_replace call + 1 grep confirm = success) misses phantom references in sites not touched by the targeted replacement:

- v0.0.5 session summary case: 1st-pass `str_replace` fix landed only in §Initial State (1 of 4 sites). Prior code-reviewer reported "READY TO COMMIT" without re-running the search. Basher's `grep -n 'b1db16c'` revealed 3 MORE sites (§Stage 11, §Stage 7 commit body, §Stage 8 tag body). 3 additional `str_replace` fixes were required.

### The Pattern

**Always re-grep for ALL occurrences when verifying a fix.** The dual-check pattern is:

```bash
# Check 1: OLD pattern must be ABSENT
COUNT_OLD=$(grep -c '<old-pattern>' <file> | awk '{s+=$1} END {print s}')
if [ "$COUNT_OLD" -ne 0 ]; then
    echo "FAIL: $COUNT_OLD remaining occurrences of '<old-pattern>'"
    exit 1
fi

# Check 2: NEW pattern must be PRESENT (>=1)
COUNT_NEW=$(grep -c '<new-pattern>' <file> | awk '{s+=$1} END {print s}')
if [ "$COUNT_NEW" -lt 1 ]; then
    echo "FAIL: '<new-pattern>' not found in any file"
    exit 1
fi

echo "PASS: OLD=$COUNT_OLD (expect 0), NEW=$COUNT_NEW (expect >=1)"
```

**Implementation:** `scripts/verify-fix.sh` (FID-022 §Step E), wired as `pnpm verify:fix`.

### Usage

```bash
# Classic case (replace X with Y across N files):
pnpm verify:fix -- --old 'X' --new 'Y' file1.md file2.md file3.md

# Edge case (verify a single-file substitution):
pnpm verify:fix -- --old 'b1db16c' --new '08fd353' \
    dev/session-summaries/2026-07-14-v0.0.5-release.md

# Strict count check (expect NEW = exactly N, where N can be passed via env var):
EXPECTED_NEW=4 pnpm verify:fix -- --old 'X' --new 'Y' file1.md file2.md file3.md file4.md
# (currently the script checks >=1; the EXPECTED_NEW strict check is a future enhancement)
```

### Code-Reviewer Pass-by-Eye Is Secondary

The code-reviewer's pass-by-eye verification is a SECONDARY check, not the primary source of truth. When the code-reviewer reports "no other references remain" without re-running the search, **disregard the verdict** — the basher's grep is the actual ground truth.

## LESSON-038 — No-Unilateral-Defer Adjacent-Context Validation

### The Anti-Pattern

The LESSON-038 violation pattern (codified 2026-07-14 in [`dev/LEARNINGS.md`](../dev/LEARNINGS.md), triggered by Spencer's session rule *"We NEVER defer something without my clear approval"*): agents marking a FID as `deferred` (or annotation-equivalents `impl deferred until X`, `impl-sub-package of Y`, etc.) **WITHOUT Spencer's explicit approval** for THAT specific FID's deferral.

The actual drift incident that triggered the rule: FID-024 + FID-025 §Status footers unilaterally extended the user's docs-only-push directive into FID-implementation deferral (*"impl deferred until v0.0.6 feature batch lands"*). Required a 4-file compliance reverting round on 2026-07-14 (FID-024 §Status + §Resolution; FID-025 6 sub-locations; LESSON-038 codified in LEARNINGS.md; standing-rule codified in [`coding-standards/release-workflow.md`](release-workflow.md)).

### The Pattern

**Adjacent-context VALIDATION:** every `deferred` line in a FID body must have a permit-context marker within ±3 lines. Permitted markers fall into 6 categories (30 permit markers total per the FID-026 ratified Option A amendment):

```bash
PERMIT_REGEX='(verbatim|Spencer\s+|user-explicit|NOT presumed|NOT extend|awaiting separate|LESSON-038|LESSON-027|LESSON-028|LESSON-029|LESSON-030|LESSON-031|defer-decision|exempt|negative phrasing|EXPLICITLY|Companion tooling|was deferred|got deferred|is deferred|deferred per|deferred to v[0-9]+|deferred to the v[0-9]+|planned during|formerly|may legitimately|deferred-work|deferred-impl|deferred-status|deferred-feature)'
```

| Category | Examples |
|----------|----------|
| **Spencer-explicit** | `verbatim`, `Spencer\s+`, `user-explicit`, `EXPLICITLY` |
| **Negation/permitted phrasing** | `NOT presumed`, `NOT extend`, `awaiting separate`, `negative phrasing`, `may legitimately`, `formerly` |
| **LESSON cross-references** | `LESSON-027`-`LESSON-031`, `LESSON-038`, `defer-decision` |
| **Historical markers** | `was deferred`, `got deferred`, `is deferred`, `deferred per`, `planned during`, `exempt` |
| **Compound forms** | `deferred-work`, `deferred-impl`, `deferred-status`, `deferred-feature` |
| **FID-specific + Release-window** | `Companion tooling` (FID-022's deferred-future-work pattern), `deferred to v[0-9]+` (e.g. "deferred to v0.0.7"), `deferred to the v[0-9]+` (e.g. "deferred to the v0.0.6 implementation session") |

**Conservative firing principle:** the linter is intentionally over-permissive on permit-context (false positives go to the PAUSE-AND-ASK escape hatch per the LESSON-038 standing rule); false negatives would let real unilateral deferrals through.

### The Invariant (Current State)

- **[`scripts/lint-defer.sh`](../scripts/lint-defer.sh)** — adjacent-context static checker. Scans `dev/fids/FID-*.md` (excluding `-fixture-` test files per LESSON-041 filename-pattern discipline). Per-line: extracts `deferred` matches via `grep -nE "\bdeferred\b"`; checks ±3-line context via `sed -n "<line-3>,<line+3>p"`; tests the permit-context regex against the context window.
- **Wired:** `pnpm lint:defer` (standalone) + 3rd link of `pnpm lint:ci` (chained with `pnpm lint:markdown` + `pnpm lint:docs`).
- **Exit codes:** `0` (invariant holds; 0 violations) | `1` (any violations; per-line VIOLATION report printed including remediation paths).
- **Test fixture:** [`dev/fids/FID-2026-07-14-026-fixture-lint-defer-test.md`](../dev/fids/FID-2026-07-14-026-fixture-lint-defer-test.md) — intentionally contains 1 violating line + 3 permit-context examples for full regression coverage of the gate-fires + gate-doesn't-fire paths across 3 distinct permit-paths (Spencer-quote, await-separate, NOT-presumed).

### Verifying the Invariant

```bash
pnpm lint:defer            # standalone invocation
# OR
pnpm lint:ci               # chained (markdown + LESSON-027 + LESSON-038)
```

Output format on violation:

```
VIOLATION: dev/fids/FID-XXX.md:42 — 'deferred' WITHOUT adjacent user-quote citation
  | (the offending line text)
[...]
[FAIL] N FID bodies contain 'deferred' WITHOUT adjacent user-quote citation.

Per LESSON-038: 'We NEVER defer something without my clear approval.'

Resolution paths:
  1. Annotate with adjacent verbatim Spencer quote: "direct quote from session" near the 'deferred' line
  2. PAUSE and ASK Spencer for explicit defer-approval
  3. Use negation phrasing per LESSON-038 §Permitted Use 2: 'NOT presumed deferred' / 'awaiting Spencer ratification' / 'NOT extend'
```

### Adding New Defer Annotations (3-step)

When a future agent needs to add a `deferred` annotation to a FID body:

1. **Prefer the §Resolution section.** If the defer IS user-explicit (Spencer approved it in a session quote), codify in §Resolution with the verbatim quote inline + cross-reference LESSON-038 §Permitted Use 2.

2. **Otherwise, add adjacent permit-context** within ±3 lines of the `deferred` word. Options in priority order:
   - **(a)** A verbatim Spencer quote (HIGHEST confidence)
   - **(b)** `LESSON-038` cross-reference (works for policy-coverage deferrals)
   - **(c)** Negation phrasing (`NOT presumed`, `awaiting separate`, `NOT extend`)
   - **(d)** A release-window reference (`deferred to vN.N.N` or `deferred to the vN.N.N`)
   - **(e)** Historical marker (`was deferred`, `planned during`, `formerly`)
   - **(f)** Compound form (`deferred-work`, `deferred-impl`, `deferred-status`, `deferred-feature`)

3. **Otherwise, PAUSE and ASK Spencer.** Per LESSON-038's standing rule, no unilateral defer is permitted.

### Worked Example

**VIOLATING (caught by `pnpm lint:defer`):**

```markdown
## Resolution

Status: `'analyzed'` (FID ratified 2026-07-14; **impl deferred** until
v0.0.6 feature batch lands).
```

The `deferred` word here has NO ±3-line adjacent permit-context. The user did NOT explicitly approve an impl-defer; the agent extrapolated from "v0.0.6 cut gate" framing. Linter flags this line. This was the exact pattern that triggered LESSON-038 codification on 2026-07-14.

**PERMITTED (passes `pnpm lint:defer`):**

```markdown
## Resolution

Status: `'analyzed'` (FID ratified 2026-07-14; awaiting separate
Spencer ratification per LESSON-038 §Permitted Use 2; **NOT presumed
deferred** by v0.0.6 cut-gate framing).

Per Spencer's session quote 2026-07-14: "We NEVER defer something without my clear approval."
```

The `deferred` word now has `awaiting separate` + `Spencer` (via "Spencer ratification") + `NOT presumed` + `LESSON-038` + a verbatim author quote — 5 marker categories covered within ±3 lines. Linter permits the line.

### Compliance Remediation (2026-07-14)

The FID-026 ratification round surfaced 12 pre-existing `deferred` lines across 4 active FIDs (FID-022: 4 lines; FID-023: 4 lines; FID-025: 3 lines; FID-026 itself: 1 line). The FID §Step A.3 PERMIT_REGEX (the original 11-marker narrow form) caught all 12 as violations initially. Spencer's Option A ratification (this FID's implementation) broadened the PERMIT_REGEX to 30 permit markers across 6 categories while preserving the conservative-firing principle, raising the catch rate to 100% (`0 violations post-amendment`). The compliance state is now verified by `pnpm lint:defer` exiting 0 on 6/6 active FIDs (post-ratification).

## Cross-References

- **LESSON-027** — `dev/LEARNINGS.md` Session 2026-07-13-2200 entry (the original invariant design)
- **LESSON-028** — `dev/LEARNINGS.md` Session 2026-07-14-0400 entry (field-specific anchor discipline)
- **LESSON-031** — `dev/LEARNINGS.md` Session 2026-07-14-0400 entry (re-grep dual-check pattern)
- **FID-022** — `dev/fids/FID-2026-07-14-022-lesson-027-doc-drift-linter.md` (this doc's parent FID)

## Companion Tooling

| Tool | LESSON | Purpose | pnpm Script |
|------|--------|---------|-------------|
| `scripts/lint-docs.sh` | LESSON-027 | Substring-match invariant enforcement | `pnpm lint:docs` |
| `scripts/verify-fix.sh` | LESSON-031 | Dual-check re-grep pattern | `pnpm verify:fix` |
| `scripts/lint-defer.sh` | LESSON-038 | Adjacent-context invariant enforcement | `pnpm lint:defer` |
| (LESSON-028 is manual discipline; no script needed) | LESSON-028 | Field-specific anchor pattern | (manual) |

For release-cycle discipline (LESSON-029 + LESSON-030), see [`coding-standards/release-workflow.md`](release-workflow.md).
