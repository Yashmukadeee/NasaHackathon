// Offline app-shell cache.
// The cache name is versioned, so a new deploy replaces the old cache instead of
// serving stale code (the reason earlier revisions self-unregistered the worker).
const CACHE_VERSION = "astra-v3";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/config.js",
  "/engine.js",
  "/db.js",
  "/app.js",
  "/style.css",
  "/sound.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/data/mission.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API calls must always hit the network so failures are visible, never masked.
  if (url.pathname.startsWith("/api/") || e.request.method !== "GET") {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for the app shell, with a network fallback and an offline page.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && url.origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match("/index.html"))
    )
  );
});
