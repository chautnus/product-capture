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
        appData.categories.push({
            id: nameEn.toLowerCase().replace(/\s+/g, '_'), name: { en: nameEn, vi: nameVi }, icon,
            fields: [
                { id: 'name', name: { en: 'Product Name', vi: 'Tên sản phẩm' }, type: 'text', required: true },
                { id: 'price', name: { en: 'Price', vi: 'Giá' }, type: 'number' }
            ]
        });
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

function initSettingsListeners() {
    document.getElementById('test-connection').addEventListener('click', async () => {
        const url = document.getElementById('api-url-input').value.trim();
        if (!url) { alert('Please enter the Apps Script URL'); return; }
        localStorage.setItem('productSnapAPIUrl', url);
        API.url = url;
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = t('connecting');
        statusEl.className = 'field-tag type-boolean';
        try {
            const result = await API.ping();
            if (result && result.success) {
                statusEl.textContent = t('connected'); statusEl.style.borderLeftColor = 'var(--success)';
                document.getElementById('sync-now').style.display = 'block';
                document.getElementById('sync-from-cloud').style.display = 'block';
                showToast(t('connected'));
            } else { throw new Error('Connection failed'); }
        } catch (e) {
            statusEl.textContent = t('not_connected'); statusEl.style.borderLeftColor = 'var(--danger)';
            document.getElementById('sync-now').style.display = 'none';
            document.getElementById('sync-from-cloud').style.display = 'none';
            showToast(t('sync_failed'));
        }
    });
    // Bug 3 fix: Only ONE listener on sync-now
    document.getElementById('sync-now').addEventListener('click', async () => {
        const btn = document.getElementById('sync-now');
        btn.disabled = true; btn.textContent = currentLang === 'vi' ? 'Đang đồng bộ...' : 'Syncing...';
        try {
            const result = await syncPendingToCloud();
            if (result.synced > 0 && result.failed === 0) showToast(currentLang === 'vi' ? `Đã đồng bộ ${result.synced} thay đổi!` : `Synced ${result.synced} changes!`);
            else if (result.synced > 0) showToast(currentLang === 'vi' ? `Đồng bộ ${result.synced}, thất bại ${result.failed}` : `Synced ${result.synced}, failed ${result.failed}`);
            else if (result.failed > 0) showToast(currentLang === 'vi' ? `${result.failed} thay đổi thất bại.` : `${result.failed} changes failed.`);
            else showToast(currentLang === 'vi' ? 'Không có thay đổi cần đồng bộ' : 'No pending changes');
        } catch (e) { showToast(t('sync_failed')); }
        btn.disabled = false; btn.textContent = t('sync_now');
    });
    document.getElementById('sync-from-cloud').addEventListener('click', async () => {
        const btn = document.getElementById('sync-from-cloud');
        btn.disabled = true; btn.textContent = currentLang === 'vi' ? 'Đang tải...' : 'Loading...';
        try { await syncFromCloud(); showToast(currentLang === 'vi' ? 'Đã đồng bộ từ Cloud!' : 'Synced from Cloud!'); }
        catch (e) { showToast(t('sync_failed')); }
        btn.disabled = false; btn.textContent = t('sync_from_cloud');
    });
    document.getElementById('cloud-refresh-btn')?.addEventListener('click', async () => {
        if (!API.url) { showToast(currentLang === 'vi' ? 'Chưa cấu hình API URL (vào Settings)' : 'API URL not configured'); return; }
        const btn = document.getElementById('cloud-refresh-btn');
        btn.textContent = '⏳'; btn.disabled = true;
        try { await syncFromCloud(); showToast(currentLang === 'vi' ? 'Đã tải dữ liệu từ Cloud!' : 'Loaded from Cloud!'); }
        catch (e) { showToast(t('sync_failed')); } finally { btn.textContent = '☁️'; btn.disabled = false; }
    });
    document.getElementById('export-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `productsnap_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('clear-data').addEventListener('click', () => {
        if (confirm(t('confirm_clear'))) {
            appData = { categories: appData.categories, products: [] };
            saveData(); renderProducts(); updateLocalDataCount(); showToast(t('data_cleared'));
        }
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

