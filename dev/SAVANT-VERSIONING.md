# Savant Versioning

**Current release:** Savant `0.0.1`.

Savant does **not** use SemVer. It uses **Savant Versioning** — a base-10 iteration counter with
epistemic resets.

## Rules

- Versions start at `0.0.1`, not `1.0.0`.
- The last digit counts iterations: `0.0.1` → `0.0.2` → ... → `0.0.10`.
- After 10 iterations, bump the middle digit: `0.0.10` → `0.1.0`.
- A **paradigm break** (fundamentally different architecture/thinking) resets the entire count
  to `0.0.1` — even if the underlying ideas are mature.

## Why

Industry SemVer is calibrated for teams that ship slowly. At Savant's dev velocity, SemVer would
move `1.0.0` → `5.0.0` in a week — signaling "massive changes" when it's just normal iteration
speed. The number becomes noise.

Savant Versioning makes the version string a **humility meter**: `0.0.3` means "three iterations
into the current foundation, still proving the base" — not "beta."

The reset discipline is the moat: most teams carry a version number forward through a rewrite
(pretending continuity). Savant resets because a paradigm break is a _new beginning_, not a
continuation.

## Reset history

| Date       | From         | To      | Cause                                                                                                                                   |
| ---------- | ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | `0.0.8` (v1) | `0.0.1` | Section-by-section rebuild. v1's Rust workspace and the M1–M7 daemon plan were abandoned; the counter restarts from the new foundation. |
