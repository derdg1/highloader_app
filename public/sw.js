// Service Worker für Offline-Funktionalität
// Wird automatisch von vite-plugin-pwa generiert und verwaltet

const CACHE_NAME = 'video-downloader-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

// Aktivierung
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch-Strategie: Network First, fallback zu Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Erfolgreiche Antwort: Cache aktualisieren
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone)
            })
        }
        return response
      })
      .catch(() => {
        // Netzwerkfehler: Aus Cache laden
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Offline-Fallback
            return new Response('Offline - bitte Verbindung prüfen', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
              }),
            })
          })
      })
  )
})
