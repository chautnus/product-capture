// ==================== AUTO-SYNC ====================
function setupAutoSync() {
    window.addEventListener('online', () => {
        console.log('Online - auto syncing pending changes...');
        showToast(currentLang === 'vi' ? 'Đã có mạng - đang đồng bộ...' : 'Online - syncing...');
        syncPendingToCloud();
    });

    window.addEventListener('offline', () => {
        console.log('Offline');
        showToast(currentLang === 'vi' ? 'Mất kết nối mạng' : 'You are offline');
    });

    if (navigator.onLine && API.url && syncState.pendingChanges.length > 0) {
        setTimeout(() => syncPendingToCloud(), 2000);
    }

    // Recursive setTimeout: pull from cloud every 2min — catches other devices' changes
    // Uses recursive pattern (not setInterval) to prevent overlap if syncFromCloud > 2min
    async function pollCloud() {
        if (navigator.onLine && API.url && !syncState.isSyncing) {
            try { await syncFromCloud(); } catch(e) { /* silent — background poll */ }
        }
        setTimeout(pollCloud, 2 * 60 * 1000);
    }
    setTimeout(pollCloud, 2 * 60 * 1000);
}

// ==================== SYNC FUNCTIONS ====================
async function syncPendingToCloud() {
    // Stuck isSyncing guard: auto-reset if stuck > 3 minutes
    if (syncState.isSyncing) {
        const stuckMs = Date.now() - (syncState.isSyncingStarted || 0);
        if (stuckMs > 3 * 60 * 1000) {
            console.warn('[sync] isSyncing stuck for 3min, resetting');
            syncState.isSyncing = false;
            syncState.isSyncingStarted = 0;
        } else {
            console.log('Already syncing, skipping...');
            return { synced: 0, failed: 0 };
        }
    }

    if (!API.url) {
        console.log('API not configured');
        return { synced: 0, failed: 0 };
    }

    if (syncState.pendingChanges.length === 0) {
        console.log('No pending changes');
        return { synced: 0, failed: 0 };
    }

    syncState.isSyncing = true;
    syncState.isSyncingStarted = Date.now();
    let synced = 0;
    let failed = 0;

    try {
        const pendingCopy = [...syncState.pendingChanges];
        const syncedIds = []; // P5: collect IDs to batch-remove at the end

        for (const change of pendingCopy) {
            try {
                let result = null;

                switch (change.type) {
                    case 'CREATE_PRODUCT': {
                        // Load real images from IndexedDB for upload
                        const images = await ImageStore.get(change.data.id);
                        result = await API.saveProduct({ ...change.data, images });
                        break;
                    }
                    case 'DELETE_PRODUCT':
                        result = await API.deleteProduct(change.data.id);
                        break;
                    case 'CREATE_CATEGORY':
                    case 'UPDATE_CATEGORY':
                        result = await API.saveCategory(change.data);
                        break;
                    case 'DELETE_CATEGORY':
                        result = await API.deleteCategory(change.data.id);
                        break;
                }

                if (result && result.success) {
                    syncedIds.push(change.id); // batch, not immediate
                    synced++;
                    console.log(`Synced: ${change.type} - ${change.data.id || change.data.name}`);
                } else {
                    failed++;
                    console.log(`Failed: ${change.type}`, result);
                }
            } catch (e) {
                failed++;
                console.error(`Error syncing ${change.type}:`, e);
            }
        }

        // P5: one batch removal = one saveSyncState() = one DOM update
        if (syncedIds.length > 0) {
            removeFromPendingBatch(syncedIds);
            // Pull fresh cloud state after successful push — ensures other devices' changes are seen
            if (navigator.onLine && API.url) {
                try { await syncFromCloud(); } catch(e) { console.warn('[sync] pull after push failed:', e); }
            }
        }
    } finally {
        // Always reset — isSyncingStarted = 0 prevents false-positive stuck detection
        syncState.isSyncing = false;
        syncState.isSyncingStarted = 0;
        syncState.lastSyncTimestamp = Date.now();
        saveSyncState();
    }

    return { synced, failed };
}

async function syncFromCloud() {
    if (!API.url) throw new Error('API not configured');

    const catResult = await API.getCategories();
    if (catResult && catResult.success && catResult.categories) {
        mergeCategories(catResult.categories);
    }

    const prodResult = await API.getProducts('all');
    if (prodResult && prodResult.success && prodResult.products) {
        mergeProducts(prodResult.products);
    }

    // Detect stale Apps Script deployment
    const serverVersion = (prodResult && prodResult.apiVersion) || (catResult && catResult.apiVersion);
    const warnEl = document.getElementById('apps-script-warning');
    if (serverVersion !== APP_VERSION) {
        console.warn('[API] Server version', serverVersion, 'does not match client', APP_VERSION);
        if (warnEl) warnEl.style.display = 'flex';
    } else if (warnEl) {
        warnEl.style.display = 'none';
    }

    syncState.lastSyncTimestamp = Date.now();
    saveSyncState();
    saveData();

    renderCategories();
    renderCategoriesSettings();
    renderProducts();
    updateLocalDataCount();
    loadProductNames(); // S3: refresh autocomplete cache after cloud sync
}

function mergeCategories(cloudCategories) {
    const localMap = new Map(appData.categories.map(c => [c.id, c]));

    cloudCategories.forEach(cloudCat => {
        if (isDeleted('category', cloudCat.id)) return;

        const localCat = localMap.get(cloudCat.id);

        if (!localCat) {
            appData.categories.push(cloudCat);
        } else {
            const cloudTime = new Date(cloudCat.updatedAt || cloudCat.createdAt || 0).getTime();
            const localTime = new Date(localCat.updatedAt || localCat.createdAt || 0).getTime();
            if (cloudTime > localTime) {
                Object.assign(localCat, cloudCat);
            }
        }
    });
}

function mergeProducts(cloudProducts) {
    const localMap = new Map(appData.products.map(p => [p.id, p]));

    cloudProducts.forEach(cloudProd => {
        if (isDeleted('product', cloudProd.id)) return;

        const localProd = localMap.get(cloudProd.id);

        if (!localProd) {
            // Keep cloud URLs in images array so thumbnails can render
            appData.products.push({ ...cloudProd });
        } else {
            const cloudTime = new Date(cloudProd.updatedAt || cloudProd.createdAt || 0).getTime();
            const localTime = new Date(localProd.updatedAt || localProd.createdAt || 0).getTime();
            if (cloudTime > localTime) {
                const index = appData.products.findIndex(p => p.id === cloudProd.id);
                if (index > -1) {
                    // Preserve local IndexedDB base64 if present; otherwise use cloud URLs
                    const hadLocalImages = localProd.images && localProd.images.length > 0
                        && typeof localProd.images[0] === 'string' && localProd.images[0].startsWith('data:');
                    appData.products[index] = {
                        ...cloudProd,
                        images: hadLocalImages ? localProd.images : cloudProd.images
                    };
                }
            }
        }
    });
}

function updateConnectionStatus() {
    const url = localStorage.getItem('productSnapAPIUrl');
    if (url) {
        API.url = url;
        API.ping().then(result => {
            const statusEl = document.getElementById('connection-status');
            if (result && result.success) {
                statusEl.textContent = t('connected');
                statusEl.style.borderLeftColor = 'var(--success)';
                document.getElementById('sync-now').style.display = 'block';
                document.getElementById('sync-from-cloud').style.display = 'block';
            }
        });
    }
}

function updateLocalDataCount() {
    const countEl = document.getElementById('local-products-count');
    if (countEl) {
        countEl.textContent = appData.products.length;
    }
}
