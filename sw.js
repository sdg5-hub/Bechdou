/* Bechdou service worker — app-shell caching + graceful offline fallback. */
const CACHE = "bechdou-v29";
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css?v=29",
  "./api.js?v=29",
  "./pages.js?v=29",
  "./pages-account.js?v=29",
  "./admin.js?v=29",
  "./script.js?v=29",
  "./seller.js?v=29",
  "./wire.js?v=29",
  "./manifest.webmanifest",
  "./assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Skip cross-origin requests and API calls (always network-only).
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/checkout/")) return;

  // Network-first for page navigations — fresh HTML on every load.
  // Fall back to offline.html if the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("./offline.html").then((res) => res || caches.match("./index.html")),
      ),
    );
    return;
  }

  // Cache-first for same-origin assets (images, CSS, JS).
  // Runtime-cache any asset not already in the shell.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => {
          // For image requests, return nothing (broken img) rather than crash.
          if (request.destination === "image") return new Response("", { status: 200 });
        }),
    ),
  );
});
