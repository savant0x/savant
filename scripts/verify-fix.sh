#!/usr/bin/env bash
# scripts/verify-fix.sh — LESSON-031 verifier dual-check pattern (FID-022 §Step E).
#
# Per `dev/LEARNINGS.md` Session 2026-07-14-0400 LESSON-031:
#   - The verifier pattern was "did the targeted replacement land" rather
#     than "are there ANY remaining occurrences of the old pattern".
#   - A partial fix can leave phantom references that the code-reviewer's
#     pass-by-eye misses (the v0.0.5 session summary case: 1st-pass
#     str_replace landed in §Initial State; 3 more sites were missed).
#   - Default-for rule: when verifying a fix, ALWAYS re-run the FULL search
#     for the old pattern, not just confirm the targeted replacement landed.
#
# This script codifies the dual-check pattern. Usage:
#
#     bash scripts/verify-fix.sh --old '<old-pattern>' --new '<new-pattern>' <files...>
#     pnpm verify:fix -- --old '<old-pattern>' --new '<new-pattern>' <files...>
#
# Behavior:
#   - Counts occurrences of `--old <pattern>` in the given files (expects 0)
#   - Counts occurrences of `--new <pattern>` in the given files (expects > 0)
#   - Exits 0 if old=0 AND new>=1; exits 1 otherwise
#
# Why "new >= 1" (not "new == N"):
#   - The classic LESSON-031 pattern is "old=0 + new=N where N = sites
#     updated". This script supports the more flexible "new>=1" check
#     because N is hard to specify when the fix is conditional (e.g.,
#     "if the file mentions X, also mention Y"). Use the strict "new=N"
#     check by counting sites manually and confirming the count matches.
#
# See `coding-standards/doc-drift-lint.md` §Verifier discipline for the
# full pattern + the code-reviewer pass-by-eye secondary role.

set -euo pipefail

OLD_PATTERN=""
NEW_PATTERN=""
FILES=()

# ── Parse args ──────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
    case "$1" in
        --old)
            OLD_PATTERN="${2:-}"
            shift 2
            ;;
        --new)
            NEW_PATTERN="${2:-}"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 --old '<old-pattern>' --new '<new-pattern>' <files...>"
            echo ""
            echo "Verifies a LESSON-031 dual-check fix:"
            echo "  --old '<old-pattern>'  must be ABSENT (count = 0) from <files>"
            echo "  --new '<new-pattern>'  must be PRESENT (count >= 1) in <files>"
            echo ""
            echo "Exits 0 if both checks pass; exits 1 otherwise."
            echo ""
            echo "Example (v0.0.5 session summary case):"
            echo "  $0 --old 'b1db16c' --new '08fd353' dev/session-summaries/2026-07-14-v0.0.5-release.md"
            exit 0
            ;;
        *)
            FILES+=("$1")
            shift
            ;;
    esac
done

if [ -z "$OLD_PATTERN" ] || [ -z "$NEW_PATTERN" ]; then
    echo "[FAIL] Both --old and --new patterns are required." >&2
    echo "        Run with --help for usage." >&2
    exit 1
fi

if [ ${#FILES[@]} -eq 0 ]; then
    echo "[FAIL] At least one file argument is required." >&2
    echo "        Example: $0 --old 'X' --new 'Y' path/to/file.md" >&2
    exit 1
fi

# ── Check 1: OLD pattern must be ABSENT (count = 0) ────────────────────
echo "=== Check 1: OLD pattern absent (count = 0) ==="
OLD_COUNT=0
OLD_SITES=()
for f in "${FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "[WARN] File not found: $f (skipping)"
        continue
    fi
    count=$(grep -c -F "$OLD_PATTERN" "$f" 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
        OLD_COUNT=$((OLD_COUNT + count))
        OLD_SITES+=("$f:$count")
    fi
done

if [ "$OLD_COUNT" -eq 0 ]; then
    echo "[OK]   OLD pattern '$OLD_PATTERN' is absent from ${#FILES[@]} file(s) (count = 0)"
else
    echo "[FAIL] OLD pattern '$OLD_PATTERN' found $OLD_COUNT time(s) in:"
    for site in "${OLD_SITES[@]}"; do
        echo "        $site"
    done
    echo ""
    echo "        The fix is incomplete; re-grep and update remaining sites (LESSON-031)."
fi
echo ""

# ── Check 2: NEW pattern must be PRESENT (count >= 1) ───────────────────
echo "=== Check 2: NEW pattern present (count >= 1) ==="
NEW_COUNT=0
NEW_SITES=()
for f in "${FILES[@]}"; do
    if [ ! -f "$f" ]; then
        continue
    fi
    count=$(grep -c -F "$NEW_PATTERN" "$f" 2>/dev/null || echo 0)
    if [ "$count" -gt 0 ]; then
        NEW_COUNT=$((NEW_COUNT + count))
        NEW_SITES+=("$f:$count")
    fi
done

if [ "$NEW_COUNT" -ge 1 ]; then
    echo "[OK]   NEW pattern '$NEW_PATTERN' is present in:"
    for site in "${NEW_SITES[@]}"; do
        echo "        $site"
    done
    echo "        (Total: $NEW_COUNT occurrences across ${#NEW_SITES[@]} file(s))"
else
    echo "[FAIL] NEW pattern '$NEW_PATTERN' is NOT present in any file (count = 0)"
    echo "        The fix wasn't applied; review the str_replace and try again."
fi
echo ""

# ── Verdict ─────────────────────────────────────────────────────────────
if [ "$OLD_COUNT" -eq 0 ] && [ "$NEW_COUNT" -ge 1 ]; then
    echo "━━━ LESSON-031 dual-check PASSED — fix is verified ━━━"
    echo "    OLD pattern: 0 occurrences (expected 0; PASS)"
    echo "    NEW pattern: $NEW_COUNT occurrences (expected >= 1; PASS)"
    exit 0
else
    echo "━━━ LESSON-031 dual-check FAILED (old=$OLD_COUNT, new=$NEW_COUNT) ━━━"
    exit 1
fi
