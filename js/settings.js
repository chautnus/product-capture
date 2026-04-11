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
