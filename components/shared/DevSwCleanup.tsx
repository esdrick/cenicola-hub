"use client";

import { useEffect } from "react";

// PWA is disabled in development (see next.config.mjs), but a stale service
// worker from a previous project or a prior `next build && next start` run
// on this same port can keep intercepting requests — causing broken
// redirects and 404s for assets that don't belong to this app at all.
// Dev-only: unregister any leftover service worker so localhost always hits
// the real dev server.
export function DevSwCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    });

    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }
  }, []);

  return null;
}
