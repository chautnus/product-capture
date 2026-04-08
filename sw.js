/**
 * ProductSnap Service Worker
 * Handles: Share Target API, Offline caching, Background sync
 */

const CACHE_NAME = 'productsnap-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json'
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
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
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

// Store shared data in IndexedDB
async function storeSharedData(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProductSnapShare', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('shared')) {
        db.createObjectStore('shared', { keyPath: 'timestamp' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['shared'], 'readwrite');
      const store = transaction.objectStore('shared');
      store.put(data);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Get stored shared data
async function getSharedData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProductSnapShare', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('shared')) {
        resolve(null);
        return;
      }
      
      const transaction = db.transaction(['shared'], 'readonly');
      const store = transaction.objectStore('shared');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const items = getAllRequest.result;
        // Get most recent item
        if (items.length > 0) {
          resolve(items[items.length - 1]);
        } else {
          resolve(null);
        }
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Clear shared data
async function clearSharedData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProductSnapShare', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('shared')) {
        resolve();
        return;
      }
      
      const transaction = db.transaction(['shared'], 'readwrite');
      const store = transaction.objectStore('shared');
      store.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onerror = () => reject(request.error);
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
