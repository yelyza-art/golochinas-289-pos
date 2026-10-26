const CACHE_NAME = 'g289-v1';
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE_NAME)));
self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then(res => res || fetch(e.request))));
