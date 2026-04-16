// ==================== AUTO-SYNC ====================
function setupAutoSync() {
    window.addEventListener('online', () => {
        showToast(currentLang === 'vi' ? 'Đã có mạng - đang đồng bộ...' : 'Online - syncing...');
        syncPendingToCloud();
    });

    window.addEventListener('offline', () => {
        showToast(currentLang === 'vi' ? 'Mất kết nối mạng' : 'You are offline');
    });

    // Push bất kỳ pending nào còn sót lại khi app mở (2s delay)
    if (navigator.onLine && SheetsAPI.spreadsheetId && syncState.pendingChanges.length > 0) {
        setTimeout(() => syncPendingToCloud(), 2000);
    }

    // Recursive poll: kéo cloud mỗi 2 phút, không overlap
    async function pollCloud() {
        if (navigator.onLine && SheetsAPI.spreadsheetId && !syncState.isSyncing) {
            try { await syncFromCloud(); } catch { /* silent — background */ }
        }
        setTimeout(pollCloud, 2 * 60 * 1000);
    }
    setTimeout(pollCloud, 2 * 60 * 1000);
}

// ==================== SYNC FUNCTIONS ====================
async function syncPendingToCloud() {
    // Guard: auto-reset nếu isSyncing bị stuck > 3 phút
    if (syncState.isSyncing) {
        const stuckMs = Date.now() - (syncState.isSyncingStarted || 0);
        if (stuckMs > 3 * 60 * 1000) {
            console.warn('[sync] isSyncing stuck 3min — resetting');
            syncState.isSyncing = false;
            syncState.isSyncingStarted = 0;
        } else {
            return { synced: 0, failed: 0 };
        }
    }

    if (!SheetsAPI.spreadsheetId) return { synced: 0, failed: 0 };
    if (syncState.pendingChanges.length === 0) return { synced: 0, failed: 0 };

    syncState.isSyncing = true;
    syncState.isSyncingStarted = Date.now();
    let synced = 0, failed = 0;

    try {
        const pendingCopy = [...syncState.pendingChanges];
        const syncedIds = [];

        for (const change of pendingCopy) {
            try {
                let result = null;
                switch (change.type) {
                    case 'CREATE_PRODUCT': {
                        const images = await ImageStore.get(change.data.id);
                        result = await SheetsAPI.saveProduct({ ...change.data, images });
                        break;
                    }
                    case 'DELETE_PRODUCT':
                        result = await SheetsAPI.deleteProduct(change.data.id);
                        break;
                    case 'CREATE_CATEGORY':
                    case 'UPDATE_CATEGORY':
                        result = await SheetsAPI.saveCategory(change.data);
                        break;
                    case 'DELETE_CATEGORY':
                        result = await SheetsAPI.deleteCategory(change.data.id);
                        break;
                }

                if (result && result.success) {
                    syncedIds.push(change.id);
                    synced++;
                } else {
                    failed++;
                    console.warn('[sync] Failed:', change.type, result);
                }
            } catch(e) {
                failed++;
                console.error('[sync] Error:', change.type, e);
            }
        }

        if (syncedIds.length > 0) {
            removeFromPendingBatch(syncedIds);
            // Cloud-Authoritative Pull: kéo trạng thái mới nhất sau push thành công
            if (navigator.onLine && SheetsAPI.spreadsheetId) {
                try { await syncFromCloud(); } catch(e) { console.warn('[sync] pull after push failed:', e); }
            }
        }
    } finally {
        syncState.isSyncing = false;
        syncState.isSyncingStarted = 0;
        syncState.lastSyncTimestamp = Date.now();
        saveSyncState();
    }

    return { synced, failed };
}

// ── Cloud-Authoritative Pull ──────────────────────────────────────────────────
// Cloud WINS. Không merge — replace local (trừ items đang pending).
async function syncFromCloud() {
    if (!SheetsAPI.spreadsheetId) throw new Error('Workspace not configured');

    const catResult  = await SheetsAPI.getCategories();
    const prodResult = await SheetsAPI.getProducts('all');

    if (catResult.success && prodResult.success) {
        replaceFromCloud(catResult.categories, prodResult.products);
    }

    syncState.lastSyncTimestamp = Date.now();
    saveSyncState();
    saveData();

    renderCategories();
    renderCategoriesSettings();
    renderProducts();
    updateLocalDataCount();
    if (typeof loadProductNames === 'function') loadProductNames();
    updateConnectionStatus();
}

// Cloud-Authoritative replace: cloud wins, trừ items đang pending (uncommitted)
function replaceFromCloud(cloudCats, cloudProds) {
    const pendingIds = new Set(
        syncState.pendingChanges.map(c => c.data?.id).filter(Boolean)
    );

    // Categories: giữ pending local, lấy cloud cho phần còn lại
    appData.categories = [
        ...appData.categories.filter(c => pendingIds.has(c.id)),
        ...cloudCats.filter(c => !pendingIds.has(c.id) && !c._deleted)
    ];

    // Products: tương tự — giữ local pending (có thể có base64 images)
    appData.products = [
        ...appData.products.filter(p => pendingIds.has(p.id)),
        ...cloudProds.filter(p => !pendingIds.has(p.id) && !p._deleted)
    ];
}

// ==================== CONNECTION STATUS ====================
function updateConnectionStatus() {
    const statusEl  = document.getElementById('connection-status');
    const apiUrlEl  = document.getElementById('api-url-input');
    const syncNowEl = document.getElementById('sync-now');
    const syncFromEl = document.getElementById('sync-from-cloud');

    const connected = typeof OAuthClient !== 'undefined'
        && OAuthClient.isSignedIn()
        && !!SheetsAPI.spreadsheetId;

    if (statusEl) {
        if (connected) {
            statusEl.textContent = t('connected');
            statusEl.style.borderLeftColor = 'var(--success)';
        } else {
            statusEl.textContent = t('not_connected');
            statusEl.style.borderLeftColor = 'var(--danger)';
        }
    }
    if (apiUrlEl && SheetsAPI.spreadsheetId) {
        apiUrlEl.value = `https://docs.google.com/spreadsheets/d/${SheetsAPI.spreadsheetId}`;
        apiUrlEl.readOnly = true;
    }
    if (syncNowEl)  syncNowEl.style.display  = connected ? 'block' : 'none';
    if (syncFromEl) syncFromEl.style.display  = connected ? 'block' : 'none';
}

function updateLocalDataCount() {
    const countEl = document.getElementById('local-products-count');
    if (countEl) countEl.textContent = appData.products.length;
}
