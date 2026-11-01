/* Pocket Arcade service worker: cache everything once, then play without a network. */
const CACHE = 'pocket-arcade-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => { const c = await caches.open(CACHE); await Promise.allSettled(ASSETS.map((a) => c.add(a))); await self.skipWaiting(); })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))); await self.clients.claim(); })());
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(e.request, { ignoreSearch: true });
    const refresh = fetch(e.request).then((r) => { if (r && r.ok && new URL(e.request.url).origin === self.location.origin) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (cached) { refresh.catch(() => {}); return cached; }
    const fresh = await refresh; if (fresh) return fresh;
    if (e.request.mode === 'navigate') { const fallback = (await c.match('./index.html')) || (await c.match('./')); if (fallback) return fallback; }
    return Response.error();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
