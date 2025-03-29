const CACHE_NAME = 'rc-weather-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon-192x192.png', // Add your actual icon paths
    '/icon-512x512.png'
    // Add other static assets if needed
];

// Install event: Cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Activate worker immediately
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of open clients
    );
});

// Fetch event: Serve from cache first (Cache-First strategy for static assets)
// Network-first or stale-while-revalidate might be better for the main HTML page
// to get updates faster, but this is simpler to start.
// API calls are always fetched from network by the main script.js.
self.addEventListener('fetch', event => {
    // Only handle GET requests for assets we might cache
    if (event.request.method !== 'GET') {
        return;
    }

    // For navigation requests (like loading the main page), try network first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/index.html')) // Fallback to cached index.html if network fails
        );
        return;
    }

    // For other static assets, use Cache First
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // Not in cache - fetch from network
                return fetch(event.request).then(
                    networkResponse => {
                        // Optional: Cache the newly fetched resource if needed (be careful not to cache API responses here)
                        // If it's a static asset not initially cached, you might add it here.
                        return networkResponse;
                    }
                );
            })
            .catch(error => {
                console.error('Fetching failed:', error);
                // Optional: return a fallback offline page/resource here
            })
    );
});