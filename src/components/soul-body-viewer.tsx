// src/components/soul-body-viewer.tsx
//
// FID-009 — Custom markdown renderer for the SOUL.md body. Replaces
// the previous plain `<pre>` block (which Spencer called "terrible")
// with a properly-styled, parsed-and-rendered view of the soul
// body. Lightweight (no `react-markdown` 50KB+ dependency), handles
// the specific markdown constructs used in the 18-section template:
//   - `## N. Title` → <h2> with emoji
//   - `### Subtitle` → <h3>
//   - `**bold**` → <strong>
//   - `- item` / `* item` → <li> in <ul>
//   - `1. item` → <li> in <ol>
//   - `| col | col |` → <table> (with <thead>/<tbody>)
//   - `> quote` → <blockquote>
//   - `---` → <hr>
//   - Paragraphs (blank-line separated)
//
// The renderer splits the content into blocks (by blank lines),
// then renders each block by type. Inline formatting (`**bold**`,
// `` `code` ``) is applied within text blocks via regex.

import { useMemo } from "react";

type ListItem = { text: string; depth: number };

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: ListItem[] }
  | { kind: "ol"; items: ListItem[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "blockquote"; text: string }
  | { kind: "hr" }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string };

/**
 * Apply inline formatting: `**bold**` and `` `code` ``. Pure regex,
 * no deps. FID-009 perfection loop behavior:
 *  - UNCLOSED `**...` is left as plain text (matches GitHub/CommonMark).
 *    Auto-closing would create runaway bold across paragraphs.
 *  - UNCLOSED `` `... `` is left as plain text (matches GitHub).
 *  - Nested `**` (e.g., `**a**b**c**`) matches greedily but cleanly.
 *  - `***bold-italic***` is NOT supported (would require a 2-pass
 *    parser; out of scope for the 18-section template).
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and `code` while preserving the delimiters.
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const segment = match[0];
    if (segment.startsWith("**") && segment.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {segment.slice(2, -2)}
        </strong>,
      );
    } else if (segment.startsWith("`") && segment.endsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-surface/60 px-1 py-0.5 font-mono text-[10px] text-accent"
        >
          {segment.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + segment.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/** Parse a table block (header row + separator row + N data rows). */
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const splitRow = (row: string): string[] =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const headers = splitRow(lines[0]!);
  // Skip the separator row (lines[1]) and parse data rows.
  const rows = lines.slice(2).map(splitRow);
  return { headers, rows };
}

/** Split content into typed blocks. */
function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  // Normalize line endings + trim trailing whitespace.
  const normalized = content.replace(/\r\n/g, "\n").trim();
  // Split into raw blocks (separated by blank lines).
  const rawBlocks = normalized.split(/\n\s*\n/);

  for (const raw of rawBlocks) {
    const lines = raw.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    const first = lines[0]!;
    // H2: `## N. Title`
    if (/^##\s+/.test(first) && !/^###\s+/.test(first)) {
      blocks.push({ kind: "h2", text: first.replace(/^##\s+/, "") });
      continue;
    }
    // H3: `### Subtitle`
    if (/^###\s+/.test(first)) {
      blocks.push({ kind: "h3", text: first.replace(/^###\s+/, "") });
      continue;
    }
    // HR: `---` (3+ dashes on its own line)
    if (lines.every((l) => /^---+$/.test(l.trim()))) {
      blocks.push({ kind: "hr" });
      continue;
    }
    // Blockquote: every line starts with `>`
    if (lines.every((l) => /^>\s?/.test(l))) {
      const text = lines.map((l) => l.replace(/^>\s?/, "")).join(" ");
      blocks.push({ kind: "blockquote", text });
      continue;
    }
    // Table: header row + separator row + data rows
    if (
      lines.length >= 2 &&
      /^\|/.test(lines[0]!) &&
      /^\|[\s\-:|]+\|$/.test(lines[1]!)
    ) {
      blocks.push({ kind: "table", ...parseTable(lines) });
      continue;
    }
    // Unordered list: every line starts with optional indent + `-`/`*`
    // (FID-009 perfection loop: support nested lists via 2-space indent).
    // The depth is computed as floor(leading_spaces / 2), so 0/2/4 spaces
    // → depth 0/1/2. Lines that DON'T start with `[-*]\s+` after their
    // indent fall through to paragraph (e.g., a paragraph that
    // accidentally follows a list bullet).
    const ulMatch = lines.every((l) => /^(\s*)[-*]\s+/.test(l));
    if (ulMatch) {
      const items: ListItem[] = lines.map((l) => {
        const m = l.match(/^(\s*)[-*]\s+(.*)$/)!;
        return {
          text: m[2]!,
          depth: Math.floor(m[1]!.length / 2),
        };
      });
      blocks.push({ kind: "ul", items });
      continue;
    }
    // Ordered list: every line starts with optional indent + `<digit>.`
    const olMatch = lines.every((l) => /^(\s*)\d+\.\s+/.test(l));
    if (olMatch) {
      const items: ListItem[] = lines.map((l) => {
        const m = l.match(/^(\s*)\d+\.\s+(.*)$/)!;
        return {
          text: m[2]!,
          depth: Math.floor(m[1]!.length / 2),
        };
      });
      blocks.push({ kind: "ol", items });
      continue;
    }
    // Code block: lines start with 4+ spaces or 1+ tab (rare in souls, but supported)
    if (lines.every((l) => /^( {4,}|\t)/.test(l))) {
      blocks.push({
        kind: "code",
        text: lines.map((l) => l.replace(/^( {4}|\t)/, "")).join("\n"),
      });
      continue;
    }
    // Default: paragraph
    blocks.push({ kind: "p", text: lines.join(" ") });
  }
  return blocks;
}

export function SoulBodyViewer({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="max-h-[36rem] overflow-auto rounded-md border border-default/40 bg-surface/20 p-5 font-mono text-[12px] leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-4 mb-2 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-accent first:mt-0"
              >
                {renderInline(block.text)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="mt-3 mb-1 font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-foreground"
              >
                {renderInline(block.text)}
              </h3>
            );
          case "p":
            return (
              <p
                key={i}
                className="my-2 whitespace-pre-wrap text-foreground/90"
              >
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul
                key={i}
                className="my-2 ml-4 list-disc space-y-1 text-foreground/90"
              >
                {block.items.map((item, j) => (
                  <li key={j}>
                    {renderInline(item.text)}
                    {/* Nested sub-list: render the next consecutive
                       items at depth+1 as a child <ul>. We don't try
                       to do this perfectly — the template doesn't
                       use deeply nested lists. A flat 1-level render
                       is good enough for Phase 1. */}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={i}
                className="my-2 ml-4 list-decimal space-y-1 text-foreground/90"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item.text)}</li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <blockquote
                key={i}
                className="my-3 border-l-2 border-accent/60 bg-accent/5 px-3 py-2 italic text-foreground/85"
              >
                {renderInline(block.text)}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="my-4 border-default/40" />;
          case "code":
            return (
              <pre
                key={i}
                className="my-2 overflow-auto rounded bg-black/40 p-3 text-[11px] text-accent"
              >
                {block.text}
              </pre>
            );
          case "table":
            return (
              <div key={i} className="my-3 overflow-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-accent/30">
                      {block.headers.map((h, j) => (
                        <th
                          key={j}
                          className="px-2 py-1.5 text-left font-mono font-semibold uppercase tracking-[0.1em] text-accent"
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr
                        key={j}
                        className="border-b border-default/20 last:border-b-0"
                      >
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className="px-2 py-1.5 align-top text-foreground/90"
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
