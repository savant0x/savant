// public/sw.js — Savant diagnostic no-op service worker (v0.0.3 patch, r2)
//
// Why this exists: Next.js dev server log shows repeated GET /sw.js 404s despite
// an exhaustive project-tree + node_modules grep returning zero callers. The
// requester is exogenous — most likely a Chrome DevTools Application > Service
// Workers panel probe, a browser extension that opportunistically registers
// a fallback SW, or an Edge WebView2 init probe. This file returns valid JS so
// the probe gets a 200 instead of a 404, immediately unregisters itself, and
// does NOT force client reloads (this SW never installed a fetch handler, so
// there is no SW-controlled state to drop — reloading clients would be
// gratuitous and risks a reprobe loop on persistent probers).
//
// ECHO Law 4 grep anchor: `grep -rn serviceWorker src/` should still return
// ZERO matches after this file ships. This public/sw.js is the ONE place SW
// behavior is described, and it is intentionally non-controlling.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
