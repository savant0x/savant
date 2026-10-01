/**
 * Savant — a proactive digital being.
 *
 * Section 0 establishes the toolchain and this composition root. Sections 1 and 2
 * add memory and the brain. Every capability must be reachable from this entry
 * point (ECHO.md Law 4); a capability that exists but is not wired here does not
 * exist.
 *
 * This module intentionally exports nothing yet. Package identity (name,
 * description, version) is owned by `package.json` alone and is not duplicated
 * here — two sources of truth for one fact is a defect (Law 13). Section 1 adds
 * the memory facade as the first real export.
 */

export {};
