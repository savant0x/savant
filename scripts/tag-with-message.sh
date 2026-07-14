#!/usr/bin/env bash
# scripts/tag-with-message.sh — LESSON-030 file-based git tag helper (FID-022 §Step D).
#
# Per `dev/LEARNINGS.md` Session 2026-07-14-0400 LESSON-030:
#   - The `git tag -a <tag> -m '...'` inline-message pattern is brittle when
#     tag messages contain special characters (backticks, em-dashes, multi-line
#     bodies from the v0.0.5 release-cut transcription).
#   - The `write_file` tool handles all character escaping correctly; the
#     basher's bash shell can mangle them in the inline-message pattern.
#   - Default-for pattern: any tag message with special characters should
#     use the file-based `git tag -F <file>` pattern.
#
# This script is the file-based helper. Usage:
#
#     bash scripts/tag-with-message.sh <tag> <msg-file>
#     pnpm git:tag -- <tag> <msg-file>
#
# Pre-flight: validates the tag name matches semver-with-v-prefix +
# the msg-file exists + is non-empty. Exits 1 on any pre-flight failure.
#
# Cleanup reminder (LESSON-029): after a successful tag, the user (or
# agent) should `rm -f <msg-file>` BEFORE running `release.py`,
# because `release.py` requires a clean tree.
#
# See `coding-standards/release-workflow.md` §File-based commit/tag pattern
# for the full discipline.

set -euo pipefail

TAG_NAME="${1:-}"
MSG_FILE="${2:-}"

if [ -z "$TAG_NAME" ] || [ -z "$MSG_FILE" ]; then
    echo "[FAIL] Usage: $0 <tag> <msg-file>" >&2
    echo "        <tag> must be 'v<semver>' (e.g., v0.0.6)." >&2
    echo "        <msg-file> must contain the tag message (use write_file)." >&2
    exit 1
fi

# ── Pre-flight: tag name must be v-prefixed + semver ────────────────────
if [[ ! "$TAG_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    echo "[FAIL] Tag name '$TAG_NAME' doesn't match 'v<semver>' pattern." >&2
    echo "        Expected: v0.0.6, v0.0.6-rc.1, etc." >&2
    exit 1
fi

# ── Pre-flight: tag must NOT already exist locally or remotely ──────────
LOCAL_EXIST=$(git tag -l "$TAG_NAME")
if [ -n "$LOCAL_EXIST" ]; then
    echo "[FAIL] Tag '$TAG_NAME' already exists locally." >&2
    echo "        Delete it first with: git tag -d $TAG_NAME" >&2
    exit 1
fi

REMOTE_EXIST=$(git ls-remote --tags origin "$TAG_NAME" 2>/dev/null | awk '{print $2}' | sed 's/\^{}$//' || echo "")
if [ -n "$REMOTE_EXIST" ]; then
    echo "[FAIL] Tag '$TAG_NAME' already exists remotely at $REMOTE_EXIST." >&2
    echo "        Delete it first with: git push origin :refs/tags/$TAG_NAME" >&2
    exit 1
fi

# ── Pre-flight: msg-file must exist + be non-empty ──────────────────────
if [ ! -f "$MSG_FILE" ]; then
    echo "[FAIL] Message file not found: $MSG_FILE" >&2
    exit 1
fi
LINE_COUNT=$(wc -l < "$MSG_FILE" | tr -d ' ')
if [ "$LINE_COUNT" -eq 0 ]; then
    echo "[FAIL] Message file is empty: $MSG_FILE" >&2
    exit 1
fi

# ── Tag ─────────────────────────────────────────────────────────────────
echo "=== Creating annotated tag $TAG_NAME with message from $MSG_FILE ==="
git tag -a "$TAG_NAME" -F "$MSG_FILE"
echo ""
echo "[OK] Tag $TAG_NAME created (local). Push it with: git push origin $TAG_NAME"
echo "    LESSON-029 reminder: rm -f $MSG_FILE before invoking release.py."
