#!/usr/bin/env bash
# scripts/refresh-readme.sh <version> — Auto-refresh README stale-state.
# Per FID-024 §Step C. Idempotent: re-running with same version is a no-op.
#
# Updates README.md sections that quote stale state:
#   1. Status badge line: `[![Status](...v0.0.5_Released...)]`
#   2. Architecture table status column: `Status (v0.0.5)` row
#
# Usage: bash scripts/refresh-readme.sh <semver>
# Exit 1 only on invalid input.

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo "[FAIL] Must provide a version argument. Usage: refresh-readme.sh <version>"
    exit 1
fi

README="README.md"
if [ ! -f "$README" ]; then
    echo "[WARN] README.md not found, skipping."
    exit 0
fi

echo "=== Refreshing README Stats for v$VERSION ==="

# 1. Status badge line: Status-vX.Y.Z_Released -> Status-vX.Y.Z_Released.
sed -i.bak -E "s/Status-v[0-9]+\.[0-9]+\.[0-9]+_Released/Status-v${VERSION}_Released/" "$README"
rm -f "${README}.bak"
echo "  [OK] Status badge -> v${VERSION}_Released"

# 2. Architecture table status column: Status (vX.Y.Z) -> Status (vX.Y.Z).
sed -i.bak -E "s/Status \\(v[0-9]+\\.[0-9]+\\.[0-9]+\\)/Status (v${VERSION})/" "$README"
rm -f "${README}.bak"
echo "  [OK] Architecture table status -> v${VERSION}"

echo ""
echo "[OK] README.md updated to v$VERSION."
