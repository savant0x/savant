#!/usr/bin/env bash
# scripts/archive-fids.sh — Auto-archive resolved FIDs.
# Per FID-024 §Step A + FID-TEMPLATE §Closed footer convention.
#
# For each `dev/fids/FID-*.md` (excluding `-fixture-` files per
# LESSON-041's TEST-artifact-positioning convention), read the
# `**Status:**` field. If status ∈ {analyzed, fixed, verified, closed},
# flip status to `closed` + mv the file to `dev/fids/archive/`.
#
# Usage: bash scripts/archive-fids.sh [--apply]
# Default: dry-run; pass `--apply` to actually perform the mv + flip.
# Idempotent: re-running is a no-op once FIDs are archived.

set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
    APPLY=1
fi

mkdir -p dev/fids/archive

echo "=== FID Auto-Archive ==="

ARCHIVED=0
SKIPPED=0
for fid in $(find dev/fids -maxdepth 1 -type f -name 'FID-*.md' 2>/dev/null | sort || true); do
    # Skip test fixtures explicitly (LESSON-045 convention).
    if [[ "$(basename "$fid")" == *-fixture-* ]]; then
        echo "  -> [SKIP] $(basename "$fid") (test fixture)"
        continue
    fi

    if grep -iqE '^[*]*Status:[*]*[[:space:]]+(analyzed|fixed|verified|closed)' "$fid"; then
        filename=$(basename "$fid")
        if [ "$APPLY" -eq 1 ]; then
            # Flip status to exactly 'closed' (cross-platform sed via .bak pattern).
            sed -i.bak -E 's/^([*]*Status:[*]*[[:space:]]+).*/\1closed/' "$fid"
            rm -f "${fid}.bak"
            mv "$fid" "dev/fids/archive/$filename"
            echo "  -> [ARCHIVED] $filename"
        else
            echo "  -> [DRY RUN] would archive $filename"
        fi
        ARCHIVED=$((ARCHIVED + 1))
    else
        SKIPPED=$((SKIPPED + 1))
    fi
done

echo ""
if [ "$APPLY" -eq 1 ]; then
    echo "[OK] Archived $ARCHIVED files. Skipped $SKIPPED (non-closable status)."
else
    echo "[OK] Would archive $ARCHIVED files. Skipped $SKIPPED (non-closable status)."
    if [ "$ARCHIVED" -gt 0 ]; then
        echo "Run with --apply to perform the move."
    fi
fi

if [ "$ARCHIVED" -eq 0 ]; then
    exit 0
fi

exit 0
