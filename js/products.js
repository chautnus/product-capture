let productSearchTerm = '';

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
            department: currentUser?.department || '',
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
    // Non-admin with department: only show their department's products
    if (!isAdmin() && currentUser?.department) {
        products = products.filter(p => p.category === currentUser.department);
    } else if (filter !== 'all') {
        products = products.filter(p => p.category === filter);
    }

    // Search by product name
    if (productSearchTerm) {
        const term = productSearchTerm.toLowerCase();
        products = products.filter(p =>
            (p.data?.name || '').toLowerCase().includes(term)
        );
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

    // Lazy-load thumbnails: IndexedDB (local base64) → product.images (cloud URLs) → placeholder
    for (const product of products) {
        ImageStore.get(product.id).then(localImages => {
            const thumbEl = document.getElementById(`thumb-${product.id}`);
            const countEl = document.getElementById(`img-count-${product.id}`);

            let src = null;
            let count = 0;

            if (localImages && localImages.length > 0) {
                src = localImages[0];
                count = localImages.length;
            } else if (product.images && product.images.length > 0) {
                src = toThumbnailUrl(product.images[0]);
                count = product.images.length;
            }

            if (thumbEl && src) {
                attachDriveUrlFallback(thumbEl, src);
                thumbEl.src = src;
            }
            if (countEl) countEl.textContent = `📷 ${count}`;
        }).catch(() => {});
    }
}
