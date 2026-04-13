let editingCategoryId = null;

// ==================== SETTINGS ====================
function renderCategoriesSettings() {
    const container = document.getElementById('categories-settings');
    const adminButtons = isAdmin()
        ? (catId) => `<button class="btn-icon" onclick="openEditCategory('${catId}')" title="Edit">✏️</button>
                      <button class="btn-icon danger" onclick="confirmDeleteCategory('${catId}')" title="Delete">🗑️</button>`
        : () => '';
    container.innerHTML = appData.categories.map(cat => `
        <div class="category-item">
            <div class="category-item-header">
                <span class="category-item-name">
                    <span style="font-size: 1.3rem;">${cat.icon}</span>
                    <span>${cat.name[currentLang] || cat.name.en}</span>
                </span>
                <div class="category-item-actions">
                    ${adminButtons(cat.id)}
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
    document.getElementById('clear-stuck-pending')?.addEventListener('click', () => {
        if (confirm(currentLang === 'vi' ? 'Xoá tất cả pending changes?' : 'Clear all pending changes?')) {
            syncState.pendingChanges = [];
            saveSyncState();
            updatePendingBadge();
            showToast(currentLang === 'vi' ? 'Đã xoá pending changes' : 'Pending changes cleared');
        }
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
