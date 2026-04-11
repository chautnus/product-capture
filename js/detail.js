// ==================== PRODUCT DETAIL ====================
async function showProductDetail(productId) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return;

    const category = appData.categories.find(c => c.id === product.category);
    const fields = category?.fields || [];

    // Load images from IndexedDB (local base64), fall back to cloud URLs in product.images
    let images = [];
    try {
        images = await ImageStore.get(productId);
    } catch (e) {
        images = [];
    }
    if ((!images || images.length === 0) && product.images && product.images.length > 0) {
        images = product.images.map(u => toThumbnailUrl(u, 600));
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
                    <button class="btn btn-secondary" id="detail-delete-btn"
                        style="flex: 1; border-color: var(--danger); color: var(--danger); ${!isAdmin() ? 'display:none;' : ''}">${t('delete')}</button>
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
