# Product Requirements Document
# ProductSnap v5.0

---

## Overview

| Attribute | Value |
|-----------|-------|
| **Product Name** | ProductSnap |
| **Version** | 5.0 |
| **Platform** | Progressive Web App (PWA) |
| **GitHub** | https://github.com/chautnus/product-capture |
| **Demo** | https://chautnus.github.io/product-capture/ |

---

## Problem Statement

Shop owners (plants, pots, accessories) need to photograph and catalog inventory quickly while walking around the store. Existing solutions require desktop entry, separate camera apps, or paid software. ProductSnap provides a single mobile-first tool that captures, organizes, and syncs product data in one flow — mỗi user có Google Sheets riêng, không cần setup kỹ thuật.

---

## Target Users

- Plant / flower shop owners cataloging inventory
- Staff doing product checks or pricing updates
- Small business owners building an online product catalog
- Multiple devices / team members sharing one workspace

---

## User Stories

- As a shop owner, I want to photograph a product and fill in details in one workflow without switching apps
- As a shop owner, I want my data synced to **my own** Google Sheets automatically — visible on desktop
- As a staff member, I want the app to work offline and sync when I'm back in WiFi range
- As a **new user**, I want to connect my own Google Drive with one click — no technical setup
- As a user, I want to receive images shared from my phone gallery or messaging apps (Zalo, WhatsApp)
- As a user, I want to browse my saved products organized by category and name
- As an admin, I want to manage team members who access the same workspace

---

## Functional Requirements

### 1. Camera & Image Capture

| ID | Requirement | Status |
|----|-------------|--------|
| CAM-01 | Capture via web camera API (getUserMedia) | ✅ Done |
| CAM-02 | Use native phone camera app (file input with capture) | ✅ Done |
| CAM-03 | Toggle front/rear camera | ✅ Done |
| CAM-04 | Stop camera button | ✅ Done |
| CAM-05 | High quality capture: 4096×2160, JPEG 95% | ✅ Done |
| CAM-06 | Select from photo library | ✅ Done |
| CAM-07 | Remove captured image | ✅ Done |
| CAM-08 | Thumbnail row with scroll | ✅ Done |

### 2. Categories

| ID | Requirement | Status |
|----|-------------|--------|
| CAT-01 | Add new category | ✅ Done |
| CAT-02 | Edit category (name EN/VI, icon) | ✅ Done |
| CAT-03 | Delete category (soft-delete: `_deleted=TRUE`) | ✅ Done |
| CAT-04 | EN/VI bilingual names | ✅ Done |
| CAT-05 | Keep selected category after save | ✅ Done |
| CAT-06 | Sync categories from cloud (Cloud-Authoritative Pull) | ✅ Done |
| CAT-07 | Categories synced to cloud via pending queue | ✅ Done |

### 3. Dynamic Form Fields

| ID | Field Type | Status |
|----|-----------|--------|
| FLD-01 | Text | ✅ Done |
| FLD-02 | Number | ✅ Done |
| FLD-03 | Boolean (Yes/No toggle) | ✅ Done |
| FLD-04 | Select (dropdown) | ✅ Done |
| FLD-05 | URL | ✅ Done |
| FLD-06 | Date | ✅ Done |
| FLD-07 | Time | ✅ Done |
| FLD-08 | DateTime | ✅ Done |

| ID | Requirement | Status |
|----|-------------|--------|
| FLD-09 | Add field to category | ✅ Done |
| FLD-10 | Remove field from category | ✅ Done |
| FLD-11 | Dynamic columns in Google Sheet for new fields | ✅ Done |
| FLD-12 | Bilingual placeholder text | ✅ Done |
| FLD-13 | Required field indicator (*) and validation | ✅ Done |

### 4. Product Name Autocomplete

| ID | Requirement | Status |
|----|-------------|--------|
| AUT-01 | ProductNames sheet trong Google Sheets | ✅ Done |
| AUT-02 | Real-time autocomplete as user types | ✅ Done |
| AUT-03 | Suggestion dropdown | ✅ Done |
| AUT-04 | "Create new" button when name not found | ✅ Done |
| AUT-05 | Filter suggestions by category | ✅ Done |
| AUT-06 | Refresh autocomplete after cloud sync | ✅ Done |

### 5. Data View

| ID | Requirement | Status |
|----|-------------|--------|
| DAT-01 | Folder structure: Category → Product Name → Items | ✅ Done |
| DAT-02 | Item count per folder | ✅ Done |
| DAT-03 | Tap item → detail modal | ✅ Done |
| DAT-04 | Image gallery in detail modal | ✅ Done |
| DAT-05 | Field/value table in detail modal | ✅ Done |
| DAT-06 | Delete product (soft-delete) | ✅ Done |

### 6. Google Sheets Sync (v5.0 — Direct API)

| ID | Requirement | Status |
|----|-------------|--------|
| GS-01 | Data sheet — store products | ✅ Done |
| GS-02 | Categories sheet | ✅ Done |
| GS-03 | ProductNames sheet | ✅ Done |
| GS-04 | Users sheet (app-level auth) | ✅ Done |
| GS-05 | Soft-delete column `_deleted` (no hard row deletion) | ✅ Done |
| GS-06 | serverTimestamp trả về từ mọi API response | ✅ Done |
| GS-07 | Cloud-Authoritative Pull: `replaceFromCloud()` không merge | ✅ Done |
| GS-08 | Pull sau push thành công (immediate cross-device sync) | ✅ Done |
| GS-09 | Auto-pull mỗi 2 phút (background poll) | ✅ Done |

### 7. Google Drive Image Storage (v5.0 — Direct API)

| ID | Requirement | Status |
|----|-------------|--------|
| DRV-01 | Root folder: `ProductSnap Images` | ✅ Done |
| DRV-02 | Subfolder per Category | ✅ Done |
| DRV-03 | Subfolder per Product Name | ✅ Done |
| DRV-04 | Upload ảnh base64 từ browser trực tiếp (Drive API v3) | ✅ Done |
| DRV-05 | Public view link (anyone with link) | ✅ Done |
| DRV-06 | Thumbnail URL: `drive.google.com/thumbnail?id=...&sz=w400` | ✅ Done |

### 8. Multi-Tenant & Onboarding (v5.0 — NEW)

| ID | Requirement | Status |
|----|-------------|--------|
| MT-01 | OAuth 2.0 login — "Kết nối với Google" | ✅ Done |
| MT-02 | Mỗi Google account → spreadsheet riêng tự động | ✅ Done |
| MT-03 | Tìm workspace trong Drive (không tạo trùng) | ✅ Done |
| MT-04 | Setup Wizard inject vào DOM (zero index.html changes) | ✅ Done |
| MT-05 | Tạo admin user qua wizard (username + password) | ✅ Done |
| MT-06 | Multi-device cùng account → dùng cùng sheet | ✅ Done |
| MT-07 | Logout → revoke OAuth + show wizard | ✅ Done |
| MT-08 | Token auto-refresh (GIS silent refresh) | ✅ Done |

### 9. PWA & Offline

| ID | Requirement | Status |
|----|-------------|--------|
| PWA-01 | Service Worker v13 cache-first | ✅ Done |
| PWA-02 | Web App Manifest with icons | ✅ Done |
| PWA-03 | Add to Home Screen | ✅ Done |
| PWA-04 | Share Target API (receive images from other apps) | ✅ Done |
| PWA-05 | Offline-first: pendingChanges queue | ✅ Done |
| PWA-06 | isSyncing stuck guard (3-min auto-reset) | ✅ Done |
| PWA-07 | Pending items detail view + clear button | ✅ Done |

### 10. UX

| ID | Requirement | Status |
|----|-------------|--------|
| UX-01 | Bottom navigation (Capture / Data / Settings) | ✅ Done |
| UX-02 | Toast notifications | ✅ Done |
| UX-03 | Loading / disabled states | ✅ Done |
| UX-04 | EN/VI language toggle | ✅ Done |
| UX-05 | Pending sync badge on Settings tab | ✅ Done |
| UX-06 | Connection status (linked → Google Sheets URL) | ✅ Done |
| UX-07 | Version display (v5.0) | ✅ Done |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Offline** | App must work with no network; queue changes and sync when back online |
| **Storage** | Support 500+ products; IndexedDB cho images, localStorage cho metadata |
| **Performance** | Save button < 100ms; thumbnails lazy load; background poll không block UI |
| **Compatibility** | iOS Safari 15+, Chrome Android 90+, Chrome Desktop |
| **Security** | OAuth 2.0; drive.file scope (chỉ đọc file app tạo); OAuth Client ID public (bình thường) |
| **Deployment** | Zero-build static files; GitHub Pages; không cần GAS redeploy |
| **Multi-tenant** | Mỗi Google account có data isolation hoàn toàn |

---

## Data Model

### Sheet "Data" (products)

| Column | Type | Description |
|--------|------|-------------|
| ID | String | `prod_{timestamp}` |
| Category | String | Category ID |
| Created At | DateTime | ISO timestamp |
| Images | String | Drive thumbnail URLs, comma-separated |
| Name | String | Product name (denormalized) |
| Price | Number | Price (denormalized) |
| Data JSON | JSON | Full product.data object |
| _deleted | Boolean | `TRUE` = soft-deleted |
| [Dynamic...] | Mixed | Per-category field columns |

### Sheet "Categories"

| Column | Type | Description |
|--------|------|-------------|
| ID | String | e.g. `plants` |
| Name EN | String | |
| Name VI | String | |
| Icon | String | Emoji |
| Fields JSON | JSON | Field definitions array |
| Updated At | DateTime | ISO timestamp |
| _deleted | Boolean | `TRUE` = soft-deleted |

### Sheet "Users"

| Column | Type | Description |
|--------|------|-------------|
| ID | String | `user_{timestamp}` |
| Username | String | |
| Password | String | plaintext (TODO: hash) |
| Role | String | `admin` \| `user` |
| Created At | DateTime | |

### Sheet "ProductNames"

| Column | Type | Description |
|--------|------|-------------|
| Name | String | Product name for autocomplete |

---

## Backlog

| Priority | Feature | Description |
|----------|---------|-------------|
| P1 | Password hashing | bcrypt hoặc SHA-256 trong Users sheet |
| P1 | Token expiry UX | Thông báo rõ khi OAuth token hết hạn, cần re-auth |
| P2 | Edit product | Modify saved product data |
| P2 | Unsorted search | Search without diacritics (Vietnamese) |
| P2 | Breadcrumb navigation | Back navigation in folder view |
| P2 | Team invite flow | Share workspace link → member join với mã |
| P3 | Export CSV/Excel | Download data as spreadsheet |
| P3 | Offline image queue | Buffer large images until sync window |
| P3 | QR code sharing | Share app URL via QR |
| P3 | Audit log | Track who created/edited what (dùng cột Created By) |
