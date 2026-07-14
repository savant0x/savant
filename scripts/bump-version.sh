#!/usr/bin/env bash
# scripts/bump-version.sh <version> — Lockstep version bump across 5 anchors.
# Per FID-024 §Step B + LESSON-019 release-only-versioning discipline +
# LESSON-028 field-specific verifier anchors.
#
# Updates 5 version-bearing files in lockstep:
#   1. VERSION              (single-line, the canonical integer-string)
#   2. package.json         (the `"version"` JSON field)
#   3. protocol.config.yaml (the `project.version` YAML field — LESSON-028 anchor)
#   4. src-tauri/tauri.conf.json (the `"version"` JSON field)
#   5. Cargo.toml           (the `[workspace.package] version` field — Tauri inherits via
#                            `version.workspace = true` in src-tauri/Cargo.toml)
#
# Usage: bash scripts/bump-version.sh <semver>
# Exit 1 on invalid semver OR post-bump lockstep mismatch.

set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[FAIL] Must provide a valid semver string (e.g., 0.0.6)"
    exit 1
fi

echo "=== Bumping Version to $VERSION ==="

# Cross-platform sed helper (works on macOS + msys + Linux via .bak pattern
# from the existing tooling baseline `scripts/lint-defer.sh`).
c_sed() {
    sed -i.bak "$1" "$2" && rm -f "$2.bak"
}

# 1. VERSION — single-line file, just overwrite.
echo "$VERSION" > VERSION
echo "  [OK] VERSION -> $VERSION"

# 2. package.json — first occurrence of `"version": "..."` (LESSON-028 field-specific).
c_sed "0,/\"version\": \".*\"/s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
echo "  [OK] package.json -> $VERSION"

# 3. protocol.config.yaml — `project.version` field (LESSON-028 anchor specificity).
c_sed "s/^project\.version: \".*\"/project.version: \"$VERSION\"/" protocol.config.yaml
echo "  [OK] protocol.config.yaml -> $VERSION"

# 4. src-tauri/tauri.conf.json — first occurrence of `"version": "..."`.
c_sed "0,/\"version\": \".*\"/s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
echo "  [OK] src-tauri/tauri.conf.json -> $VERSION"

# 5. Cargo.toml — `[workspace.package] version = "..."`.
c_sed "s/^version = \".*\"/version = \"$VERSION\"/" Cargo.toml
echo "  [OK] Cargo.toml -> $VERSION"

# Post-bump lockstep validation (LESSON-031 dual-check pattern).
echo ""
echo "Verifying lockstep..."
FAILED=0
grep -q "\"version\": \"$VERSION\"" package.json || { echo "  [FAIL] package.json"; FAILED=1; }
grep -q "^project\.version: \"$VERSION\"" protocol.config.yaml || { echo "  [FAIL] protocol.config.yaml"; FAILED=1; }
grep -q "\"version\": \"$VERSION\"" src-tauri/tauri.conf.json || { echo "  [FAIL] src-tauri/tauri.conf.json"; FAILED=1; }
grep -q "^version = \"$VERSION\"" Cargo.toml || { echo "  [FAIL] Cargo.toml"; FAILED=1; }

if [ "$FAILED" -eq 1 ]; then
    echo ""
    echo "[FAIL] Lockstep validation failed."
    echo "  Revert via: git checkout HEAD -- VERSION package.json protocol.config.yaml src-tauri/tauri.conf.json Cargo.toml"
    exit 1
fi

echo ""
echo "[OK] Version successfully set across all 5 truth anchors."
