/**
 * Service Worker — офлайн-кэш для PWA.
 */
importScripts("pwa-precache.js");

const CACHE = self.PWA_CACHE_VERSION || "bb-pwa-v1";
const PRECACHE = self.PWA_PRECACHE_URLS || ["index.html", "manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[sw] precache partial fail", err)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

function sameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const isVersionedAsset = /[?&]v=\d+/.test(request.url)
        || /\/(game|ui-layout|battle-hero-anchor|avatar-hero-effects|pwa-precache)\.js/.test(request.url);
      const isShellDoc = request.mode === "navigate"
        || request.destination === "document"
        || /\/index\.html(?:$|[?#])/.test(new URL(request.url).pathname + new URL(request.url).search);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      if (isVersionedAsset || isShellDoc) {
        return network.catch(() => cached);
      }
      return cached || network;
    }),
  );
});
