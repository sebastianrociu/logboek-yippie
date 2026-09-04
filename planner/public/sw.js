/* sw.js - service worker voor de Yippie-planner.
   Cache-strategie zoals het bestaande platform:
   - HTML/navigatie: network-first (altijd vers), val terug op cache bij offline
   - /vendor/, /assets/, /shared/, manifest: stale-while-revalidate
   - /api/*: nooit cachen
   Bump CACHE bij een release; version-check.js merkt de nieuwe /api/version en
   toont een balk met een "Vernieuwen"-knop. */
var CACHE = 'yp-planner-v11';
var PRECACHE = [
  '/', '/inschrijven/', '/mijn/', '/beheer/', '/resource/', '/school/',
  '/yp-design.css', '/vendor/tailwind.css', '/manifest.webmanifest',
  '/assets/icon.svg', '/assets/logo.png',
  '/shared/api.js', '/shared/icons.js', '/shared/dialog.js', '/shared/me-badge.js', '/shared/cmdk.js', '/shared/version-check.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function swr(req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type !== 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return; // laat door naar het netwerk

  var isAsset = /^\/(vendor|assets|shared)\//.test(url.pathname) || url.pathname === '/yp-design.css' || url.pathname === '/manifest.webmanifest';
  if (isAsset) { e.respondWith(swr(req)); return; }

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('/'); });
      })
    );
  }
});

/* WebPush volgt in fase 2 (pure WebCrypto in _worker.js + push-subscriptions). */
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(data.title || 'Yippie voor de klas', {
    body: data.body || '', icon: '/manifest.webmanifest', tag: data.tag || 'yp'
  }));
});
