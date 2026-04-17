let editingCategoryId = null;

// Bookmarklet body — injected as javascript: URL.
// Dùng event listeners (không inline onclick) để tránh escaping hell.
// window.location.href thay window.open → không bị popup blocker chặn.
const BOOKMARKLET_BODY = `var imgs=[];document.querySelectorAll('img').forEach(function(el){var s=el.currentSrc||el.src;if(s&&s.startsWith('http')&&el.naturalWidth>80&&el.naturalHeight>80&&!imgs.includes(s))imgs.push(s);});if(!imgs.length){alert('Kh\u00f4ng t\u00ecm th\u1ea5y \u1ea3nh n\u00e0o!');return;}var sel=new Set(),ov=document.createElement('div');ov.id='__ps';ov.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;font-family:sans-serif;';document.body.appendChild(ov);function render(){var h='<div style="background:#fff;border-radius:16px;padding:20px;max-width:90vw;max-height:85vh;overflow-y:auto;min-width:320px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><strong>\u{1F4E6} Save to ProductSnap</strong><button id="__psx" style="border:none;background:none;font-size:1.4rem;cursor:pointer;line-height:1;">\u00d7</button></div><div id="__pg" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">';imgs.forEach(function(src,i){h+='<div data-i="'+i+'" style="cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:1/1;background:#f0f0f0;outline:'+(sel.has(i)?'3px solid #4CAF50':'none')+';box-sizing:border-box;"><img src="'+src.replace(/"/g,'%22')+'" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.parentNode.style.display=&apos;none&apos;"></div>';});h+='</div><div style="display:flex;gap:8px;"><button id="__psi" style="flex:1;padding:11px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">\u2713 Import ('+sel.size+')</button><button id="__psc" style="padding:11px;background:#f5f5f5;border:none;border-radius:8px;cursor:pointer;">Hu\u1ef7</button></div></div>';ov.innerHTML=h;ov.querySelectorAll('[data-i]').forEach(function(el){el.addEventListener('click',function(){var i=parseInt(this.getAttribute('data-i'));if(sel.has(i))sel.delete(i);else sel.add(i);render();});});document.getElementById('__psx').onclick=document.getElementById('__psc').onclick=function(){ov.remove();};document.getElementById('__psi').onclick=function(){if(!sel.size){alert('Ch\u1ecdn \u00edt nh\u1ea5t 1 \u1ea3nh');return;}var c=[];sel.forEach(function(i){c.push(imgs[i]);});var u=PS+'?import='+encodeURIComponent(c.join(','));var w=window.open(u,'_blank');if(!w)window.location.href=u;ov.remove();};}render();`;

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
    // "Test Connection" → OAuth + tìm/tạo workspace
    document.getElementById('test-connection').addEventListener('click', async () => {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = t('connecting');
        try {
            await OAuthClient.getToken();
            await SheetsAPI.findOrCreateWorkspace();
            updateConnectionStatus();
            showToast(t('connected'));
        } catch(e) {
            statusEl.textContent = t('not_connected');
            statusEl.style.borderLeftColor = 'var(--danger)';
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

    // Inject bookmarklet installer section (không sửa index.html)
    const _psUrl = location.origin + location.pathname;
    const _bm = `javascript:(function(){var PS='${_psUrl}';` + BOOKMARKLET_BODY + `})();`;
    const _section = document.createElement('div');
    _section.className = 'settings-section';
    _section.id = 'bookmarklet-section';
    _section.innerHTML = `
        <div class="settings-header">🔖 Import từ trang web</div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:8px 0;">
            Kéo nút bên dưới vào thanh bookmark của trình duyệt. Sau đó khi xem trang sản phẩm bất kỳ, bấm bookmark đó để chọn ảnh.
        </p>
        <a id="bookmarklet-link" class="btn btn-secondary" draggable="true"
           style="display:inline-flex;align-items:center;gap:8px;cursor:grab;">
            📦 Save to ProductSnap
        </a>
        <p style="font-size:0.78rem;color:var(--text-secondary);margin:8px 0 0;">
            ℹ️ Trên mobile: copy link → thêm bookmark thủ công → sửa URL thành link này.
        </p>`;
    const settingsScreen = document.getElementById('screen-settings');
    if (settingsScreen && !document.getElementById('bookmarklet-section')) {
        settingsScreen.appendChild(_section);
        document.getElementById('bookmarklet-link').href = _bm;
    }
}
