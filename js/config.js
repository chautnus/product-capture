// ==================== CONFIG ====================
const APP_VERSION = '5.0';

// ⚙️ Google Cloud Console → OAuth 2.0 Client ID (Web application)
// Thay bằng Client ID thật sau khi tạo trên console.cloud.google.com
const OAUTH_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// Debug mode: enable with ?debug=1 in URL
const DEBUG_MODE = new URLSearchParams(location.search).get('debug') === '1';

// Convert Google Drive uc?id=XXX (and related) format to reliable thumbnail URL
function toThumbnailUrl(url, size = 200) {
    if (!url || typeof url !== 'string') return url;
    const m = url.match(/drive\.google\.com\/(?:uc\?(?:export=view&)?id=|thumbnail\?id=|file\/d\/)([a-zA-Z0-9_-]+)/);
    if (!m) return url; // base64 data: URIs and other URLs pass through unchanged
    // Primary: thumbnail API with size hint (loads as image, no redirect)
    return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}`;
}

// Attach onerror fallback to swap Drive URL format if primary fails
function attachDriveUrlFallback(imgEl, primarySrc) {
    if (!imgEl || !primarySrc || !primarySrc.includes('drive.google.com')) return;
    imgEl.onerror = () => {
        imgEl.onerror = null;
        const m = primarySrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) imgEl.src = `https://drive.google.com/uc?export=view&id=${m[1]}`;
    };
}

// ==================== DYNAMIC SCRIPT LOADER ====================
// Load Google Identity Services + new API modules sau khi config.js xong
// Không chạm vào index.html (SYSTEM LOCK). Dispatch 'google-api-ready' khi xong.
(function () {
    const SCRIPTS = [
        'https://accounts.google.com/gsi/client',
        `js/oauth.js?v=${APP_VERSION}`,
        `js/sheets-api.js?v=${APP_VERSION}`,
        `js/drive-api.js?v=${APP_VERSION}`,
        `js/wizard.js?v=${APP_VERSION}`,
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload  = resolve;
            s.onerror = () => reject(new Error(`Script load failed: ${src}`));
            document.head.appendChild(s);
        });
    }

    SCRIPTS.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
        .then(() => {
            window._gApiReady = true;
            document.dispatchEvent(new CustomEvent('google-api-ready'));
        })
        .catch(err => console.error('[config] Script load error:', err));
})();

// Debug overlay — shows tap coordinates + target element
function initDebugOverlay() {
    if (!DEBUG_MODE) return;
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.style.cssText = 'position:fixed;top:70px;left:8px;right:8px;z-index:9999;background:rgba(255,0,0,0.92);color:#fff;font-size:11px;padding:6px 8px;border-radius:4px;font-family:monospace;pointer-events:none;line-height:1.3;word-break:break-all;';
    overlay.textContent = `DEBUG v${APP_VERSION} loaded — tap anywhere`;
    document.body.appendChild(overlay);

    document.addEventListener('click', (e) => {
        const rect = e.target.getBoundingClientRect();
        const cls = typeof e.target.className === 'string' ? e.target.className : (e.target.className.baseVal || '');
        overlay.textContent = `tap ${e.clientX},${e.clientY} | <${e.target.tagName.toLowerCase()}> .${cls || '(no-class)'} | rect ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
    }, true);
}
