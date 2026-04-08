# Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   MOBILE / DESKTOP                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              PWA (3 static files)                │   │
│  │  index.html  ·  app.css  ·  app.js               │   │
│  │                                                  │   │
│  │  • Camera capture (web API + native input)       │   │
│  │  • Dynamic category forms                        │   │
│  │  • Offline-first with pending sync queue         │   │
│  │  • Share Target API (receive images)             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   GITHUB PAGES                           │
│  index.html · app.css · app.js · sw.js · manifest.json  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              GOOGLE APPS SCRIPT (Web App)                │
│  doGet()  →  getCategories, getData, getProductNames     │
│  doPost() →  saveProduct, deleteProduct, saveCategory    │
└─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────┐
│    GOOGLE SHEETS    │   │      GOOGLE DRIVE        │
│  • Data             │   │  ProductCapture_Images/  │
│  • Categories       │   │  ├── plants/             │
│  • ProductNames     │   │  │   └── Sen đá/         │
│  • Settings         │   │  ├── pots/               │
└─────────────────────┘   └─────────────────────────┘
```

---

## Frontend

### Files

| File | Purpose |
|------|---------|
| `index.html` | HTML shell — structure only, no inline scripts or styles |
| `app.css` | All styles — CSS variables, components, responsive |
| `app.js` | All application logic — state, camera, API, sync |
| `sw.js` | Service Worker — cache-first, Share Target POST handler |
| `manifest.json` | PWA config — icons, theme color, share_target definition |

No build step. Edit files directly, push to GitHub Pages.

---

## State Management

All state is module-level variables in `app.js`:

| Variable | Storage | Contents |
|----------|---------|----------|
| `appData` | localStorage | Category definitions + product metadata (no images) |
| `syncState` | localStorage | Pending changes queue, deleted IDs, last sync timestamp |
| `capturedImages` | In-memory only | Base64 images for current capture session |
| Product images | IndexedDB (`ProductSnapImages`) | Full base64 image arrays, keyed by product ID |

### Why IndexedDB for Images?

localStorage has a 5-10MB limit per origin. A single 4K JPEG at 95% quality encodes to ~5MB in base64. Storing images in localStorage causes silent quota failures after 1-2 products.

IndexedDB has no practical quota limit on modern devices (typically up to 50-80% of available disk space).

---

## Offline Strategy

### Write path (save product)
1. User taps "Save Product"
2. Images stored in IndexedDB immediately
3. Product metadata stored in localStorage (`appData.products`)
4. Change added to `syncState.pendingChanges` queue (metadata only, no images)
5. If online: auto-sync triggers after 1 second
6. If offline: change stays in queue

### Sync path (pending → cloud)
1. `syncPendingToCloud()` iterates `pendingChanges`
2. For `CREATE_PRODUCT`: loads images from IndexedDB, sends product + images to API
3. For `DELETE_PRODUCT`: sends delete request
4. On success: removes change from queue

### Sync from cloud
1. `syncFromCloud()` fetches categories + products from Apps Script API
2. Smart merge with timestamp conflict resolution (newer timestamp wins)
3. Deleted IDs tracked in `syncState.deletedIds` — cloud items with matching IDs are ignored

---

## Share Target API

Flow when user shares images from another app to ProductSnap:

1. OS sends POST request to `./index.html` (declared in `manifest.json` → `share_target`)
2. Service Worker (`sw.js`) intercepts POST in `fetch` handler
3. Converts image files to base64, stores in IndexedDB (`ProductSnapShare` store)
4. Redirects to `./index.html?shared=true`
5. App detects `?shared=true` on load → requests shared data from SW via `MessageChannel`
6. `handleSharedImages()` receives base64 arrays → adds to `capturedImages` in-memory
7. App switches to Capture tab, shows received images in thumbnail strip

**Note:** Share Target only works when the PWA is installed (Add to Home Screen).

---

## Backend (Google Apps Script)

Single file: `google-apps-script.js` — paste into Apps Script editor.

### API Endpoints

| Method | Action | Description |
|--------|--------|-------------|
| GET | `ping` | Health check |
| GET | `getCategories` | Get all categories |
| GET | `getData?category=X` | Get products (all or by category) |
| GET | `getProductNames?category=X` | Get product names for autocomplete |
| POST | `saveProduct` | Save product + upload images to Drive |
| POST | `deleteProduct` | Delete product row |
| POST | `saveCategory` | Create or update category |
| POST | `deleteCategory` | Delete category row |
| POST | `syncAll` | Bulk sync categories + products |
| POST | `addProductName` | Add name to ProductNames sheet |

### Image Upload

`uploadImages(images, productId, category, productName)`:
- Creates folder structure: `ProductCapture_Images/{category}/{productName}/`
- Decodes base64 → uploads as JPEG to Drive
- Returns array of `https://drive.google.com/uc?id={fileId}` URLs
- Sets file sharing to "Anyone with link can view"

---

## Deployment

### GitHub Pages

```bash
# Clone
git clone https://github.com/chautnus/product-capture C:\dev\product-capture
cd C:\dev\product-capture

# Push changes
git add index.html app.css app.js sw.js manifest.json
git commit -m "Update: description"
git push origin main
```

GitHub Pages auto-deploys from the `main` branch. URL: `https://chautnus.github.io/product-capture/`

### Google Apps Script via clasp

```bash
# Install clasp globally (one-time)
npm install -g @google/clasp

# Authenticate (opens browser)
clasp login

# Get your Script ID from Apps Script editor:
# URL: https://script.google.com/d/SCRIPT_ID/edit
# OR: Project Settings → Script ID

# Create .clasp.json (do NOT commit to Git)
echo '{"scriptId":"YOUR_SCRIPT_ID","rootDir":"./"}' > .clasp.json

# Add to .gitignore
echo ".clasp.json" >> .gitignore

# Push and deploy
clasp push                             # Upload code
clasp deploy --description "v4.0"     # Create new deployment
clasp deployments                      # List deployments and get URL
```

> **Important:** Every `clasp deploy` creates a **new deployment URL**. Update the URL in the app's Settings after each backend deployment.

---

## Security Notes

- The Apps Script deployment URL acts as an authentication token — keep it private
- The URL is stored in `localStorage` only, never in source code
- `.clasp.json` (contains Script ID) must not be committed to Git
- Apps Script deployed as "Execute as: Me, Anyone can access" — the URL is the only access control
- No user authentication is implemented — suitable for single-user or trusted-team use only
