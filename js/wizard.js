// ==================== SETUP WIZARD ====================
// Inject modal HTML vào DOM (không cần thay đổi index.html)
// Flow: Welcome → OAuth → Tạo workspace → Tạo admin → Vào app

const WIZARD_HTML = `
<div id="modal-setup-wizard" class="modal-overlay" style="align-items:center; z-index:10001;">
  <div class="modal" style="max-width:380px; width:92%; border-radius:18px; padding:28px 24px;">

    <!-- Step 1: Welcome -->
    <div id="wizard-step-1">
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:2.5rem;">📦</div>
        <h2 style="margin:8px 0 4px; font-size:1.3rem;">ProductSnap</h2>
        <p style="color:var(--text-secondary); font-size:0.88rem; margin:0;">
          Lưu dữ liệu trên Google Sheets của bạn — riêng tư, không giới hạn.
        </p>
      </div>
      <button id="wizard-connect-btn" class="btn btn-primary" style="width:100%; gap:10px; font-size:1rem; padding:14px;">
        <span>🔑</span> Kết nối với Google
      </button>
      <p id="wizard-connect-error" style="color:var(--danger); font-size:0.82rem; margin:10px 0 0; display:none;"></p>
    </div>

    <!-- Step 2: Đang kết nối -->
    <div id="wizard-step-2" style="display:none; text-align:center; padding:20px 0;">
      <div style="font-size:2rem; animation: spin 1s linear infinite;">⏳</div>
      <p id="wizard-status-msg" style="color:var(--text-secondary); margin:16px 0 0; font-size:0.9rem;">
        Đang kết nối Google…
      </p>
    </div>

    <!-- Step 3: Tạo admin -->
    <div id="wizard-step-3" style="display:none;">
      <div style="text-align:center; margin-bottom:18px;">
        <div style="font-size:2rem;">✅</div>
        <h3 style="margin:8px 0 4px;">Workspace đã sẵn sàng!</h3>
        <p id="wizard-sheet-name" style="color:var(--text-secondary); font-size:0.82rem; margin:0;"></p>
      </div>
      <label class="form-label">Tên đăng nhập</label>
      <input id="wizard-username" class="form-input" placeholder="admin" autocomplete="username" style="margin-bottom:12px;">
      <label class="form-label">Mật khẩu</label>
      <input id="wizard-password" class="form-input" type="password" placeholder="••••••••" autocomplete="new-password" style="margin-bottom:4px;">
      <p id="wizard-admin-error" style="color:var(--danger); font-size:0.82rem; margin:8px 0 0; display:none;"></p>
      <button id="wizard-create-admin-btn" class="btn btn-primary" style="width:100%; margin-top:16px; padding:13px;">
        ✓ Tạo tài khoản &amp; Vào app
      </button>
    </div>

  </div>
</div>
<style>
@keyframes spin { to { transform: rotate(360deg); } }
</style>`;

const Wizard = {
    _injected: false,

    show() {
        if (!this._injected) {
            document.body.insertAdjacentHTML('beforeend', WIZARD_HTML);
            this._bindEvents();
            this._injected = true;
        }
        document.getElementById('modal-setup-wizard').classList.add('active');
        this._showStep(1);
    },

    hide() {
        const el = document.getElementById('modal-setup-wizard');
        if (el) el.classList.remove('active');
    },

    _showStep(n) {
        [1, 2, 3].forEach(i => {
            const el = document.getElementById(`wizard-step-${i}`);
            if (el) el.style.display = i === n ? '' : 'none';
        });
    },

    _setStatus(msg) {
        const el = document.getElementById('wizard-status-msg');
        if (el) el.textContent = msg;
    },

    _showConnectError(msg) {
        const el = document.getElementById('wizard-connect-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
        const btn = document.getElementById('wizard-connect-btn');
        if (btn) btn.disabled = false;
    },

    _showAdminError(msg) {
        const el = document.getElementById('wizard-admin-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    _bindEvents() {
        document.getElementById('wizard-connect-btn').addEventListener('click', () => this._stepConnect());
        document.getElementById('wizard-create-admin-btn').addEventListener('click', () => this._stepCreateAdmin());
        document.getElementById('wizard-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') this._stepCreateAdmin();
        });
    },

    async _stepConnect() {
        const btn = document.getElementById('wizard-connect-btn');
        btn.disabled = true;
        this._showStep(2);
        this._setStatus('Đang xác thực Google…');
        try {
            await OAuthClient.getToken();
            this._setStatus('Đang tìm/tạo workspace…');
            await SheetsAPI.findOrCreateWorkspace();

            // Kiểm tra có phải lần đầu không (Users sheet trống)
            const isFirst = await SheetsAPI.isFirstSetup();
            if (!isFirst) {
                // Đã có user → bỏ qua tạo admin, vào thẳng login
                this.hide();
                if (typeof showLoginModal === 'function') showLoginModal();
                return;
            }

            // Hiển thị sheet name
            const el = document.getElementById('wizard-sheet-name');
            if (el) el.textContent = `Spreadsheet ID: ${SheetsAPI.spreadsheetId.slice(0, 20)}…`;

            this._showStep(3);
            document.getElementById('wizard-username').focus();
        } catch(e) {
            console.error('[wizard] connect error', e);
            this._showStep(1);
            this._showConnectError('Kết nối thất bại: ' + (e.message || 'Thử lại'));
        }
    },

    async _stepCreateAdmin() {
        const username = document.getElementById('wizard-username').value.trim();
        const password = document.getElementById('wizard-password').value;
        if (!username) { this._showAdminError('Vui lòng nhập tên đăng nhập'); return; }
        if (password.length < 4) { this._showAdminError('Mật khẩu tối thiểu 4 ký tự'); return; }

        const btn = document.getElementById('wizard-create-admin-btn');
        btn.disabled = true;
        btn.textContent = 'Đang tạo…';

        try {
            const result = await SheetsAPI.addUser({ username, password, role: 'admin' });
            if (!result.success) throw new Error('Create user failed');

            currentUser = { id: result.user.id, username, role: 'admin' };
            if (typeof saveAuthState === 'function') saveAuthState();
            if (typeof applyRoleUI === 'function') applyRoleUI();
            if (typeof setupAutoSync === 'function') setupAutoSync();

            this.hide();
            if (typeof showToast === 'function') showToast('Chào mừng, ' + username + '!');
        } catch(e) {
            console.error('[wizard] create admin error', e);
            this._showAdminError('Tạo tài khoản thất bại: ' + (e.message || 'Thử lại'));
            btn.disabled = false;
            btn.textContent = '✓ Tạo tài khoản & Vào app';
        }
    }
};
