// Network-first app shell: reloads always get the newest build while online,
// and the cached shell keeps the app usable when offline.
const CACHE = "astra-health-v3";
const FILES = ["./", "index.html", "style.css", "app.js", "db.js", "sound.js", "engine.js", "config.js", "data/mission.json", "manifest.webmanifest", "icon.svg", "logo.jpg"];
const MEDIA = /\.(mp4|webm|mov|ogg|mp3|wav|flac)$/i;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Refresh the offline copy, but skip media (range responses) and errors.
        if (res.status === 200 && !MEDIA.test(url.pathname)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then((cached) => cached || caches.match(new URL("index.html", self.registration.scope).href))
      )
  );
});
