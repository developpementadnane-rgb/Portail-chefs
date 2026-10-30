/**
 * Qada service worker — scope: app-shell caching only.
 *
 * Per the v2.0 offline strategy, this is deliberately NOT a
 * general-purpose offline-everything service worker. It exists to
 * answer one question: "if the chef opens the app with no network,
 * does the app itself load at all?" Everything about WHICH DATA is
 * available offline (members, sessions, attendance queue) is handled
 * by client/lib/offline/* via IndexedDB — this file never touches
 * IndexedDB and never intercepts /api/* or Supabase requests. Data
 * freshness and sync correctness live entirely in JS, where the
 * conflict-resolution logic in syncQueue.ts can be tested and
 * reasoned about; the service worker's only job is serving the HTML/
 * JS/CSS shell from cache so that JS gets to run at all.
 *
 * Strategy per request type:
 *   - Navigation requests (loading the app itself): cache-first with
 *     network fallback, so the SPA shell opens instantly offline.
 *   - Same-origin built assets (JS/CSS/fonts under /assets/, hashed
 *     filenames from the Vite build): cache-first — hashed filenames
 *     mean a cached entry is never stale, a new deploy simply
 *     produces new filenames.
 *   - Everything else (API calls, Supabase requests, cross-origin
 *     requests, images): network-only, untouched by this service
 *     worker. This is intentional — attendance sync and member data
 *     must go through the app's own offline-aware code paths
 *     (syncQueue.ts, membersCache.ts), not a generic SW cache that
 *     could silently serve stale JSON and defeat the conflict
 *     resolution the sync endpoint implements.
 *
 * Versioning: bump CACHE_VERSION on any change to APP_SHELL_URLS or
 * to this file's caching logic, so the activate handler evicts the
 * old cache instead of serving mismatched shell files.
 */

const CACHE_VERSION = "qada-shell-v1";

const APP_SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isBuiltAsset(url) {
  // Vite's default build output for this project (see vite.config.ts,
  // outDir: "dist/spa") emits hashed filenames under /assets/.
  return url.pathname.startsWith("/assets/");
}

function isApiOrExternal(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.origin !== self.location.origin
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return; // never intercept writes

  const url = new URL(request.url);

  if (isApiOrExternal(url)) return; // let the network/app code handle it entirely

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the shell fresh on every successful online
          // navigation, so the offline fallback below stays current.
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (isBuiltAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});
