// src/lib/swarm-diff.ts
//
// FID-013 — Swarm diff utility for the /manifest "Deploy Swarm"
// preview. Computes a 3-way diff between the current active
// swarm baseline and a proposed deployment so the user can
// see exactly what will change before confirming.
//
// Matching strategy: by `name` field (the only stable identifier
// in `AgentManifestPlan`). Two agents with the same name are
// compared for content equality (soul + identity). Content
// equality uses a fast stable hash so we don't deep-compare
// large soul strings.
//
// Phase 1: the baseline is whatever the mock IPC last
// successfully bulk_manifested (persisted to localStorage).
// Phase 2: the baseline will be the actual deployed swarm
// state (parsed from `workspace-savant/SOUL.md` files).

import type { AgentManifestPlan } from "@/types/control-frames";

/**
 * FID-013 — Stable hash of an `AgentManifestPlan` for change
 * detection. Uses the Web Crypto SHA-256 (same algorithm as
 * `calculateSoulHash` for content integrity). The hash covers
 * the agent's `name`, `soul`, and `identity` fields so any
 * change to any of them registers as "modified".
 *
 * Returns a 16-character hex prefix (64 bits) — collision
 * probability is ~1 in 10^19 for realistic swarm sizes (< 100
 * agents), which is more than sufficient.
 */
export async function computeSwarmHash(
  agent: AgentManifestPlan,
): Promise<string> {
  const encoder = new TextEncoder();
  // Stable serialization: name|soul|identity. Field separator
  // is a non-printable ASCII char that can't appear in any of
  // the fields (identity + soul are typically SOUL.md / IDENTITY.md
  // bodies, but we belt-and-suspender with the separator).
  const payload = `${agent.name}\x00${agent.soul}\x00${agent.identity ?? ""}`;
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * FID-013 — Sync version of the hash (FNV-1a 32-bit). Used as
 * a fallback for environments without Web Crypto, AND as the
 * "baseline vs proposed" equality check inside the diff loop
 * (we don't want to pay async crypto.subtle.digest cost per
 * agent inside a sync render). FNV-1a is not cryptographic
 * but is collision-resistant enough for "did this content
 * change" detection at swarm sizes < 100.
 */
export function computeSwarmHashSync(agent: AgentManifestPlan): string {
  const payload = `${agent.name}\x00${agent.soul}\x00${agent.identity ?? ""}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit hex.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * FID-013 — 3-way diff of two `AgentManifestPlan[]` arrays,
 * matched by `name`. Returns the four buckets + the proposed
 * list as-is (the caller can use it for the bulk_manifest
 * dispatch).
 *
 *   - `added`: in proposed, not in baseline
 *   - `modified`: same name, different hash (sync FNV-1a)
 *   - `removed`: in baseline, not in proposed
 *   - `unchanged`: same name, same hash
 *
 * Sync by design — runs in the render path (no async work).
 * The `computeSwarmHash` async variant is exposed separately
 * for callers that need cryptographic-grade integrity (e.g.,
 * a future "verify deployed matches baseline" flow).
 */
export type SwarmDiff = {
  added: AgentManifestPlan[];
  modified: Array<{ baseline: AgentManifestPlan; proposed: AgentManifestPlan }>;
  removed: AgentManifestPlan[];
  unchanged: AgentManifestPlan[];
};

export function previewSwarmDiff(
  baseline: AgentManifestPlan[],
  proposed: AgentManifestPlan[],
): SwarmDiff {
  const baselineByName = new Map<string, AgentManifestPlan>();
  for (const a of baseline) baselineByName.set(a.name, a);

  const proposedByName = new Map<string, AgentManifestPlan>();
  for (const a of proposed) proposedByName.set(a.name, a);

  const added: AgentManifestPlan[] = [];
  const modified: Array<{
    baseline: AgentManifestPlan;
    proposed: AgentManifestPlan;
  }> = [];
  const unchanged: AgentManifestPlan[] = [];
  const removed: AgentManifestPlan[] = [];

  // Walk proposed — classify as added / modified / unchanged.
  for (const p of proposed) {
    const b = baselineByName.get(p.name);
    if (!b) {
      added.push(p);
    } else if (computeSwarmHashSync(b) === computeSwarmHashSync(p)) {
      unchanged.push(p);
    } else {
      modified.push({ baseline: b, proposed: p });
    }
  }

  // Walk baseline — anything not in proposed is removed.
  for (const b of baseline) {
    if (!proposedByName.has(b.name)) {
      removed.push(b);
    }
  }

  return { added, modified, removed, unchanged };
}
