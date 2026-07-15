#!/usr/bin/env bash
# scripts/refresh-readme.sh <version> [--dry-run]
#
# Auto-refresh README.md stale-state for a given release version.
# Codifies Spencer's 2026-07-15 directives + LESSON-027 invariant + LESSON-058
# relaxed commit-subject limit.
#
# Updates README.md sections via HTML comment markers (deterministic anchors):
#   - <!-- BADGES_START --> ... <!-- BADGES_END -->              : regenerate badges
#   - <!-- WHATS_NEW_START --> ... <!-- WHATS_NEW_END -->        : single-latest ## Whats New
#   - <!-- ABOUT_BODY_START --> ... <!-- ABOUT_BODY_END -->      : preserved (manual; not regenerated)
#   - Architecture table `Status (vX.Y.Z)` cell                  : updated
#   - Older `## What's New in v<other>` blocks                   : deleted (single-latest rule)
#
# Strict semver validation (rejects --help + any non-semver arg; prevents the
# v0.0.6 --help regression that corrupted the badge + table).
#
# Idempotent: re-running with the same version is a no-op.
#
# Exit codes:
#   0 = SUCCESS
#   1 = invalid input (missing arg, bad semver, --help, files missing)
#   2 = marker missing
#   3 = post-write self-check failed
#   4 = python invocation failed
#
# Usage:
#   bash scripts/refresh-readme.sh 0.0.7
#   bash scripts/refresh-readme.sh 0.0.7 --dry-run

set -euo pipefail

VERSION="${1:-}"
DRY_RUN="false"

if [ -z "$VERSION" ]; then
    echo "[FAIL] Usage: refresh-readme.sh <semver> [--dry-run]" >&2
    echo "        <semver> must match X.Y.Z format (e.g., 0.0.7)." >&2
    exit 1
fi

if [ "$VERSION" = "--help" ] || [ "$VERSION" = "-h" ]; then
    echo "Usage: refresh-readme.sh <semver> [--dry-run]" >&2
    echo "  Updates README.md badges + Whats New + Architecture status for the given version." >&2
    echo "  Exit codes: 0 = success, 1 = invalid input, 2 = marker missing, 3 = post-check failed, 4 = python error." >&2
    exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[FAIL] Version must match semver (X.Y.Z). Got: '$VERSION'" >&2
    exit 1
fi

if [ "${2:-}" = "--dry-run" ]; then
    DRY_RUN="true"
elif [ -n "${2:-}" ]; then
    echo "[FAIL] Unknown arg: '$2'. Allowed: --dry-run" >&2
    exit 1
fi

README="README.md"
CHANGELOG="CHANGELOG.md"

if [ ! -f "$README" ]; then
    echo "[FAIL] README.md not found at $README" >&2
    exit 1
fi

if [ ! -f "$CHANGELOG" ]; then
    echo "[FAIL] CHANGELOG.md not found at $CHANGELOG" >&2
    exit 1
fi

echo "=== Refreshing README for v${VERSION} (dry_run=${DRY_RUN}) ==="

# Portable Python invocation
if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
else
    echo "[FAIL] Neither 'python3' nor 'python' found on PATH. Install Python or invoke manually." >&2
    exit 1
fi
echo "  [..] Using Python: $PYTHON_BIN"

# Marker-presence self-check
for MARKER in '<!-- BADGES_START -->' '<!-- BADGES_END -->' \
              '<!-- WHATS_NEW_START -->' '<!-- WHATS_NEW_END -->' \
              '<!-- ABOUT_BODY_START -->' '<!-- ABOUT_BODY_END -->'; do
    if ! grep -qF "$MARKER" "$README"; then
        echo "[FAIL] Marker not found in README.md: $MARKER" >&2
        echo "        Refusing to write a partial refresh; preserve the canonical README structure." >&2
        exit 2
    fi
done
echo "  [OK] All 6 HTML markers present in README.md"

# Extract Whats New bullets from CHANGELOG.md v<VERSION> block
echo "  [..] Extracting What's New bullets from CHANGELOG.md v${VERSION}..."

WHATS_NEW_BULLETS=$("$PYTHON_BIN" - "$VERSION" "$CHANGELOG" <<'PYEOF'
import re
import sys

# Reconfigure stdout/stderr to UTF-8 to handle Unicode characters (em-dashes,
# right-arrows U+2192, multi-byte chars) in CHANGELOG.md bullets when the
# host shell default codec is cp1252 (Windows Git Bash). Without this, a
# single right-arrow character left in a bullet crashes the heredoc silently
# with UnicodeEncodeError and the README refresh fails mid-flight.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

version = sys.argv[1]
changelog_path = sys.argv[2]

try:
    with open(changelog_path, encoding="utf-8") as f:
        changelog = f.read()
except OSError as e:
    print(f"[FAIL] Cannot read {changelog_path}: {e}", file=sys.stderr)
    sys.exit(1)

# Find the `## v<version> — ...` section header
pattern = re.compile(rf"^##\s+{re.escape('v' + version)}\s+\u2014.*$", re.MULTILINE)
m = pattern.search(changelog)
if not m:
    print(f"[FAIL] No '{version}' section header found in {changelog_path}", file=sys.stderr)
    print(f"       (looked for '^## v{version} \u2014 ...')", file=sys.stderr)
    sys.exit(1)

start = m.start()
rest = changelog[start + 1 :]
next_h = re.search(r"^##\s+", rest, re.MULTILINE)
end = start + 1 + (next_h.start() if next_h else len(rest))
section = changelog[start:end]

# Capture ALL `### Added` subsections (Keep-a-Changelog format with FID-scoped
# headers like `### Added (FID-022 ...)`). Per-section extraction prevents the
# regex from eating across `### Added` boundaries (which previously caused the
# last bullet to include the next section's `### Changed` heading + drop the
# FID-025/026/031 milestones entirely from the README). cap=12 covers a heavy
# release like v0.0.6 which has 9 ### Added bullets (5 FID-022 + 1 FID-025 +
# 2 FID-026 + 1 FID-031) + 3-bullet margin for future releases.
bullets_per_cat = 12


def _norm_lf(text: str) -> str:
    """Defensive CRLF -> LF normalization (CHANGELOG.md is LF on disk; git
    autocrlf on Windows clones may convert; the script must be portable)."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _extract_bullets(text: str, cap: int) -> list:
    """Split text at bullet boundaries via zero-width lookahead (the match
    doesn't consume the bullet-start delimiter). Each `- `-starting part is
    truncated at its first blank-line boundary (so trailing `**FID-X
    closed...**` closing paragraphs don't get swallowed) and capped to
    `cap` entries."""
    parts = re.split(r"(?m)(?=^- )", text)
    out = []
    for p in parts:
        if not p.lstrip().startswith("- "):
            continue
        # Truncate at first blank-line boundary — Keep-a-Changelog continuation
        # lines are 2-space-indented (never blank), so `\n\s*\n` cleanly stops
        # at the end of a bullet.
        truncated = re.split(r"\n\s*\n", p, maxsplit=1)[0]
        out.append(truncated.rstrip())
        if len(out) >= cap:
            break
    return out


section_lf = _norm_lf(section)

added_matches = re.findall(
    r"^###\s+Added.*?(?=^###\s+|^##\s+|\Z)",
    section_lf,
    re.MULTILINE | re.DOTALL,
)

bullets = []
if added_matches:
    for added_section in added_matches:
        if len(bullets) >= bullets_per_cat:
            break
        # Cap the remaining budget for this section so we never exceed the
        # global cap across all `### Added` subsections.
        remaining = bullets_per_cat - len(bullets)
        bullets.extend(_extract_bullets(added_section, remaining))
else:
    # No `### Added` subsection found; fall back to the section as a whole.
    bullets = _extract_bullets(section_lf, bullets_per_cat)

if not bullets:
    print(f"[FAIL] No bullets extractable from v{version}", file=sys.stderr)
    sys.exit(1)

print("\n".join(bullets))
PYEOF
)

if [ $? -ne 0 ] || [ -z "$WHATS_NEW_BULLETS" ]; then
    echo "[FAIL] Could not extract bullets from CHANGELOG.md v${VERSION}" >&2
    exit 4
fi

BULLET_COUNT=$(echo "$WHATS_NEW_BULLETS" | wc -l | tr -d ' ')
echo "  [OK] Extracted ${BULLET_COUNT} bullets from CHANGELOG.md v${VERSION}"

if [ "$DRY_RUN" = "true" ]; then
    echo ""
    echo "[DRY RUN] No write performed. Would update README.md to v${VERSION}:"
    echo "  - Badge Status -> Status-v${VERSION}_Released"
    echo "  - What's New -> single-latest block (${BULLET_COUNT} bullets from CHANGELOG.md)"
    echo "  - Architecture table Status (v${VERSION})"
    echo "  - Older What's New blocks deleted (single-latest rule)"
    exit 0
fi

export WHATS_NEW_BULLETS

# Apply edits via Python (single-pass, deterministic)
"$PYTHON_BIN" - "$VERSION" "$README" "$CHANGELOG" <<'PYEOF'
import os
import re
import sys
from pathlib import Path

# Reconfigure stdout/stderr to UTF-8 for any progress print statements
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

version = sys.argv[1]
readme_path = Path(sys.argv[2])
changelog_path = Path(sys.argv[3])
bullets_text = os.environ.get("WHATS_NEW_BULLETS", "")

if not bullets_text:
    print("[FAIL] WHATS_NEW_BULLETS environment variable is empty or missing", file=sys.stderr)
    sys.exit(1)

readme = readme_path.read_text(encoding="utf-8")
changelog = changelog_path.read_text(encoding="utf-8")

# Extract the release date from the CHANGELOG `## v<version> — YYYY-MM-DD`
# section header. Falls back to "unknown" if absent (defensive; lets the
# auto-refresh pipeline complete even on a freshly-bumped version whose
# CHANGELOG entry hasn't been added yet — the user will then update it).
date_match = re.search(
    rf"^##\s+{re.escape('v' + version)}\s+\u2014\s+(\d{{4}}-\d{{2}}-\d{{2}})",
    changelog,
    re.MULTILINE,
)
iso_date = date_match.group(1) if date_match else "unknown"

# 1. Replace the BADGES region.
old_badges = re.compile(
    r"<!-- BADGES_START -->.*?<!-- BADGES_END -->",
    re.DOTALL,
)
new_badges = (
    "<!-- BADGES_START -->\n"
    "<div align=\"center\">\n\n"
    "[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)"
    "[![Next.js](https://img.shields.io/badge/Next.js-15-%23000000?style=flat-square&logo=nextdotjs&logoColor=%2300fbff)](https://nextjs.org/)"
    "[![Rust](https://img.shields.io/badge/Rust-1.86+-%23000000?style=flat-square&logo=rust&logoColor=%2300fbff)](https://www.rust-lang.org/)"
    "[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)"
    "[![HeroUI](https://img.shields.io/badge/HeroUI-v3_Alpha-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](heroui.com/)"
    "[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](LICENSE)"
    f"[![Status](https://img.shields.io/badge/Status-v{version}_Released-%23000000?style=flat-square&color=brightgreen)](CHANGELOG.md)\n\n"
    "</div>\n"
    "<!-- BADGES_END -->"
)
new_readme, n_badges = old_badges.subn(new_badges, readme, count=1)
if n_badges != 1:
    print(f"[FAIL] Expected exactly 1 BADGES region, replaced {n_badges}", file=sys.stderr)
    sys.exit(3)

# 2. Replace the WHATS_NEW region (single-latest).
new_whats_new = (
    "<!-- WHATS_NEW_START -->\n"
    f"## What's New in v{version}\n\n"
    f"{bullets_text}\n\n"
    "Full release notes in [`CHANGELOG.md`](CHANGELOG.md) "
    f"`## v{version} \u2014 {iso_date}`.\n\n"
    "### Past Releases\n\n"
    "For prior release notes (`v0.0.1` through `v0.0.5`), see [`CHANGELOG.md`](CHANGELOG.md) \u2014 "
    "only the most-recent version's notes live in this README per the single-latest rule codified 2026-07-15.\n\n"
    "<!-- WHATS_NEW_END -->"
)

old_whats_new = re.compile(
    r"<!-- WHATS_NEW_START -->.*?<!-- WHATS_NEW_END -->",
    re.DOTALL,
)
new_readme, n_w = old_whats_new.subn(new_whats_new, new_readme, count=1)
if n_w != 1:
    print(f"[FAIL] Expected exactly 1 WHATS_NEW region, replaced {n_w}", file=sys.stderr)
    sys.exit(3)

# 3. Delete any older `## What's New in v<other>` blocks (single-latest rule).
#    SCOPED SPLIT: only operates on prefix (before WHATS_NEW_START) and
#    suffix (after WHATS_NEW_END). The marker region containing the NEW
#    header is preserved verbatim. Critical: a non-scoped regex would
#    match the new header inside the markers and delete it.
whats_new_start = re.search(r"<!-- WHATS_NEW_START -->", new_readme)
whats_new_end = re.search(r"<!-- WHATS_NEW_END -->", new_readme)
old_hdr = re.compile(
    r"^## What.s New in v[0-9]+\.[0-9]+\.[0-9]+\s*$.*?(?=\n## |\n<!-- |\Z)",
    re.MULTILINE | re.DOTALL,
)

if whats_new_start and whats_new_end and whats_new_start.start() < whats_new_end.start():
    prefix = new_readme[: whats_new_start.start()]
    marker_region = new_readme[whats_new_start.start() : whats_new_end.end()]
    suffix = new_readme[whats_new_end.end() :]
    prefix = old_hdr.sub("", prefix)
    suffix = old_hdr.sub("", suffix)
    new_readme = prefix + marker_region + suffix
else:
    pass

# 4. Update the Architecture table `Status (vX.Y.Z)` cell.
old_status = re.compile(r"Status \(v[0-9]+\.[0-9]+\.[0-9]+\)")
n_status_before = len(old_status.findall(new_readme))
new_readme = old_status.sub(f"Status (v{version})", new_readme)

# Write
readme_path.write_text(new_readme, encoding="utf-8")

print(f"  [OK] Badges        -> v{version}_Released (1 region replaced)")
print(f"  [OK] What's New    -> {len(bullets_text.splitlines())} bullets extracted (1 region replaced)")
print(f"  [OK] Architecture  -> Status (v{version}) ({n_status_before} cells updated)")
PYEOF

if [ $? -ne 0 ]; then
    echo "[FAIL] Python write invocation failed; README.md may be in a partial state; review git diff." >&2
    exit 4
fi

# Post-write self-check
echo "  [..] Running post-write self-check..."

VERIFY_FAIL=0

if ! grep -qF "Status-v${VERSION}_Released" "$README"; then
    echo "  [FAIL] Badge Status 'Status-v${VERSION}_Released' NOT found in README.md" >&2
    VERIFY_FAIL=1
fi

WN_COUNT=$(grep -c "^## What's New in v${VERSION}" "$README" || true)
if [ "$WN_COUNT" -ne 1 ]; then
    echo "  [FAIL] Expected exactly 1 '## What's New in v${VERSION}' header; got $WN_COUNT" >&2
    VERIFY_FAIL=1
fi

if ! grep -qF "Status (v${VERSION})" "$README"; then
    echo "  [FAIL] 'Status (v${VERSION})' NOT found in README.md" >&2
    VERIFY_FAIL=1
fi

TOTAL_WN_HEADERS=$(grep -cE "^## What's New in v[0-9]+\.[0-9]+\.[0-9]+" "$README" || true)
if [ "${TOTAL_WN_HEADERS:-0}" -ne 1 ]; then
    echo "  [FAIL] Single-latest rule violated: ${TOTAL_WN_HEADERS} total ## What's New in vX.Y.Z headers (expected 1)" >&2
    VERIFY_FAIL=1
fi

if [ "$VERIFY_FAIL" -ne 0 ]; then
    echo "[FAIL] Post-write self-check failed. README.md may be in a partial state; review git diff." >&2
    exit 3
fi

echo "  [OK] Post-write self-check: 1 ## What's New in v${VERSION} + Status-v${VERSION}_Released + Status (v${VERSION})"

echo ""
echo "[OK] README.md refreshed to v${VERSION} (badges + What's New + Architecture status)."
echo "     Reminder (LESSON-029): any .tmp-* files removed before next commit/push."
