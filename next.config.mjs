/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri loads the renderer as a static export of the Next.js app.
  output: "export",
  // HeroUI v3 alpha uses next/image for some primitives; the static export
  // pipeline does not include the Next.js image optimizer, so disable it.
  images: { unoptimized: true },
  // The user has a package-lock.json at C:\Users\spenc\ (parent of project).
  // Pin the trace root to the project so Next.js doesn't infer the wrong
  // workspace root and warn at every dev start.
  outputFileTracingRoot: process.cwd(),
  // Trailing-slash routes are conventional for Tauri static loading.
  trailingSlash: true,
  // Hide the Next.js dev indicator (the small badge in the bottom-right
  // corner that shows the route and build status). The Sovereign navbar
  // is the only chrome we want in the renderer.
  devIndicators: false,
  // FID-006 v2: enable `?raw` imports for `.md` files
  // (workspace-savant/SOUL.md). The `asset/source` webpack type treats
  // matched files as raw text strings. Without this rule, Next.js
  // webpack fails with "Module parse failed: Unexpected character" on
  // the .md?raw import. See src/lib/soul.ts.
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
