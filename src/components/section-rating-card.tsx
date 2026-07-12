// src/components/section-rating-card.tsx
//
// FID-012 — Per-section rating card for the /manifest Draft Buffer's
// SECTIONS BREAKDOWN. One card per `## N. Title` section in the
// built soul body. Displays the section's identity + per-section
// metrics (lines, words, density) as color-coded pills.
//
// Color thresholds for density (mirrors the global DEPTH card in
// `rating-box.tsx`):
//   - density >= 10  → success (green)  — substantive content
//   - density >= 5   → warning (yellow) — moderate content
//   - density < 5    → danger  (red)    — thin / placeholder
//
// The "completeness" indicator (small dot on the right) is a binary
// signal: green if the section has >= 10 words AND isn't a
// placeholder string (TBD/TODO/...), red otherwise. This is the
// "section meets the bar" signal that complements the density
// color (density is a gradient, completeness is a threshold).
//
// Per ECHO Law 13 (utility-first): this component is reusable for
// any per-section metric display (e.g., future swarm reports,
// per-agent breakdown).

import type { ReactElement } from "react";
import type { SectionMetric } from "@/lib/manifest-mock";

type DensityColor = "success" | "warning" | "danger";

function densityColor(density: number): DensityColor {
  if (density >= 10) return "success";
  if (density >= 5) return "warning";
  return "danger";
}

const DENSITY_BG: Record<DensityColor, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export interface SectionRatingCardProps {
  metric: SectionMetric;
  /** Optional override for the index in the list (defaults to metric.id). */
  index?: number;
}

export function SectionRatingCard({
  metric,
  index,
}: SectionRatingCardProps): ReactElement {
  const color = densityColor(metric.density);
  const displayIndex = index ?? metric.id;
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${DENSITY_BG[color]}`}
      data-testid={`section-card-${displayIndex}`}
    >
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] tabular-nums"
        title={`Section ${metric.id}`}
      >
        {displayIndex.toString().padStart(2, "0")}
      </span>
      <span
        className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium"
        title={metric.title}
      >
        {metric.title}
      </span>
      <span
        className="hidden font-mono text-[9px] uppercase tracking-[0.15em] opacity-70 sm:inline"
        title="lines"
      >
        {metric.lines}L
      </span>
      <span
        className="hidden font-mono text-[9px] uppercase tracking-[0.15em] opacity-70 sm:inline"
        title="words"
      >
        {metric.words}W
      </span>
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] tabular-nums"
        title={`density ${metric.density} words/line`}
      >
        {metric.density.toFixed(1)}
      </span>
      {/* Completeness dot — inline ternary because `Record<boolean, string>`
          is invalid TypeScript (Record requires string|number|symbol keys). */}
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          metric.completeness ? "bg-success" : "bg-danger"
        }`}
        title={
          metric.completeness
            ? "section meets completeness bar (>= 10 words, not a placeholder)"
            : "section is incomplete (< 10 words or placeholder)"
        }
        aria-label={
          metric.completeness ? "section complete" : "section incomplete"
        }
      />
    </div>
  );
}
