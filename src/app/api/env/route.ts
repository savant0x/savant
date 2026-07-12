import { NextResponse } from "next/server";

// FID-008 — env var override (tier 1).
//
// The renderer cannot read `process.env.OPENROUTER_MASTER_KEY`
// directly (only `NEXT_PUBLIC_*` vars are inlined at build time).
// This server route is the bridge: it reads the env var on the
// server and returns a redacted summary to the client.
//
// SECURITY: in the Tauri desktop runtime the Rust process reads
// `process.env.OPENROUTER_MASTER_KEY` server-side and the renderer
// never sees the raw key (the IPC contract is redacted by design).
// In the browser preview the dev server is local-only and the user
// has explicitly set the env var in their `.env`, so returning the
// raw key to the client is acceptable for dev convenience.
//
// With `output: "export"` (Tauri static export), the response is
// baked into a static JSON file that's included in the Tauri
// bundle. The full key must NEVER appear in the production
// response — anyone who extracts the bundle would see the key in
// plaintext. Per ECHO Law 12 (never expose sensitive data), we
// gate the full key on `NODE_ENV !== "production"`:
//   - DEV (`npm run dev`): full key returned for dev convenience
//     (env var tier 1 works without a Settings page visit)
//   - PROD (`npm run build` for Tauri): only `last4` + `source`
//     returned; the Tauri app uses Rust IPC for the env var (not
//     this route), so the env var tier remains functional
//
// `force-static` is required by `output: "export"` — the route is
// rendered at build time, the env var is baked in, the response
// ships as a static JSON file. The dev guard above ensures the
// static file never contains the full key in production builds.
//
// WHY NOT A BUILD-TARGET FLAG: a `NEXT_PUBLIC_BUILD_TARGET` (or
// similar) flag would NOT enable dynamic env var reading in a
// static web export — with `output: "export"`, the route is
// compiled to a static file and physically cannot read server
// env vars at runtime. Supporting a hypothetical non-Tauri web
// deployment would require dropping `output: "export"` entirely
// (and maintaining a separate dynamic build config), which would
// break the primary Tauri desktop build (`frontendDist: "../out"`
// in `src-tauri/tauri.conf.json`). Since the project is Tauri-
// first and the README does not list web deployment as a
// supported path, the dev guard + documentation is the correct
// approach. The Tauri app uses Rust IPC for the env var in
// production (see `src-tauri/src/inference/openrouter.rs`), so
// the env var tier remains functional via the Rust-side read.
export const dynamic = "force-static";

export async function GET(): Promise<NextResponse> {
  const key = process.env.OPENROUTER_MASTER_KEY ?? null;
  const isDev = process.env.NODE_ENV !== "production";
  return NextResponse.json({
    // Full key in dev only. In production, this is `null` and the
    // client falls back to the vault entry (tier 2) or the static
    // template (no key). The Tauri app never reads this field in
    // production (it uses Rust IPC), so the env var tier remains
    // functional via the Rust-side read.
    openrouterMasterKey: isDev ? key : null,
    last4: key ? key.slice(-4) : null,
    source: key ? ("env" as const) : ("none" as const),
  });
}
