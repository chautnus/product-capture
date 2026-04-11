let selectedCategory = null;
let productNamesCache = [];
let autocompleteTimeout = null;

// ==================== CATEGORIES ====================
function renderCategories() {
    const grid = document.getElementById('category-grid');
    // Non-admin with department: only show their department's category
    const visibleCats = (!isAdmin() && currentUser?.department)
        ? appData.categories.filter(c => c.id === currentUser.department)
        : appData.categories;

    grid.innerHTML = visibleCats.map(cat => `
        <div class="category-card ${selectedCategory === cat.id ? 'selected' : ''}"
             onclick="selectCategory('${cat.id}')">
            <div class="icon">${cat.icon}</div>
            <div class="name">${cat.name[currentLang] || cat.name.en}</div>
        </div>
    `).join('');

    // Auto-select if only one category visible
    if (visibleCats.length === 1 && selectedCategory !== visibleCats[0].id) {
        selectCategory(visibleCats[0].id);
    }
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
            // A5: use DOM construction to avoid XSS via product names in innerHTML
            dropdown.innerHTML = '';
            matches.slice(0, 10).forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = item.name;
                if (item.category) {
                    const tag = document.createElement('span');
                    tag.className = 'category-tag';
                    tag.textContent = item.category;
                    div.appendChild(tag);
                }
                div.addEventListener('click', () => selectProductName(item.name));
                dropdown.appendChild(div);
            });
            dropdown.style.display = 'block';
            addBtn.style.display = 'none';
        } else {
            dropdown.style.display = 'none';
            addBtn.style.display = 'block';
            addBtn.textContent = `+ ${currentLang === 'vi' ? 'Tạo mới' : 'Create'}: "${value}"`;
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
