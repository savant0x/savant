// Persona source-of-truth (FID-006 v2).
//
// Mirrors savant-orig's AgentIdentity.soul: String populated from
//   - crates/core/src/fs/registry.rs:192     (disk loader:
//     `fs::read_to_string(workspace_path_resolved.join("SOUL.md"))`)
//   - crates/core/src/fs/registry.rs:320-326 (default-write when missing)
//
// Build-time `?raw` import keeps this static-export-safe under
// next.config.mjs:4 `output: "export"` (Next.js API routes blocked).
// Both chat and manifest consume from this module (ECHO Law 13).
// The `?raw` module shape is declared globally in src/types/raw.d.ts.
import SOUL_RAW from "../../workspace-savant/SOUL.md?raw";

export const SOUL_PROMPT: string = SOUL_RAW.trim();

/**
 * Deterministic hash of the initial persona for drift comparison.
 *
 * v1: simple non-cryptographic (djb2-style) — v2 swaps to blake3 per
 * savant-orig `registry.rs:205` (Node/browser lack blake3 without a
 * WASM polyfill; structural semantics match for v1).
 */
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export const SOUL_BASELINE_HASH: string = simpleHash(SOUL_PROMPT);

// OCEAN (Big Five) personality trait defaults. Mirrors savant-orig's
// `impl Default for PersonalityTraits` at crates/core/src/types/mod.rs
// (openness=0.5, conscientiousness=0.5, etc.). Surfaced on
// /manifest Card 2 (Evolution State).
export const OCEAN_DEFAULT_TRAITS = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  neuroticism: 0.5,
} as const;

export interface SoulExample {
  user_message: string;
  assistant_message: string;
}

const USER_PREFIX_LEN = "User:".length; // 5
const ASSISTANT_PREFIX_LEN = "Assistant:".length; // 10

/**
 * Mirrors `crates/agent/src/soul_examples.rs:31` (parse_soul_examples):
 *   1. find("## Example Exchanges") — section start
 *   2. find("\n## ") — section end
 *   3. split("### Example") — per-example blocks
 *   4. find("User:") + find("Assistant:") — per-message
 *
 * Returns [] if no `## Example Exchanges` section exists (no error).
 */
export function parse_soul_examples(soul: string): SoulExample[] {
  const sectionStart = soul.indexOf("## Example Exchanges");
  if (sectionStart === -1) return [];
  const section = soul.slice(sectionStart);
  const sectionEndRest = section.indexOf("\n## ", 20);
  const sectionEnd = sectionEndRest === -1 ? section.length : sectionEndRest;
  const sectionBounded = section.slice(0, sectionEnd);
  const parts = sectionBounded.split("### Example");
  const examples: SoulExample[] = [];
  for (let i = 1; i < parts.length; i++) {
    const ex = parse_single_example(parts[i]);
    if (ex) examples.push(ex);
  }
  return examples;
}

function parse_single_example(block: string): SoulExample | null {
  const trimmed = block.trim();
  const userStart = trimmed.indexOf("User:");
  if (userStart === -1) return null;
  const userText = trimmed.slice(userStart + USER_PREFIX_LEN);
  const assistantStartRel = userText.indexOf("Assistant:");
  if (assistantStartRel === -1) return null;
  const userMessage = userText.slice(0, assistantStartRel).trim();
  const assistantText = userText.slice(
    assistantStartRel + ASSISTANT_PREFIX_LEN,
  );
  const assistantEndRel = assistantText.indexOf("### Example");
  const assistantMessage = assistantText
    .slice(0, assistantEndRel === -1 ? assistantText.length : assistantEndRel)
    .trim();
  if (userMessage === "" && assistantMessage === "") return null;
  return { user_message: userMessage, assistant_message: assistantMessage };
}

export const SOUL_EXAMPLES: SoulExample[] = parse_soul_examples(SOUL_PROMPT);
