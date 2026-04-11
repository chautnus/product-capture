let currentUser = null; // {id, username, role, department}

// ==================== AUTH ====================
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function loadAuthState() {
    const saved = localStorage.getItem('productSnapUser');
    if (saved) {
        try {
            const u = JSON.parse(saved);
            // P0: reject offline fallback users (id='offline') — require real API auth
            if (u && u.id && u.id !== 'offline' && u.username && u.role) {
                currentUser = u;
            } else {
                localStorage.removeItem('productSnapUser');
            }
        } catch (e) { currentUser = null; }
    }
}

function saveAuthState() {
    if (currentUser) localStorage.setItem('productSnapUser', JSON.stringify(currentUser));
    else localStorage.removeItem('productSnapUser');
}

function showLoginModal() {
    // P3: use .active class consistent with all other modals
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

    if (!API.url) {
        // P0: show API URL setup section in the login modal
        const setupSection = document.getElementById('login-setup-section');
        if (setupSection) {
            setupSection.style.display = 'block';
            document.getElementById('login-api-url-input').focus();
        }
        showToast(currentLang === 'vi'
            ? '⚙️ Nhập Apps Script URL bên dưới trước khi đăng nhập'
            : '⚙️ Enter Apps Script URL below before logging in');
        return;
    }

    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.textContent = currentLang === 'vi' ? 'Đang đăng nhập...' : 'Logging in...';

    try {
        const result = await API.login(username, password);
        if (result && result.success) {
            currentUser = result.user;
            saveAuthState();
            document.getElementById('login-password').value = '';
            hideLoginModal();
            applyRoleUI();
            showToast(currentLang === 'vi' ? `Xin chào, ${currentUser.username}!` : `Welcome, ${currentUser.username}!`);
        } else if (!result) {
            showToast(currentLang === 'vi'
                ? 'Không thể kết nối server. Kiểm tra API URL.'
                : 'Cannot reach server. Check API URL.');
        } else if (result.error && result.error.includes('Users sheet')) {
            showToast(currentLang === 'vi'
                ? '⚠️ Chưa setup. Chạy initialSetup() trong Apps Script.'
                : '⚠️ Not set up. Run initialSetup() in Apps Script.');
        } else if (result.error && result.error.includes('Unknown action')) {
            showToast(currentLang === 'vi'
                ? '⚠️ Apps Script chưa cập nhật. Deploy lại.'
                : '⚠️ Apps Script outdated. Redeploy.');
        } else {
            showToast(t('invalid_credentials'));
        }
    } catch (e) {
        console.error('Login error:', e);
        showToast(currentLang === 'vi'
            ? 'Không thể kết nối server. Kiểm tra API URL.'
            : 'Cannot reach server. Check API URL.');
    } finally {
        btn.disabled = false;
        btn.textContent = t('login');
    }
}

function logoutUser() {
    currentUser = null;
    saveAuthState();
    applyRoleUI();
    showLoginModal();
}

function applyRoleUI() {
    const admin = isAdmin();

    // Add category button
    const addCatBtn = document.getElementById('add-category');
    if (addCatBtn) addCatBtn.style.display = admin ? '' : 'none';

    // Users section
    const usersSection = document.getElementById('section-users');
    if (usersSection) usersSection.style.display = admin ? '' : 'none';

    // Current user display
    const userDisplay = document.getElementById('current-user-display');
    if (userDisplay) userDisplay.textContent = currentUser ? `${currentUser.username} (${currentUser.role})` : '-';

    // Re-render category settings to apply admin-gated buttons
    renderCategoriesSettings();
    if (admin) renderUsersSettings();
}

let _usersCache = null;
let _usersCacheTs = 0;

async function renderUsersSettings() {
    const container = document.getElementById('users-settings');
    if (!container || !API.url) return;

    // P4: skip API call if cache is fresh (< 10 seconds)
    const now = Date.now();
    if (_usersCache && (now - _usersCacheTs) < 10000) {
        buildUsersSettingsDOM(container, _usersCache);
        return;
    }

    try {
        const result = await API.getUsers();
        if (!result || !result.success) return;
        _usersCache = result.users;
        _usersCacheTs = Date.now();
        buildUsersSettingsDOM(container, _usersCache);
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

function buildUsersSettingsDOM(container, users) {
    // P1: safe DOM construction — no innerHTML with user-supplied data
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

        if (u.department) {
            const deptTag = document.createElement('span');
            deptTag.className = 'field-tag';
            deptTag.style.marginLeft = '4px';
            deptTag.textContent = u.department;
            info.appendChild(deptTag);
        }

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
    const result = await API.deleteUser(userId);
    if (result && result.success) {
        _usersCache = null; // invalidate cache
        showToast(t('user_deleted'));
        renderUsersSettings();
    }
}

function addNewUser() {
    // P2: use modal instead of prompt() — prompt() is blocked on mobile PWA
    document.getElementById('new-user-username').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-role').value = 'user';
    document.getElementById('new-user-department').value = '';
    openModal('modal-add-user');
}

async function confirmAddUser() {
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;
    const department = document.getElementById('new-user-department').value.trim();

    if (!username || !password) {
        showToast(currentLang === 'vi' ? 'Nhập đầy đủ tên và mật khẩu' : 'Username and password required');
        return;
    }

    const btn = document.getElementById('confirm-add-user');
    btn.disabled = true;
    try {
        const user = {
            id: 'user_' + Date.now(),
            username, password,
            role: role === 'admin' ? 'admin' : 'user',
            department,
            createdAt: new Date().toISOString()
        };
        const result = await API.addUser(user);
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
