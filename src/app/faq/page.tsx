"use client";

import { Card } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";

// Faq route. The 3-panel shell is rendered by <DashboardShell>.
// This file only provides the center content below the header.

export default function FaqPage() {
  return (
    <DashboardShell>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Common questions about Savant
          </h2>
          <p className="mt-2 text-sm text-foreground">
            Content coming soon. This page is scaffolded and routed; data and
            interactions will be wired in a follow-up.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Status
          </h2>
          <p className="mt-2 text-sm text-foreground">Not yet connected.</p>
        </Card>
      </div>
    </DashboardShell>
  );
}
