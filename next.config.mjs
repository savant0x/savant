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
};

export default nextConfig;
