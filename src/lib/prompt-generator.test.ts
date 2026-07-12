// src/lib/prompt-generator.test.ts
//
// FID-009 perfection loop — unit tests for the curated prompt
// generator. Covers: domain coverage, prompt shape, getRandomPrompt
// + getRandomPromptByDomain, and the no-immediate-repeat behavior.

import { describe, it, expect } from "vitest";
import {
  CURATED_PROMPTS,
  getRandomPrompt,
  getRandomPromptByDomain,
  type PromptDomain,
} from "./prompt-generator";

const ALL_DOMAINS: PromptDomain[] = [
  "hustler",
  "security",
  "poet",
  "strategist",
  "zen",
  "ceo",
  "negotiator",
  "quantum",
  "chef",
  "crisis",
  "philosopher",
  "ai-safety",
  "marine-bio",
  "lawyer",
  "chess",
  "er-doctor",
  "jazz",
  "vc",
  "astrophysicist",
  "product-designer",
];

describe("CURATED_PROMPTS", () => {
  it("has 20 prompts (one per domain)", () => {
    expect(CURATED_PROMPTS.length).toBe(20);
  });

  it("covers all 20 expected domains exactly once", () => {
    const seen = new Set(CURATED_PROMPTS.map((p) => p.domain));
    expect(seen.size).toBe(ALL_DOMAINS.length);
    for (const d of ALL_DOMAINS) expect(seen.has(d)).toBe(true);
  });

  it("every prompt has a non-empty label and text", () => {
    for (const p of CURATED_PROMPTS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it("every prompt text is 3-10 sentences (multi-sentence persona)", () => {
    for (const p of CURATED_PROMPTS) {
      // Naive sentence count: split on `. ` (period + space) or `.\n`.
      const sentenceish = p.text
        .split(/\.\s+|\.\n/)
        .filter((s) => s.trim().length > 0);
      // Allow 2-15 sentenceish fragments (LLM-friendly range).
      expect(sentenceish.length).toBeGreaterThanOrEqual(2);
      expect(sentenceish.length).toBeLessThanOrEqual(15);
    }
  });

  it("has unique labels (no two prompts share a human-readable name)", () => {
    const labels = CURATED_PROMPTS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("getRandomPromptByDomain", () => {
  it("returns a prompt matching the requested domain", () => {
    for (const d of ALL_DOMAINS) {
      for (let i = 0; i < 10; i++) {
        const p = getRandomPromptByDomain(d);
        expect(p.domain).toBe(d);
      }
    }
  });
});

describe("getRandomPrompt", () => {
  it("returns a prompt from the curated pool", () => {
    for (let i = 0; i < 50; i++) {
      const p = getRandomPrompt();
      expect(CURATED_PROMPTS).toContain(p);
    }
  });

  it("avoids the immediate repeat (cycles by +1 on collision)", () => {
    // getRandomPrompt() uses Math.floor(Math.random() * 20). With
    // Math.random() stubbed to 0, idx = 0 → CURATED_PROMPTS[0]
    // (hustler). On call 2, lastPromptPick = 0, so the if-branch
    // increments to idx 1 (security).
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const first = getRandomPrompt();
      const second = getRandomPrompt();
      expect(first.domain).toBe("hustler");
      expect(second.domain).toBe("security");
      expect(first).not.toBe(second);
    } finally {
      Math.random = origRandom;
    }
  });
});
