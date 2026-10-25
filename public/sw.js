/* TagTriage service worker: caches the app shell so every page opens offline after the first visit. */
const BUILD = new URL(self.location.href).searchParams.get("build") || "dev";
const CACHE = `tagtriage-shell-${BUILD}`;
const SHELL = ["/", "/register", "/board", "/inventory", "/audit", "/manifest.webmanifest", "/icon/192", "/icon/512", "/apple-icon"];
const ASSET_PATTERN = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
const CSS_URL_PATTERN = /url\((\/_next\/static\/media\/[^)]+)\)/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const path of SHELL) {
    try {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) continue;
      await cache.put(path, response.clone());
      if ((response.headers.get("content-type") || "").includes("text/html")) {
        for (const match of (await response.text()).matchAll(ASSET_PATTERN)) assets.add(match[1]);
      }
    } catch {
      // Keep installing; missing entries are filled in at runtime.
    }
  }
  for (const asset of assets) {
    try {
      const response = await fetch(asset);
      if (!response.ok) continue;
      await cache.put(asset, response.clone());
      if (asset.endsWith(".css")) {
        for (const match of (await response.text()).matchAll(CSS_URL_PATTERN)) {
          const font = await fetch(match[1]);
          if (font.ok) await cache.put(match[1], font);
        }
      }
    } catch {
      // Ignore individual asset failures.
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("tagtriage-shell-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response.ok) cache.put(new URL(request.url).pathname, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(new URL(request.url).pathname)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit || Response.error());
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the model route or React Server Component payloads (a failed RSC fetch falls back to a full navigation).
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || request.headers.get("RSC")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
