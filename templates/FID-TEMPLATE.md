# FID: <!-- fill in: short title -->

| Field | Value |
| --- | --- |
| **Filename** | `FID-YYYY-MMDD-NNN-<!-- fill in: kebab-case-title -->.md` |
| **ID** | FID-YYYY-MMDD-NNN <!-- fill in --> |
| **Severity** | <!-- fill in: critical \| high \| medium \| low --> |
| **Status** | <!-- fill in: created \| analyzed \| fixed \| verified \| converged \| closed --> |
| **Created** | <!-- fill in: YYYY-MM-DD --> |

Allowed status values: `created | analyzed | fixed | verified | converged | closed`.
Allowed severity levels: `critical | high | medium | low`.

## Summary

<!-- fill in: one-paragraph problem statement. What is wrong, where it lives, and why it matters. -->

## RED — Evidence Catalog

<!-- fill in: catalog the current state with evidence. Every claim cites a file path and line number. -->

### Missing / affected paths

| Path | Status | Evidence |
| --- | --- | --- |
| <!-- fill in --> | <!-- fill in: MISSING \| MODIFIED --> | <!-- fill in --> |

### Existing artifacts to preserve

<!-- fill in: files that must NOT be overwritten, with sizes/notes. -->

### Repository / toolchain state

<!-- fill in: git state, build tooling, test runner, anything the fix depends on. -->

### Operator decisions

<!-- fill in: decisions recorded with the operator before GREEN, and why. -->

## GREEN — Specification

<!-- fill in: the converged fix spec. -->

### Decisions

<!-- fill in: each decision with its reasoning, most-robust-default first. -->

### Files to create / modify

1. <!-- fill in: path — what changes, in what order. -->

### Sequence

<!-- fill in: ordered implementation steps. -->

### Call-graph reachability

<!-- fill in: for code changes, grep production entry points to confirm the new path is actually reached. For docs, confirm every referenced path resolves on disk. Zero grep results = not wired. -->

## AUDIT

_To be filled by the Verifier with tool-output evidence._

## ADVERSARIAL

_To be filled by the Adversary with refutation/re-audit verdicts._

## Resolution

_To be filled at closure: commit SHA, archive confirmation, CHANGELOG entry._

---

**FID rules (authoritative source: ECHO.md):**

- FIDs live ONLY in `dev/fids/`. Archived (closed) FIDs move to `dev/fids/archive/`.
- Filename format: `FID-YYYY-MMDD-NNN-{kebab-case-title}.md`.
- Scan existing FIDs in `dev/fids/` and `dev/fids/archive/` to allocate the next available number on the date; never reuse a number on the same date.
- Never create top-level `fids/` or `archive/` directories that shadow canonical ECHO paths.
- Every lifecycle stage requires evidence; FID metadata is a claim, the code is ground truth.
- No author attribution — documents speak for themselves.