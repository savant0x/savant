"use client";

// ids.ts — tiny utility for OpenRouter `agent_name` uniqueness.
//
// OpenRouter rejects duplicate `agent_name` values on `POST /v1/keys`,
// so each Rotate / Save iteration needs a fresh unique name. We use
// `crypto.getRandomValues` for crypto-quality randomness (browser
// only — this file is marked "use client"). 8 hex chars (16 bits per
// char × 4 chars = 32 effective bits) is enough to make collisions
// statistically negligible across a user session.
//
// The shape is locked by FID-0003 §Steps step 1; do not edit without
// amending the FID.

export const randomHex = (n: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(n / 2))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, n);
