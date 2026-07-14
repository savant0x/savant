#!/usr/bin/env bash
# scripts/release-prep.sh <version> [--apply] — Release-prep orchestrator.
# Per FID-024 §Step E. Composes archive-fids.sh + bump-version.sh +
# refresh-readme.sh + clean-bloat.sh + verification gates + scripts/release.py.
#
# Usage:
#   bash scripts/release-prep.sh 0.0.6              # dry-run
#   bash scripts/release-prep.sh 0.0.6 --apply      # actual execution
#
# Branch guard: orchestrator MUST run on `main` if --apply is passed
# (per FID-024 §Loop 1 RED item 5 + §Questions Q1).
#
# Implements:
#   - LESSON-029 (release.py pre-flight is local-only)
#   - LESSON-030 (file-based commit/tag pattern, cleanup discipline)
#   - LESSON-031 (re-grep verification gate)

set -euo pipefail

VERSION="${1:-}"
APPLY="${2:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[FAIL] Provide valid semver. Usage: release-prep.sh <version> [--apply]"
    exit 1
fi

# Branch guard (apply-mode only; dry-run is allowed on any branch).
if [ "$APPLY" == "--apply" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if [ "$CURRENT_BRANCH" != "main" ]; then
        echo "[FAIL] release-prep with --apply MUST run on main. Current branch is '$CURRENT_BRANCH'."
        exit 1
    fi
fi

echo "━━━ RELEASE PREP: v$VERSION ━━━"
echo ""

if [ "$APPLY" != "--apply" ]; then
    echo "[DRY RUN MODE] - No destructive operations will be performed."
    echo ""
fi

# Step 1: Auto-archive resolved FIDs (FID-024 §Step A).
echo "▶ Step 1: archive-fids.sh"
bash scripts/archive-fids.sh $APPLY
echo ""

# Step 2: Cleanup transient + dead+bloat (FID-024 §Step D) — run BEFORE bump
# so temp files from the commit/tag pattern are cleared.
echo "▶ Step 2: clean-bloat.sh"
bash scripts/clean-bloat.sh $APPLY
echo ""

# Steps 3-5: Bump + refresh + CHANGELOG seed (apply-mode only).
if [ "$APPLY" == "--apply" ]; then
    echo "▶ Step 3: bump-version.sh"
    bash scripts/bump-version.sh "$VERSION"
    echo ""

    echo "▶ Step 4: refresh-readme.sh"
    bash scripts/refresh-readme.sh "$VERSION"
    echo ""

    echo "▶ Step 5: CHANGELOG.md post-section seed"
    if ! grep -q "^## v$VERSION" CHANGELOG.md; then
        TODAY=$(date +%Y-%m-%d)
        # Insert new release block above the first `## [Unreleased]` reference.
        sed -i.bak -E "s|^## \\[Unreleased\\]|## [Unreleased]\n\n## v$VERSION — $TODAY\n\n### Added\n- TBD (in-progress release notes)\n|" CHANGELOG.md
        rm -f CHANGELOG.md.bak
        echo "  [OK] Seeded CHANGELOG.md with empty entry for v$VERSION."
    else
        echo "  [SKIP] CHANGELOG.md already has entry for v$VERSION."
    fi
    echo ""
fi

# Verification gates (FID-024 §Step E item 5; exit-on-fail in apply-mode).
# Per code-reviewer's FIX-FORWARD: the orchestrator MUST refuse broken releases
# in apply-mode; non-blocking warnings only acceptable in dry-mode.
echo "▶ Verification Gates"

if [ "$APPLY" == "--apply" ]; then
    # Apply-mode: strict, exit-on-fail.
    bash scripts/lint-docs.sh > /dev/null || { echo "[FAIL] lint-docs.sh"; exit 1; }
    echo "  [OK] lint-docs.sh (LESSON-027 invariant preserved)"

    pnpm lint:docs > /dev/null 2>&1 || { echo "[FAIL] pnpm lint:docs"; exit 1; }
    echo "  [OK] pnpm lint:docs"

    pnpm lint:defer > /dev/null 2>&1 || { echo "[FAIL] pnpm lint:defer"; exit 1; }
    echo "  [OK] pnpm lint:defer (LESSON-038 invariant holds)"
else
    # Dry-mode: non-blocking warnings (mirrors pre-fix behavior).
    bash scripts/lint-docs.sh > /dev/null || echo "  [WARN] lint-docs.sh"
    echo "  [OK] lint-docs.sh"

    pnpm lint:docs > /dev/null 2>&1 || echo "  [WARN] pnpm lint:docs"
    pnpm lint:defer > /dev/null 2>&1 || echo "  [WARN] pnpm lint:defer"
fi

# release-check.sh (LESSON-029 3-gate pre-flight) runs UNCONDITIONALLY — per
# code-reviewer's FIX-FORWARD: even in dry-mode, run the 3-gate pre-flight so
# the orchestrator surfaces latent issues BEFORE the user applies.
echo "  → release-check.sh (LESSON-029 3-gate pre-flight)"
bash scripts/release-check.sh "$VERSION" || { echo "[FAIL] release-check.sh"; exit 1; }
echo "  [OK] release-check.sh"
echo ""

# Step 7: Hand-off to scripts/release.py (FID-024 §Step E item 7).
# Per code-reviewer's FIX-FORWARD: surface release.py exit code explicitly so
# the orchestrator refuses to proceed on partial-failure (e.g., tag-pushed but
# GH-release-missing per FID-024 §Questions Q5).
if [ "$APPLY" == "--apply" ]; then
    echo "▶ Step 7: release.py hand-off"
    python scripts/release.py "$VERSION" || { echo "[FAIL] release.py"; exit 1; }
    echo "  [OK] release.py"
else
    echo "▶ DRY RUN END"
    echo "Run with --apply to finalize release mechanics."
fi
