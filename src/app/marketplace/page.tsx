"use client";

import { Card } from "@heroui/react";
import { DashboardShell } from "@/components/dashboard-shell";

// Marketplace route. The 3-panel shell is rendered by <DashboardShell>.
// This file only provides the center content below the header.

export default function MarketplacePage() {
  return (
    <DashboardShell>
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Card 1
          </h3>
          <p className="text-xs text-muted">Agent marketplace placeholder</p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Card 2
          </h3>
          <p className="text-xs text-muted">Agent marketplace placeholder</p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider">
            Card 3
          </h3>
          <p className="text-xs text-muted">Agent marketplace placeholder</p>
        </Card>
      </div>
    </DashboardShell>
  );
}
