"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker in production builds only, versioned by build id. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(build)}`, { scope: "/" }).catch(() => {
      // Offline support is progressive; the app still works online without it.
    });
  }, []);
  return null;
}
