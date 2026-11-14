// Offline-first: cache the app shell and mission data on first load.
const CACHE = "mission-vitals-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "engine.js", "config.js", "data/mission.json", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));
