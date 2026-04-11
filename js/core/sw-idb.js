/**
 * ProductSnap SW — IndexedDB helpers for Share Target data
 * Used via importScripts() in sw.js (global scope, no exports)
 */

// Store shared data in IndexedDB
function storeSharedData(data) {
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
function getSharedData() {
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
function clearSharedData() {
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
