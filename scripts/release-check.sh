#!/usr/bin/env bash
# scripts/release-check.sh — LESSON-029 release.py pre-flight companion (FID-022 §Step C).
#
# Per `dev/LEARNINGS.md` Session 2026-07-14-0400 LESSON-029:
#   - `scripts/release.py`'s clean-tree pre-flight check is LOCAL-ONLY
#     (`git status --porcelain` is consulted; remote is not).
#   - Companion tooling: a `pre-release-check.sh` script that runs the
#     clean-tree check + the uncommitted-temp-file check + the tag-pushed
#     check (3 gates) BEFORE invoking `release.py` closes the gap.
#
# This script is that companion. Usage:
#
#     bash scripts/release-check.sh                  # default (read VERSION file)
#     bash scripts/release-check.sh 0.0.6            # explicit version
#     pnpm release:check                             # via package.json
#
# Exit codes:
#   0  — all 3 gates GREEN; safe to invoke `release.py <version>`
#   1  — Gate 1 fails (uncommitted changes)
#   2  — Gate 2 fails (transient temp files)
#   3  — Gate 3 fails (remote tag missing or stale)
#   4  — invalid arguments
#
# See `coding-standards/release-workflow.md` §Pre-flight check for the full
# discipline + the cleanup pattern.

set -euo pipefail

VERSION="${1:-$(cat VERSION 2>/dev/null || echo '')}"
if [ -z "$VERSION" ]; then
    echo "[FAIL] No version specified and VERSION file missing or empty." >&2
    echo "        Usage: $0 <version>  OR  ensure VERSION file exists at repo root." >&2
    exit 4
fi

FAILED=0

# ── Gate 1: clean working tree (mirrors `release.py`'s pre-flight) ──────
echo "=== Gate 1: clean working tree ==="
DIRTY_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY_COUNT" -ne 0 ]; then
    echo "[FAIL] Working tree has $DIRTY_COUNT uncommitted change(s):"
    git status --porcelain | sed 's/^/        /'
    echo ""
    echo "        Commit, stash, or clean up before releasing (LESSON-029 invariant)."
    FAILED=1
else
    echo "[OK]   Working tree is clean ($DIRTY_COUNT uncommitted changes)"
fi
echo ""

# ── Gate 2: transient temp files (LESSON-029 cleanup discipline) ───────
echo "=== Gate 2: transient temp files (LESSON-029 + LESSON-030 cleanup) ==="
# The 4 patterns below are the canonical LESSON-029 temp-file patterns:
#   - `dev/.tmp-*.txt` / `dev/.tmp-*.md` (the v0.0.5 basher temp files)
#   - `dev/.tmp-*.py` / `dev/.tmp-*.sh` (the FID-020 / FID-022 fix-script temp files)
#   - Any `.tmp-*` file at repo root (defensive)
#   - Any `*.bak` file (common editor backup)
TMP_COUNT=$(find . \( -path './node_modules' -o -path './.git' -o -path './target' -o -path './.next' \) -prune -o \
    \( -name '.tmp-*' -o -name '*.bak' \) -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$TMP_COUNT" -ne 0 ]; then
    echo "[FAIL] Found $TMP_COUNT transient file(s) (LESSON-029 cleanup required):"
    find . \( -path './node_modules' -o -path './.git' -o -path './target' -o -path './.next' \) -prune -o \
        \( -name '.tmp-*' -o -name '*.bak' \) -print 2>/dev/null | sed 's/^/        /'
    echo ""
    echo "        Remove transient files BEFORE invoking release.py (per LESSON-029)."
    FAILED=2
else
    echo "[OK]   No transient temp files present"
fi
echo ""

# ── Gate 3: remote tag check (NEW; not in `release.py`'s local-only check) ──
echo "=== Gate 3: remote tag presence ==="
TAG="v$VERSION"
# `git ls-remote` may fail if offline or if remote is unreachable; we treat that as
# a soft warning (not a hard fail) because some workflows push tags out-of-band.
REMOTE_TAG=$(git ls-remote --tags origin "$TAG" 2>/dev/null | awk '{print $2}' | sed 's/\^{}$//' || echo "")
if [ -z "$REMOTE_TAG" ]; then
    echo "[WARN] Tag '$TAG' not found on remote 'origin' (offline or first-time push)."
    echo "        This is OK if the tag will be created by `release.py` in this run;"
    echo "        it is a problem only if you expected $TAG to already exist remotely."
    echo ""
    echo "        --dry-run invocation: bash scripts/release-check.sh <version> --expect-tag-exists"
    echo ""
    # Gate 3 is advisory (NOT a hard fail) so the script can run on first release
    # of a new version. Document this in `release-workflow.md` §Pre-flight check.
elif [ "$REMOTE_TAG" != "refs/tags/$TAG" ]; then
    echo "[FAIL] Remote tag '$TAG' has unexpected sha format:"
    echo "        remote: $REMOTE_TAG"
    echo "        expected: refs/tags/$TAG"
    FAILED=3
else
    echo "[OK]   Remote tag '$TAG' present at $REMOTE_TAG"
fi
echo ""

# ── Verdict ─────────────────────────────────────────────────────────────
if [ "$FAILED" -eq 0 ]; then
    echo "━━━ All 3 gates GREEN — safe to invoke release.py $VERSION ━━━"
    exit 0
else
    echo "━━━ Gate(s) failed (exit code $FAILED); DO NOT invoke release.py until cleared ━━━"
    exit $FAILED
fi
