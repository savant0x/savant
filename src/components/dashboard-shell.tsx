"use client";

// DashboardShell — the 3-panel layout (foldable rail + center + inspector)
// shared by every route in src/app/*/page.tsx.
//
// Active nav detection: uses usePathname() to derive the active id from
// the current URL. Click a nav item and the URL changes; the active
// highlight follows automatically (no local setState needed).
//
// Right-edge active bar: each nav item is `border-r-2 border-accent` when
// active (was border-l-2 in earlier versions). The 2px accent bar sits
// flush against the rail's right border so the eye reads it as a
// "you are here" marker on the inside-right of the column.
//
// Theme: dark-first. The <html> element ships with data-theme="dark"
// (server-rendered in layout.tsx). The footer theme toggle flips the
// html attribute client-side; HeroUI v3 swaps design tokens automatically.
//
// Logo: /img/logo.png (Next.js serves public/* at /).
// Children: each page provides its own center content below the header.

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@heroui/react";
import { listProfiles, type ProfileSummary } from "@/lib/ipc";

type Theme = "dark" | "light";

// ─── Nav items with hrefs (Savant-backup convention) ──────────────────
// Source order is conceptual (default-first, feature priority). The
// sidebar sorts alphabetically at runtime when building NAV_SECTIONS,
// so future agents can drop a new item anywhere in either array and the
// display order stays correct without a manual re-sort.
const SYSTEM_NAV_ITEMS = [
  { id: "chat", href: "/chat", label: "Chat with Savant", icon: "fa-message" },
  {
    id: "swarm",
    href: "/",
    label: "Swarm Broadcast",
    icon: "fa-tower-broadcast",
  },
  {
    id: "manifest",
    href: "/manifest",
    label: "Manifest Soul",
    icon: "fa-wand-magic-sparkles",
  },
] as const;

const PAGE_NAV_ITEMS = [
  { id: "evolution", href: "/evolution", label: "Evolution", icon: "fa-dna" },
  { id: "tune", href: "/tune", label: "Fine-Tuning", icon: "fa-sliders" },
  {
    id: "changelog",
    href: "/changelog",
    label: "Changelog",
    icon: "fa-clipboard-list",
  },
  { id: "settings", href: "/settings", label: "Settings", icon: "fa-gear" },
  {
    id: "marketplace",
    href: "/marketplace",
    label: "Marketplace",
    icon: "fa-store",
  },
  { id: "mcp", href: "/mcp", label: "MCP", icon: "fa-plug" },
  { id: "health", href: "/health", label: "Health", icon: "fa-heart-pulse" },
  { id: "faq", href: "/faq", label: "FAQ", icon: "fa-circle-question" },
  { id: "browser", href: "/browser", label: "Browser", icon: "fa-globe" },
] as const;

// Display order: items are sorted by label so the sidebar reads
// top-to-bottom alphabetically. `[...arr].sort()` copies before sorting
// so the underlying `as const` arrays stay untouched (other consumers
// like ALL_NAV_ITEMS keep their source order).
const NAV_SECTIONS = [
  {
    label: "System",
    items: [...SYSTEM_NAV_ITEMS].sort((a, b) => a.label.localeCompare(b.label)),
  },
  {
    label: "Pages",
    items: [...PAGE_NAV_ITEMS].sort((a, b) => a.label.localeCompare(b.label)),
  },
];

const ALL_NAV_ITEMS = [...SYSTEM_NAV_ITEMS, ...PAGE_NAV_ITEMS];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Derive active id from the URL: "/" → "swarm", "/evolution" → "evolution", etc.
  const activeId =
    pathname === "/" ? "swarm" : pathname.replace(/^\//, "").split("/")[0];
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "dark";
    setTheme(current);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const p = await listProfiles();
        setProfiles(p);
      } catch (err) {
        console.error("[DashboardShell] listProfiles failed:", err);
      }
    })();
  }, []);

  const toggleTheme = (): void => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const activeLabel =
    ALL_NAV_ITEMS.find((n) => n.id === activeId)?.label.toUpperCase() ??
    "SAVANT";

  // Path to the page file the developer should edit, shown as a hint in
  // the center header. "/" → src/app/page.tsx; "/evolution" → src/app/evolution/page.tsx.
  const filePath =
    pathname === "/" ? "src/app/page.tsx" : `src/app${pathname}/page.tsx`;

  return (
    <div
      className="grid h-screen w-screen overflow-hidden bg-background text-foreground transition-[grid-template-columns] duration-300 ease-out"
      style={{
        gridTemplateColumns: collapsed
          ? "64px minmax(0, 1fr) 320px"
          : "240px minmax(0, 1fr) 320px",
      }}
    >
      {/* ─── Left Rail ─────────────────────────────────────────────── */}
      <aside className="relative flex flex-col border-r border-default/60 bg-surface/30">
        {/* Brand — logo doubled (40px → 80px) */}
        <header
          className={
            collapsed
              ? "flex items-center justify-center border-b border-default/60 p-3"
              : "flex items-center gap-4 border-b border-default/60 p-4"
          }
        >
          <Link
            href="/"
            aria-label="Savant home"
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo.png"
              alt="Savant"
              className="h-12 w-12 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </Link>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-mono text-sm font-semibold uppercase tracking-[0.3em] text-foreground">
                Savant
              </h1>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                v0.0.1 · proactive
              </p>
            </div>
          )}
        </header>

        {/* Nav — 2 sections (System, Pages) with right-edge active bar */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              {idx > 0 && (
                <div
                  className="my-1.5 mx-3 h-px bg-default/60"
                  role="separator"
                  aria-hidden
                />
              )}
              {!collapsed && (
                <div className="mt-3 mb-1 mx-3 flex items-center gap-2 border-b border-default/60 pb-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_4px_var(--accent)]"
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                    {section.label}
                  </span>
                </div>
              )}
              {section.items.map(({ id, href, label, icon }) => {
                const active = activeId === id;
                return (
                  <Link
                    key={id}
                    href={href}
                    title={label}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-all duration-200 no-underline",
                      collapsed ? "justify-center" : "justify-start",
                      active
                        ? "border-r-2 border-accent bg-accent/10 text-accent"
                        : "border-r-2 border-transparent text-muted hover:bg-surface-secondary/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    <i
                      className={`fas ${icon} text-base shrink-0`}
                      aria-hidden
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: status + theme toggle */}
        <footer className="border-t border-default/60 p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex h-2 w-2 items-center justify-center"
                title="System online"
              >
                <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
              </div>
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
                aria-label="Toggle theme"
                className="flex h-6 w-6 items-center justify-center rounded-md border border-default/40 text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <i
                  className={`${theme === "dark" ? "fa-sun" : "fa-moon"} fas text-xs`}
                  aria-hidden
                />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_4px_var(--success)]" />
                </span>
                <span className="text-muted">System</span>
                <span className="ml-auto text-success">Online</span>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground"
                aria-label="Toggle theme"
              >
                <span>Theme</span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <i
                    className={`${theme === "dark" ? "fa-moon" : "fa-sun"} fas text-xs`}
                    aria-hidden
                  />
                  <span>{theme === "dark" ? "Dark" : "Light"}</span>
                </span>
              </button>
            </div>
          )}
        </footer>

        {/* Fold toggle — middle of the right edge */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className="absolute top-1/2 -right-3 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-default/60 bg-surface text-muted shadow-md transition-all duration-200 hover:scale-110 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <i
            className={`${collapsed ? "fa-chevron-right" : "fa-chevron-left"} fas text-sm`}
            aria-hidden
          />
        </button>
      </aside>

      {/* ─── Center Canvas ─────────────────────────────────────────── */}
      <main className="flex flex-col overflow-auto p-8">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            Active view
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold uppercase tracking-[0.2em] text-foreground">
            {activeLabel}
          </h1>
          <p className="mt-3 font-mono text-xs text-muted">
            Edit{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-accent">
              {filePath}
            </code>{" "}
            to add content.
          </p>
        </header>
        {children}
      </main>

      {/* ─── Right Inspector ───────────────────────────────────────── */}
      <aside className="flex flex-col overflow-auto border-l border-default/60 bg-surface/30">
        <header className="border-b border-default/60 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted">
            Inspector
          </p>
        </header>
        <Separator />
        <section className="p-4">
          <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Vault
          </h3>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted">No profiles configured.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {profiles.map((p) => (
                <li key={p.name} className="text-sm">
                  <span className="font-medium">{p.provider}</span>
                  <span className="text-muted"> · {p.method}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Separator />
        <section className="p-4">
          <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Activity
          </h3>
          <p className="text-sm text-muted">No recent activity.</p>
        </section>
      </aside>
    </div>
  );
}
