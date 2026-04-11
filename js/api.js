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
    async deleteCategory(id) { return await this.call('deleteCategory', { id }); },
    async login(username, password) { return await this.get('login', { username, password }); },
    async getUsers() { return await this.get('getUsers'); },
    async addUser(user) { return await this.call('addUser', { user }); },
    async updateUser(user) { return await this.call('updateUser', { user }); },
    async deleteUser(id) { return await this.call('deleteUser', { id }); }
};

// Load API URL from localStorage
API.url = localStorage.getItem('productSnapAPIUrl') || DEFAULT_API_URL;
