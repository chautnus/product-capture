let currentUser = null; // {id, username, role}

// ==================== AUTH ====================
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function loadAuthState() {
    const saved = localStorage.getItem('productSnapUser');
    if (saved) {
        try {
            const u = JSON.parse(saved);
            if (u && u.id && u.id !== 'offline' && u.username && u.role) {
                currentUser = u;
            } else {
                localStorage.removeItem('productSnapUser');
            }
        } catch { currentUser = null; }
    }
}

function saveAuthState() {
    if (currentUser) localStorage.setItem('productSnapUser', JSON.stringify(currentUser));
    else localStorage.removeItem('productSnapUser');
}

function showLoginModal() {
    openModal('modal-login');
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) setTimeout(() => usernameInput.focus(), 50);
}

function hideLoginModal() {
    closeModal('modal-login');
}

async function submitLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showToast(currentLang === 'vi' ? 'Nhập đầy đủ tên đăng nhập và mật khẩu' : 'Please enter username and password');
        return;
    }

    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.textContent = currentLang === 'vi' ? 'Đang đăng nhập...' : 'Logging in...';

    try {
        const result = await SheetsAPI.login(username, password);
        if (result && result.success) {
            currentUser = result.user;
            saveAuthState();
            document.getElementById('login-password').value = '';
            hideLoginModal();
            applyRoleUI();
            setupAutoSync();
            showToast(currentLang === 'vi' ? `Xin chào, ${currentUser.username}!` : `Welcome, ${currentUser.username}!`);
        } else {
            showToast(currentLang === 'vi' ? 'Sai tên đăng nhập hoặc mật khẩu' : 'Invalid credentials');
        }
    } catch(e) {
        console.error('[auth] login error:', e);
        showToast(currentLang === 'vi' ? 'Không thể kết nối. Thử lại.' : 'Connection failed. Try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = t('login');
    }
}

async function logoutUser() {
    currentUser = null;
    saveAuthState();
    // Thu hồi OAuth token + xoá workspace cache
    if (typeof OAuthClient !== 'undefined') await OAuthClient.signOut();
    localStorage.removeItem('productSnapSheetId');
    localStorage.removeItem('_ps_drive_root');
    applyRoleUI();
    // Show setup wizard (user sẽ OAuth lại)
    if (typeof Wizard !== 'undefined') Wizard.show();
}

function applyRoleUI() {
    const admin = isAdmin();

    const addCatBtn = document.getElementById('add-category');
    if (addCatBtn) addCatBtn.style.display = admin ? '' : 'none';

    const usersSection = document.getElementById('section-users');
    if (usersSection) usersSection.style.display = admin ? '' : 'none';

    const userDisplay = document.getElementById('current-user-display');
    if (userDisplay) userDisplay.textContent = currentUser ? `${currentUser.username} (${currentUser.role})` : '-';

    renderCategoriesSettings();
    if (admin) renderUsersSettings();
}

// ==================== USERS MANAGEMENT ====================
let _usersCache = null;
let _usersCacheTs = 0;

async function renderUsersSettings() {
    const container = document.getElementById('users-settings');
    if (!container || !SheetsAPI.spreadsheetId) return;

    const now = Date.now();
    if (_usersCache && (now - _usersCacheTs) < 10000) {
        buildUsersSettingsDOM(container, _usersCache);
        return;
    }

    try {
        const users = await SheetsAPI.getUsers();
        _usersCache = users;
        _usersCacheTs = Date.now();
        buildUsersSettingsDOM(container, _usersCache);
    } catch(e) {
        console.error('[auth] Failed to load users:', e);
    }
}

function buildUsersSettingsDOM(container, users) {
    container.innerHTML = '';
    users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'settings-item';
        row.style.cssText = 'flex-direction:column;align-items:stretch;padding:10px;background:var(--surface);border-radius:8px;margin-bottom:8px;';

        const inner = document.createElement('div');
        inner.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

        const info = document.createElement('div');
        const nameEl = document.createElement('strong');
        nameEl.textContent = u.username;
        info.appendChild(nameEl);

        const roleTag = document.createElement('span');
        roleTag.className = 'field-tag';
        roleTag.style.cssText = `margin-left:8px;background:${u.role === 'admin' ? 'var(--primary)' : 'var(--surface-2)'};color:${u.role === 'admin' ? 'white' : 'inherit'}`;
        roleTag.textContent = u.role;
        info.appendChild(roleTag);

        inner.appendChild(info);

        if (u.id !== currentUser?.id) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-icon danger';
            delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', () => deleteUser(u.id));
            inner.appendChild(delBtn);
        }

        row.appendChild(inner);
        container.appendChild(row);
    });
}

async function deleteUser(userId) {
    if (!confirm(currentLang === 'vi' ? 'Xóa người dùng này?' : 'Delete this user?')) return;
    const result = await SheetsAPI.deleteUser(userId);
    if (result && result.success) {
        _usersCache = null;
        showToast(t('user_deleted'));
        renderUsersSettings();
    }
}

function addNewUser() {
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value = 'user';
    document.getElementById('new-user-department').value = '';
    openModal('modal-add-user');
}

async function confirmAddUser() {
    const username   = document.getElementById('new-user-username').value.trim();
    const password   = document.getElementById('new-user-password').value.trim();
    const role       = document.getElementById('new-user-role').value;
    const department = document.getElementById('new-user-department').value.trim();

    if (!username || !password) {
        showToast(currentLang === 'vi' ? 'Nhập đầy đủ tên và mật khẩu' : 'Username and password required');
        return;
    }

    const btn = document.getElementById('confirm-add-user');
    btn.disabled = true;
    try {
        const result = await SheetsAPI.addUser({
            username, password,
            role: role === 'admin' ? 'admin' : 'user',
            department
        });
        if (result && result.success) {
            _usersCache = null;
            closeModal('modal-add-user');
            showToast(t('user_added'));
            renderUsersSettings();
        } else {
            showToast(result?.error || t('sync_failed'));
        }
    } finally {
        btn.disabled = false;
    }
}
