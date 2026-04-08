// ==================== SERVICE WORKER ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Bug A fix: use relative path for GitHub Pages subdirectory
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('SW registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('Phiên bản mới có sẵn. Tải lại?')) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            window.location.reload();
                        }
                    }
                });
            });
        } catch (error) {
            console.log('SW registration failed:', error);
        }
    });

    // Listen for messages from Service Worker (shared images)
    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from SW:', event.data);
        if (event.data.type === 'SHARE_TARGET') {
            handleSharedImages(event.data);
        }
    });
}

// Check for shared images on page load
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
        console.log('App opened via share');
        requestSharedDataFromSW();
        // Bug A fix: use relative path
        window.history.replaceState({}, '', './index.html');
    }
});

// Request shared data from Service Worker
function requestSharedDataFromSW() {
    if (!navigator.serviceWorker.controller) {
        console.log('No SW controller, waiting...');
        navigator.serviceWorker.ready.then(() => {
            setTimeout(requestSharedDataFromSW, 500);
        });
        return;
    }

    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'SHARED_DATA' && event.data.data) {
            handleSharedImages(event.data.data);
        }
    };

    navigator.serviceWorker.controller.postMessage(
        { type: 'GET_SHARED_DATA' },
        [messageChannel.port2]
    );
}

// Handle images shared from other apps (Share Target API)
function handleSharedImages(data) {
    console.log('Handling shared images:', data);

    if (data.images && data.images.length > 0) {
        data.images.forEach(img => {
            if (img && !capturedImages.includes(img)) {
                capturedImages.push(img);
            }
        });

        renderCapturedImages();

        const count = data.images.length;
        const msg = currentLang === 'vi'
            ? `Đã nhận ${count} ảnh từ chia sẻ`
            : `Received ${count} image(s) from share`;
        showToast(msg);

        switchScreen('capture');

        if (data.title && data.title.trim()) {
            setTimeout(() => {
                const nameInput = document.getElementById('product-name-input');
                if (nameInput) {
                    nameInput.value = data.title.trim();
                }
            }, 500);
        }
    }
}

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

// ==================== GOOGLE SHEETS API ====================
const API = {
    url: '', // Will be set by user

    async call(action, data = {}) {
        if (!this.url) {
            console.warn('API URL not configured');
            return null;
        }

        try {
            const response = await fetch(this.url, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain' // Google Apps Script works better with text/plain
                },
                body: JSON.stringify({ action, ...data })
            });

            const text = await response.text();
            console.log('API Response:', text.substring(0, 200));

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON parse error:', e);
                return { success: false, error: 'Invalid JSON response' };
            }
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async get(action, params = {}) {
        if (!this.url) return null;

        const queryString = new URLSearchParams({ action, ...params }).toString();
        try {
            const response = await fetch(`${this.url}?${queryString}`, {
                method: 'GET',
                mode: 'cors',
                redirect: 'follow'
            });

            const text = await response.text();
            console.log('API GET Response:', text.substring(0, 200));

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('JSON parse error:', e);
                return { success: false, error: 'Invalid JSON response' };
            }
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    },

    async ping() { return await this.get('ping'); },
    async syncAll() {
        return await this.call('syncAll', {
            categories: appData.categories,
            products: appData.products
        });
    },
    async saveProduct(product) { return await this.call('saveProduct', { product }); },
    async getProducts(category = 'all') { return await this.get('getData', { category }); },
    async getCategories() { return await this.get('getCategories'); },
    async getProductNames(category = 'all') { return await this.get('getProductNames', { category }); },
    async addProductName(name, category) { return await this.call('addProductName', { name, category }); },
    async syncFields(fields) { return await this.call('syncFields', { fields }); },
    async deleteProduct(id) { return await this.call('deleteProduct', { id }); },
    async saveCategory(category) { return await this.call('saveCategory', { category }); },
    async deleteCategory(id) { return await this.call('deleteCategory', { id }); }
};

// Load API URL from localStorage
API.url = localStorage.getItem('productSnapAPIUrl') || '';

// Product names cache for autocomplete
let productNamesCache = [];

// ==================== TRANSLATIONS ====================
const translations = {
    en: {
        all: "All",
        plants: "🌿 Plants",
        pots: "🪴 Pots",
        accessories: "🛠 Accessories",
        tap_to_start: "Tap to start camera",
        tap_to_use_camera: "Tap to use phone camera",
        select_category: "Select Category",
        save_product: "Save Product",
        no_data: "No data yet",
        all_data: "📁 All Data",
        start_capture: "Start capturing your first product!",
        categories: "Categories",
        google_sheets: "Google Sheets",
        connection_status: "Connection Status",
        not_connected: "Not Connected",
        connected: "Connected ✓",
        connecting: "Connecting...",
        connect_sheets: "Connect Google Sheets",
        export: "Export",
        export_json: "Export as JSON",
        capture: "Capture",
        data: "Data",
        products: "Products",
        settings: "Settings",
        add_field: "Add Field",
        field_name: "Field Name",
        field_type: "Field Type",
        options: "Options (comma separated)",
        add: "Add",
        add_category: "+ Add Category",
        category_name: "Category Name",
        icon: "Icon (emoji)",
        saved: "Saved!",
        synced: "Synced to Google Sheets!",
        sync_failed: "Sync failed",
        product_name: "Product Name",
        price: "Price",
        size: "Size",
        color: "Color",
        has_flowers: "Has Flowers",
        care_level: "Care Level",
        link: "Link/URL",
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        yes: "Yes",
        no: "No",
        enter_value: "Enter value...",
        enter_name: "Enter value...",
        enter_price: "0.00",
        enter_size: "e.g. 15cm, Small...",
        select_value: "Select value",
        select_color: "Select value",
        enter_url: "https://...",
        select_date: "Select date",
        select_time: "Select time",
        red: "Red",
        green: "Green",
        white: "White",
        pink: "Pink",
        yellow: "Yellow",
        add_new_field: "+ Add New Field",
        images: "images",
        api_url: "Apps Script URL",
        test_connection: "Test Connection",
        sync_now: "Sync to Google Sheets",
        sync_from_cloud: "Sync from Cloud",
        local_data: "Local Data",
        products_count: "Products saved",
        clear_data: "Clear All Data",
        confirm_clear: "Are you sure? This will delete all local data!",
        data_cleared: "All data cleared",
        edit_category: "Edit Category",
        fields: "Fields",
        save: "Save",
        confirm_delete: "Confirm Delete",
        cancel: "Cancel",
        delete: "Delete",
        use_phone_camera: "Use Phone Camera",
        take_photo: "Take Photo"
    },
    vi: {
        all: "Tất cả",
        plants: "🌿 Cây cảnh",
        pots: "🪴 Chậu",
        accessories: "🛠 Phụ kiện",
        tap_to_start: "Chạm để bật camera",
        tap_to_use_camera: "Chạm để dùng camera điện thoại",
        select_category: "Chọn danh mục",
        save_product: "Lưu sản phẩm",
        no_data: "Chưa có dữ liệu",
        all_data: "📁 Tất cả dữ liệu",
        start_capture: "Bắt đầu chụp sản phẩm đầu tiên!",
        categories: "Danh mục",
        google_sheets: "Google Sheets",
        connection_status: "Trạng thái kết nối",
        not_connected: "Chưa kết nối",
        connected: "Đã kết nối ✓",
        connecting: "Đang kết nối...",
        connect_sheets: "Kết nối Google Sheets",
        export: "Xuất dữ liệu",
        export_json: "Xuất file JSON",
        capture: "Chụp",
        data: "Dữ liệu",
        products: "Sản phẩm",
        settings: "Cài đặt",
        add_field: "Thêm trường",
        field_name: "Tên trường",
        field_type: "Loại trường",
        options: "Tùy chọn (phân cách bởi dấu phẩy)",
        add: "Thêm",
        add_category: "+ Thêm danh mục",
        category_name: "Tên danh mục",
        icon: "Biểu tượng (emoji)",
        saved: "Đã lưu!",
        synced: "Đã đồng bộ lên Google Sheets!",
        sync_failed: "Đồng bộ thất bại",
        product_name: "Tên sản phẩm",
        price: "Giá",
        size: "Kích thước",
        color: "Màu sắc",
        has_flowers: "Có hoa",
        care_level: "Độ khó chăm sóc",
        link: "Đường dẫn/URL",
        easy: "Dễ",
        medium: "Trung bình",
        hard: "Khó",
        yes: "Có",
        no: "Không",
        enter_value: "Nhập giá trị...",
        enter_name: "Nhập giá trị...",
        enter_price: "0",
        enter_size: "VD: 15cm, Nhỏ...",
        select_value: "Chọn giá trị",
        select_color: "Chọn giá trị",
        enter_url: "https://...",
        select_date: "Chọn ngày",
        select_time: "Chọn giờ",
        red: "Đỏ",
        green: "Xanh lá",
        white: "Trắng",
        pink: "Hồng",
        yellow: "Vàng",
        add_new_field: "+ Thêm trường mới",
        images: "ảnh",
        api_url: "URL Apps Script",
        test_connection: "Kiểm tra kết nối",
        sync_now: "Đồng bộ lên Google Sheets",
        sync_from_cloud: "Đồng bộ từ Cloud",
        local_data: "Dữ liệu cục bộ",
        products_count: "Sản phẩm đã lưu",
        clear_data: "Xóa tất cả dữ liệu",
        confirm_clear: "Bạn chắc chắn? Thao tác này sẽ xóa toàn bộ dữ liệu!",
        data_cleared: "Đã xóa tất cả dữ liệu",
        edit_category: "Sửa danh mục",
        fields: "Các trường",
        save: "Lưu",
        confirm_delete: "Xác nhận xóa",
        cancel: "Hủy",
        delete: "Xóa",
        use_phone_camera: "Dùng Camera điện thoại",
        take_photo: "Chụp ảnh"
    }
};

let currentLang = 'en';

function t(key) {
    return translations[currentLang][key] || key;
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT') {
            el.placeholder = t(key);
        } else {
            el.textContent = t(key);
        }
    });
    renderCategories();
    renderDynamicForm();
    renderProducts();
}

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

let selectedCategory = null;
let capturedImages = [];
let cameraStream = null;
let facingMode = 'environment';

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
    saveSyncState();
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
    const badge = document.getElementById('pending-badge');
    const count = syncState.pendingChanges.length;
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    const pendingCountEl = document.getElementById('pending-changes-count');
    if (pendingCountEl) {
        pendingCountEl.textContent = count;
    }
}

// ==================== AUTO-SYNC ====================
function setupAutoSync() {
    window.addEventListener('online', () => {
        console.log('Online - auto syncing pending changes...');
        showToast(currentLang === 'vi' ? 'Đã có mạng - đang đồng bộ...' : 'Online - syncing...');
        syncPendingToCloud();
    });

    window.addEventListener('offline', () => {
        console.log('Offline');
        showToast(currentLang === 'vi' ? 'Mất kết nối mạng' : 'You are offline');
    });

    if (navigator.onLine && API.url && syncState.pendingChanges.length > 0) {
        setTimeout(() => syncPendingToCloud(), 2000);
    }
}

// ==================== CAMERA ====================
async function startCamera() {
    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 4096, min: 1920 },
                height: { ideal: 2160, min: 1080 },
                aspectRatio: { ideal: 4/3 }
            },
            audio: false
        });

        const preview = document.getElementById('camera-preview');
        preview.srcObject = cameraStream;
        document.getElementById('camera-placeholder').style.display = 'none';
        document.getElementById('stop-camera').style.display = 'flex';
    } catch (err) {
        console.error('Camera error:', err);
        alert('Could not access camera. Please check permissions.');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const preview = document.getElementById('camera-preview');
    preview.srcObject = null;
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('stop-camera').style.display = 'none';
}

function captureImage() {
    if (!cameraStream) {
        alert(currentLang === 'vi' ? 'Vui lòng bật camera trước' : 'Please start camera first');
        return;
    }

    const preview = document.getElementById('camera-preview');
    const canvas = document.getElementById('capture-canvas');

    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(preview, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    capturedImages.push(imageData);
    renderCapturedImages();
}

function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
}

function renderCapturedImages() {
    const container = document.getElementById('captured-images');
    container.innerHTML = capturedImages.map((img, idx) => `
        <div class="captured-img">
            <img src="${img}" alt="Captured ${idx + 1}">
            <button class="remove-btn" onclick="removeImage(${idx})">×</button>
        </div>
    `).join('') + `<button class="add-image-btn" id="add-from-gallery">+</button>`;

    document.getElementById('add-from-gallery').onclick = () => {
        document.getElementById('gallery-input').click();
    };
}

function removeImage(idx) {
    capturedImages.splice(idx, 1);
    renderCapturedImages();
}

// ==================== CATEGORIES ====================
function renderCategories() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = appData.categories.map(cat => `
        <div class="category-card ${selectedCategory === cat.id ? 'selected' : ''}"
             onclick="selectCategory('${cat.id}')">
            <div class="icon">${cat.icon}</div>
            <div class="name">${cat.name[currentLang] || cat.name.en}</div>
        </div>
    `).join('');
}

function selectCategory(catId) {
    selectedCategory = catId;
    renderCategories();
    renderDynamicForm();
    loadProductNames();
}

async function loadProductNames() {
    const localNames = appData.products
        .filter(p => !selectedCategory || p.category === selectedCategory)
        .map(p => ({ id: p.id, name: p.data?.name || '', category: p.category }))
        .filter(item => item.name);

    const uniqueNames = new Map();
    localNames.forEach(item => {
        if (!uniqueNames.has(item.name.toLowerCase())) {
            uniqueNames.set(item.name.toLowerCase(), item);
        }
    });

    productNamesCache = Array.from(uniqueNames.values());

    if (API.url && selectedCategory) {
        try {
            const result = await API.getProductNames(selectedCategory);
            if (result && result.success && result.names) {
                result.names.forEach(item => {
                    if (!uniqueNames.has(item.name.toLowerCase())) {
                        uniqueNames.set(item.name.toLowerCase(), item);
                        productNamesCache.push(item);
                    }
                });
            }
        } catch (e) {
            console.log('Could not load product names from cloud:', e);
        }
    }
}

// ==================== DYNAMIC FORM ====================
function renderDynamicForm() {
    const container = document.getElementById('dynamic-form');

    if (!selectedCategory) {
        container.innerHTML = '';
        return;
    }

    const category = appData.categories.find(c => c.id === selectedCategory);
    if (!category) return;

    let html = category.fields.map(field => {
        const fieldName = field.name[currentLang] || field.name.en || field.name;
        const required = field.required ? ' <span style="color: var(--danger);">*</span>' : '';

        switch (field.type) {
            case 'text':
                if (field.id === 'name') {
                    return `
                        <div class="form-group" style="position: relative;">
                            <label class="form-label">${fieldName}${required}</label>
                            <input type="text" class="form-input" data-field="${field.id}"
                                   id="product-name-input"
                                   placeholder="${t('enter_value')}"
                                   autocomplete="off"
                                   oninput="showNameSuggestions(this.value)">
                            <div id="name-suggestions" class="autocomplete-dropdown" style="display: none;"></div>
                            <button type="button" id="add-new-name-btn" class="btn-add-new" style="display: none;" onclick="addNewProductName()">
                                + ${currentLang === 'vi' ? 'Tạo mới' : 'Create new'}
                            </button>
                        </div>
                    `;
                }
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="text" class="form-input" data-field="${field.id}"
                               placeholder="${t('enter_value')}">
                    </div>
                `;
            case 'number':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="number" class="form-input" data-field="${field.id}"
                               placeholder="${t('enter_price')}" step="0.01">
                    </div>
                `;
            case 'url':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="url" class="form-input" data-field="${field.id}"
                               placeholder="${t('enter_url')}">
                    </div>
                `;
            case 'date':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="date" class="form-input" data-field="${field.id}">
                    </div>
                `;
            case 'time':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="time" class="form-input" data-field="${field.id}">
                    </div>
                `;
            case 'datetime':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <input type="datetime-local" class="form-input" data-field="${field.id}">
                    </div>
                `;
            case 'boolean':
                return `
                    <div class="toggle-group">
                        <span class="toggle-label">${fieldName}</span>
                        <div class="toggle" data-field="${field.id}" onclick="toggleBoolean(this)"></div>
                    </div>
                `;
            case 'select':
                return `
                    <div class="form-group">
                        <label class="form-label">${fieldName}${required}</label>
                        <div class="select-wrapper">
                            <select class="form-select" data-field="${field.id}">
                                <option value="">${t('select_value')}</option>
                                ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `;
            default:
                return '';
        }
    }).join('');

    html += `
        <div style="margin: 16px 0;">
            <button class="btn btn-secondary" onclick="openModal('modal-add-field')">
                ${t('add_new_field')}
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function toggleBoolean(el) {
    el.classList.toggle('active');
}

// ==================== AUTOCOMPLETE ====================
let autocompleteTimeout = null;

function showNameSuggestions(value) {
    const dropdown = document.getElementById('name-suggestions');
    const addBtn = document.getElementById('add-new-name-btn');

    if (!dropdown) return;

    if (autocompleteTimeout) clearTimeout(autocompleteTimeout);

    if (!value || value.length < 1) {
        dropdown.style.display = 'none';
        addBtn.style.display = 'none';
        return;
    }

    autocompleteTimeout = setTimeout(() => {
        const searchValue = value.toLowerCase();
        const matches = productNamesCache.filter(item =>
            item.name.toLowerCase().includes(searchValue)
        );

        if (matches.length > 0) {
            dropdown.innerHTML = matches.slice(0, 10).map(item => `
                <div class="autocomplete-item" onclick="selectProductName('${item.name.replace(/'/g, "\\'")}')">
                    ${item.name}
                    <span class="category-tag">${item.category || ''}</span>
                </div>
            `).join('');
            dropdown.style.display = 'block';
            addBtn.style.display = 'none';
        } else {
            dropdown.style.display = 'none';
            addBtn.style.display = 'block';
            addBtn.innerHTML = `+ ${currentLang === 'vi' ? 'Tạo mới' : 'Create'}: "${value}"`;
        }
    }, 200);
}

function selectProductName(name) {
    const input = document.getElementById('product-name-input');
    if (input) input.value = name;
    document.getElementById('name-suggestions').style.display = 'none';
    document.getElementById('add-new-name-btn').style.display = 'none';
}

async function addNewProductName() {
    const input = document.getElementById('product-name-input');
    if (!input || !input.value.trim()) return;

    const name = input.value.trim();

    productNamesCache.push({ id: 'local_' + Date.now(), name: name, category: selectedCategory });

    if (API.url) {
        API.addProductName(name, selectedCategory).then(result => {
            console.log('Added product name:', result);
        });
    }

    document.getElementById('add-new-name-btn').style.display = 'none';
    showToast(currentLang === 'vi' ? 'Đã thêm tên mới' : 'Name added');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#product-name-input') && !e.target.closest('#name-suggestions')) {
        const dropdown = document.getElementById('name-suggestions');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// ==================== PRODUCTS ====================

/**
 * Bug fixes applied:
 * - Bug 1: Images stored in IndexedDB via ImageStore (not localStorage)
 * - Bug 2: try/finally ensures button always re-enables even if exception occurs
 * - Bug 4: Form cleared AFTER save succeeds (not before)
 * - Bug 5: Required name field validated before saving
 */
async function saveProduct() {
    if (!selectedCategory) {
        alert(currentLang === 'vi' ? 'Vui lòng chọn danh mục' : 'Please select a category');
        return;
    }

    if (capturedImages.length === 0) {
        alert(currentLang === 'vi' ? 'Vui lòng chụp ít nhất 1 ảnh' : 'Please capture at least one image');
        return;
    }

    // Bug 5: Validate required name field
    const nameInput = document.getElementById('product-name-input');
    if (nameInput && !nameInput.value.trim()) {
        alert(currentLang === 'vi' ? 'Vui lòng nhập tên sản phẩm' : 'Please enter a product name');
        nameInput.focus();
        return;
    }

    const saveBtn = document.getElementById('save-product');

    // Bug 2: try/finally ensures button always re-enables
    try {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.textContent = currentLang === 'vi' ? 'Đang lưu...' : 'Saving...';

        const formData = {};
        document.querySelectorAll('#dynamic-form [data-field]').forEach(el => {
            const fieldId = el.getAttribute('data-field');
            if (el.classList.contains('toggle')) {
                formData[fieldId] = el.classList.contains('active');
            } else {
                formData[fieldId] = el.value;
            }
        });

        const productId = 'prod_' + Date.now().toString();
        const imagesSnapshot = [...capturedImages]; // snapshot before clearing

        const product = {
            id: productId,
            category: selectedCategory,
            images: [], // will be loaded from ImageStore on demand
            data: formData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Bug 1: Store images in IndexedDB (no localStorage quota issues)
        await ImageStore.put(productId, imagesSnapshot);

        // Save product metadata to localStorage (images: [] keeps it small)
        appData.products.unshift(product);
        saveData();
        updateLocalDataCount();

        // Queue for cloud sync — include images for upload
        // Images are loaded from ImageStore during sync (not stored in syncState)
        addToPending('CREATE_PRODUCT', { ...product, _pendingWithImages: true });

        // Bug 4: Reset form ONLY after save succeeds
        capturedImages = [];
        renderCapturedImages();

        document.querySelectorAll('#dynamic-form [data-field]').forEach(el => {
            if (el.classList.contains('toggle')) {
                el.classList.remove('active');
            } else {
                el.value = '';
            }
        });

        const suggestionsEl = document.getElementById('name-suggestions');
        if (suggestionsEl) suggestionsEl.style.display = 'none';
        const addNewBtn = document.getElementById('add-new-name-btn');
        if (addNewBtn) addNewBtn.style.display = 'none';

        showToast(t('saved'));

    } catch (err) {
        console.error('Save failed:', err);
        alert((currentLang === 'vi' ? 'Lưu thất bại: ' : 'Save failed: ') + err.message);
    } finally {
        // Bug 2: Always re-enable button regardless of success or failure
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.textContent = t('save_product');
    }
}

async function renderProducts(filter = 'all') {
    const container = document.getElementById('products-list');
    const emptyState = document.getElementById('empty-products');

    let products = appData.products;
    if (filter !== 'all') {
        products = products.filter(p => p.category === filter);
    }

    if (products.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Group products by category then by product name
    const grouped = {};
    products.forEach(product => {
        const catId = product.category || 'uncategorized';
        const productName = product.data.name || 'Unnamed';
        if (!grouped[catId]) grouped[catId] = {};
        if (!grouped[catId][productName]) grouped[catId][productName] = [];
        grouped[catId][productName].push(product);
    });

    const summaryEl = document.getElementById('data-summary');
    if (summaryEl) {
        const catCount = Object.keys(grouped).length;
        const totalProducts = products.length;
        summaryEl.textContent = currentLang === 'vi'
            ? `${catCount} danh mục • ${totalProducts} mục`
            : `${catCount} categories • ${totalProducts} items`;
    }

    const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="#666" font-size="30">📷</text></svg>');

    let html = '';

    Object.keys(grouped).forEach(catId => {
        const category = appData.categories.find(c => c.id === catId);
        const catName = category ? (category.name[currentLang] || category.name.en) : catId;
        const catIcon = category?.icon || '📁';
        const productNames = Object.keys(grouped[catId]);
        const itemCount = Object.values(grouped[catId]).flat().length;

        html += `
            <div class="folder-category" style="margin-bottom: 16px;">
                <div class="folder-header" style="display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--bg-card); border-radius: var(--radius-sm); margin-bottom: 8px;">
                    <span style="font-size: 1.5rem;">${catIcon}</span>
                    <span style="flex: 1; font-weight: 600;">${catName}</span>
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">${itemCount} items</span>
                </div>
        `;

        productNames.forEach(productName => {
            const items = grouped[catId][productName];
            items.forEach(product => {
                const price = product.data.price
                    ? (currentLang === 'vi' ? `${product.data.price}đ` : `$${product.data.price}`)
                    : '';

                html += `
                    <div class="product-card" onclick="showProductDetail('${product.id}')" style="cursor: pointer;">
                        <img src="${PLACEHOLDER}" class="product-thumb" alt="${productName}" id="thumb-${product.id}">
                        <div class="product-info">
                            <div class="product-name">${productName}</div>
                            <div class="product-meta">
                                <span class="product-images-count" id="img-count-${product.id}">📷 ...</span>
                                ${price ? ` • ${price}` : ''}
                            </div>
                        </div>
                        <div style="color: var(--text-secondary);">›</div>
                    </div>
                `;
            });
        });

        html += `</div>`;
    });

    container.innerHTML = html;

    // Lazy-load thumbnails from IndexedDB (non-blocking)
    for (const product of products) {
        ImageStore.get(product.id).then(images => {
            const thumbEl = document.getElementById(`thumb-${product.id}`);
            const countEl = document.getElementById(`img-count-${product.id}`);
            if (thumbEl && images && images[0]) {
                thumbEl.src = images[0];
            }
            if (countEl) {
                countEl.textContent = `📷 ${images ? images.length : 0}`;
            }
        }).catch(() => {});
    }
}

async function showProductDetail(productId) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return;

    const category = appData.categories.find(c => c.id === product.category);
    const fields = category?.fields || [];

    // Load images from IndexedDB
    let images = [];
    try {
        images = await ImageStore.get(productId);
    } catch (e) {
        images = [];
    }

    let detailHtml = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;">
                ${images.length > 0
                    ? images.map((img, i) => `
                        <img src="${img}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; flex-shrink: 0;" alt="Image ${i+1}">
                    `).join('')
                    : '<p style="color: var(--text-secondary); padding: 12px;">No images</p>'
                }
            </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            ${fields.map(field => {
                const fieldName = field.name[currentLang] || field.name.en || field.name;
                let value = product.data[field.id];

                if (field.type === 'boolean') {
                    value = value ? '✅ ' + t('yes') : '❌ ' + t('no');
                } else if (!value) {
                    value = '-';
                }

                return `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 12px 8px; color: var(--text-secondary); width: 40%;">${fieldName}</td>
                        <td style="padding: 12px 8px; font-weight: 500;">${value}</td>
                    </tr>
                `;
            }).join('')}
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 8px; color: var(--text-secondary);">${currentLang === 'vi' ? 'Ngày tạo' : 'Created'}</td>
                <td style="padding: 12px 8px;">${new Date(product.createdAt).toLocaleDateString()}</td>
            </tr>
        </table>
    `;

    let modal = document.getElementById('modal-product-detail');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-product-detail';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <span class="modal-title" id="detail-title"></span>
                    <button class="modal-close" onclick="closeModal('modal-product-detail')">×</button>
                </div>
                <div id="detail-content"></div>
                <div style="margin-top: 16px; display: flex; gap: 10px;">
                    <button class="btn btn-secondary" style="flex: 1; border-color: var(--danger); color: var(--danger);" id="detail-delete-btn">${t('delete')}</button>
                    <button class="btn btn-primary" style="flex: 1;" onclick="closeModal('modal-product-detail')">${currentLang === 'vi' ? 'Đóng' : 'Close'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('detail-title').textContent = product.data.name || 'Product Details';
    document.getElementById('detail-content').innerHTML = detailHtml;
    document.getElementById('detail-delete-btn').onclick = () => confirmDeleteProduct(productId);
    openModal('modal-product-detail');
}

// ==================== SETTINGS ====================
function renderCategoriesSettings() {
    const container = document.getElementById('categories-settings');
    container.innerHTML = appData.categories.map(cat => `
        <div class="category-item">
            <div class="category-item-header">
                <span class="category-item-name">
                    <span style="font-size: 1.3rem;">${cat.icon}</span>
                    <span>${cat.name[currentLang] || cat.name.en}</span>
                </span>
                <div class="category-item-actions">
                    <button class="btn-icon" onclick="openEditCategory('${cat.id}')" title="Edit">✏️</button>
                    <button class="btn-icon danger" onclick="confirmDeleteCategory('${cat.id}')" title="Delete">🗑️</button>
                </div>
            </div>
            <div class="category-item-fields">
                ${cat.fields.map(f => `
                    <span class="field-tag type-${f.type}">${f.name[currentLang] || f.name.en || f.name}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

let editingCategoryId = null;

function openEditCategory(catId) {
    const category = appData.categories.find(c => c.id === catId);
    if (!category) return;

    editingCategoryId = catId;
    document.getElementById('edit-category-id').value = catId;
    document.getElementById('edit-category-name').value = category.name.en || '';
    document.getElementById('edit-category-name-vi').value = category.name.vi || '';
    document.getElementById('edit-category-icon').value = category.icon || '';

    renderEditCategoryFields(category);
    openModal('modal-edit-category');
}

function renderEditCategoryFields(category) {
    const container = document.getElementById('edit-category-fields');
    container.innerHTML = category.fields.map((f, idx) => `
        <span class="field-item">
            <span class="field-tag type-${f.type}" style="margin: 0;">${f.name[currentLang] || f.name.en || f.name}</span>
            <button class="remove-field" onclick="removeFieldFromCategory(${idx})">×</button>
        </span>
    `).join('');
}

function removeFieldFromCategory(fieldIndex) {
    const category = appData.categories.find(c => c.id === editingCategoryId);
    if (!category) return;

    if (category.fields[fieldIndex].id === 'name') {
        alert(currentLang === 'vi' ? 'Không thể xóa trường "Tên sản phẩm"' : 'Cannot remove "Product Name" field');
        return;
    }

    category.fields.splice(fieldIndex, 1);
    saveData();
    renderEditCategoryFields(category);
}

function openAddFieldToCategory() {
    closeModal('modal-edit-category');
    selectedCategory = editingCategoryId;
    openModal('modal-add-field');
}

function confirmDeleteCategory(catId) {
    const category = appData.categories.find(c => c.id === catId);
    if (!category) return;

    const catName = category.name[currentLang] || category.name.en;
    const message = currentLang === 'vi'
        ? `Bạn có chắc muốn xóa danh mục "${catName}"? Các sản phẩm trong danh mục này sẽ được chuyển sang "Chưa phân loại".`
        : `Are you sure you want to delete category "${catName}"? Products will be moved to "Uncategorized".`;

    document.getElementById('delete-confirm-message').textContent = message;
    document.getElementById('delete-item-id').value = catId;
    document.getElementById('delete-item-type').value = 'category';
    openModal('modal-confirm-delete');
}

function deleteCategory(catId) {
    const index = appData.categories.findIndex(c => c.id === catId);
    if (index > -1) {
        appData.categories.splice(index, 1);
        addToDeletedIds('category', catId);
        addToPending('DELETE_CATEGORY', { id: catId, timestamp: Date.now() });
        saveData();
        renderCategoriesSettings();
        renderCategories();
        showToast(currentLang === 'vi' ? 'Đã xóa danh mục' : 'Category deleted');
    }
}

function confirmDeleteProduct(productId) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return;

    const productName = product.data?.name || productId;
    const message = currentLang === 'vi'
        ? `Bạn có chắc muốn xóa sản phẩm "${productName}"?`
        : `Are you sure you want to delete product "${productName}"?`;

    document.getElementById('delete-confirm-message').textContent = message;
    document.getElementById('delete-item-id').value = productId;
    document.getElementById('delete-item-type').value = 'product';
    openModal('modal-confirm-delete');
}

function deleteProductById(productId) {
    const index = appData.products.findIndex(p => p.id === productId);
    if (index > -1) {
        appData.products.splice(index, 1);
        addToDeletedIds('product', productId);
        addToPending('DELETE_PRODUCT', { id: productId, timestamp: Date.now() });
        saveData();
        renderProducts();
        updateLocalDataCount();
        closeModal('modal-product-detail');
        showToast(currentLang === 'vi' ? 'Đã xóa sản phẩm' : 'Product deleted');

        // Bug 1 fix: also remove images from IndexedDB
        ImageStore.delete(productId).catch(e => console.error('Failed to delete images:', e));
    }
}

// ==================== MODALS ====================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ==================== NAVIGATION ====================
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-screen="${screenId}"]`).classList.add('active');

    if (screenId === 'products') {
        renderProducts();
    } else if (screenId === 'settings') {
        renderCategoriesSettings();
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Language switch
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.getAttribute('data-lang');
            updateTranslations();
        });
    });

    // Camera
    document.getElementById('camera-placeholder').addEventListener('click', startCamera);
    document.getElementById('capture-btn').addEventListener('click', captureImage);
    document.getElementById('switch-camera').addEventListener('click', switchCamera);
    document.getElementById('stop-camera').addEventListener('click', stopCamera);
    document.getElementById('stop-camera').style.display = 'none';

    // Gallery input
    document.getElementById('gallery-input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                capturedImages.push(ev.target.result);
                renderCapturedImages();
            };
            reader.readAsDataURL(file);
        });
    });

    // Native camera input
    document.getElementById('native-camera-input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                capturedImages.push(ev.target.result);
                renderCapturedImages();
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    });

    // Save product
    document.getElementById('save-product').addEventListener('click', saveProduct);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchScreen(item.getAttribute('data-screen'));
        });
    });

    // Add field modal
    document.getElementById('new-field-type').addEventListener('change', (e) => {
        document.getElementById('select-options-group').style.display =
            e.target.value === 'select' ? 'block' : 'none';
    });

    document.getElementById('confirm-add-field').addEventListener('click', () => {
        const name = document.getElementById('new-field-name').value.trim();
        const type = document.getElementById('new-field-type').value;
        const options = document.getElementById('new-field-options').value.split(',').map(o => o.trim()).filter(o => o);

        if (!name || !selectedCategory) return;

        const category = appData.categories.find(c => c.id === selectedCategory);
        if (category) {
            const newField = {
                id: name.toLowerCase().replace(/\s+/g, '_'),
                name: { en: name, vi: name },
                type: type
            };
            if (type === 'select') newField.options = options;
            category.fields.push(newField);
            saveData();
            closeModal('modal-add-field');

            document.getElementById('new-field-name').value = '';
            document.getElementById('new-field-options').value = '';

            if (editingCategoryId) {
                renderEditCategoryFields(category);
                openModal('modal-edit-category');
            } else {
                renderDynamicForm();
            }
        }
    });

    // Add category modal
    document.getElementById('add-category').addEventListener('click', () => {
        openModal('modal-add-category');
    });

    document.getElementById('confirm-add-category').addEventListener('click', () => {
        const nameEn = document.getElementById('new-category-name').value.trim();
        const nameVi = document.getElementById('new-category-name-vi').value.trim() || nameEn;
        const icon = document.getElementById('new-category-icon').value.trim() || '📦';

        if (!nameEn) return;

        const newCategory = {
            id: nameEn.toLowerCase().replace(/\s+/g, '_'),
            name: { en: nameEn, vi: nameVi },
            icon: icon,
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' }
            ]
        };

        appData.categories.push(newCategory);
        saveData();
        renderCategories();
        renderCategoriesSettings();
        closeModal('modal-add-category');
        showToast(currentLang === 'vi' ? 'Đã thêm danh mục' : 'Category added');

        document.getElementById('new-category-name').value = '';
        document.getElementById('new-category-name-vi').value = '';
        document.getElementById('new-category-icon').value = '';
    });

    // Edit category - save button
    document.getElementById('confirm-edit-category').addEventListener('click', () => {
        const catId = document.getElementById('edit-category-id').value;
        const category = appData.categories.find(c => c.id === catId);
        if (!category) return;

        category.name.en = document.getElementById('edit-category-name').value.trim() || category.name.en;
        category.name.vi = document.getElementById('edit-category-name-vi').value.trim() || category.name.vi;
        category.icon = document.getElementById('edit-category-icon').value.trim() || category.icon;

        saveData();
        renderCategories();
        renderCategoriesSettings();
        closeModal('modal-edit-category');
        showToast(currentLang === 'vi' ? 'Đã lưu thay đổi' : 'Changes saved');
    });

    // Confirm delete button
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        const itemId = document.getElementById('delete-item-id').value;
        const itemType = document.getElementById('delete-item-type').value;

        if (itemType === 'category') {
            deleteCategory(itemId);
        } else if (itemType === 'product') {
            deleteProductById(itemId);
        }

        closeModal('modal-confirm-delete');
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // Initial render
    renderCategories();
    renderCapturedImages();

    // Load saved API URL
    const savedApiUrl = localStorage.getItem('productSnapAPIUrl');
    if (savedApiUrl) {
        document.getElementById('api-url-input').value = savedApiUrl;
        updateConnectionStatus();
    }

    // Test connection button
    document.getElementById('test-connection').addEventListener('click', async () => {
        const urlInput = document.getElementById('api-url-input');
        const url = urlInput.value.trim();

        if (!url) {
            alert('Please enter the Apps Script URL');
            return;
        }

        localStorage.setItem('productSnapAPIUrl', url);
        API.url = url;

        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = t('connecting');
        statusEl.className = 'field-tag type-boolean';

        try {
            const result = await API.ping();
            if (result && result.success) {
                statusEl.textContent = t('connected');
                statusEl.className = 'field-tag type-boolean';
                statusEl.style.borderLeftColor = 'var(--success)';
                document.getElementById('sync-now').style.display = 'block';
                document.getElementById('sync-from-cloud').style.display = 'block';
                showToast(t('connected'));
            } else {
                throw new Error('Connection failed');
            }
        } catch (e) {
            statusEl.textContent = t('not_connected');
            statusEl.className = 'field-tag type-boolean';
            statusEl.style.borderLeftColor = 'var(--danger)';
            document.getElementById('sync-now').style.display = 'none';
            document.getElementById('sync-from-cloud').style.display = 'none';
            showToast(t('sync_failed'));
        }
    });

    // Bug 3 fix: Only ONE listener on sync-now (removed the duplicate that called API.syncAll())
    document.getElementById('sync-now').addEventListener('click', async () => {
        const btn = document.getElementById('sync-now');
        btn.disabled = true;
        btn.textContent = currentLang === 'vi' ? 'Đang đồng bộ...' : 'Syncing...';

        try {
            const result = await syncPendingToCloud();
            if (result.synced > 0) {
                showToast(currentLang === 'vi'
                    ? `Đã đồng bộ ${result.synced} thay đổi!`
                    : `Synced ${result.synced} changes!`);
            } else if (syncState.pendingChanges.length === 0) {
                showToast(currentLang === 'vi' ? 'Không có thay đổi cần đồng bộ' : 'No pending changes');
            }
        } catch (e) {
            console.error('Sync to cloud failed:', e);
            showToast(t('sync_failed'));
        }

        btn.disabled = false;
        btn.textContent = t('sync_now');
    });

    // Sync from cloud button
    document.getElementById('sync-from-cloud').addEventListener('click', async () => {
        const btn = document.getElementById('sync-from-cloud');
        btn.disabled = true;
        btn.textContent = currentLang === 'vi' ? 'Đang tải...' : 'Loading...';

        try {
            await syncFromCloud();
            showToast(currentLang === 'vi' ? 'Đã đồng bộ từ Cloud!' : 'Synced from Cloud!');
        } catch (e) {
            console.error('Sync from cloud failed:', e);
            showToast(t('sync_failed'));
        }

        btn.disabled = false;
        btn.textContent = t('sync_from_cloud');
    });

    // Export JSON button
    document.getElementById('export-json').addEventListener('click', () => {
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `productsnap_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Clear data button
    document.getElementById('clear-data').addEventListener('click', () => {
        if (confirm(t('confirm_clear'))) {
            appData = { categories: appData.categories, products: [] };
            saveData();
            renderProducts();
            updateLocalDataCount();
            showToast(t('data_cleared'));
        }
    });

    updateLocalDataCount();
    updatePendingBadge();
    setupAutoSync();
});

// ==================== SYNC FUNCTIONS ====================

async function syncPendingToCloud() {
    if (syncState.isSyncing) {
        console.log('Already syncing, skipping...');
        return { synced: 0, failed: 0 };
    }

    if (!API.url) {
        console.log('API not configured');
        return { synced: 0, failed: 0 };
    }

    if (syncState.pendingChanges.length === 0) {
        console.log('No pending changes');
        return { synced: 0, failed: 0 };
    }

    syncState.isSyncing = true;
    let synced = 0;
    let failed = 0;

    const pendingCopy = [...syncState.pendingChanges];

    for (const change of pendingCopy) {
        try {
            let result = null;

            switch (change.type) {
                case 'CREATE_PRODUCT': {
                    // Load real images from IndexedDB for upload
                    const images = await ImageStore.get(change.data.id);
                    result = await API.saveProduct({ ...change.data, images });
                    break;
                }
                case 'DELETE_PRODUCT':
                    result = await API.deleteProduct(change.data.id);
                    break;
                case 'CREATE_CATEGORY':
                case 'UPDATE_CATEGORY':
                    result = await API.saveCategory(change.data);
                    break;
                case 'DELETE_CATEGORY':
                    result = await API.deleteCategory(change.data.id);
                    break;
            }

            if (result && result.success) {
                removeFromPending(change.id);
                synced++;
                console.log(`Synced: ${change.type} - ${change.data.id || change.data.name}`);
            } else {
                failed++;
                console.log(`Failed: ${change.type}`, result);
            }
        } catch (e) {
            failed++;
            console.error(`Error syncing ${change.type}:`, e);
        }
    }

    syncState.isSyncing = false;
    syncState.lastSyncTimestamp = Date.now();
    saveSyncState();

    return { synced, failed };
}

async function syncFromCloud() {
    if (!API.url) throw new Error('API not configured');

    const catResult = await API.getCategories();
    if (catResult && catResult.success && catResult.categories) {
        mergeCategories(catResult.categories);
    }

    const prodResult = await API.getProducts('all');
    if (prodResult && prodResult.success && prodResult.products) {
        mergeProducts(prodResult.products);
    }

    syncState.lastSyncTimestamp = Date.now();
    saveSyncState();
    saveData();

    renderCategories();
    renderCategoriesSettings();
    renderProducts();
    updateLocalDataCount();
}

function mergeCategories(cloudCategories) {
    const localMap = new Map(appData.categories.map(c => [c.id, c]));

    cloudCategories.forEach(cloudCat => {
        if (isDeleted('category', cloudCat.id)) return;

        const localCat = localMap.get(cloudCat.id);

        if (!localCat) {
            appData.categories.push(cloudCat);
        } else {
            const cloudTime = new Date(cloudCat.updatedAt || cloudCat.createdAt || 0).getTime();
            const localTime = new Date(localCat.updatedAt || localCat.createdAt || 0).getTime();
            if (cloudTime > localTime) {
                Object.assign(localCat, cloudCat);
            }
        }
    });
}

function mergeProducts(cloudProducts) {
    const localMap = new Map(appData.products.map(p => [p.id, p]));

    cloudProducts.forEach(cloudProd => {
        if (isDeleted('product', cloudProd.id)) return;

        const localProd = localMap.get(cloudProd.id);

        if (!localProd) {
            // Cloud product has image URLs (not base64), store as-is with empty local images
            appData.products.push({ ...cloudProd, images: [] });
        } else {
            const cloudTime = new Date(cloudProd.updatedAt || cloudProd.createdAt || 0).getTime();
            const localTime = new Date(localProd.updatedAt || localProd.createdAt || 0).getTime();
            if (cloudTime > localTime) {
                const index = appData.products.findIndex(p => p.id === cloudProd.id);
                if (index > -1) {
                    appData.products[index] = { ...cloudProd, images: [] };
                }
            }
        }
    });
}

function updateConnectionStatus() {
    const url = localStorage.getItem('productSnapAPIUrl');
    if (url) {
        API.url = url;
        API.ping().then(result => {
            const statusEl = document.getElementById('connection-status');
            if (result && result.success) {
                statusEl.textContent = t('connected');
                statusEl.style.borderLeftColor = 'var(--success)';
                document.getElementById('sync-now').style.display = 'block';
                document.getElementById('sync-from-cloud').style.display = 'block';
            }
        });
    }
}

function updateLocalDataCount() {
    const countEl = document.getElementById('local-products-count');
    if (countEl) {
        countEl.textContent = appData.products.length;
    }
}
