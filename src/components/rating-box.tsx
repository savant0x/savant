// src/components/rating-box.tsx
//
// Reusable metric display card for the soul builder (FID-006 v3
// v2 reopen + FID-009 enterprise-grade redesign).
//
// FID-009 enhancements:
//   - Larger value typography (text-xl → text-2xl on hover)
//   - Hover state: border becomes accent + slight scale-up (1.02x)
//   - Thicker progress bar (h-1 → h-1.5)
//   - Gradient background (bg-surface/30 → bg-gradient-to-br)
//   - Optional icon prefix (e.g., 📊 LINES)
//   - Optional sublabel for additional context below the hint
//   - Smooth transitions on all interactive states
//
// Color variants map to the existing Tailwind tokens used in
// the dashboard (border-default/40, border-success/40, etc.).

import type { ReactNode } from "react";

type RatingColor = "default" | "success" | "warning" | "danger" | "accent";

const RATING_COLOR_CLASS: Record<RatingColor, string> = {
  default: "border-default/40 text-foreground",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
  accent: "border-accent/40 text-accent",
};

const RATING_BAR_CLASS: Record<RatingColor, string> = {
  default: "bg-foreground/60",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
};

const RATING_HOVER_BORDER: Record<RatingColor, string> = {
  default: "hover:border-default/80",
  success: "hover:border-success/80",
  warning: "hover:border-warning/80",
  danger: "hover:border-danger/80",
  accent: "hover:border-accent/80",
};

export type RatingBoxProps = {
  /** Uppercase label, e.g. "LINES", "DEPTH", "HASH". */
  label: string;
  /** Primary value (string or number). Rendered bold + large. */
  value: string | number;
  /** Optional 0-1 progress bar (e.g., depth_score, sections/18). */
  bar?: number;
  /** Color variant for the border + value text + bar. */
  color?: RatingColor;
  /** Optional subtitle shown below the value (e.g., "/18 target"). */
  hint?: string;
  /** Optional title attribute (hover tooltip). */
  title?: string;
  /** Optional icon prefix shown next to the label (e.g.,
   *  `<i className="fas fa-chart-line" />`). Used in the manifest
   *  page's rating grid (LINES, SECTIONS, DEPTH, HASH, INFRA). */
  icon?: ReactNode;
};

export function RatingBox({
  label,
  value,
  bar,
  color = "default",
  hint,
  title,
  icon,
}: RatingBoxProps) {
  const barPct = bar !== undefined ? Math.max(0, Math.min(1, bar)) * 100 : null;
  return (
    <div
      title={title}
      className={`group relative flex flex-col gap-1.5 overflow-hidden rounded-md border ${RATING_COLOR_CLASS[color]} ${RATING_HOVER_BORDER[color]} bg-gradient-to-br from-surface/40 to-surface/10 p-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_12px_var(--accent)]/20`}
    >
      {/* Accent bar on the left edge — visual rhythm */}
      <div
        className={`absolute left-0 top-0 h-full w-0.5 ${RATING_BAR_CLASS[color]} opacity-50 transition-opacity duration-300 group-hover:opacity-100`}
        aria-hidden
      />
      <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
        {icon && <span className="text-[10px]">{icon}</span>}
        {label}
      </span>
      <span
        className={`truncate font-mono text-xl font-bold transition-all duration-300 group-hover:text-2xl ${RATING_COLOR_CLASS[color]}`}
      >
        {value}
      </span>
      {hint && <span className="font-mono text-[9px] text-muted">{hint}</span>}
      {barPct !== null && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface/60">
          <div
            className={`h-full ${RATING_BAR_CLASS[color]} transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
