// src/components/bulk-diff-viewer.tsx
//
// FID-013 — 3-way diff display for the /manifest "Deploy Swarm"
// preview. Shows what will change when the user deploys the
// proposed `AgentManifestPlan[]` against the current active
// baseline. Color-coded:
//
//   - ADDED     (green)    — in proposed, not in baseline
//   - MODIFIED  (yellow)   — same name, different content
//   - REMOVED   (red)      — in baseline, not in proposed
//   - UNCHANGED (muted)    — same name, same content
//
// The UNCHANGED bucket is collapsed by default (it's usually
// the largest bucket and not interesting). The ADDED/MODIFIED/
// REMOVED sections each show the agent's name + a brief
// content hint (first 80 chars of the soul field).
//
// Per ECHO Law 13 (utility-first): this component is reusable
// for any future 3-way diff display (e.g., a future "Compare
// with previous version" feature on the Draft Buffer).

import type { SwarmDiff } from "@/lib/swarm-diff";

export interface BulkDiffViewerProps {
  diff: SwarmDiff;
  /** Optional className for the outer container. */
  className?: string;
}

/** Truncate a string to N chars + ellipsis for the content hint. */
function snippet(s: string, n = 80): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= n) return trimmed;
  return trimmed.slice(0, n) + "…";
}

export function BulkDiffViewer({
  diff,
  className = "",
}: BulkDiffViewerProps): React.ReactElement {
  const { added, modified, removed, unchanged } = diff;
  const totalChanges = added.length + modified.length + removed.length;
  const noChanges = totalChanges === 0;

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border border-default/40 bg-surface/30 p-3 ${className}`}
      data-testid="bulk-diff-viewer"
    >
      <div className="flex items-center justify-between border-b border-default/40 pb-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          [ DEPLOYMENT DIFF ]
        </span>
        <span
          className={`font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${
            noChanges ? "text-success" : "text-warning"
          }`}
        >
          {noChanges
            ? "No changes"
            : `${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
        </span>
      </div>

      {noChanges && (
        <p className="font-mono text-[11px] text-muted">
          All properties match the active deployment. Deploying will be a no-op.
        </p>
      )}

      {/* ADDED — green */}
      {added.length > 0 && (
        <DiffSection
          label="ADDED"
          color="success"
          items={added.map((a) => ({
            name: a.name,
            hint: snippet(a.soul, 100),
          }))}
        />
      )}

      {/* MODIFIED — yellow */}
      {modified.length > 0 && (
        <DiffSection
          label="MODIFIED"
          color="warning"
          items={modified.map(({ baseline, proposed }) => ({
            name: proposed.name,
            hint: `${snippet(baseline.soul, 60)} → ${snippet(proposed.soul, 60)}`,
          }))}
        />
      )}

      {/* REMOVED — red */}
      {removed.length > 0 && (
        <DiffSection
          label="REMOVED"
          color="danger"
          items={removed.map((a) => ({
            name: a.name,
            hint: snippet(a.soul, 100),
          }))}
        />
      )}

      {/* UNCHANGED — collapsed by default, muted */}
      {unchanged.length > 0 && (
        <details className="text-muted">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] hover:text-foreground">
            UNCHANGED ({unchanged.length} agent
            {unchanged.length === 1 ? "" : "s"})
          </summary>
          <ul className="mt-1.5 space-y-0.5 pl-2">
            {unchanged.map((a) => (
              <li
                key={a.name}
                className="font-mono text-[10px] text-muted/70"
                title={a.name}
              >
                · {a.name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type DiffColor = "success" | "warning" | "danger";

const DIFF_BORDER: Record<DiffColor, string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-danger/30 bg-danger/5",
};

const DIFF_LABEL_COLOR: Record<DiffColor, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const DIFF_ICON: Record<DiffColor, string> = {
  success: "fa-plus",
  warning: "fa-pen",
  danger: "fa-minus",
};

function DiffSection({
  label,
  color,
  items,
}: {
  label: string;
  color: DiffColor;
  items: Array<{ name: string; hint: string }>;
}): React.ReactElement {
  return (
    <div className={`rounded-md border p-2 ${DIFF_BORDER[color]}`}>
      <div
        className={`mb-1.5 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] ${DIFF_LABEL_COLOR[color]}`}
      >
        <i className={`fas ${DIFF_ICON[color]}`} aria-hidden />
        {label} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex flex-col gap-0.5 border-l-2 border-default/30 pl-2"
          >
            <span className="font-mono text-[11px] font-medium text-foreground">
              {item.name}
            </span>
            <span
              className="truncate font-mono text-[10px] text-muted"
              title={item.hint}
            >
              {item.hint}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
