// src/lib/logger.ts
//
// ECHO Law 13 (utility-first, universal logic) — single logger for all
// debug output in the renderer. Replaces scattered `console.*` calls +
// their `// eslint-disable-next-line no-console` suppressions with a
// properly-typed module that downstream consumers import instead of
// reaching for `console` directly.
//
// Why a wrapper instead of using `console.*` directly:
//   1. Single point of control for the `[savant]` prefix + log level
//      formatting. Future enhancements (e.g. log level filtering,
//      remote transport, breadcrumb collection) ship in one place.
//   2. Decouples call sites from the global `console` namespace —
//      tests can stub `logger` without monkey-patching `console`.
//   3. Removes the need for per-line `// eslint-disable-next-line
//      no-console` comments (the logger is not a `console.*` call).
//   4. Per ECHO Law 12 (never expose sensitive data in logs/errors),
//      the logger's `redact()` helper strips known-secret fields
//      (keys, tokens, hashes) before logging — call sites can pass
//      objects containing sensitive data without leaking.
//
// Scope: this is a Phase 1 browser-preview logger. It writes to
// `console.*` under the hood (the only sink available in a browser
// without a remote transport). Phase 2 Tauri migration can swap the
// sink to a Rust-side logger via a new IPC command without changing
// any call site.
//
// The logger does NOT silently swallow errors. Every method is
// fire-and-forget; callers handle their own error propagation
// (ECHO Law 14 — all error paths handled by the caller).
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info("session key rotated", { agent: "savant-abc123" });
//   logger.warn("rotation failed", { code: "rotation_error" }, e);
//   logger.error("listProfiles failed", err);

export type LogLevel = "info" | "warn" | "error";

/** Structured log context. Keys with `secret` in the name are redacted. */
export type LogContext = Record<string, unknown>;

/**
 * Fields whose values are redacted before logging. The match is
 * case-insensitive on the key name; the value is replaced with
 * `"[REDACTED]"` regardless of type. Per ECHO Law 12.
 *
 * Pattern design (tightened to reduce false positives):
 *   - `secret` is anchored to `(^|[_-])secret([_-]|$)` so compound
 *     words like "secretSanta", "secretary", "mySecret" pass through.
 *     Only standalone "secret" segments (delimited by string bounds
 *     or `[_-]`) are redacted.
 *   - `api_key`, `master_key`, `session_key`, `sub_key` all have a
 *     `$` anchor so compound words like "myapikey", "api_key_thing"
 *     pass through. Only the standalone key names at the END of
 *     the key are redacted. The trailing `s?` makes the plural
 *     form (`api_keys`, `master_keys`, etc.) also match — real-world
 *     collections use the plural, and the inconsistency with the
 *     unanchored `token` / `password` patterns (which already match
 *     their plurals) was visible.
 *   - `key$` (bare) remains unanchored on the left so any word
 *     ending in "key" (e.g., "anyKey", "mykey") is redacted. This
 *     errs on the side of redacting (ECHO Law 12) — the false
 *     positive rate is acceptable; the false negative rate is not.
 */
const SECRET_KEY_PATTERNS = [
  /(^|[_-])secret([_-]|$)/i,
  /password/i,
  /token/i,
  /credential/i,
  /api[_]?keys?$/i,
  /master[_]?keys?$/i,
  /session[_]?keys?$/i,
  /sub[_]?keys?$/i,
  /bearer/i,
  /authorization/i,
  /hash/i,
  /key$/i,
] as const;

/** Returns true if the key name matches a known-secret pattern. */
function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

/**
 * Recursively redact a value for safe logging. Handles:
 *   - Primitives (string, number, boolean, null, undefined) → as-is
 *   - Plain objects (Object.prototype === prototype) → recurse via `redact()`
 *   - Arrays (any depth, including arrays of arrays) → recurse per element
 *   - Non-plain objects (Date, Map, Set, RegExp, null-prototype, etc.) → as-is
 *     (silent data loss would be worse than a slightly less-redacted value)
 *
 * The plain-object guard uses `Object.getPrototypeOf(v) === Object.prototype`
 * (not `v.constructor === Object`) to correctly handle:
 *   - `Object.create(null)` — no prototype, no constructor
 *   - Cross-realm objects (e.g., from iframes) — `v.constructor` may
 *     be `Object` from a different realm but `Object.getPrototypeOf`
 *     returns the SAME prototype object across realms
 */
function redactValue(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  // Array check MUST come before the prototype check: arrays have
  // `Array.prototype`, not `Object.prototype`, so they would fall
  // through to the "return as-is" branch otherwise. We need to
  // recurse into array elements instead.
  if (Array.isArray(v)) return v.map(redactValue);
  if (Object.getPrototypeOf(v) !== Object.prototype) return v;
  // Cast through `unknown` to acknowledge the type-system gap: TS
  // cannot statically prove that a value whose prototype matches
  // `Object.prototype` is structurally a `LogContext`. The runtime
  // is safe because `redact()` only reads `Object.entries(v)` and
  // never mutates the input.
  return redact(v as unknown as LogContext);
}

/**
 * Deep-clone a context object, replacing any value whose key matches
 * a secret pattern with `"[REDACTED]"`. Recurses into nested objects
 * AND arrays (any depth, including arrays of arrays). Non-plain
 * objects (Date, Map, Set, RegExp) pass through unchanged. The
 * original object is NOT mutated.
 */
export function redact(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (isSecretKey(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactValue(v);
    }
  }
  return out;
}

/**
 * Format a log message with the `[savant]` prefix + level tag.
 * Examples:
 *   formatMessage("info", "session key rotated") → "[savant] session key rotated"
 *   formatMessage("warn", "rotation failed")    → "[savant:warn] rotation failed"
 *   formatMessage("error", "listProfiles failed") → "[savant:error] listProfiles failed"
 */
function formatMessage(level: LogLevel, message: string): string {
  return level === "info"
    ? `[savant] ${message}`
    : `[savant:${level}] ${message}`;
}

export interface Logger {
  /**
   * Log an informational message. Use for non-error events that
   * aid debugging (e.g. "session key rotated", "mock IPC installed").
   * The message is prefixed with `[savant]` and written to
   * `console.info`.
   */
  info(message: string, context?: LogContext): void;
  /**
   * Log a warning. Use for handled failures (the caller continues
   * despite the error). The message is prefixed with
   * `[savant:warn]` and written to `console.warn`. If `error` is
   * provided, its `.message` is appended to the log line.
   */
  warn(message: string, context?: LogContext, error?: unknown): void;
  /**
   * Log an error. Use for unhandled failures (the caller is about
   * to propagate the error to the user). The message is prefixed
   * with `[savant:error]` and written to `console.error`. If
   * `error` is provided, its `.message` is appended to the log
   * line.
   */
  error(message: string, context?: LogContext, error?: unknown): void;
}

/**
 * Build a console-formatted argument list from a message + optional
 * context + optional error. The context is redacted (ECHO Law 12)
 * and serialised as a single JSON string for readability.
 */
function buildArgs(
  message: string,
  level: LogLevel,
  context?: LogContext,
  error?: unknown,
): unknown[] {
  const args: unknown[] = [formatMessage(level, message)];
  if (context !== undefined) {
    const safe = redact(context);
    args.push(JSON.stringify(safe));
  }
  if (error !== undefined) {
    const errMsg = error instanceof Error ? error.message : String(error);
    args.push(errMsg);
  }
  return args;
}

export const logger: Logger = {
  info(message, context) {
    // eslint-disable-next-line no-console
    console.info(...buildArgs(message, "info", context));
  },
  warn(message, context, error) {
    // eslint-disable-next-line no-console
    console.warn(...buildArgs(message, "warn", context, error));
  },
  error(message, context, error) {
    // eslint-disable-next-line no-console
    console.error(...buildArgs(message, "error", context, error));
  },
};
