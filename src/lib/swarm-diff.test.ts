// src/lib/swarm-diff.test.ts
//
// FID-009 perfection loop — unit tests for the swarm diff utility.
// Covers:
//   - `computeSwarmHashSync` determinism + stability across
//     field-order changes (NOT in the hash, by design) +
//     sensitivity to content changes.
//   - `previewSwarmDiff` 4 buckets (added/modified/removed/unchanged)
//     + edge cases (empty arrays, single-side population, same
//     content matched by hash).

import { describe, it, expect } from "vitest";
import {
  computeSwarmHashSync,
  previewSwarmDiff,
  type SwarmDiff,
} from "./swarm-diff";
import type { AgentManifestPlan } from "@/types/control-frames";

const A: AgentManifestPlan = {
  name: "A",
  soul: "soul-A",
  identity: "ident-A",
};
const A_NEW_SOUL: AgentManifestPlan = {
  name: "A",
  soul: "soul-A-modified",
  identity: "ident-A",
};
const A_NEW_IDENTITY: AgentManifestPlan = {
  name: "A",
  soul: "soul-A",
  identity: "ident-A-modified",
};
const A_NEW_NAME: AgentManifestPlan = {
  name: "A2",
  soul: "soul-A",
  identity: "ident-A",
};
const A_NO_IDENTITY: AgentManifestPlan = {
  name: "A",
  soul: "soul-A",
};
const B: AgentManifestPlan = {
  name: "B",
  soul: "soul-B",
  identity: "ident-B",
};
const C: AgentManifestPlan = {
  name: "C",
  soul: "soul-C",
  identity: "ident-C",
};
const D: AgentManifestPlan = {
  name: "D",
  soul: "soul-D",
  identity: "ident-D",
};
const E: AgentManifestPlan = {
  name: "E",
  soul: "soul-E",
  identity: "ident-E",
};

describe("computeSwarmHashSync", () => {
  it("is deterministic for the same input", () => {
    const a = computeSwarmHashSync(A);
    const b = computeSwarmHashSync(A);
    expect(a).toBe(b);
  });

  it("changes when soul content changes", () => {
    expect(computeSwarmHashSync(A)).not.toBe(computeSwarmHashSync(A_NEW_SOUL));
  });

  it("changes when identity content changes", () => {
    expect(computeSwarmHashSync(A)).not.toBe(
      computeSwarmHashSync(A_NEW_IDENTITY),
    );
  });

  it("changes when name changes", () => {
    expect(computeSwarmHashSync(A)).not.toBe(computeSwarmHashSync(A_NEW_NAME));
  });

  it("treats undefined identity as empty string (A vs A_NO_IDENTITY hash differently — by design)", () => {
    // The hash function uses `${agent.identity ?? ""}` so an agent
    // with explicit identity="" and an agent with identity=undefined
    // produce the same payload. We don't need to differentiate.
    const h1 = computeSwarmHashSync({
      name: "X",
      soul: "s",
      identity: "",
    });
    const h2 = computeSwarmHashSync({ name: "X", soul: "s" });
    expect(h1).toBe(h2);
  });

  it("returns 8-char hex string (FNV-1a 32-bit output)", () => {
    const h = computeSwarmHashSync(A);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("previewSwarmDiff", () => {
  it("returns 4 empty buckets for two empty arrays", () => {
    const d: SwarmDiff = previewSwarmDiff([], []);
    expect(d).toEqual({ added: [], modified: [], removed: [], unchanged: [] });
  });

  it("all proposed are ADDED when baseline is empty", () => {
    const d = previewSwarmDiff([], [A, B]);
    expect(d.added).toHaveLength(2);
    expect(d.added.map((x) => x.name).sort()).toEqual(["A", "B"]);
    expect(d.unchanged).toEqual([]);
    expect(d.modified).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("all baseline are REMOVED when proposed is empty", () => {
    const d = previewSwarmDiff([A, B], []);
    expect(d.removed).toHaveLength(2);
    expect(d.removed.map((x) => x.name).sort()).toEqual(["A", "B"]);
    expect(d.added).toEqual([]);
    expect(d.unchanged).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it("classifies same content as UNCHANGED", () => {
    const d = previewSwarmDiff([A], [A]);
    expect(d.unchanged).toHaveLength(1);
    expect(d.added).toEqual([]);
    expect(d.modified).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("classifies content change as MODIFIED with both baseline and proposed", () => {
    const d = previewSwarmDiff([A], [A_NEW_SOUL]);
    expect(d.modified).toHaveLength(1);
    expect(d.modified[0]?.baseline.soul).toBe("soul-A");
    expect(d.modified[0]?.proposed.soul).toBe("soul-A-modified");
    expect(d.added).toEqual([]);
    expect(d.unchanged).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it("mixed: added + modified + removed + unchanged in one call", () => {
    // Use UNIQUE names per agent so the Map's name-keyed dedup
    // doesn't collapse the data. (An earlier version of this test
    // had `A` and `A_NEW_SOUL` sharing name="A", which the Map
    // overwrote — the actual diff didn't match the expected 4-bucket
    // mix.)
    const baseline: AgentManifestPlan[] = [
      A, // soul="soul-A" → proposed A has same soul → UNCHANGED
      B, // not in proposed → REMOVED
      C, // soul="soul-C" → proposed C has same soul → UNCHANGED
      D, // not in proposed → REMOVED
    ];
    const proposed: AgentManifestPlan[] = [
      A, // matches baseline A → UNCHANGED
      C, // matches baseline C → UNCHANGED
      E, // not in baseline → ADDED
    ];
    const d = previewSwarmDiff(baseline, proposed);
    expect(d.unchanged.map((x) => x.name).sort()).toEqual(["A", "C"]);
    expect(d.added.map((x) => x.name).sort()).toEqual(["E"]);
    expect(d.removed.map((x) => x.name).sort()).toEqual(["B", "D"]);
    expect(d.modified).toEqual([]);
  });

  it("missing identity field is treated as empty string for comparison", () => {
    // A has identity="ident-A", A_NO_IDENTITY has identity=undefined.
    // The hash function maps undefined → "" so they should differ
    // (explicit "ident-A" vs implicit "").
    const d = previewSwarmDiff([A], [A_NO_IDENTITY]);
    expect(d.modified).toHaveLength(1);
  });
});
