// src/lib/manifest-mock.test.ts
//
// FID-009 perfection loop — unit tests for the manifest mock.
// Covers:
//   - `computeSectionMetrics`: empty, single, canonical 18-section,
//     loose regex variants, placeholders, density rounding.
//   - `calculateSemanticDepth`: 0.5 lock removed (the FID-009 fix),
//     proportional to line/section/density.
//   - `generateTemplateSoul`: shape (has all 18 sections, has
//     core laws table, contains the agent name).
//   - `parseSSEStream`: TCP fragmentation, [DONE] sentinel,
//     malformed chunk tolerance, abort handling.
//
// Run: `npm test -- manifest-mock`

import { describe, it, expect } from "vitest";
import {
  calculateSemanticDepth,
  computeSectionMetrics,
  generateTemplateSoul,
  parseSSEStream,
} from "./manifest-mock";

describe("calculateSemanticDepth", () => {
  it("returns 0 for empty content", () => {
    expect(calculateSemanticDepth("")).toBe(0);
  });

  it("returns a positive score for content with sections + words", () => {
    const content = [
      "## 1. Title",
      "Some words here in this section.",
      "## 2. Another",
      "More words for the second section.",
    ].join("\n");
    const d = calculateSemanticDepth(content);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it("counts only top-level ## headers (not ### sub-sections)", () => {
    // 2 `##` + 4 `###` → 2 top-level sections.
    // If the (broken) old regex matched `###` too, sectionCount
    // would be 6 → sectionBonus = 6/18 = 0.333 → depth > 0.3.
    // With the fix, sectionCount = 2 → sectionBonus = 0.111 → depth
    // is well under 0.2. We assert a range that ONLY the fixed
    // version can satisfy.
    const content = [
      "## 1. Top",
      "### Sub 1.1",
      "words words words words words",
      "### Sub 1.2",
      "words words words words words",
      "## 2. Two",
      "### Sub 2.1",
      "words words words words words",
      "### Sub 2.2",
      "words words words words words",
    ].join("\n");
    const d = calculateSemanticDepth(content);
    expect(d).toBeGreaterThan(0.05); // not 0
    expect(d).toBeLessThan(0.2); // not > 0.2 (which would mean ### was counted)
  });

  it("depth is NOT hardcoded to 0.5 (FID-009 bug fix)", () => {
    // The original bug: `metrics: { ...computeMetrics(content), depth_score: 0.5 }`
    // would always force 0.5. With the fix, depth VARIES with content.
    // The most direct test: compute depth for two very different
    // content shapes and assert they produce DIFFERENT values. If the
    // function were hardcoded to 0.5, both would equal 0.5 and the
    // assertion would fail.
    //
    // Note: a single-shape assertion like "dense > 0.5" is fragile
    // because the natural formula `min(density/30, 1) * 0.5 + sectionBonus * 0.5`
    // can legitimately equal 0.5 for content with high density
    // (capped at 1.0) AND no sections. We test VARIANCE instead of
    // absolute values, which is the actual property we care about.
    const sparse = "## 1. A\nshort."; // 2 lines, ~4 words, 1 section → depth ≈ 0.06
    const dense = Array.from({ length: 10 }, () => "word").join(" "); // 1 line, 10 words, 0 sections → depth ≈ 0.17
    const sparseDepth = calculateSemanticDepth(sparse);
    const denseDepth = calculateSemanticDepth(dense);
    expect(sparseDepth).not.toBe(denseDepth);
    // Sanity: both should be in [0, 1].
    expect(sparseDepth).toBeGreaterThan(0);
    expect(sparseDepth).toBeLessThan(1);
    expect(denseDepth).toBeGreaterThan(0);
    expect(denseDepth).toBeLessThanOrEqual(1);
  });
});

describe("computeSectionMetrics", () => {
  it("returns [] for empty content", () => {
    expect(computeSectionMetrics("")).toEqual([]);
  });

  it("returns 1 section for a single ## header", () => {
    const out = computeSectionMetrics("## 1. Only\n\nbody words here");
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe(1);
    expect(out[0]?.title).toBe("1. Only");
  });

  it("extracts canonical 18 sections (loose regex: ## N. Title)", () => {
    // Body must be >= 10 words per section for completeness=true.
    // Each section body is 12 words here.
    const sections = Array.from(
      { length: 18 },
      (_, i) =>
        `## ${i + 1}. Section ${i + 1}\n\nbody of section ${i + 1} with many words to satisfy completeness`,
    ).join("\n");
    const out = computeSectionMetrics(sections);
    expect(out).toHaveLength(18);
    for (let i = 0; i < 18; i++) {
      expect(out[i]?.id).toBe(i + 1);
      expect(out[i]?.title).toBe(`${i + 1}. Section ${i + 1}`);
      expect(out[i]?.completeness).toBe(true);
    }
  });

  it("loose regex accepts `## 1) Title` and `## 1 Title` formats", () => {
    const a = computeSectionMetrics("## 1) Foo\n\nbar bar bar bar bar");
    const b = computeSectionMetrics("## 1 Foo\n\nbar bar bar bar bar");
    expect(a[0]?.id).toBe(1);
    expect(b[0]?.id).toBe(1);
  });

  it("ignores ### sub-section headers (only counts ## N. ...)", () => {
    const content = [
      "## 1. Top",
      "### Sub 1.1",
      "words words words words",
      "## 2. Two",
      "### Sub 2.1",
      "words words words words",
    ].join("\n");
    const out = computeSectionMetrics(content);
    expect(out).toHaveLength(2);
    expect(out[0]?.title).toBe("1. Top");
    expect(out[1]?.title).toBe("2. Two");
  });

  it("flags placeholder-only sections as incomplete (TBD/TODO/.../n/a)", () => {
    const placeholders = [
      "TBD",
      "...",
      "TODO",
      "(empty)",
      "n/a",
      "  TBD  ",
      "  ...  ",
    ];
    for (const ph of placeholders) {
      const out = computeSectionMetrics(`## 1. Empty\n\n${ph}`);
      expect(out[0]?.completeness).toBe(false);
    }
  });

  it("flags short sections (< 10 words) as incomplete", () => {
    const out = computeSectionMetrics("## 1. Short\n\njust a few words");
    expect(out[0]?.completeness).toBe(false);
    expect(out[0]?.words).toBe(4);
  });

  it("rounds density to 1 decimal place", () => {
    // Body has 7 lines × 5 words = 35 words. The `lines` field
    // includes the header line (`## 1. D` is non-empty), so
    // lines = 8 (1 header + 7 body). density = 35/8 = 4.375 →
    // rounded to 1 decimal = 4.4.
    const body = Array.from(
      { length: 7 },
      () => "word1 word2 word3 word4 word5",
    ).join("\n");
    const out = computeSectionMetrics(`## 1. D\n\n${body}`);
    expect(out[0]?.density).toBe(4.4);
  });
});

describe("generateTemplateSoul", () => {
  it("contains all 18 ## section headers", () => {
    // Some sections are prefixed with an emoji + space before the
    // number (e.g., `## 🔴 7. CORE LAWS`). The regex must allow
    // optional text between `##` and the number.
    const tpl = generateTemplateSoul("test prompt", "TestName", "2026-01-01");
    const matches = tpl.match(/^##\s+.*\d+\./gm) || [];
    expect(matches.length).toBe(18);
  });

  it("interpolates the agent name", () => {
    const tpl = generateTemplateSoul("test prompt", "Savant", "2026-01-01");
    expect(tpl).toContain("**Name**: Savant");
  });

  it("uses 'Unnamed Agent' when name is null", () => {
    const tpl = generateTemplateSoul("test prompt", null, "2026-01-01");
    expect(tpl).toContain("**Name**: Unnamed Agent");
  });

  it("includes the Core Laws table with all 10 laws", () => {
    const tpl = generateTemplateSoul("test prompt", "X", "2026-01-01");
    expect(tpl).toContain("## 🔴 7. CORE LAWS");
    for (let i = 1; i <= 10; i++) {
      expect(tpl).toContain(`| ${i} |`);
    }
  });

  it("interpolates the prompt into the Core Directive", () => {
    const tpl = generateTemplateSoul(
      "Always be brief and act, never explain",
      "X",
      "2026-01-01",
    );
    expect(tpl).toContain(
      "**Core Directive:** Always be brief and act, never explain",
    );
  });
});

describe("parseSSEStream", () => {
  // Helper: build a ReadableStream<Uint8Array> from a string array of
  // chunks. Each chunk is delivered as one `read()` call (no internal
  // fragmentation within a chunk). This lets tests compose
  // arbitrary split patterns.
  function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let i = 0;
    return new ReadableStream({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[i++]!));
      },
    });
  }

  it("parses a single complete event", async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
    ]);
    const ac = new AbortController();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual(["hi"]);
  });

  it("handles TCP fragmentation: split JSON across 2 chunks", async () => {
    // The JSON is split mid-word. The parser MUST buffer until
    // \\n\\n is seen, then yield the full event.
    const stream = makeStream([
      'data: {"choices":[{"delta":{"con',
      'tent":"hello"}}]}\n\n',
    ]);
    const ac = new AbortController();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual(["hello"]);
  });

  it("skips [DONE] sentinel without throwing", async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const ac = new AbortController();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual(["a"]);
  });

  it("yields multiple events from multiple chunks", async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"c"}}]}\n\n',
    ]);
    const ac = new AbortController();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("tolerates malformed JSON chunks (skips and continues)", async () => {
    const stream = makeStream([
      "data: {not json}\n\n",
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ]);
    const ac = new AbortController();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual(["ok"]);
  });

  it("stops yielding when signal is aborted", async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ]);
    const ac = new AbortController();
    ac.abort();
    const out: string[] = [];
    for await (const evt of parseSSEStream(stream, ac.signal)) {
      out.push(evt.choices?.[0]?.delta?.content ?? "");
    }
    expect(out).toEqual([]); // abort before first read
  });
});
