/**
 * Service Worker — офлайн-кэш для PWA.
 * Не кэшируем node_modules/dist: иначе iPad Mini jetsam'ит WebView (OOM).
 */
importScripts("pwa-precache.js");

const CACHE = self.PWA_CACHE_VERSION || "bb-pwa-v1";
const RAW_PRECACHE = self.PWA_PRECACHE_URLS || ["index.html", "manifest.webmanifest"];

function isBlockedPrecacheUrl(url) {
  const path = String(url || "").split("?")[0];
  return /(^|\/)node_modules(\/|$)/.test(path)
    || /(^|\/)dist(\/|$)/.test(path)
    || /(^|\/)tools(\/|$)/.test(path);
}

const PRECACHE = RAW_PRECACHE.filter((url) => !isBlockedPrecacheUrl(url));

async function precacheUrls(cache, urls) {
  // addAll падает целиком на одном 404; по одному — частичный успех + меньше пик памяти.
  const results = await Promise.allSettled(
    urls.map((url) => cache.add(new Request(url, { cache: "reload" }))),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) {
    console.warn(`[sw] precache: ${urls.length - failed}/${urls.length} ok, ${failed} failed`);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => precacheUrls(cache, PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[sw] precache install fail", err)),
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
  if (isBlockedPrecacheUrl(request.url)) return;

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
