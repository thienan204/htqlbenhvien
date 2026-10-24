// Minimal Service Worker for PWA Desktop Installability - BVDK Loc Son
const CACHE_NAME = 'bvdk-it-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through fetch handler required by Chrome/Edge PWA install criteria
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
