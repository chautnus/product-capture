# ProductSnap — Module Split Progress
last_updated: 2026-04-15

## v4.7 Split Status (app.js → 12 modules)

Plan: `C:\Users\Chau\.claude\plans\validated-bouncing-kettle.md`

| # | File | Lines | Status | Notes |
|---|------|-------|--------|-------|
| 1 | config.js | 41 | ✅ Done | APP_VERSION, DEFAULT_API_URL, DEBUG_MODE, toThumbnailUrl, attachDriveUrlFallback, initDebugOverlay |
| 2 | i18n.js | 211 | ✅ Done | translations (EN+VI), currentLang, t(), updateTranslations() |
| 3 | data.js | 240 | ✅ Done | ImageStore, appData, syncState, loadData/saveData, pending/deleted helpers |
| 4 | api.js | 87 | ✅ Done | API object, all Apps Script calls, API.url init |
| 5 | auth.js | 250 | ✅ Done | currentUser, login/logout, applyRoleUI, users CRUD |
| 6 | camera.js | 83 | ✅ Done | capturedImages, cameraStream, start/capture/stop/switch/remove |
| 7 | form.js | 260 | ✅ Done | selectedCategory, productNamesCache, renderCategories, renderDynamicForm, autocomplete |
| 8 | products.js | 223 | ✅ Done | productSearchTerm, saveProduct, renderProducts |
| 9 | detail.js | 114 | ✅ Done | showProductDetail, confirmDeleteProduct, deleteProductById |
| 10 | settings.js | 100 | ✅ Done | editingCategoryId, renderCategoriesSettings, openEditCategory, removeField, deleteCategory |
| 11 | sync.js | 200 | ✅ Done | setupAutoSync, syncPendingToCloud, syncFromCloud, mergeCategories, mergeProducts, updateConnectionStatus, updateLocalDataCount |
| 12 | app.js | 380 | ✅ Done | SW block + MODALS + NAVIGATION + 5 init functions + DOMContentLoaded core |

## v4.7 CSS Split (app.css → 8 modules)
- css/variables.css, layout.css, camera.css, form.css, products.css, settings.css, nav.css, overlays.css
- app.css: 16 lines (@import only + @media responsive)
- nav height bug fixed: padding-bottom: calc(80px + env(safe-area-inset-bottom))
- sw.js: bumped to v12, ASSETS_TO_CACHE has all 19 js/css files
- Bug fixed: config.js + i18n.js had export/import keywords removed (global scope restored)

## Post-split TODOs ✅
- [x] Update index.html: 12 script tags with js/ prefix, CSS v=4.7
- [x] Update sw.js: ASSETS_TO_CACHE updated, bump to v12
- [x] Fix app.css: nav height bug
- [x] Fix ES module export/import bug in config.js + i18n.js
- [x] git push v4.7

## Sync Bug Fix Plan (active)
Plan: `C:\Users\Chau\.claude\plans\twinkling-puzzling-dongarra.md`

| # | Bug | Root Cause | Status |
|---|-----|-----------|--------|
| 1 | Duplicate records | saveProduct() no ID check before appendRow | 🔒 Needs GAS split first |
| 2 | Slow upload | Sequential Drive API (structural) | ⏸ Deferred |
| 3 | Pending never clears | No detail UI, stuck isSyncing flag | 🔄 Phase 1 |
| 4 | Categories don't sync cross-device | setupAutoSync has no interval, no pull after push | 🔄 Phase 1 |
| 5 | Version warning (apiVersion 4.6 vs 4.7) | GAS not redeployed | 🔒 Needs GAS split first |

### Phase 1 ✅ DONE (commit 3277a72)
- [x] setupAutoSync: recursive pollCloud() every 2min
- [x] syncPendingToCloud: pull from cloud after successful push
- [x] syncPendingToCloud: isSyncing stuck guard (3min, reset in finally)
- [x] index.html: #pending-detail expandable list + clear button
- [x] js/data.js: updatePendingBadge O(N) grouped display
- [x] js/app.js: clear-stuck-pending click handler

### Phase 2 — /split-plan google-apps-script.js (1048 lines, SYSTEM LOCK)
Split thành thư mục gas/ (10 files, tất cả < 250 lines, GAS global scope):
- [x] gas/config.js       (15 lines)   — CONFIG constants ✅
- [x] gas/helpers.js      (59 lines)   — getImagesFolderId, updateSetting, parseJSON, parseImageCell ✅
- [x] gas/columns.js      (98 lines)   — getDataColumns, addColumn, syncFieldsToColumns, ensureColumnExists ✅
- [x] gas/product-names.js (67 lines)  — getProductNames, addProductName ✅
- [x] gas/categories.js   (83 lines)   — getCategories, saveCategory, deleteCategory ✅ (apiVersion→4.7)
- [x] gas/users.js        (117 lines)  — loginUser, getUsers, addUser, updateUser, deleteUser ✅
- [x] gas/products.js     (207 lines)  — getData, saveProduct (LockService+ID check), uploadImages, getOrCreateSubfolder, deleteProduct ✅
- [x] gas/sync.js         (75 lines)   — syncAll ✅
- [x] gas/setup.js        (148 lines)  — initialSetup, createImagesFolder ✅
- [x] gas/webapp.js       (93 lines)   — doGet, doPost ✅
- [x] gas/tests.js        (28 lines)   — test functions ✅
Note: GAS multi-file = tất cả .gs trong cùng project chia sẻ global scope, không cần import

### Phase 3 — google-apps-script.js (after split)
- [x] saveProduct(): LockService + ID check before appendRow ✅
- [x] apiVersion: '4.6' → '4.7' (getCategories + getData) ✅
- [x] Assembled from gas/ files into google-apps-script.js ✅

### Phase 4 ✅ DONE (commit 42ebebb)
- [x] gas/ split: 11 files committed + pushed
- [x] google-apps-script.js assembled + pushed
- [ ] Redeploy Apps Script in GAS editor (manual — user pending)

### Phase 5 ✅ DONE — Category sync bugs
- [x] Bug A: `confirm-add-category` → `addToPending('CREATE_CATEGORY', newCat)` added (js/app.js)
- [x] Bug B: `confirm-edit-category` → `addToPending('UPDATE_CATEGORY', {...category})` added (js/app.js)
- [x] Split: `initSettingsListeners` moved app.js→settings.js (app.js: 275→204 lines)
