# ProductSnap — Project Memory
last_updated: 2026-04-16 (bookmarklet feature)

---

## Phiên bản hiện tại: v5.0 (commit b7f2a69)

### Thay đổi lớn nhất so với v4.7
- **GAS bị xoá hoàn toàn** — thay bằng Google Sheets API v4 trực tiếp từ browser
- **OAuth 2.0** (Google Identity Services) thay username/password + GAS URL
- **Multi-tenant**: mỗi Google account → tự động tạo spreadsheet riêng "ProductSnap Workspace"
- **Cloud-Authoritative Pull**: `replaceFromCloud()` thay merge — cloud luôn thắng (trừ pending items)
- **Setup Wizard**: tự động khi chưa có OAuth token, inject HTML vào DOM (không sửa index.html)
- **Bookmarklet Import**: lấy ảnh từ trang web bất kỳ → `?import=` URL param → auto-select category

---

## Module Map — v5.0

| # | File | Lines | Vai trò |
|---|------|-------|---------|
| 1 | `js/config.js` | 74 | APP_VERSION='5.0', OAUTH_CLIENT_ID, dynamic script loader, debug overlay |
| 2 | `js/i18n.js` | 220 | translations (EN+VI), currentLang, t(), updateTranslations() |
| 3 | `js/data.js` | 255 | ImageStore(IndexedDB), appData, syncState, loadData/saveData, pending helpers |
| 4 | `js/oauth.js` | 99 | **NEW** GIS token client, auto-refresh, revoke |
| 5 | `js/sheets-api.js` | 231 | **NEW** Sheets API v4 wrapper — CRUD cho categories/products/users |
| 6 | `js/drive-api.js` | 88 | **NEW** Drive API v3 — upload ảnh, tạo folder tự động |
| 7 | `js/wizard.js` | 165 | **NEW** Setup wizard (DOM-injected, zero index.html changes) |
| 8 | `js/auth.js` | 208 | currentUser, login/logout, applyRoleUI, users CRUD — dùng SheetsAPI |
| 9 | `js/camera.js` | 130 | capturedImages, cameraStream, start/capture/stop/switch/remove, **fetchImageAsBase64, handleWebImport** |
| 10 | `js/form.js` | 260 | ⚠️ LOCK selectedCategory, renderCategories, renderDynamicForm, autocomplete |
| 11 | `js/products.js` | 224 | productSearchTerm, saveProduct, renderProducts, **lastCategory tracking** |
| 12 | `js/detail.js` | 114 | showProductDetail, confirmDeleteProduct, deleteProductById |
| 13 | `js/settings.js` | 194 | renderCategoriesSettings, openEditCategory, initSettingsListeners, **BOOKMARKLET_BODY + inject section** |
| 14 | `js/sync.js` | 177 | setupAutoSync, syncPendingToCloud, syncFromCloud, replaceFromCloud |
| 15 | `js/app.js` | 224 | MODALS + NAVIGATION + init functions + DOMContentLoaded (google-api-ready pattern), **?import= detection** |
| 16 | `sw.js` | 201 | Cache v13, Share Target API, offline caching |

> ⚠️ **SYSTEM LOCK**: `form.js` (260) và `data.js` (255) > 250 lines — cần `/split-plan` trước khi sửa

---

## Sync Architecture — Cloud-Authoritative Pull

```
WRITE (online):  UI → SheetsAPI.save*() → syncFromCloud() → replaceFromCloud()
WRITE (offline): UI → pendingChanges queue → khi online → push → pull
READ:            local cache + background poll mỗi 2 phút
```

### replaceFromCloud() logic
- Items trong `pendingChanges` → giữ nguyên local (uncommitted)
- Items có `_deleted=TRUE` từ cloud → bỏ qua
- Tất cả còn lại → cloud wins, replace local

---

## Google Cloud Console (1 lần, đã làm)
- Project: ProductSnap
- APIs enabled: Google Sheets API + Google Drive API
- OAuth Client ID (Web): `271749541534-0ohcjg65bmejf4gjhd4ve17quggp72q1.apps.googleusercontent.com`
- Authorized JS origins: `https://chautnus.github.io`
- `OAUTH_CLIENT_ID` đã set trong `js/config.js` line 6

---

## Spreadsheet Schema — "ProductSnap Workspace"

### Sheet "Data"
| Col | A | B | C | D | E | F | G | H | I+ |
|-----|---|---|---|---|---|---|---|---|---|
| | ID | Category | Created At | Images (URLs) | Name | Price | Data JSON | _deleted | Dynamic cols |

### Sheet "Categories"
| Col | A | B | C | D | E | F | G |
|-----|---|---|---|---|---|---|---|
| | ID | Name EN | Name VI | Icon | Fields JSON | Updated At | _deleted |

### Sheet "Users"
| Col | A | B | C | D | E |
|-----|---|---|---|---|---|
| | ID | Username | Password | Role | Created At |

> Soft-delete: `_deleted=TRUE` (không xoá row) — `getProducts`/`getCategories` filter rows này

---

## Commit History (key milestones)

| Commit | Version | Mô tả |
|--------|---------|-------|
| 3277a72 | 4.7-beta | Sync bugs phase 1: autoSync poll, isSyncing guard, pending detail UI |
| 42ebebb | 4.7 | GAS split (gas/ 11 files), LockService dedup, apiVersion 4.7 |
| e4bb110 | 4.7 | Category sync fix: addToPending trong confirm-add/edit handlers |
| d962e17 | 5.0 | **BREAKING**: GAS → Sheets API + OAuth, multi-tenant, Cloud-Authoritative Pull |
| 7e01965 | 5.0 | Set real OAuth Client ID |
| c53057c | 5.0 | feat: web image import via bookmarklet (camera.js, app.js, settings.js, products.js) |
| cd1c48d | 5.0 | fix: popup blocker (window.location.href) + DOM timing (?import= sau renderCategories) |
| b7f2a69 | 5.0 | fix: bookmarklet syntax error — `\'` trong template literal → `&apos;` |

---

## Script Load Order (Dynamic — từ config.js)

index.html loads synchronously: `config.js → i18n.js → data.js → auth.js → camera.js → form.js → products.js → detail.js → settings.js → sync.js → app.js`

config.js dynamic loads (async chain, sau đó dispatch `google-api-ready`):
`GIS (accounts.google.com) → oauth.js → sheets-api.js → drive-api.js → wizard.js`

app.js lắng nghe `google-api-ready` event → `initWithGoogle()` → OAuthClient.init() → Wizard hoặc syncFromCloud()

---

## Bookmarklet Import Flow

```
Settings → kéo [📦 Save to ProductSnap] lên bookmark bar
    ↓
Mở trang nhà cung cấp → bấm bookmark
    ↓
BOOKMARKLET_BODY chạy trên trang đó:
  - querySelectorAll('img') → filter naturalWidth/Height > 80px
  - Render overlay grid (event listeners, không inline onclick)
  - User chọn ảnh → Set<index> tracking → Import count hiển thị trực tiếp
  - [✓ Import] → window.location.href = PS + '?import=' + encodeURIComponent(urls)
    ↓
ProductSnap load với ?import= param:
  - DOMContentLoaded: parse _importUrls sớm
  - Sau renderCategories() → handleWebImport(_importUrls)
    - fetchImageAsBase64(url): fetch CORS-first, fallback lưu URL string
    - capturedImages.push(...) → renderCapturedImages()
    - auto-select localStorage('lastCategory') || categories[0]
    - renderDynamicForm() → scroll to form
    - history.replaceState() → xoá ?import= khỏi URL bar
```

### Gotchas đã fix
- `\'` trong JS template literal → bare `'` → syntax error trong bookmarklet → dùng `&apos;`
- `window.open()` bị popup blocker chặn → dùng `window.location.href`
- `handleWebImport()` chạy trước `renderCategories()` → `.category-card` chưa có → dời xuống sau

---

## Plans
- v4.7 split: `C:\Users\Chau\.claude\plans\validated-bouncing-kettle.md`
- v5.0 sync redesign + bookmarklet: `C:\Users\Chau\.claude\plans\twinkling-puzzling-dongarra.md`
