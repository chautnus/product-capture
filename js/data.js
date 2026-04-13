// ==================== IMAGE STORE (IndexedDB) ====================
// Bug 1 fix: store images in IndexedDB instead of localStorage
// localStorage limit = 5-10MB; one 4K JPEG base64 = ~5MB → overflow after 1 product
const ImageStore = {
    DB_NAME: 'ProductSnapImages',
    STORE_NAME: 'images',
    VERSION: 1,

    async open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.VERSION);
            req.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(this.STORE_NAME);
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(productId, images) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put(images, productId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async get(productId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(productId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    async delete(productId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).delete(productId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};

// ==================== DATA STORE ====================
let appData = {
    categories: [
        {
            id: 'plants',
            name: { en: 'Plants', vi: 'Cây cảnh' },
            icon: '🌿',
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' },
                { id: 'size', name: { en: 'Size', vi: 'Kích thước' }, type: 'text' },
                { id: 'color', name: { en: 'Color', vi: 'Màu sắc' }, type: 'select', options: ['Red', 'Green', 'White', 'Pink', 'Yellow'] },
                { id: 'has_flowers', name: { en: 'Has Flowers', vi: 'Có hoa' }, type: 'boolean' },
                { id: 'care_level', name: { en: 'Care Level', vi: 'Độ khó chăm sóc' }, type: 'select', options: ['Easy', 'Medium', 'Hard'] },
                { id: 'link', name: { en: 'Link/URL', vi: 'Đường dẫn' }, type: 'url' }
            ]
        },
        {
            id: 'pots',
            name: { en: 'Pots', vi: 'Chậu' },
            icon: '🪴',
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' },
                { id: 'size', name: { en: 'Size', vi: 'Kích thước' }, type: 'text' },
                { id: 'material', name: { en: 'Material', vi: 'Chất liệu' }, type: 'select', options: ['Ceramic', 'Plastic', 'Terracotta', 'Metal'] },
                { id: 'color', name: { en: 'Color', vi: 'Màu sắc' }, type: 'text' }
            ]
        },
        {
            id: 'accessories',
            name: { en: 'Accessories', vi: 'Phụ kiện' },
            icon: '🛠',
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' },
                { id: 'type', name: { en: 'Type', vi: 'Loại' }, type: 'text' },
                { id: 'link', name: { en: 'Link/URL', vi: 'Đường dẫn' }, type: 'url' }
            ]
        }
    ],
    products: []
};

// ==================== SYNC STATE ====================
let syncState = {
    pendingChanges: [],
    deletedIds: { products: [], categories: [] },
    lastSyncTimestamp: 0,
    isSyncing: false
};

// ==================== STORAGE FUNCTIONS ====================
function loadData() {
    const saved = localStorage.getItem('productSnapData');
    if (saved) {
        appData = JSON.parse(saved);
    }

    const savedSync = localStorage.getItem('productSnapSyncState');
    if (savedSync) {
        syncState = JSON.parse(savedSync);
    }
    syncState.isSyncing = false; // S2: never restore a locked sync state from storage

    cleanupOldPendingChanges();

    // Run migration for existing products that have embedded base64 images in localStorage
    migrateImagesToIndexedDB();
}

function saveData() {
    localStorage.setItem('productSnapData', JSON.stringify(appData));
}

function saveSyncState() {
    localStorage.setItem('productSnapSyncState', JSON.stringify(syncState));
    updatePendingBadge();
    updateLastSyncDisplay();
}

function updateLastSyncDisplay() {
    const el = document.getElementById('last-sync-time');
    if (!el) return;
    if (!syncState.lastSyncTimestamp) {
        el.textContent = currentLang === 'vi' ? 'Chưa đồng bộ' : 'Never';
        return;
    }
    const d = new Date(syncState.lastSyncTimestamp);
    el.textContent = d.toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// ==================== MIGRATION: localStorage images → IndexedDB ====================
async function migrateImagesToIndexedDB() {
    let migrated = 0;
    for (const product of appData.products) {
        if (product.images && product.images.length > 0 && product.images[0] && product.images[0].startsWith('data:')) {
            try {
                await ImageStore.put(product.id, product.images);
                product.images = [];
                migrated++;
            } catch (e) {
                console.error('Migration failed for product:', product.id, e);
            }
        }
    }
    if (migrated > 0) {
        saveData();
        showToast(currentLang === 'vi'
            ? `Đã chuyển ảnh của ${migrated} sản phẩm sang bộ nhớ mới`
            : `Migrated ${migrated} product images to local database`);
    }
}

// ==================== PENDING CHANGES MANAGEMENT ====================
const PENDING_EXPIRY_DAYS = 7;

function addToPending(type, data) {
    const change = {
        id: 'change_' + Date.now(),
        type: type,
        data: data,
        timestamp: Date.now(),
        status: 'pending'
    };
    syncState.pendingChanges.push(change);
    saveSyncState();

    if (navigator.onLine && API.url) {
        setTimeout(() => syncPendingToCloud(), 1000);
    }

    return change.id;
}

function removeFromPending(changeId) {
    syncState.pendingChanges = syncState.pendingChanges.filter(c => c.id !== changeId);
    // Note: caller is responsible for calling saveSyncState() after batching
}

function removeFromPendingBatch(changeIds) {
    // P5: batch remove to avoid N DOM updates in sync loop
    const idSet = new Set(changeIds);
    syncState.pendingChanges = syncState.pendingChanges.filter(c => !idSet.has(c.id));
    saveSyncState(); // single save + single DOM update
}

function cleanupOldPendingChanges() {
    const expiryTime = PENDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const oldCount = syncState.pendingChanges.length;
    syncState.pendingChanges = syncState.pendingChanges.filter(c => (now - c.timestamp) < expiryTime);
    if (syncState.pendingChanges.length < oldCount) {
        saveSyncState();
    }
}

function addToDeletedIds(type, id) {
    if (type === 'product' && !syncState.deletedIds.products.includes(id)) {
        syncState.deletedIds.products.push(id);
    } else if (type === 'category' && !syncState.deletedIds.categories.includes(id)) {
        syncState.deletedIds.categories.push(id);
    }
    saveSyncState();
}

function isDeleted(type, id) {
    if (type === 'product') return syncState.deletedIds.products.includes(id);
    if (type === 'category') return syncState.deletedIds.categories.includes(id);
    return false;
}

function updatePendingBadge() {
    const pending = syncState.pendingChanges;
    const count = pending ? pending.length : 0;

    const badge = document.getElementById('pending-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const pendingCountEl = document.getElementById('pending-changes-count');
    if (pendingCountEl) pendingCountEl.textContent = count;

    // Populate pending detail list — O(N) grouping, timestamp captured in forEach
    const listEl = document.getElementById('pending-list');
    if (!listEl) return;
    if (!pending || count === 0) { listEl.innerHTML = ''; return; }

    const grouped = {};
    pending.forEach(c => {
        const key = c.data?.id || c.data?.name || c.id;
        if (!grouped[key]) grouped[key] = { types: [], ts: c.timestamp };
        grouped[key].types.push(c.type);
        if (c.timestamp < grouped[key].ts) grouped[key].ts = c.timestamp;
    });

    listEl.innerHTML = Object.entries(grouped)
        .map(([key, { types, ts }]) =>
            `<li><code>${types.join(' → ')}</code> — ${key} <small>(${new Date(ts).toLocaleTimeString()})</small></li>`)
        .join('');
}
