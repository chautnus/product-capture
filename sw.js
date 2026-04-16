/**
 * ProductSnap Service Worker
 * Handles: Share Target API, Offline caching, Background sync
 */

importScripts('./js/core/sw-idb.js');

const CACHE_NAME = 'productsnap-v13';
const APP_VERSION = '5.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  `./app.css?v=${APP_VERSION}`,
  './manifest.json',
  `./js/core/sw-init.js?v=${APP_VERSION}`,
  `./js/core/sw-idb.js?v=${APP_VERSION}`,
  `./js/config.js?v=${APP_VERSION}`,
  `./js/i18n.js?v=${APP_VERSION}`,
  `./js/data.js?v=${APP_VERSION}`,
  `./js/oauth.js?v=${APP_VERSION}`,
  `./js/sheets-api.js?v=${APP_VERSION}`,
  `./js/drive-api.js?v=${APP_VERSION}`,
  `./js/wizard.js?v=${APP_VERSION}`,
  `./js/auth.js?v=${APP_VERSION}`,
  `./js/camera.js?v=${APP_VERSION}`,
  `./js/form.js?v=${APP_VERSION}`,
  `./js/products.js?v=${APP_VERSION}`,
  `./js/detail.js?v=${APP_VERSION}`,
  `./js/settings.js?v=${APP_VERSION}`,
  `./js/sync.js?v=${APP_VERSION}`,
  `./js/app.js?v=${APP_VERSION}`
];

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v' + APP_VERSION + '...');

  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
    );
    await self.clients.claim();
  })());
});

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle Share Target POST requests
  if (event.request.method === 'POST' && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'))) {
    console.log('[SW] Share Target received');
    event.respondWith(handleShareTarget(event.request, url));
    return;
  }
  
  // Handle GET requests with cache-first strategy
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request)
            .then((response) => {
              // Cache successful responses
              if (response.ok && url.origin === self.location.origin) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, responseToCache));
              }
              return response;
            });
        })
        .catch(() => {
          // Return cached index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        })
    );
  }
});

// ==================== SHARE TARGET HANDLER ====================
async function handleShareTarget(request, originalUrl) {
  console.log('[SW] Processing shared content...');
  
  // Get base path for redirect
  const basePath = originalUrl.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '.';
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('images');
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    
    console.log('[SW] Received files:', files.length);
    console.log('[SW] Title:', title);
    console.log('[SW] Text:', text);
    
    // Convert files to base64
    const imageDataArray = [];
    
    for (const file of files) {
      if (file && file.size > 0) {
        const base64 = await fileToBase64(file);
        imageDataArray.push(base64);
        console.log('[SW] Converted file:', file.name, file.size);
      }
    }
    
    // Store shared data in IndexedDB or pass to client
    if (imageDataArray.length > 0) {
      // Get all clients and send message
      const allClients = await self.clients.matchAll({ includeUncontrolled: true });
      
      for (const client of allClients) {
        client.postMessage({
          type: 'SHARE_TARGET',
          images: imageDataArray,
          title: title,
          text: text,
          url: url
        });
      }
      
      // Also store in a temporary cache for new clients
      await storeSharedData({
        images: imageDataArray,
        title: title,
        text: text,
        url: url,
        timestamp: Date.now()
      });
    }
    
    // Redirect to app with relative path
    return Response.redirect(basePath + '/index.html?shared=true', 303);
    
  } catch (error) {
    console.error('[SW] Share target error:', error);
    return Response.redirect(basePath + '/index.html?error=share_failed', 303);
  }
}

// ==================== HELPERS ====================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== MESSAGE HANDLER ====================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'GET_SHARED_DATA') {
    getSharedData()
      .then((data) => {
        event.ports[0].postMessage({ type: 'SHARED_DATA', data: data });
        // Clear after sending
        if (data) clearSharedData();
      })
      .catch((error) => {
        event.ports[0].postMessage({ type: 'ERROR', error: error.message });
      });
  }
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker loaded');
