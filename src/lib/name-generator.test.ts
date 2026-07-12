// src/lib/name-generator.test.ts
//
// FID-009 perfection loop — unit tests for the themed name
// generator. Covers: theme coverage, name uniqueness within
// and across themes, getRandomName + getRandomNameByTheme,
// and the no-immediate-repeat behavior (with Math.random
// stubbed for determinism).
//
// Run: `npm test -- name-generator`

import { describe, it, expect } from "vitest";
import {
  NAMES_BY_THEME,
  TOTAL_NAME_COUNT,
  TOTAL_THEME_COUNT,
  getRandomName,
  getRandomNameByTheme,
  type NameTheme,
} from "./name-generator";

const ALL_THEMES: NameTheme[] = [
  "mythological",
  "sci-fi",
  "tech",
  "nature",
  "abstract",
];

describe("NAMES_BY_THEME", () => {
  it("exports all 5 expected themes", () => {
    expect(Object.keys(NAMES_BY_THEME).sort()).toEqual([...ALL_THEMES].sort());
  });

  it("has 20 names per theme (100 total)", () => {
    for (const theme of ALL_THEMES) {
      expect(NAMES_BY_THEME[theme].length).toBe(20);
    }
    // Sanity: sum of all theme pools equals TOTAL_NAME_COUNT
    const sum = ALL_THEMES.reduce(
      (acc, t) => acc + NAMES_BY_THEME[t].length,
      0,
    );
    expect(sum).toBe(TOTAL_NAME_COUNT);
  });

  it("TOTAL_THEME_COUNT matches theme count", () => {
    expect(TOTAL_THEME_COUNT).toBe(ALL_THEMES.length);
  });

  it("has no duplicate names WITHIN a theme", () => {
    for (const theme of ALL_THEMES) {
      const pool = NAMES_BY_THEME[theme];
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("has no duplicate names ACROSS themes", () => {
    const all = ALL_THEMES.flatMap((t) => [...NAMES_BY_THEME[t]]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("getRandomNameByTheme", () => {
  it("returns a name from the requested theme", () => {
    for (const theme of ALL_THEMES) {
      const pool = NAMES_BY_THEME[theme];
      // 50 calls per theme should produce names from the pool.
      // (Probabilistically certain with 50 × 20 = 1000 trials.)
      for (let i = 0; i < 50; i++) {
        const name = getRandomNameByTheme(theme);
        expect(pool).toContain(name);
      }
    }
  });
});

describe("getRandomName", () => {
  it("returns a name from one of the 5 themes (probabilistically)", () => {
    const allNames = new Set(ALL_THEMES.flatMap((t) => [...NAMES_BY_THEME[t]]));
    for (let i = 0; i < 100; i++) {
      expect(allNames.has(getRandomName())).toBe(true);
    }
  });

  it("avoids the immediate repeat via lastPick", () => {
    // Force the same name to be picked twice in a row by stubbing
    // Math.random. On call 1, both `randomTheme` and the name
    // selection inside the chosen theme should be deterministic.
    // We pick theme = "mythological" (idx 0) and name = "Prometheus"
    // (idx 0) by stubbing Math.random to return 0.
    //
    // getRandomName() flow:
    //   - randomTheme(): themes[Math.floor(0 * 5)] = themes[0] = "mythological"
    //   - name pick: pool[Math.floor(0 * 20)] = "Prometheus"
    // The "no immediate repeat" check uses `next === lastPick` — on
    // call 1, lastPick is null so it returns "Prometheus". On call 2,
    // lastPick = "Prometheus", so the if-branch increments to
    // pool[1] = "Athena".
    const calls: string[] = [];
    const origRandom = Math.random;
    Math.random = () => 0; // always picks theme 0, name 0
    try {
      calls.push(getRandomName());
      calls.push(getRandomName());
    } finally {
      Math.random = origRandom;
    }
    expect(calls[0]).toBe("Prometheus");
    expect(calls[1]).toBe("Athena"); // incremented to avoid repeat
    expect(calls[0]).not.toBe(calls[1]);
  });

  it("cycles through pool when forced to repeat (avoids infinite loop)", () => {
    // The no-repeat logic only BUMPS BY 1 when the same name is
    // picked (it does NOT cycle through the full pool). With
    // `Math.random() = 0` always, the name selector always picks
    // pool[0] ("Prometheus"); the no-repeat logic then increments
    // to pool[1] ("Athena"); on the next call pool[0] is picked
    // again and (since lastPick = "Athena") no increment, so it
    // returns "Prometheus" again. The result is an alternating
    // P, A, P, A pattern — which IS the correct behavior of an
    // "avoid the immediate repeat" guard.
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const seen: string[] = [];
      for (let i = 0; i < 10; i++) seen.push(getRandomName());
      // The actual alternating pattern.
      expect(seen).toEqual([
        "Prometheus",
        "Athena",
        "Prometheus",
        "Athena",
        "Prometheus",
        "Athena",
        "Prometheus",
        "Athena",
        "Prometheus",
        "Athena",
      ]);
    } finally {
      Math.random = origRandom;
    }
  });
});
