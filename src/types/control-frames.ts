// FID-006 v3 — TypeScript mirrors of savant-orig ControlFrame types.
//
// Source-of-truth (pasteback-grounded):
//   - BootstrapTier:     crates/core/src/types/mod.rs:1153-1164 (4 variants, snake_case)
//   - BootstrapStatus:   crates/core/src/types/mod.rs:1174-1183 (3 variants, snake_case)
//   - AgentManifestPlan: crates/core/src/types/mod.rs:189-194  (3 fields)
//   - ControlFrame::SoulManifest: crates/core/src/types/mod.rs:75-79  (3 fields)
//   - ControlFrame::BulkManifest: crates/core/src/types/mod.rs:84-86  (1 field)
//
// Snake_case union types per `#[serde(rename_all = "snake_case")]` on
// the parent enums at types/mod.rs:1154, 1174. Exact variant names —
// do not pre-emptively rename for UX (per LESSON-018 + FID-006 v3
// "exact names, not UX rename" lessons learned).

// BootstrapTier — 4 variants mirroring crates/core/src/types/mod.rs:1155-1163
//   PureGeneration | Grounded | Scaffolded | Aspirational
export type BootstrapTier =
  "pure_generation" | "grounded" | "scaffolded" | "aspirational";

// BootstrapStatus — 3 variants mirroring crates/core/src/types/mod.rs:1175-1182
//   Ready (#[default]) | Pending | Degraded
export type BootstrapStatus = "ready" | "pending" | "degraded";

// AgentManifestPlan — 3-field struct mirroring crates/core/src/types/mod.rs:190-194
export interface AgentManifestPlan {
  name: string;
  soul: string;
  identity?: string;
}

// ControlFrame::SoulManifest payload — crates/core/src/types/mod.rs:75-79
//
// Note: `bootstrap_tier` is snake_case to match the Rust IPC contract.
// The dashboard's `sendControlFrame` at
// `dashboard/src/app/page.tsx:82-86` sends `bootstrap_tier:` (snake_case).
// Phase 2 Tauri integration requires the field name to roundtrip through
// the JSON serializer without rename.
//
// `model` is an optional Phase 1 hint from the renderer (the manifest
// page passes the loaded chat model from `useLoadedConfig()`); the mock
// falls back to DEFAULT_MODEL if absent. Phase 2 will read
// `ai.manifestation_model` from savant-orig config (see
// `crates/gateway/src/handlers/mod.rs:1743-1750`).
export interface SoulManifestPayload {
  prompt: string;
  name?: string;
  bootstrap_tier?: BootstrapTier;
  model?: string;
}

/**
 * IPC return shape for `manifest_soul` — mirrors the
 * `MANIFEST_DRAFT` payload at
 * [`crates/gateway/src/handlers/mod.rs:1917-1942`]. `content` is the
 * full SOUL.md body (header + 18 sections); `status` is
 * `"complete"` (LLM success), `"template"` (no key, static fallback),
 * or `"error"` (LLM or network failure). `metrics` is always populated
 * (zeroes on error).
 */
export interface ManifestResult {
  prompt: string;
  name: string | null;
  content: string;
  status: "complete" | "template" | "error";
  /** SHA-256 hex digest in browser (BLAKE3 in savant-orig; field name
   *  kept for IPC contract parity). */
  soul_blake3?: string;
  /** True if the LLM declared capabilities via
   *  `## INFRASTRUCTURE_REQUIREMENTS` block. */
  has_infra_block?: boolean;
  metrics: { lines: number; sections: number; depth_score: number };
  /** Set on `status: "template"` — explains the fallback. */
  note?: string;
  /** Set on `status: "error"` — human-readable error message. */
  error?: string;
}

// ControlFrame::BulkManifest payload — crates/core/src/types/mod.rs:84-86
export interface BulkManifestPayload {
  agents: AgentManifestPlan[];
}

// IPC return shape for bulk_manifest
// Mirrors the server-side `BulkManifest` dispatch at
// crates/gateway/src/handlers/mod.rs:645-665 (SEC #8 limit of 10 agents).
export interface BulkManifestResult {
  status: "SWARM_DEPLOYED" | "REJECTED";
  count?: number;
  reason?: "SEC_8_LIMIT_EXCEEDED";
}
