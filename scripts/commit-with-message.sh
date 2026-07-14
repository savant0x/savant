#!/usr/bin/env bash
# scripts/commit-with-message.sh — LESSON-030 file-based git commit helper (FID-022 §Step D).
#
# Per `dev/LEARNINGS.md` Session 2026-07-14-0400 LESSON-030:
#   - The `git commit -m 'subject' -m 'body para 1' -m 'body para 2' ...` MULTI-`-m`
#     pattern is brittle when commit messages contain special characters
#     (backticks from the LESSON-027 drift invariant phrase; em-dashes;
#     multi-byte UTF-8; multi-line bodies).
#   - The `write_file` tool handles all character escaping correctly; the
#     basher's bash shell can mangle them in the multi-`-m` pattern.
#   - Default-for pattern: any commit message with special characters
#     should use the file-based `git commit -F <file>` pattern by default;
#     the multi-`-m` pattern is the legacy fallback.
#
# This script is the file-based helper. Usage:
#
#     bash scripts/commit-with-message.sh <msg-file>           # commit staged changes
#     bash scripts/commit-with-message.sh <msg-file> --all     # commit all tracked changes
#     pnpm git:commit -- <msg-file>                            # via package.json
#
# Pre-flight: validates the msg-file exists + is non-empty + contains a
# conventional-commits subject on the first non-blank line. Exits 1 on
# any pre-flight failure (so the agent can correct the message file
# BEFORE attempting the commit).
#
# Cleanup reminder (LESSON-029): after a successful commit, the user
# (or agent) should `rm -f <msg-file>` BEFORE running `release.py`,
# because `release.py` requires a clean tree.
#
# See `coding-standards/release-workflow.md` §File-based commit/tag pattern
# for the full discipline.

set -euo pipefail

MSG_FILE="${1:-}"
shift || true
EXTRA_ARGS=("$@")

if [ -z "$MSG_FILE" ]; then
    echo "[FAIL] Usage: $0 <msg-file> [--all]" >&2
    echo "        <msg-file> must contain the commit message (use write_file to" >&2
    echo "        create it; the file-based pattern avoids shell-escape issues)." >&2
    exit 1
fi

if [ ! -f "$MSG_FILE" ]; then
    echo "[FAIL] Message file not found: $MSG_FILE" >&2
    echo "        Create it via write_file (handles backticks, em-dashes, UTF-8)." >&2
    exit 1
fi

# ── Pre-flight: msg-file must be non-empty ──────────────────────────────
LINE_COUNT=$(wc -l < "$MSG_FILE" | tr -d ' ')
if [ "$LINE_COUNT" -eq 0 ]; then
    echo "[FAIL] Message file is empty: $MSG_FILE" >&2
    exit 1
fi

# ── Pre-flight: first non-blank line must be a conventional-commits subject ─
SUBJECT=$(grep -m1 -v '^[[:space:]]*$' "$MSG_FILE" || true)
if [ -z "$SUBJECT" ]; then
    echo "[FAIL] No subject line found in $MSG_FILE (first non-blank line must be present)." >&2
    exit 1
fi
# Conventional-commits sanity check: subject length + non-leading-whitespace.
SUBJECT_LEN=${#SUBJECT}
if [ "$SUBJECT_LEN" -gt 72 ]; then
    echo "[WARN] Subject is $SUBJECT_LEN chars (> 72); conventional-commits recommends <= 72." >&2
    echo "        Subject: $SUBJECT" >&2
fi
if [[ "$SUBJECT" =~ ^[[:space:]] ]]; then
    echo "[FAIL] Subject has leading whitespace; conventional-commits requires 'type(scope): subject'." >&2
    echo "        Got: '$SUBJECT'" >&2
    exit 1
fi

# ── Pre-flight: warn if nothing is staged (helps catch empty-commit attempts) ─
STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$STAGED_COUNT" -eq 0 ]; then
    echo "[WARN] Nothing is staged. Use 'git add <files>' first, or pass --all to commit all tracked changes." >&2
    echo "        (To force an empty commit, use 'git commit --allow-empty -F $MSG_FILE'.)" >&2
    exit 1
fi

# ── Commit ─────────────────────────────────────────────────────────────
echo "=== Committing $STAGED_COUNT staged file(s) with message from $MSG_FILE ==="
echo "Subject: $SUBJECT"
echo ""
git commit -F "$MSG_FILE" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
echo ""
echo "[OK] Commit landed. LESSON-029 reminder: rm -f $MSG_FILE before invoking release.py."
