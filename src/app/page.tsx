"use client";

import { Card, Chip } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";

// Root route: About / Savant v0.0.6 landing view.
// The 3-panel shell (rail, fold toggle, theme toggle, inspector, center
// header) is rendered by <DashboardShell>. This file provides the
// post-release landing content below the header: 1 status banner +
// 3 about-feature cards orient the visitor to the v0.0.6 deliverables.

const RELEASE_TAG = "v0.0.6";
const RELEASE_DATE = "2026-07-15";
const NEXT_PHASE =
  "v0.0.7+ architectural pivot (Tauri → CLI/HTTP strangler-fig pattern)";

export default function Home() {
  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-3">
        <Chip
          variant="solid"
          color="success"
          className="self-start font-mono text-xs"
        >
          Savant {RELEASE_TAG} RELEASED — {RELEASE_DATE}
        </Chip>
        <h1 className="font-mono text-2xl font-bold">
          Sovereign agent substrate. Phase 1 baseline complete.
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Pre-pivot baseline before {NEXT_PHASE}. See {" "}
          <a href="/changelog" className="underline">CHANGELOG</a>{" "}
          for the full release notes and {" "}
          <a href="/reflections" className="underline">Reflections</a>{" "}
          for the runtime narrative.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Git release tooling
          </h3>
          <p className="text-xs text-muted-foreground">
            LESSON-027 lint:docs + LESSON-029 release:check + LESSON-030
            file-based commit/tag pattern + LESSON-031 dual-check re-grep
            discipline codified as the project&apos;s release workbench
            (<code>pnpm lint:docs</code>, {" "}
            <code>pnpm release:check</code>, {" "}
            <code>pnpm git:commit</code>, {" "}
            <code>pnpm git:tag</code>).
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Gateway foundation (Layer 0)
          </h3>
          <p className="text-xs text-muted-foreground">
            33 new <code>/v1/*</code> handlers at <code>crates/gateway/</code>{" "}
            (1 real impl + 6 stubs returning 501 NotImplemented + 1 SSE
            plumbing stub at release time; differential scheduled per
            master-FID-035 build order).
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Cascade-recovery cycle
          </h3>
          <p className="text-xs text-muted-foreground">
            LESSON-053 (5-step BOOT CHECK pipeline) + LESSON-054
            (stale-session transcript disposition) codified to prevent the
            2026-07-15 ECHO-brake cascade from recurring. Cross-agent audit
            channel (<code>dev/nova/{`{inbox,outbox}`}/</code>) established per
            LESSON-008 attribution-≠-source.
          </p>
        </Card>
      </div>
    </DashboardShell>
  );
}
