# Architecture — ProductSnap v5.0

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    MOBILE / DESKTOP                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  PWA (static files)                   │   │
│  │  index.html · app.css · js/*.js · sw.js               │   │
│  │                                                       │   │
│  │  OAuthClient ──→ Google Identity Services (GIS)       │   │
│  │  SheetsAPI   ──→ Google Sheets API v4   (CRUD)        │   │
│  │  DriveAPI    ──→ Google Drive API v3    (images)      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                           │ OAuth 2.0 token
          ┌────────────────┴─────────────────┐
          ▼                                   ▼
┌──────────────────────┐         ┌────────────────────────┐
│   GOOGLE SHEETS API  │         │    GOOGLE DRIVE API    │
│  "ProductSnap        │         │  "ProductSnap Images/" │
│   Workspace"         │         │  ├── plants/           │
│  ├── Data            │         │  │   └── Sen đá/       │
│  ├── Categories      │         │  └── pots/             │
│  ├── Users           │         └────────────────────────┘
│  └── ProductNames    │
└──────────────────────┘
        (per Google account — mỗi user có sheet riêng)
```

**Không còn Google Apps Script.** Browser gọi trực tiếp Sheets/Drive API với OAuth token.

---

## Frontend Files

| File | Lines | Vai trò |
|------|-------|---------|
| `index.html` | 438 ⚠️ LOCK | HTML shell — structure only |
| `app.css` | 16 | CSS @import wrapper |
| `css/*.css` | 8 files | Variables, layout, camera, form, products, settings, nav, overlays |
| `manifest.json` | — | PWA config — icons, share_target |
| `sw.js` | 201 | Service Worker v13 — cache-first, Share Target |
| `js/config.js` | 74 | Config, OAUTH_CLIENT_ID, dynamic script loader |
| `js/oauth.js` | 99 | GIS token client — getToken(), signOut(), isSignedIn() |
| `js/sheets-api.js` | 231 | Sheets API wrapper — findOrCreateWorkspace, CRUD |
| `js/drive-api.js` | 88 | Drive API — uploadImage, folder management |
| `js/wizard.js` | 165 | Setup wizard — OAuth flow, workspace init, admin creation |
| `js/auth.js` | 208 | currentUser, login/logout, applyRoleUI, users management |
| `js/i18n.js` | 220 | EN/VI translations |
| `js/data.js` | 255 ⚠️LOCK | appData, syncState, ImageStore (IndexedDB), pending helpers |
| `js/form.js` | 260 ⚠️LOCK | Dynamic forms, renderCategories, autocomplete |
| `js/camera.js` | 83 | Camera capture, gallery, thumbnail strip |
| `js/products.js` | 223 | renderProducts, saveProduct (client-side) |
| `js/detail.js` | 114 | Product detail modal, delete |
| `js/settings.js` | 165 | Settings UI, categories CRUD |
| `js/sync.js` | 177 | syncPendingToCloud, syncFromCloud, replaceFromCloud, poll |
| `js/app.js` | 214 | Event listeners, DOMContentLoaded, google-api-ready handler |

---

## Script Loading

index.html loads scripts **synchronously** (no defer/async):
```
config.js → i18n.js → data.js → auth.js → camera.js → form.js
→ products.js → detail.js → settings.js → sync.js → app.js
```

`config.js` (line 28–52) dynamically loads thêm via promise chain:
```
GIS script → oauth.js → sheets-api.js → drive-api.js → wizard.js
→ dispatch CustomEvent('google-api-ready')
```

`app.js` DOMContentLoaded lắng nghe `google-api-ready` event trước khi init OAuth.

---

## Auth & Workspace Flow

### First-time user (no token)
```
App load → google-api-ready → OAuthClient.init()
→ !isSignedIn() → Wizard.show()
→ Step 1: [Kết nối với Google] → OAuthClient.getToken() → OAuth popup
→ Step 2: SheetsAPI.findOrCreateWorkspace()
   ├─ search Drive: name='ProductSnap Workspace' → found → use it
   └─ not found → create spreadsheet + init headers
→ Step 3: SheetsAPI.isFirstSetup()
   ├─ true → tạo admin (username + password → addUser)
   └─ false → showLoginModal() (workspace có sẵn users)
→ currentUser saved → applyRoleUI() → setupAutoSync()
```

### Returning user (token còn hạn)
```
App load → google-api-ready → OAuthClient.init() → isSignedIn() = true
→ loadAuthState() → currentUser from localStorage
→ applyRoleUI() → setupAutoSync() → syncFromCloud()
```

### Multi-device (cùng Google account)
```
Device B → OAuth → same Google account → findOrCreateWorkspace()
→ search Drive → finds existing "ProductSnap Workspace"
→ SheetsAPI.isFirstSetup() = false → showLoginModal()
→ login với username/password đã tạo ở Device A
```

---

## Sync Architecture — Cloud-Authoritative Pull

```
┌─────────────────────────────────────────────────────┐
│                   TRUTH HIERARCHY                    │
│                                                     │
│  1. SheetsAPI (cloud) — ultimate authority          │
│  2. pendingChanges   — uncommitted local writes     │
│  3. localStorage     — read cache (stale ok)        │
└─────────────────────────────────────────────────────┘
```

### Write flow (online)
1. UI action → update `appData` optimistically (instant UX)
2. `addToPending(type, data)` → `syncState.pendingChanges`
3. `syncPendingToCloud()`:
   - Iterate pending → `SheetsAPI.save*()`/ `delete*()`
   - On success → `removeFromPendingBatch()` → `syncFromCloud()`
4. `syncFromCloud()` → `replaceFromCloud(cloudCats, cloudProds)`

### replaceFromCloud() — no merge, cloud wins
```javascript
function replaceFromCloud(cloudCats, cloudProds) {
    const pendingIds = new Set(pendingChanges.map(c => c.data?.id));
    appData.categories = [
        ...appData.categories.filter(c => pendingIds.has(c.id)), // uncommitted
        ...cloudCats.filter(c => !pendingIds.has(c.id) && !c._deleted) // cloud
    ];
    // same for products
}
```

### Background poll
- Recursive `setTimeout(pollCloud, 2min)` — không overlap nếu sync chậm
- Online event → push pending ngay lập tức
- `isSyncing` stuck guard: auto-reset sau 3 phút

### Soft delete
`deleteCategory(id)` / `deleteProduct(id)` → set `_deleted=TRUE` trong sheet (không xoá row).
`getCategories()` / `getProducts()` → filter `row[6/7] !== 'TRUE'`.

---

## State Management

| Variable | Storage | Nội dung |
|----------|---------|---------|
| `appData` | localStorage | Categories + product metadata |
| `syncState` | localStorage | pendingChanges queue, lastSyncTimestamp |
| `currentUser` | localStorage (`productSnapUser`) | `{id, username, role}` |
| OAuth token | localStorage (`_gsi_tok`) | `{token, expiry}` — tự refresh qua GIS |
| Workspace ID | localStorage (`productSnapSheetId`) | Google Sheets spreadsheetId |
| Drive root ID | localStorage (`_ps_drive_root`) | "ProductSnap Images" folder ID |
| `capturedImages` | In-memory | base64 của session hiện tại |
| Product images | IndexedDB (`ProductSnapImages`) | base64 arrays, key = product ID |

---

## Offline Strategy

### Write offline
1. `appData` + IndexedDB (images) updated immediately
2. `pendingChanges` ghi queue
3. `isSyncing` = false → không push
4. Khi online → `window.addEventListener('online')` trigger push

### Read offline
- `appData` từ localStorage (cache) → render bình thường
- Không có pull mới cho đến khi online

---

## Share Target API

1. OS POST → `./index.html` (khai báo trong `manifest.json → share_target`)
2. `sw.js` intercept POST → convert images → base64 → IndexedDB (`ProductSnapShare`)
3. Redirect → `./index.html?shared=true`
4. App detect `?shared=true` → message SW → nhận base64 → thêm vào `capturedImages`
5. Switch Capture tab → hiện ảnh shared

---

## Deployment

### GitHub Pages (frontend)
```bash
git add .
git commit -m "feat: description"
git push origin main
# Auto-deploy: https://chautnus.github.io/product-capture/
```

### Google Cloud Console (1 lần)
1. Enable: Sheets API + Drive API
2. OAuth consent screen → External
3. OAuth Client ID → Web → Authorized JS origins: `https://chautnus.github.io`
4. Copy Client ID → `js/config.js` → `OAUTH_CLIENT_ID`

**Không còn GAS deployment.** Không cần clasp, không cần redeploy sau mỗi update.

---

## Security

| Concern | Approach |
|---------|---------|
| API credentials | OAuth 2.0 — user authorizes, không có service account key |
| Spreadsheet access | Drive scope `drive.file` — chỉ đọc/ghi file do app tạo |
| OAuth Client ID | Public (bình thường cho Web OAuth clients) — không phải secret |
| App-level auth | username/password lưu trong Users sheet (plaintext — cần nâng cấp) |
| Data isolation | Mỗi Google account → spreadsheet riêng, không share mặc định |
