// Immediately flush all caches and unregister service worker for real-time development
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Always fetch directly from network without caching
  e.respondWith(fetch(e.request));
});
