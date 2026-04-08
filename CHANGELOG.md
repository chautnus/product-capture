# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [4.0.0] - 2026-04-08

### Changed
- Split monolithic `index.html` (~3000 lines) into separate `index.html` + `app.css` + `app.js`
- Images now stored in **IndexedDB** (`ProductSnapImages`) instead of localStorage — eliminates 5-10MB quota overflow
- Service Worker bumped to v5 to force cache refresh on all clients

### Fixed
- **Bug 1 (CRITICAL):** localStorage quota exhaustion — base64 4K images (~5MB each) silently failed to save after 1-2 products. Images now stored in IndexedDB with no practical quota limit.
- **Bug 2 (HIGH):** Save Product button permanently stuck `disabled` when any JavaScript exception occurred during save. Fixed with `try/finally` block.
- **Bug 3 (HIGH):** Duplicate event listener on `sync-now` button triggered two API calls on every sync click. Removed the stale `API.syncAll()` listener.
- **Bug 4 (HIGH):** Form was cleared *before* save was confirmed — data loss if network failed mid-save. Form now resets only after successful local save.
- **Bug 5 (MEDIUM):** Required "Product Name" field (`required: true`) was never validated before saving. Added validation with focus and alert.
- **Bug 6 (HIGH):** Backend `saveProduct()` referenced undefined variable `images` instead of `product.images`. Fixed in `google-apps-script.js` line 518.
- **Bug A:** Service Worker registration used absolute path `/sw.js` — failed on GitHub Pages subdirectory. Changed to `./sw.js`.
- `syncPendingToCloud()` now loads images from IndexedDB at sync time (images are not stored in `syncState` queue, avoiding localStorage overflow for pending items)
- `deleteProductById()` now also deletes images from IndexedDB
- `renderProducts()` lazy-loads thumbnails from IndexedDB after initial render
- `showProductDetail()` loads full image gallery from IndexedDB

### Added
- `ImageStore` module — IndexedDB wrapper with `put()`, `get()`, `delete()` methods
- Auto-migration: on first load, existing products with embedded base64 images in localStorage are migrated to IndexedDB automatically
- Required field indicator (`*`) in dynamic form labels

---

## [3.1.0] - 2025-04-08

### Added
- Offline-first pending sync queue with auto-sync when back online
- Smart merge with timestamp conflict resolution (newer timestamp wins)
- `deletedIds` tracking to prevent re-syncing deleted items from cloud
- Auto-cleanup of pending changes older than 7 days
- Pending badge on Settings tab nav icon
- Sync Status section in Settings (pending count, last sync time)
- `saveCategory` and `deleteCategory` API endpoints in backend
- "Use Phone Camera" button — triggers native phone camera app

### Fixed
- Autocomplete now merges local + cloud product names
- Save button disabled during upload to prevent double-submit
- Form correctly resets after save
- `sync-from-cloud` button added to Settings

---

## [3.0.0] - 2025-04-08

### Added
- Folder structure for Drive images: `ProductCapture_Images/{category}/{productName}/`
- Image URL format: comma-separated URLs (removed JSON array wrapping)
- Full PRD documentation

### Fixed
- PWA 404 error: manifest and service worker now use relative paths (`./`)

---

## [2.1.0] - 2025-04-08

### Added
- "Sync from Cloud" button — downloads categories and products from Google Sheets
- Field types: `date`, `time`, `datetime`
- Placeholder text localization (EN/VI) for all input types

---

## [2.0.0] - 2025-04-07

### Added
- ProductNames sheet for autocomplete (separate from Data sheet)
- Autocomplete dropdown with real-time filtering
- "Create new" button when product name not found
- Product detail modal with image gallery and field table
- Folder-view data browser (Category → Product Name → Items)
- Delete product from detail modal
- Share Target API — receive images shared from other apps
- Service Worker with offline caching
- PWA manifest with icons

---

## [1.0.0] - 2025-04-07

### Added
- Initial release
- Camera capture via web API (getUserMedia) with 4K resolution
- Switch front/rear camera
- Stop camera button
- Select from photo gallery
- Dynamic form fields per category (text, number, boolean, select, URL)
- Category management (add, edit, delete)
- Google Sheets sync via Google Apps Script
- Auto-create columns for new dynamic fields
- Bottom navigation (Capture / Data / Settings)
- EN/VI bilingual UI
- Keep selected category after saving
