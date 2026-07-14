"use client";

import { useMemo, useState } from "react";
import { Card } from "@heroui/react";
import { iconRegistry, iconNames } from "@/components/icons";

// Dashboard showcase for the installed Hover animated icon pack
// (https://www.itshover.com/icons). This route is the integration point;
// per-page wiring (nav rail, settings, etc.) is intentionally left for later.
// Hover any icon to trigger its animation.

export default function IconsPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return iconNames;
    return iconNames.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          Hover Icons
        </h1>
        <p className="mt-1 text-sm text-muted">
          Animated icon pack from itshover.com — {iconNames.length} icons
          installed. Hover any icon to play its animation.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter icons…"
          className="mt-4 w-full max-w-sm rounded-lg border border-default bg-content1 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {filtered.map((name) => {
          const Icon = iconRegistry[name];
          return (
            <Card
              key={name}
              className="flex flex-col items-center gap-2 p-4"
            >
              <Icon size={28} className="text-foreground" />
              <span className="break-all text-center text-[10px] leading-tight text-muted">
                {name}
              </span>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          No icons match &ldquo;{query}&rdquo;.
        </p>
      )}
    </main>
  );
}
