const CACHE_PREFIX = "mendesk-pwa-shell-";
const LEGACY_CACHE_PREFIXES = ["koko-pwa-shell-"];
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const SHELL_URLS = ["/offline", "/store/demo-atelier-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (
          (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          || LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
        ))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => (
      await caches.match("/offline") ?? Response.error()
    )),
  );
});
