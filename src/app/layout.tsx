import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Savant",
  description:
    "Next.js 15 + Tauri 2 proactive AI shell. Currently in a renderer-first Phase 1 rebuild (Rust core pending). v0.0.3 introduces the Soul Builder, LLM streaming, and Swarm Deployment diffing.",
  // Favicon fix (2026-07-13): the Savant favicon files live in
  // `public/favicon/` but the layout had no `icons` metadata, so
  // Next.js was falling back to the default Vercel icon. Explicit
  // `icons` + `manifest` here wires the real favicon files into
  // the HTML <head> `<link>` tags and links the PWA webmanifest.
  // File map (all under `public/favicon/`):
  //   - favicon.ico               → classic /favicon.ico request
  //   - favicon-16x16.png         → modern browser tab icon (16x16)
  //   - favicon-32x32.png         → modern browser tab icon (32x32)
  //   - apple-touch-icon.png      → iOS home-screen (180x180)
  //   - android-chrome-192x192.png + 512x512.png → PWA manifest
  icons: {
    icon: [
      {
        url: "/favicon/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" data-theme="dark">
      <body className="h-full bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
