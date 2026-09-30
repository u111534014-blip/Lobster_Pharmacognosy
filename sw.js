/*
 * 離線快取。有網路時一律載入最新檔案，沒網路才用快取。
 * 新增或刪除檔案時，更新 FILES 並把 VERSION 加 1。
 */
var VERSION = 'v3';
var CACHE = 'longxia-yaozhi-' + VERSION;
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/data/families.js',
  'js/core.js',
  'js/modules/family-quiz.js',
  'js/modules/family-traits.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('longxia-yaozhi-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) {
    // 字型很少變：先用快取
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (res) { c.put(e.request, res.clone()); return res; });
      });
    }));
    return;
  }

  // app 檔案：有網路就拿最新版（並更新快取），沒網路才用快取
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true });
    })
  );
});
