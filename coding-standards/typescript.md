# TypeScript Coding Standard

This is the language-specific standard for this project, referenced by `protocol.config.yaml` (`language: typescript`) and `ECHO.md`. Language overrides take precedence over `protocol.config.yaml` per the Quality Override Precedence rule.

## File & Symbol Naming

| Element | Convention | Example |
| --- | --- | --- |
| Module files | `kebab-case` | `agent-registry.ts` |
| Exported classes / interfaces / types / enums | `PascalCase` | `AgentRegistry`, `FidRecord` |
| Functions and variables | `camelCase` | `resolveArchivePath()` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_OPEN_FIDS` |

## Law 6: Type Safety Shortcuts (Forbidden)

| Forbidden pattern | Use instead |
| --- | --- |
| `any` | The actual domain type. If the type is genuinely open, define a narrowed union or a generic. |
| `@ts-ignore` | Fix the type error. `@ts-ignore` hides the failure rather than resolving it. |
| `unknown` as a parameter, return, or variable type — outside a `v is T` guard | The actual domain type. `unknown` is only acceptable as the input to a user-defined type guard. |
| Input at a trust boundary (external, API, serialized, untrusted) | A user-defined type guard `v is T` that performs runtime validation. Never a cast (`as T`) — a cast asserts without checking. |

Type guard pattern at a trust boundary:

```ts
export function isFidRecord(v: unknown): v is FidRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'status' in v &&
    typeof (v as Record<string, unknown>).id === 'string' &&
    isFidStatus((v as Record<string, unknown>).status)
  );
}
```

## Error Handling (Law 14)

- Every error path is handled: propagate it or handle it explicitly. No swallowed errors.
- Never catch an exception to discard it. If recovery is not possible, re-throw or convert to a typed failure.
- Async functions declare their return type as `Promise<T>`, never a bare `Promise`.
- Fail fast on invariant violations; do not silently coerce invalid state into a default.

## Utility-First (Law 13)

- Search for an existing helper before creating a new one. One function, one truth.
- Duplicate logic is a defect: if two functions do the same thing, one of them is wrong.
- Prefer a pure, exported utility in the appropriate module over a local reimplementation.

## Quality Overrides

Language overrides take precedence over `protocol.config.yaml`.

| Metric | Ceiling |
| --- | --- |
| `max_file_lines` | 300 |
| `max_function_lines` | 50 |
| `max_line_length` | 100 |
| `max_complexity` | 10 |
| `max_params` | 4 |
| `max_comment_density` | 0.33 |
| `max_nesting_depth` | 3 |

Exceeding a ceiling is a defect, not a style preference.