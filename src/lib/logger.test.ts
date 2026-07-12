// src/lib/logger.test.ts
//
// Unit tests for the `redact()` helper in `src/lib/logger.ts`. The
// helper is security-sensitive (it strips secret fields before
// logging) and currently has zero test coverage — these tests lock
// in the behavior and catch regressions.
//
// Per ECHO Law 3 (Verify Before Proceed): every `redact()` change
// must be validated against this suite before merging.

import { describe, it, expect } from "vitest";
import { redact } from "./logger";

describe("redact() — secret key redaction", () => {
  it('replaces values for keys matching the secret patterns with "[REDACTED]"', () => {
    expect(
      redact({
        secret: "s",
        password: "p",
        token: "t",
        api_key: "ak",
        apiKey: "akCamel",
        master_key: "mk",
        session_key: "sk",
        sub_key: "subk",
        bearer: "b",
        authorization: "a",
        hash: "h",
        anyKey: "k", // matches /key$/i
      }),
    ).toEqual({
      secret: "[REDACTED]",
      password: "[REDACTED]",
      token: "[REDACTED]",
      api_key: "[REDACTED]",
      apiKey: "[REDACTED]",
      master_key: "[REDACTED]",
      session_key: "[REDACTED]",
      sub_key: "[REDACTED]",
      bearer: "[REDACTED]",
      authorization: "[REDACTED]",
      hash: "[REDACTED]",
      anyKey: "[REDACTED]",
    });
  });

  it("matches secret keys case-insensitively", () => {
    expect(
      redact({
        SECRET: "s",
        Password: "p",
        TOKEN: "t",
        API_KEY: "ak",
      }),
    ).toEqual({
      SECRET: "[REDACTED]",
      Password: "[REDACTED]",
      TOKEN: "[REDACTED]",
      API_KEY: "[REDACTED]",
    });
  });

  it("does NOT redact compound words containing 'secret' (e.g., secretSanta, secretary, mySecret)", () => {
    // The tightened /secret pattern is anchored to
    // `(^|[_-])secret([_-]|$)` — only standalone "secret" segments
    // (delimited by string bounds or [_-]) are redacted. Compound
    // words where "secret" is part of a larger word pass through.
    expect(
      redact({
        secretSanta: "value",
        secretary: "value",
        mySecret: "value", // preceded by "y", not [_-]
        secrets: "value", // followed by "s", not [_-] or end
        my_secret_data: "value", // followed by "_", preceded by "_" → IS redacted
        secret_key: "value", // preceded by start, followed by "_" → IS redacted
      }),
    ).toEqual({
      secretSanta: "value",
      secretary: "value",
      mySecret: "value",
      secrets: "value",
      my_secret_data: "[REDACTED]",
      secret_key: "[REDACTED]",
    });
  });

  it("does NOT redact compound words with api_key at non-end positions (e.g., api_key_thing, apikeything)", () => {
    // The tightened /api[_]?key$/i pattern has a $ anchor — only
    // api_key or apikey as a standalone segment at the END of the
    // key is redacted. Compound words where api_key is NOT at the
    // end pass through.
    //
    // NOTE: "myApiKey" / "myapikey" DO end in "key" and ARE redacted
    // by the bare /key$/i pattern (any word ending in "key" is
    // redacted per ECHO Law 12 — err on the side of redacting).
    expect(
      redact({
        api_key_thing: "value", // ends in "thing" → passes through
        apikeything: "value", // ends in "thing" → passes through
        apiKeySuffix: "value", // ends in "Suffix" → passes through
      }),
    ).toEqual({
      api_key_thing: "value",
      apikeything: "value",
      apiKeySuffix: "value",
    });
  });

  it("does NOT redact compound words with master_key/session_key/sub_key at non-end positions", () => {
    // Same $ anchor applied to the other _key family.
    expect(
      redact({
        master_key_backup: "value", // ends in "backup" → passes through
        sessionkeything: "value", // ends in "thing" → passes through
        subkeybackup: "value", // ends in "backup" → passes through
      }),
    ).toEqual({
      master_key_backup: "value",
      sessionkeything: "value",
      subkeybackup: "value",
    });
  });

  it("DOES redact compound words ENDING in key (e.g., myapikey, mymasterkey)", () => {
    // The bare /key$/i pattern redacts ANY word ending in "key"
    // (errs on the side of redacting per ECHO Law 12). This
    // includes compound words like "myapikey" or "mymasterkey"
    // even though the api_key/master_key sub-patterns don't match
    // them (they require "api"/"master" as a separate segment).
    expect(
      redact({
        myapikey: "value", // ends in "key" → redacted
        mymasterkey: "value", // ends in "key" → redacted
        mysessionkey: "value", // ends in "key" → redacted
        mysubkey: "value", // ends in "key" → redacted
      }),
    ).toEqual({
      myapikey: "[REDACTED]",
      mymasterkey: "[REDACTED]",
      mysessionkey: "[REDACTED]",
      mysubkey: "[REDACTED]",
    });
  });

  it("DOES redact masterkey/sessionkey/subkey (no underscore) — the [_]? handles both", () => {
    // The [_]? in each pattern makes the underscore optional, so
    // both "master_key" and "masterkey" are redacted.
    expect(
      redact({
        masterkey: "value",
        sessionkey: "value",
        subkey: "value",
        apikey: "value",
      }),
    ).toEqual({
      masterkey: "[REDACTED]",
      sessionkey: "[REDACTED]",
      subkey: "[REDACTED]",
      apikey: "[REDACTED]",
    });
  });

  it("does not mutate the original object", () => {
    const original = { key: "secret", public: "value" };
    const copy = { ...original };
    redact(original);
    expect(original).toEqual(copy);
  });
});

describe("redact() — non-secret values pass through", () => {
  it("passes through non-secret primitive values", () => {
    expect(
      redact({
        name: "Savant",
        count: 42,
        active: true,
        nullable: null,
        missing: undefined,
        ratio: 0.75,
      }),
    ).toEqual({
      name: "Savant",
      count: 42,
      active: true,
      nullable: null,
      missing: undefined,
      ratio: 0.75,
    });
  });

  it("does NOT redact keys that contain 'key' but do NOT end in 'key'", () => {
    // Words that contain 'key' as a substring but do NOT end in
    // 'key' (last char is not 'y' after 'ke'):
    //   - "keychain" ends in "n" → passes through
    //   - "keyboard" ends in "d" → passes through
    //   - "keynote"  ends in "e" → passes through
    //   - "keystone" ends in "e" → passes through
    //
    // Note: "monkey", "donkey", "hockey" DO end in "key" (last
    // 3 chars: k-e-y) and are INTENTIONALLY redacted by /key$/i.
    // This is the correct ECHO Law 12 behavior — we err on the
    // side of redacting any word that ends in "key" (the false
    // positive rate is acceptable; the false negative rate is not).
    expect(
      redact({
        keychain: "value",
        keyboard: "value",
        keynote: "value",
        keystone: "value",
      }),
    ).toEqual({
      keychain: "value",
      keyboard: "value",
      keynote: "value",
      keystone: "value",
    });
  });
});

describe("redact() — nested objects", () => {
  it("recurses into nested plain objects", () => {
    expect(
      redact({
        outer: { inner: { secret: "s", public: "v" } },
      }),
    ).toEqual({
      outer: { inner: { secret: "[REDACTED]", public: "v" } },
    });
  });

  it("preserves the nested structure (doesn't flatten)", () => {
    const result = redact({ a: { b: { c: { d: "leaf" } } } });
    expect(result).toEqual({ a: { b: { c: { d: "leaf" } } } });
  });
});

describe("redact() — arrays", () => {
  it("recurses into arrays of plain objects", () => {
    expect(
      redact({
        items: [
          { name: "a", token: "secret1" },
          { name: "b", token: "secret2" },
        ],
      }),
    ).toEqual({
      items: [
        { name: "a", token: "[REDACTED]" },
        { name: "b", token: "[REDACTED]" },
      ],
    });
  });

  it("recurses into nested arrays (arrays of arrays)", () => {
    expect(
      redact({
        matrix: [
          [{ secret: "s1" }, { public: "v1" }],
          [{ secret: "s2" }, { public: "v2" }],
        ],
      }),
    ).toEqual({
      matrix: [
        [{ secret: "[REDACTED]" }, { public: "v1" }],
        [{ secret: "[REDACTED]" }, { public: "v2" }],
      ],
    });
  });

  it("passes through arrays of primitives unchanged", () => {
    expect(
      redact({
        tags: ["alpha", "beta", "gamma"],
        nums: [1, 2, 3],
      }),
    ).toEqual({
      tags: ["alpha", "beta", "gamma"],
      nums: [1, 2, 3],
    });
  });

  it("redacts plural forms of _key family (api_keys, master_keys, etc.)", () => {
    // The `s?` at the end of each `*_key` pattern makes the plural
    // form also match. This matches the real-world convention where
    // collections use the plural name (e.g., `api_keys` for a list
    // of API keys). Without the `s?`, `api_keys` would not match
    // `/api[_]?key$/i` because it ends in "keys", not "key".
    expect(
      redact({
        api_keys: ["k1", "k2"],
        master_keys: ["m1"],
        session_keys: ["s1"],
        sub_keys: ["sub1"],
      }),
    ).toEqual({
      api_keys: "[REDACTED]",
      master_keys: "[REDACTED]",
      session_keys: "[REDACTED]",
      sub_keys: "[REDACTED]",
    });
  });
});

describe("redact() — non-plain objects pass through", () => {
  it("passes Date objects through unchanged (no silent collapse to {})", () => {
    const d = new Date("2026-07-13T00:00:00Z");
    const result = redact({ created: d });
    expect(result.created).toBe(d);
  });

  it("passes RegExp objects through unchanged", () => {
    const re = /savant/g;
    const result = redact({ pattern: re });
    expect(result.pattern).toBe(re);
  });

  it("passes Map and Set through unchanged", () => {
    const m = new Map<string, number>([["a", 1]]);
    const s = new Set([1, 2, 3]);
    const result = redact({ m, s });
    expect(result.m).toBe(m);
    expect(result.s).toBe(s);
  });

  it("handles Object.create(null) correctly (no prototype, no constructor)", () => {
    // The Object.getPrototypeOf check correctly identifies null-prototype
    // objects as plain objects (they should be recursed into, not
    // collapsed to {}). The previous v.constructor check would have
    // failed here because v.constructor is undefined for null-prototype
    // objects — the check `undefined !== Object` is true, so the
    // value would have passed through unredacted.
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto["name"] = "alice";
    nullProto["password"] = "p";
    const result = redact(nullProto);
    expect(result).toEqual({ name: "alice", password: "[REDACTED]" });
  });
});

describe("redact() — edge cases", () => {
  it("returns an empty object for an empty input", () => {
    expect(redact({})).toEqual({});
  });

  it("handles deeply nested mixed structures", () => {
    // Uses non-secret keys for the outer nesting levels so the
    // deep recursion is visible. The `profile` key (not secret)
    // wraps a `password` key (secret) to demonstrate the
    // per-field redaction at depth. The `credentials` key WOULD
    // trigger the "key-secret trumps value-shape" precedence
    // (see the test below) — avoid it here.
    expect(
      redact({
        request: {
          method: "POST",
          headers: {
            authorization: "Bearer xyz",
            "content-type": "application/json",
          },
          body: {
            user: {
              name: "alice",
              profile: { password: "p", displayName: "Alice" },
            },
            items: [{ secret: "s1" }, { secret: "s2" }],
          },
        },
      }),
    ).toEqual({
      request: {
        method: "POST",
        headers: {
          authorization: "[REDACTED]",
          "content-type": "application/json",
        },
        body: {
          user: {
            name: "alice",
            profile: { password: "[REDACTED]", displayName: "Alice" },
          },
          items: [{ secret: "[REDACTED]" }, { secret: "[REDACTED]" }],
        },
      },
    });
  });

  it("redacts the ENTIRE VALUE when the key is secret (key-secret trumps value-shape)", () => {
    // When the KEY matches a secret pattern, the entire value is
    // replaced with "[REDACTED]" — even if the value is a nested
    // object or array. This is intentional per ECHO Law 12: if
    // the key is secret, we don't reveal anything about the
    // value's structure or content (a partially-redacted object
    // could leak metadata: key names, value counts, etc.).
    expect(
      redact({
        credentials: { password: "p", token: "t" },
      }),
    ).toEqual({ credentials: "[REDACTED]" });
    expect(
      redact({
        token: ["k1", "k2", "k3"],
      }),
    ).toEqual({ token: "[REDACTED]" });
  });
});
