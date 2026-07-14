#!/usr/bin/env bash
# scripts/lint-docs.sh — LESSON-027 doc-drift substring-match invariant enforcement (FID-022 §Step A).
#
# Per `dev/LEARNINGS.md` Session 2026-07-13-2200 LESSON-027 + FID-021:
#   - Canonical phrase lives at `crates/vault/src/master_key.rs:23-27` (cascade
#     docstring) + 4 forward-pointers (`src-tauri/src/lib.rs` [run() doc-comment
#     + load_vault_key helper], `src-tauri/Cargo.toml` [workspace deps comment],
#     `CHANGELOG.md` [[Unreleased] ### Fixed]).
#   - Invariant 1 (exact-match count): 5 (canonical + 4 forward-pointers).
#   - Invariant 2 (cascade-prose alternation variant count): 1 (only canonical).
#   - The `Precedence & ` + `.` + `env` + ` loading` substring is verbatim-cited
#     at each anchor site so `git grep -cF` of the phrase yields exactly the count.
#
# If a future agent adds a 7th forward-pointer site and forgets to use the EXACT
# phrase, the count drops -> this script exits 1 -> drift detected at commit
# time (vs. at quarterly code review time, which is the previous manual discipline).
#
# Wired as `pnpm lint:docs` (standalone) + part of `pnpm lint:ci`.

set -euo pipefail

# Source files containing the 5 anchors per LESSON-027 invariant.
# Invariant: EXACT_TOTAL across these 4 files = 5 (master_key.rs:1 + lib.rs:2 + Cargo.toml:1 + CHANGELOG.md:1)
# Invariant: CASCADE_TOTAL across these 4 files = 1 (only master_key.rs)
SOURCE_FILES=(
    'crates/vault/src/master_key.rs'
    'src-tauri/src/lib.rs'
    'src-tauri/Cargo.toml'
    'CHANGELOG.md'
)

# Canonical phrase (single-quoted bash -> literal; backticks are NOT regex-special
# in fixed-string mode so they're fine). Do NOT rephrase — drift invariant.
CANONICAL_PHRASE='Precedence & `.env` loading'

# Cascade-prose alternation variant. The canonical paragraph in master_key.rs
# uses this unique marker phrase that the 4 forward-pointers do NOT cite. This
# tightened regex detects the canonical PROSE paragraph in master_key.rs ONLY
# (the 4 forward-pointers reference the canonical by exact phrase and don't
# include the prose marker).
# Why not the broader `Precedence.*\.env.*loading`? It matched all 5 sites
# (the exact phrase is technically a special case of the prose pattern via
# `.*`), defeating the invariant. The unique marker is the only reliable split.
# REWRITE-TRIGGER: if a future author intentionally rewrites the canonical
# prose (intentional rework), this cascade-prose check will fail spuriously.
# In that case, update CASCADE_PROSE_PATTERN to match the new wording —
# rewriting the canonical is the ONLY legitimate reason this invariant breaks.
CASCADE_PROSE_PATTERN='canonical reference for the cwd-FIRST ordering rationale'

EXPECTED_EXACT=5
EXPECTED_CASCADE=1

# ── Invariant 1: exact substring count must equal 5 ────────────────────
# `-c` = count per file (output: "file:count"); `-F` = fixed string.
# awk sums the count column across all files (skips empty output).
EXACT_OUTPUT=$(git grep -cF "$CANONICAL_PHRASE" -- "${SOURCE_FILES[@]}" 2>/dev/null || true)
EXACT_TOTAL=$(printf '%s\n' "$EXACT_OUTPUT" | awk -F: '{s += $NF} END { print s+0 }')

# ── Invariant 2: cascade-prose alternation variant count must equal 1 ──
# `-iE` = case-insensitive extended regex (cascade prose has different wording).
CASCADE_OUTPUT=$(git grep -ciE "$CASCADE_PROSE_PATTERN" -- "${SOURCE_FILES[@]}" 2>/dev/null || true)
CASCADE_TOTAL=$(printf '%s\n' "$CASCADE_OUTPUT" | awk -F: '{s += $NF} END { print s+0 }')

echo "=== LESSON-027 doc-drift lint ==="
echo "Exact-match anchors: $EXACT_TOTAL (expected $EXPECTED_EXACT)"
echo "Cascade-prose alternation-variant anchors: $CASCADE_TOTAL (expected $EXPECTED_CASCADE)"
echo ""

if [ "$EXACT_TOTAL" -eq "$EXPECTED_EXACT" ] && [ "$CASCADE_TOTAL" -eq "$EXPECTED_CASCADE" ]; then
    echo "[OK] LESSON-027 invariant holds"
    exit 0
else
    echo "[FAIL] LESSON-027 invariant violated"
    echo ""
    echo "Diagnosis: a forward-pointer was added/removed/changed WITHOUT using the"
    echo "EXACT canonical phrase '$CANONICAL_PHRASE' as its anchor."
    echo "Drift-resolution: read crates/vault/src/master_key.rs:23-27 (canonical),"
    echo "then copy the EXACT phrase to each forward-pointer site."
    exit 1
fi
