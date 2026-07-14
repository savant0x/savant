#!/usr/bin/env bash
# scripts/lint-defer.sh — LESSON-038 no-unilateral-defer invariant enforcement (FID-026 §Step A).
#
# Per `dev/LEARNINGS.md` LESSON-038 (2026-07-14) + `coding-standards/release-workflow.md` §Bounded Behavior: No Unilateral Defer:
#   - Trigger: Spencer's session rule 2026-07-14: "We NEVER defer something without my clear approval."
#   - Permitted: (1) annotating Spencer's verbatim quotes about deferral policy;
#                 (2) codifying user-explicit deferral DIRECTLY in `Resolution:` section;
#                 (3) WHEN Spencer EXPLICITLY asks for a defer-decision tracker file,
#                     aggregating fid-level defer status into that file.
#   - Not permitted: deriving 'FID-X impl deferred' from release-cut-gate statements
#                    OR doc-only-push-defer extensions OR cross-FID extrapolation.
#
# This script scans `dev/fids/FID-*.md` (excluding `-fixture-` test files per
# FID-026 §Step A.4) for the word `deferred` (case-insensitive, whole-word)
# on any line; for each occurrence, checks ±3 lines around for adjacent
# user-quote citation OR negation phrasing OR LESSON-038 cross-reference.
# Exits 1 if any violation; exits 0 otherwise.
#
# Mirrors `scripts/lint-docs.sh` (FID-022 §Step A) shape:
#   set -euo pipefail + grep -nE match + sed ±N context + permit-context check
#   + aggregate violations + exit-code summary. Different invariant logic:
#   anchor-count PRESERVATION (LESSON-027) vs adjacent-context VALIDATION
#   (LESSON-038).
#
# Wired as standalone `pnpm lint:defer` + 3rd link of `pnpm lint:ci`.
# Per FID-027 §Steps, the prior 2-link `lint:ci` chain is documented as
# superseded by the 3-link chain.

set -euo pipefail

# ── Regex definitions ──────────────────────────────────────────────
# DEFER_REGEX: case-insensitive whole-word match for "deferred"
DEFER_REGEX='\bdeferred\b'
# PERMIT_REGEX: case-insensitive alternation of the LESSON-038 permitted-context
# markers. Any single match within ±3 lines allows the line. Conservative firing:
# over-detection is intentional per LESSON-038 escape-hatch ("PAUSE and ASK").
# 22 permit markers (FID-026 §Step A.3 + user ratification for Option A broadening):
#   - Spencer-explicit:   verbatim | Spencer[[:space:]]+ | user-explicit | EXPLICITLY
#   - Negation/permitted:  NOT presumed | NOT extend | awaiting separate |
#                          negative phrasing | may legitimately | formerly
#   - LESSON cross-refs:  LESSON-027 | LESSON-028 | LESSON-029 | LESSON-030 |
#                          LESSON-031 | LESSON-038 | defer-decision
#   - Historical markers:  was deferred | got deferred | is deferred |
#                          deferred per | planned during | exempt
#   - Compound forms:      deferred-work | deferred-impl | deferred-status |
#                          deferred-feature
#   - FID-specific:        Companion tooling (FID-022 deferred-future-work pattern)
#   - Release-window:      deferred to vN.N.N (e.g. "deferred to v0.0.7",
#                          "deferred to the v0.0.6 implementation session")
#                          — POSIX-portable via `[0-9]+` (NOT `\d+` which is
#                          PCRE-only and rejected by strict POSIX ERE).
#                          Note: alternation covers both the no-article form
#                          ("to vX.Y.Z") AND the with-article form ("to the vX.Y.Z").
# POSIX-portability note (post-codereview): `[[:space:]]+` is used in place of
# `\s+` (the latter is GNU-only; BSD / strict-POSIX grep accepts the bracket
# class form). `\b` in DEFER_REGEX is GNU-extended but works on the Win MSYS
# + macOS / Linux GNU grep 3+ environments targeted by FID-026.
PERMIT_REGEX='(verbatim|Spencer[[:space:]]+|user-explicit|NOT presumed|NOT extend|awaiting separate|LESSON-038|LESSON-027|LESSON-028|LESSON-029|LESSON-030|LESSON-031|defer-decision|exempt|negative phrasing|EXPLICITLY|Companion tooling|was deferred|got deferred|is deferred|deferred per|deferred to v[0-9]+|deferred to the v[0-9]+|planned during|formerly|may legitimately|deferred-work|deferred-impl|deferred-status|deferred-feature)'

# ── File enumeration ──────────────────────────────────────────────
# Find active FIDs (exclude -fixture- test files per FID-026 §Step A.4
# + per LESSON-041 filename-pattern discipline).
FID_FILES=$(find dev/fids -maxdepth 1 -type f -name 'FID-*.md' -not -name '*-fixture-*' 2>/dev/null | sort || true)

violations=0
total_files=0
total_deferred_lines=0

echo "=== LESSON-038 auto-defer lint ==="

# Handle the no-FIDs-found case (e.g., empty dev/fids/ post-release)
if [ -z "$FID_FILES" ]; then
    echo "Files scanned: 0"
    echo "Lines containing 'deferred': 0"
    echo "Violations (without adjacent user quote): 0"
    echo ""
    echo "[OK] LESSON-038 invariant holds (no active FIDs)"
    exit 0
fi

# ── Per-file scan ─────────────────────────────────────────────────
for fid in $FID_FILES; do
    total_files=$((total_files + 1))

    # Extract lines with `deferred` mentions (grep -E for regex; -n for line numbers)
    matched=$(grep -nE "$DEFER_REGEX" "$fid" 2>/dev/null || true)
    if [ -z "$matched" ]; then continue; fi

    while IFS= read -r line_info; do
        # Defensive: skip if the matched line includes the fixture-marker (would
        # indicate a file that slipped through the find filter).
        if echo "$line_info" | grep -q "fixture-lint-defer"; then continue; fi

        line_no=$(echo "$line_info" | cut -d: -f1)
        line_text=$(echo "$line_info" | cut -d: -f2-)
        total_deferred_lines=$((total_deferred_lines + 1))

        # Compute ±3-line context (clamped to file boundaries per FID-026 polish).
        start=$((line_no - 3))
        if [ "$start" -lt 1 ]; then start=1; fi
        end=$((line_no + 3))

        # Extract the context window via sed. If sed fails (e.g., end exceeds file
        # lines), fall through to graceful handling.
        context=$(sed -n "${start},${end}p" "$fid" 2>/dev/null || true)

        # Check if any permit-context marker is in the ±3-line context.
        if echo "$context" | grep -qiE "$PERMIT_REGEX"; then
            continue  # permitted — adjacent user-quote citation
        fi

        # VIOLATION: deferred without adjacent permit-context.
        echo "VIOLATION: $fid:$line_no — 'deferred' WITHOUT adjacent user-quote citation"
        echo "  | $line_text"
        violations=$((violations + 1))
    done <<< "$matched"
done

echo "Files scanned: $total_files"
echo "Lines containing 'deferred': $total_deferred_lines"
echo "Violations (without adjacent user quote): $violations"
echo ""

if [ "$violations" -gt 0 ]; then
    echo "[FAIL] $violations FID bodies contain 'deferred' WITHOUT adjacent user-quote citation."
    echo ""
    echo "Per LESSON-038: 'We NEVER defer something without my clear approval.'"
    echo ""
    echo "Resolution paths:"
    echo "  1. Annotate with adjacent verbatim Spencer quote: \"direct quote from session\" near the 'deferred' line"
    echo "  2. PAUSE and ASK Spencer for explicit defer-approval"
    echo "  3. Use negation phrasing per LESSON-038 §Permitted Use 2: 'NOT presumed deferred' / 'awaiting Spencer ratification' / 'NOT extend'"
    exit 1
fi

echo "[OK] LESSON-038 invariant holds"
exit 0
