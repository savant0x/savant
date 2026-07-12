// vitest.setup.ts
//
// Global test setup for the renderer. Polyfills two browser APIs that
// happy-dom either provides incompletely or omits entirely:
//
// 1. `crypto.subtle` (FID-009 perfection loop) — happy-dom's native
//    SubtleCrypto is incomplete. Polyfilled from Node's `webcrypto`.
//    Required by:
//      - `src/lib/manifest-mock.ts` `calculateSoulHash` (SHA-256)
//      - `src/lib/swarm-diff.ts` `computeSwarmHash` (SHA-256)
//
// 2. `localStorage` (FID-015) — happy-dom's `localStorage` may be
//    either `undefined` OR a partial object missing the `getItem`
//    method (depending on the configuration). Polyfilled with a
//    Map-backed shim matching the `getItem` / `setItem` /
//    `removeItem` / `clear` / `key` / `length` API surface that
//    `src/lib/mock-ipc.ts` uses. Required by:
//      - `src/lib/ipc.test.ts` (5 pre-existing cases for the
//        `provisionSessionKey` parser + `clearSessionKey` hash
//        regression) — fails with
//        `TypeError: window.localStorage.getItem is not a function`
//        at `src/lib/mock-ipc.ts:129:35` (inside `hydrateMasters`)
//        without this polyfill.
//
// Both polyfills are idempotent — only install if missing or broken.
// The `setupFiles` config in `vitest.config.ts` runs this file
// BEFORE any test imports, so the polyfills are guaranteed to be
// present when `mock-ipc.ts`'s `setupMockIPC()` (which calls
// `hydrateMasters` on every IPC install) accesses
// `window.localStorage`.
//
// The localStorage polyfill is installed via `Object.defineProperty`
// (not direct assignment) to bypass any non-writable property
// protection that happy-dom may apply to the `localStorage` slot.
// It also sets the shim on BOTH `globalThis` and `window` (when
// they differ) so it's visible via `window.localStorage.getItem(...)`
// in `mock-ipc.ts` regardless of which object happy-dom's accessor
// path resolves to.
//
// If a future test needs the `storage` event (cross-tab sync), the
// `node-localstorage` package can be added as a devDependency — but
// for Phase 1, the Map-backed shim is sufficient (mock-ipc.ts only
// uses `getItem`, `setItem`, `removeItem`, and `length`). See
// `dev/fids/archive/FID-2026-07-13-015-happy-dom-localstorage.md`
// for the decision record.

import { webcrypto } from "node:crypto";
import { beforeEach } from "vitest";

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  // @ts-expect-error — Node's webcrypto is a superset of the
  // browser Crypto interface; the missing methods are browser-only
  // (e.g., getRandomValues with quota) which we don't need in tests.
  globalThis.crypto = webcrypto;
}

// Minimal Map-backed localStorage polyfill for happy-dom test runs.
// FID-015. The shim satisfies the `Storage` interface per
// `lib.dom.d.ts` (getItem / setItem / removeItem / clear / key /
// length). `getItem` returns `string | null`; `key` returns
// `string | null`; `length` is a getter (matches the interface).
//
// The guard checks `typeof getItem !== "function"` (not just
// `!globalThis.localStorage`) because happy-dom in some
// configurations provides a localStorage OBJECT that is missing
// methods — a naive `!localStorage` check would skip the polyfill
// in that case, and the broken object would cause the same
// `TypeError: ... is not a function` at runtime.
if (typeof globalThis.localStorage?.getItem !== "function") {
  const store = new Map<string, string>();
  const shim: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  // Use `Object.defineProperty` to bypass any non-writable property
  // protection on the `localStorage` slot. Direct assignment
  // (`globalThis.localStorage = shim`) would throw a TypeError in
  // strict mode if the property is non-writable.
  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    writable: true,
    configurable: true,
  });
  // In happy-dom, `window === globalThis` by default — but if they
  // differ in some configs, set the shim on `window` too so it's
  // visible via `window.localStorage.getItem(...)` in `mock-ipc.ts`.
  if (typeof window !== "undefined" && window !== globalThis) {
    Object.defineProperty(window, "localStorage", {
      value: shim,
      writable: true,
      configurable: true,
    });
  }
}

// State isolation between tests (FID-015 code-reviewer recommendation):
// the Map-backed shim is module-scoped and persists across all 73
// tests in a single vitest run. Without this `beforeEach`, a value
// set in test A (e.g., `localStorage.setItem("foo", "bar")`) would
// leak into test B if test B transitively imports `mock-ipc.ts`
// (which calls `hydrateMasters` → `localStorage.getItem(...)` on
// import). The 5 pre-existing `ipc.test.ts` cases don't read
// localStorage themselves, but future tests (e.g., FID-013 swarm
// baseline persistence, FID-007 master key persistence) will.
beforeEach(() => {
  globalThis.localStorage?.clear();
});
