#!/usr/bin/env bash
# scripts/clean-bloat.sh — Auto-cleanup transient + dead+bloat files.
# Per FID-024 §Step D + LESSON-029 release-pre-flight cleanup +
# LESSON-030 file-based commit pattern cleanup.
#
# Targets: `.tmp-*` (LESSON-030 temp files), `*.bak` (sed backups),
# `.scratch-*`, `dead-*`, `.DS_Store`, `*.swp`. Filters out
# node_modules/, .git/, target/, .next/, src-tauri/target/, out/.
#
# Usage: bash scripts/clean-bloat.sh [--apply]
# Default: dry-run; pass `--apply` to actually remove.
# Idempotent: re-running with apply is a no-op once cleaned.

set -euo pipefail

APPLY="${1:-}"

DRY_LABEL="[DRY RUN]"
if [ "$APPLY" == "--apply" ]; then
    DRY_LABEL="[DELETED]"
fi

echo "=== Bloat & Transient Cleanup ==="

COUNT=0
while IFS= read -r file; do
    [ -z "$file" ] && continue
    if [ "$APPLY" == "--apply" ]; then
        rm -rf "$file"
    fi
    echo "  $DRY_LABEL $file"
    COUNT=$((COUNT + 1))
done < <(
    find . \
        -path './node_modules' -prune -o \
        -path './.git' -prune -o \
        -path './target' -prune -o \
        -path './.next' -prune -o \
        -path './src-tauri/target' -prune -o \
        -path './out' -prune -o \
        \( -name '.tmp-*' -o \
           -name '*.bak' -o \
           -name '.scratch-*' -o \
           -name 'dead-*' -o \
           -name '.DS_Store' -o \
           -name '*.swp' \) \
        -print 2>/dev/null || true
)

echo ""
if [ "$APPLY" == "--apply" ]; then
    echo "[OK] Removed $COUNT files."
else
    echo "[OK] Would remove $COUNT files."
    if [ "$COUNT" -gt 0 ]; then
        echo "Run with --apply to remove these files."
    fi
fi
