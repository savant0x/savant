// Global ambient module declaration for Next.js `?raw` imports.
// Used by src/lib/soul.ts to load workspace-savant/SOUL.md at build
// time (FID-006 v2). The webpack rule in next.config.mjs (test: /\.md$/,
// type: "asset/source") makes the import resolve to a string at build
// time, satisfying the static-export pipeline under
// next.config.mjs:4 `output: "export"`.
declare module "*?raw" {
  const content: string;
  export default content;
}
