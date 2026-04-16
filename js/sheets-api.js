// ==================== GOOGLE SHEETS API v4 WRAPPER ====================
// Thay thế api.js + GAS. Tất cả reads/writes trực tiếp qua Sheets API.
// Mỗi user có spreadsheet riêng ("ProductSnap Workspace" trong Drive của họ).

const SheetsAPI = {
    spreadsheetId: null,

    BASE: 'https://sheets.googleapis.com/v4/spreadsheets',

    // ── Helpers ──────────────────────────────────────────────────────────

    async _get(range) {
        const tok = await OAuthClient.getToken();
        const res = await fetch(`${this.BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}`,
            { headers: { Authorization: `Bearer ${tok}` } });
        if (!res.ok) throw new Error(`Sheets GET ${range}: ${res.status}`);
        return res.json();
    },

    async _put(range, rows) {
        const tok = await OAuthClient.getToken();
        const res = await fetch(
            `${this.BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
            { method: 'PUT', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ values: rows }) });
        if (!res.ok) throw new Error(`Sheets PUT ${range}: ${res.status}`);
        return res.json();
    },

    async _append(sheetName, row) {
        const tok = await OAuthClient.getToken();
        const res = await fetch(
            `${this.BASE}/${this.spreadsheetId}/values/${encodeURIComponent(sheetName + '!A:A')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ values: [row] }) });
        if (!res.ok) throw new Error(`Sheets APPEND ${sheetName}: ${res.status}`);
        return res.json();
    },

    // Tìm row index (1-based) theo ID ở cột A. Trả về -1 nếu không tìm thấy.
    async _findRowById(sheetName, id) {
        const data = await this._get(`${sheetName}!A:A`);
        const ids = (data.values || []).map(r => r[0]);
        const idx = ids.findIndex((v, i) => i > 0 && v === id);
        return idx > 0 ? idx + 1 : -1;  // +1 vì Sheets 1-based
    },

    // ── Workspace ─────────────────────────────────────────────────────────

    async ping() {
        if (!this.spreadsheetId) return { success: false };
        const tok = await OAuthClient.getToken();
        const res = await fetch(`${this.BASE}/${this.spreadsheetId}?fields=spreadsheetId`,
            { headers: { Authorization: `Bearer ${tok}` } });
        return { success: res.ok };
    },

    // Tìm hoặc tạo "ProductSnap Workspace" trong Drive user
    async findOrCreateWorkspace() {
        const saved = localStorage.getItem('productSnapSheetId');
        if (saved) {
            this.spreadsheetId = saved;
            try { const p = await this.ping(); if (p.success) return saved; } catch {}
            localStorage.removeItem('productSnapSheetId');
        }

        const tok = await OAuthClient.getToken();
        const q = encodeURIComponent(`name='ProductSnap Workspace' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
        const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&orderBy=createdTime desc`,
            { headers: { Authorization: `Bearer ${tok}` } });
        const sd = await sr.json();
        if (sd.files?.length) {
            this.spreadsheetId = sd.files[0].id;
            localStorage.setItem('productSnapSheetId', this.spreadsheetId);
            return this.spreadsheetId;
        }

        // Tạo mới
        const cr = await fetch(`${this.BASE}`, {
            method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                properties: { title: 'ProductSnap Workspace' },
                sheets: [{ properties: { title: 'Data' } }, { properties: { title: 'Categories' } },
                          { properties: { title: 'Users' } }, { properties: { title: 'ProductNames' } }]
            })
        });
        const ss = await cr.json();
        this.spreadsheetId = ss.spreadsheetId;
        localStorage.setItem('productSnapSheetId', this.spreadsheetId);
        await this._initHeaders();
        return this.spreadsheetId;
    },

    async _initHeaders() {
        await this._put('Data!A1:H1',         [['ID','Category','Created At','Images','Name','Price','Data JSON','_deleted']]);
        await this._put('Categories!A1:G1',   [['ID','Name EN','Name VI','Icon','Fields JSON','Updated At','_deleted']]);
        await this._put('Users!A1:E1',        [['ID','Username','Password','Role','Created At']]);
        await this._put('ProductNames!A1:A1', [['Name']]);
    },

    // ── Categories ────────────────────────────────────────────────────────

    async getCategories() {
        const data = await this._get('Categories!A:G');
        const rows = data.values || [];
        const cats = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r[0] || r[6] === 'TRUE') continue;
            let fields = [];
            try { fields = JSON.parse(r[4] || '[]'); } catch {}
            cats.push({ id: r[0], name: { en: r[1]||'', vi: r[2]||'' }, icon: r[3]||'📦', fields, updatedAt: r[5]||'' });
        }
        return { success: true, categories: cats, serverTimestamp: Date.now() };
    },

    async saveCategory(cat) {
        const row = [cat.id, cat.name?.en||'', cat.name?.vi||'', cat.icon||'📦',
                     JSON.stringify(cat.fields||[]), new Date().toISOString(), ''];
        const ri = await this._findRowById('Categories', cat.id);
        if (ri > 0) await this._put(`Categories!A${ri}:G${ri}`, [row]);
        else        await this._append('Categories', row);
        return { success: true, category: cat };
    },

    async deleteCategory(id) {
        const ri = await this._findRowById('Categories', id);
        if (ri > 0) await this._put(`Categories!G${ri}`, [['TRUE']]);
        return { success: true };
    },

    // ── Products ─────────────────────────────────────────────────────────

    async getProducts(category) {
        const data = await this._get('Data!A:H');
        const rows = data.values || [];
        const products = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r[0] || r[7] === 'TRUE') continue;
            let productData = {};
            try { productData = JSON.parse(r[6] || '{}'); } catch {}
            productData.name  = r[4] || productData.name;
            productData.price = r[5] || productData.price;
            const prod = { id: r[0], category: r[1], createdAt: r[2],
                           images: (r[3]||'').split(',').map(s=>s.trim()).filter(Boolean), data: productData };
            if (!category || category === 'all' || prod.category === category) products.push(prod);
        }
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return { success: true, products, serverTimestamp: Date.now() };
    },

    async saveProduct(product) {
        // Upload base64 images → Drive URLs
        let imageUrls = (product.images||[]).filter(img => img.startsWith('http'));
        const base64s = (product.images||[]).filter(img => img.startsWith('data:'));
        for (let i = 0; i < base64s.length; i++) {
            try {
                const url = await DriveAPI.uploadImage(
                    base64s[i], `img_${i}_${Date.now()}.jpg`,
                    product.category, product.data?.name);
                imageUrls.push(url);
            } catch(e) { console.warn('[sheets] image upload failed', e); }
        }

        const row = [
            product.id, product.category, product.createdAt || new Date().toISOString(),
            imageUrls.join(','), product.data?.name||'', product.data?.price||'',
            JSON.stringify(product.data||{}), ''
        ];
        const ri = await this._findRowById('Data', product.id);
        if (ri > 0) await this._put(`Data!A${ri}:H${ri}`, [row]);
        else        await this._append('Data', row);
        return { success: true, product: { ...product, images: imageUrls } };
    },

    async deleteProduct(id) {
        const ri = await this._findRowById('Data', id);
        if (ri > 0) await this._put(`Data!H${ri}`, [['TRUE']]);
        return { success: true };
    },

    // ── Users ─────────────────────────────────────────────────────────────

    async login(username, password) {
        const data = await this._get('Users!A:E');
        const rows = (data.values || []).slice(1);
        const user = rows.find(r => r[1] === username && r[2] === password);
        if (!user) return { success: false, error: 'Invalid credentials' };
        return { success: true, user: { id: user[0], username: user[1], role: user[3]||'user' } };
    },

    async getUsers() {
        const data = await this._get('Users!A:E');
        return (data.values||[]).slice(1).filter(r=>r[0]).map(r=>({
            id: r[0], username: r[1], role: r[3]||'user', createdAt: r[4]||''
        }));
    },

    async addUser(userData) {
        const id = `user_${Date.now()}`;
        await this._append('Users', [id, userData.username, userData.password||'', userData.role||'user', new Date().toISOString()]);
        return { success: true, user: { id, username: userData.username, role: userData.role||'user' } };
    },

    async deleteUser(userId) {
        const ri = await this._findRowById('Users', userId);
        if (ri > 0) await this._put(`Users!A${ri}:E${ri}`, [['']]);
        return { success: true };
    },

    // Kiểm tra Users sheet có trống không (setup mới)
    async isFirstSetup() {
        const data = await this._get('Users!A:A');
        const rows = (data.values||[]).slice(1).filter(r=>r[0]);
        return rows.length === 0;
    },

    // ── Product Names (autocomplete) ─────────────────────────────────────

    async getProductNames() {
        const data = await this._get('ProductNames!A:A');
        return (data.values||[]).slice(1).map(r=>r[0]).filter(Boolean);
    },

    async addProductName(name) {
        const existing = await this.getProductNames();
        if (!existing.includes(name)) await this._append('ProductNames', [name]);
        return { success: true };
    }
};
