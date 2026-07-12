// src/lib/name-generator.ts
//
// FID-009 — Themed name generator for the manifest page's die icon.
// Replaces the previous hardcoded 20-name array with 100+ names
// across 5 themes. The user can (in a future FID) filter by theme
// via a `<select>` next to the die icon; for now the die icon picks
// a random name from the full pool.
//
// Themes (20 names each = 100 total):
//   - mythological: Greek + Norse + Roman pantheons
//   - sci-fi:       Stars, planets, sci-fi concepts
//   - tech:         Math, code, computing concepts
//   - nature:       Weather, geography, ecosystems
//   - abstract:     Concepts, emotions, philosophical ideas
//
// All names are unique across themes (no duplicates). The pool is
// pure data + a `getRandomName()` selector (no React, no IPC).

export type NameTheme =
  "mythological" | "sci-fi" | "tech" | "nature" | "abstract";

const MYTHOLOGICAL: readonly string[] = [
  "Prometheus",
  "Athena",
  "Nova",
  "Orion",
  "Phoenix",
  "Helios",
  "Artemis",
  "Apollo",
  "Hermes",
  "Perseus",
  "Atlas",
  "Achilles",
  "Odysseus",
  "Theseus",
  "Castor",
  "Pollux",
  "Chiron",
  "Calliope",
  "Clio",
  "Erato",
];

const SCI_FI: readonly string[] = [
  "Vega",
  "Sirius",
  "Altair",
  "Rigel",
  "Deneb",
  "Capella",
  "Aldebaran",
  "Spica",
  "Antares",
  "Betelgeuse",
  "Arcturus",
  "Bellatrix",
  "Alnilam",
  "Mimosa",
  "Regulus",
  "Canopus",
  "Fomalhaut",
  "Polaris",
  "Proxima",
  "Cygnus",
];

const TECH: readonly string[] = [
  "Cipher",
  "Catalyst",
  "Vector",
  "Maverick",
  "Quantum",
  "Nexus",
  "Zenith",
  "Apex",
  "Prism",
  "Helix",
  "Vertex",
  "Matrix",
  "Sigma",
  "Lambda",
  "Delta",
  "Theta",
  "Omega",
  "Syntax",
  "Binary",
  "Hash",
];

const NATURE: readonly string[] = [
  "Zephyr",
  "Aurora",
  "Tempest",
  "Cascade",
  "Glacier",
  "Monsoon",
  "Solstice",
  "Equinox",
  "Boreal",
  "Canyon",
  "Mesa",
  "Ridge",
  "Valley",
  "Summit",
  "Tundra",
  "Prairie",
  "Savanna",
  "Reef",
  "Shoal",
  "Cove",
];

const ABSTRACT: readonly string[] = [
  "Echo",
  "Mirage",
  "Phantom",
  "Specter",
  "Wraith",
  "Enigma",
  "Paradox",
  "Riddle",
  "Veil",
  "Shroud",
  "Aegis",
  "Bulwark",
  "Bastion",
  "Citadel",
  "Vanguard",
  "Sentinel",
  "Pilgrim",
  "Nomad",
  "Drifter",
  "Wayfarer",
];

/** Theme → name pool. Exported for future theme-filter UI. */
export const NAMES_BY_THEME: Readonly<Record<NameTheme, readonly string[]>> = {
  mythological: MYTHOLOGICAL,
  "sci-fi": SCI_FI,
  tech: TECH,
  nature: NATURE,
  abstract: ABSTRACT,
};

/** Flattened array of all 100 names. */
const ALL_NAMES: readonly string[] = [
  ...MYTHOLOGICAL,
  ...SCI_FI,
  ...TECH,
  ...NATURE,
  ...ABSTRACT,
];

/** Random theme. Uses `Math.random()` for simplicity; the die icon
 *  is a low-stakes UX element so cryptographic randomness is
 *  unnecessary. */
function randomTheme(): NameTheme {
  const themes = Object.keys(NAMES_BY_THEME) as NameTheme[];
  return themes[Math.floor(Math.random() * themes.length)];
}

/** Pick a random name from a random theme. The selector avoids
 *  picking the same name twice in a row by remembering the last
 *  pick (closure-scoped; resets on page reload OR on HMR module
 *  re-evaluation, which is the expected UX — a fresh page/HMR
 *  cycle should be able to land on any name, including the
 *  previous pick).
 *
 *  FID-009 perfection loop: explicit on the HMR tradeoff. We do
 *  NOT persist to sessionStorage because:
 *    1. sessionStorage is a heavier hammer for a UX nicety
 *    2. The user expects a fresh page to feel fresh
 *    3. HMR is dev-only; production is unaffected
 *  If the user wants persistent exclusion (e.g., "don't show
 *  X for the whole session"), that's a future FID that adds
 *  an exclusion list to localStorage. */
let lastPick: string | null = null;
export function getRandomName(): string {
  const theme = randomTheme();
  const pool = NAMES_BY_THEME[theme];
  let next = pool[Math.floor(Math.random() * pool.length)];
  // Avoid the immediate repeat (small pool chance but visible UX).
  if (next === lastPick && pool.length > 1) {
    next = pool[(pool.indexOf(next) + 1) % pool.length];
  }
  lastPick = next;
  return next;
}

/** Pick a random name from a specific theme. */
export function getRandomNameByTheme(theme: NameTheme): string {
  const pool = NAMES_BY_THEME[theme];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Total name count (for UI display: "100+ names across 5 themes"). */
export const TOTAL_NAME_COUNT = ALL_NAMES.length;
export const TOTAL_THEME_COUNT = Object.keys(NAMES_BY_THEME).length;
