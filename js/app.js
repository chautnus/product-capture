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
        productSearchTerm = '';
        const searchInput = document.getElementById('product-search-input');
        if (searchInput) searchInput.value = '';
        renderProducts();
    } else if (screenId === 'settings') {
        renderCategoriesSettings();
    }
}

// ==================== EVENT LISTENERS ====================

function initNavListeners() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.getAttribute('data-lang');
            updateTranslations();
        });
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchScreen(item.getAttribute('data-screen')));
    });
    document.getElementById('product-search-input')?.addEventListener('input', (e) => {
        productSearchTerm = e.target.value;
        renderProducts();
    });
}

function initCameraListeners() {
    document.getElementById('camera-placeholder').addEventListener('click', startCamera);
    document.getElementById('capture-btn').addEventListener('click', captureImage);
    document.getElementById('switch-camera').addEventListener('click', switchCamera);
    document.getElementById('stop-camera').addEventListener('click', stopCamera);
    document.getElementById('stop-camera').style.display = 'none';
    document.getElementById('save-product').addEventListener('click', saveProduct);

    const addToImages = (file) => {
        const reader = new FileReader();
        reader.onload = (ev) => { capturedImages.push(ev.target.result); renderCapturedImages(); };
        reader.readAsDataURL(file);
    };
    document.getElementById('gallery-input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(addToImages);
    });
    document.getElementById('native-camera-input').addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(addToImages);
        e.target.value = '';
    });
    document.getElementById('select-gallery-btn')?.addEventListener('click', () => {
        document.getElementById('gallery-input').click();
    });
}

function initModalListeners() {
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
            const newField = { id: name.toLowerCase().replace(/\s+/g, '_'), name: { en: name, vi: name }, type };
            if (type === 'select') newField.options = options;
            category.fields.push(newField);
            saveData();
            closeModal('modal-add-field');
            document.getElementById('new-field-name').value = '';
            document.getElementById('new-field-options').value = '';
            if (editingCategoryId) { renderEditCategoryFields(category); openModal('modal-edit-category'); }
            else renderDynamicForm();
        }
    });
    document.getElementById('add-category').addEventListener('click', () => openModal('modal-add-category'));
    document.getElementById('confirm-add-category').addEventListener('click', () => {
        const nameEn = document.getElementById('new-category-name').value.trim();
        if (!nameEn) return;
        const nameVi = document.getElementById('new-category-name-vi').value.trim() || nameEn;
        const icon = document.getElementById('new-category-icon').value.trim() || '📦';
        const newCat = {
            id: nameEn.toLowerCase().replace(/\s+/g, '_'), name: { en: nameEn, vi: nameVi }, icon,
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' }
            ]
        };
        appData.categories.push(newCat);
        addToPending('CREATE_CATEGORY', newCat);
        saveData(); renderCategories(); renderCategoriesSettings(); closeModal('modal-add-category');
        showToast(currentLang === 'vi' ? 'Đã thêm danh mục' : 'Category added');
        ['new-category-name', 'new-category-name-vi', 'new-category-icon'].forEach(id => document.getElementById(id).value = '');
    });
    document.getElementById('confirm-edit-category').addEventListener('click', () => {
        const catId = document.getElementById('edit-category-id').value;
        const category = appData.categories.find(c => c.id === catId);
        if (!category) return;
        category.name.en = document.getElementById('edit-category-name').value.trim() || category.name.en;
        category.name.vi = document.getElementById('edit-category-name-vi').value.trim() || category.name.vi;
        category.icon = document.getElementById('edit-category-icon').value.trim() || category.icon;
        addToPending('UPDATE_CATEGORY', { ...category });
        saveData(); renderCategories(); renderCategoriesSettings(); closeModal('modal-edit-category');
        showToast(currentLang === 'vi' ? 'Đã lưu thay đổi' : 'Changes saved');
    });
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        const itemId = document.getElementById('delete-item-id').value;
        const itemType = document.getElementById('delete-item-type').value;
        if (itemType === 'category') deleteCategory(itemId);
        else if (itemType === 'product') deleteProductById(itemId);
        closeModal('modal-confirm-delete');
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (overlay.id === 'modal-login') return;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    });
}

function initAuthListeners() {
    document.getElementById('login-submit')?.addEventListener('click', submitLogin);
    document.getElementById('login-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitLogin(); });
    document.getElementById('login-save-api-btn')?.addEventListener('click', () => {
        const url = document.getElementById('login-api-url-input')?.value.trim();
        if (url) {
            API.url = url; localStorage.setItem('productSnapAPIUrl', url);
            document.getElementById('api-url-input').value = url;
            document.getElementById('login-setup-section').style.display = 'none';
            showToast(currentLang === 'vi' ? 'Đã lưu URL! Đăng nhập lại.' : 'URL saved! Now login.');
            document.getElementById('login-username').focus();
        }
    });
    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);
    document.getElementById('add-user')?.addEventListener('click', addNewUser);
    document.getElementById('confirm-add-user')?.addEventListener('click', confirmAddUser);
}

document.addEventListener('DOMContentLoaded', () => {
    initDebugOverlay();
    loadAuthState();
    loadData();
    initNavListeners();
    initCameraListeners();
    initModalListeners();
    initSettingsListeners();
    initAuthListeners();

    renderCategories();
    renderCapturedImages();

    const savedApiUrl = localStorage.getItem('productSnapAPIUrl') || DEFAULT_API_URL;
    document.getElementById('api-url-input').value = savedApiUrl;
    updateConnectionStatus();
    updateLocalDataCount();
    updatePendingBadge();
    updateLastSyncDisplay();
    setupAutoSync();

    if (!currentUser) showLoginModal(); else applyRoleUI();
    if (API.url) { const s = document.getElementById('login-setup-section'); if (s) s.style.display = 'none'; }

    const verEl = document.getElementById('app-version-display');
    if (verEl) verEl.textContent = APP_VERSION;

    const pwaStatusEl = document.getElementById('pwa-installed-status');
    if (pwaStatusEl) {
        const isInstalled = navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        pwaStatusEl.textContent = isInstalled ? '✅ PWA đã cài đặt (standalone)' : '⚠️ Chưa cài — mở Chrome → Add to Home Screen';
        pwaStatusEl.style.color = isInstalled ? 'var(--success)' : 'var(--warning)';
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            const swEl = document.getElementById('sw-version-display');
            if (swEl && reg) swEl.textContent = reg.active ? 'active' : reg.installing ? 'installing...' : 'waiting';
        });
    }
});

