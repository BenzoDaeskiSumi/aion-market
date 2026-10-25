/* Aion 2 Market — service worker: makes the site installable and keeps the last version for when the network is down.
   Network first for everything (prices change every hour, code changes often); the cache is only a fallback.
   Only this site's own files are cached: other sites (NCSOFT icons, the bot, Supabase) are never touched. */
const CACHE = 'aion-market-v2';
const SHELL = ['./', 'index.html', 'market.html', 'overlay.html', 'css/home.css', 'js/home.js', 'css/style.css', 'css/overlay.css', 'lib/d3.min.js', 'manifest.webmanifest', 'img/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/media/')) return;      // the video: the browser streams it with range requests, never cached here
  // big per-item histories are not worth keeping offline
  const keep = !url.pathname.includes('/h/') && !url.pathname.endsWith('/db/items.json');
  e.respondWith(fetch(req).then((res) => {
    if (keep && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: url.pathname.endsWith('.html') || url.pathname.endsWith('/')}).then((r) => r || Response.error())));
});
