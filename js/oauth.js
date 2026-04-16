// ==================== GOOGLE OAUTH 2.0 (GIS) ====================
// Dùng Google Identity Services token client (implicit flow)
// Scope: spreadsheets (read/write) + drive.file (images upload)

const OAuthClient = {
    _tokenClient: null,
    _accessToken: null,
    _tokenExpiry: 0,
    _resolveToken: null,
    _rejectToken: null,

    // Gọi 1 lần khi GIS script đã load
    init(clientId) {
        const saved = this._loadSaved();
        if (saved) {
            this._accessToken = saved.token;
            this._tokenExpiry = saved.expiry;
        }

        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ].join(' '),
            callback: (response) => {
                if (response.error) {
                    console.error('[oauth] Error:', response.error);
                    if (this._rejectToken) this._rejectToken(new Error(response.error));
                    return;
                }
                this._accessToken = response.access_token;
                this._tokenExpiry = Date.now() + (response.expires_in * 1000);
                this._saveCurrent();
                console.log('[oauth] Token received, expires in', response.expires_in, 's');
                if (this._resolveToken) this._resolveToken(this._accessToken);
                this._resolveToken = null;
                this._rejectToken = null;
            }
        });
    },

    // Trả về access token hợp lệ (refresh tự động nếu hết hạn)
    async getToken() {
        // Còn hạn (> 2 phút buffer)
        if (this._accessToken && this._tokenExpiry > Date.now() + 120_000) {
            return this._accessToken;
        }
        // Hết hạn hoặc chưa có → yêu cầu token mới
        return new Promise((resolve, reject) => {
            this._resolveToken = resolve;
            this._rejectToken = reject;
            try {
                // prompt: '' = silent refresh nếu user đã đồng ý trước
                this._tokenClient.requestAccessToken({ prompt: '' });
            } catch {
                this._tokenClient.requestAccessToken({ prompt: 'consent' });
            }
        });
    },

    // Có token hợp lệ trong bộ nhớ không?
    isSignedIn() {
        return !!(this._accessToken && this._tokenExpiry > Date.now() + 30_000);
    },

    // Thu hồi token + xoá localStorage
    async signOut() {
        if (this._accessToken) {
            google.accounts.oauth2.revoke(this._accessToken, () => {
                console.log('[oauth] Token revoked');
            });
        }
        this._accessToken = null;
        this._tokenExpiry = 0;
        localStorage.removeItem('_gsi_tok');
    },

    _saveCurrent() {
        try {
            localStorage.setItem('_gsi_tok', JSON.stringify({
                token: this._accessToken,
                expiry: this._tokenExpiry
            }));
        } catch { /* localStorage full */ }
    },

    _loadSaved() {
        try {
            const raw = localStorage.getItem('_gsi_tok');
            if (!raw) return null;
            const { token, expiry } = JSON.parse(raw);
            // Chỉ dùng nếu còn hơn 5 phút
            if (expiry > Date.now() + 300_000) return { token, expiry };
            localStorage.removeItem('_gsi_tok');
            return null;
        } catch { return null; }
    }
};
