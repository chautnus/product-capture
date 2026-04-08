# Product Requirements Document
# ProductSnap v4.0

---

## Overview

| Attribute | Value |
|-----------|-------|
| **Product Name** | ProductSnap |
| **Version** | 4.0 |
| **Platform** | Progressive Web App (PWA) |
| **GitHub** | https://github.com/chautnus/product-capture |
| **Demo** | https://chautnus.github.io/product-capture/ |

---

## Problem Statement

Shop owners (plants, pots, accessories) need to photograph and catalog inventory quickly while walking around the store. Existing solutions require desktop entry, separate camera apps, or paid software. ProductSnap provides a single mobile-first tool that captures, organizes, and syncs product data in one flow.

---

## Target Users

- Plant / flower shop owners cataloging inventory
- Staff doing product checks or pricing updates
- Small business owners building an online product catalog

---

## User Stories

- As a shop owner, I want to photograph a product and fill in details in one workflow without switching apps
- As a shop owner, I want my data synced to Google Sheets automatically so I can view it on desktop
- As a staff member, I want the app to work offline and sync when I'm back in WiFi range
- As a user, I want to receive images shared from my phone gallery or messaging apps (Zalo, WhatsApp)
- As a user, I want to browse my saved products organized by category and name

---

## Functional Requirements

### 1. Camera & Image Capture

| ID | Requirement | Status |
|----|-------------|--------|
| CAM-01 | Capture via web camera API (getUserMedia) | Done |
| CAM-02 | Use native phone camera app (file input with capture) | Done |
| CAM-03 | Toggle front/rear camera | Done |
| CAM-04 | Stop camera button | Done |
| CAM-05 | High quality capture: 4096×2160, JPEG 95% | Done |
| CAM-06 | Select from photo library | Done |
| CAM-07 | Remove captured image | Done |
| CAM-08 | Thumbnail row with scroll | Done |

### 2. Categories

| ID | Requirement | Status |
|----|-------------|--------|
| CAT-01 | Add new category | Done |
| CAT-02 | Edit category (name EN/VI, icon) | Done |
| CAT-03 | Delete category | Done |
| CAT-04 | EN/VI bilingual names | Done |
| CAT-05 | Keep selected category after save | Done |
| CAT-06 | Sync categories from cloud | Done |

### 3. Dynamic Form Fields

| ID | Field Type | Status |
|----|-----------|--------|
| FLD-01 | Text | Done |
| FLD-02 | Number | Done |
| FLD-03 | Boolean (Yes/No toggle) | Done |
| FLD-04 | Select (dropdown) | Done |
| FLD-05 | URL | Done |
| FLD-06 | Date | Done |
| FLD-07 | Time | Done |
| FLD-08 | DateTime | Done |

| ID | Requirement | Status |
|----|-------------|--------|
| FLD-09 | Add field to category | Done |
| FLD-10 | Remove field from category | Done |
| FLD-11 | Auto-create column in Google Sheet for new fields | Done |
| FLD-12 | Bilingual placeholder text | Done |
| FLD-13 | Required field indicator (*) and validation | Done |

### 4. Product Name Autocomplete

| ID | Requirement | Status |
|----|-------------|--------|
| AUT-01 | Separate ProductNames sheet in Google Sheets | Done |
| AUT-02 | Real-time autocomplete as user types | Done |
| AUT-03 | Suggestion dropdown | Done |
| AUT-04 | "Create new" button when name not found | Done |
| AUT-05 | Filter suggestions by category | Done |
| AUT-06 | Merge local + cloud name sources | Done |

### 5. Data View

| ID | Requirement | Status |
|----|-------------|--------|
| DAT-01 | Folder structure: Category → Product Name → Items | Done |
| DAT-02 | Item count per folder | Done |
| DAT-03 | Tap item → detail modal | Done |
| DAT-04 | Image gallery in detail modal | Done |
| DAT-05 | Field/value table in detail modal | Done |
| DAT-06 | Delete product | Done |

### 6. Google Sheets Sync

| ID | Requirement | Status |
|----|-------------|--------|
| GS-01 | Data sheet — store products | Done |
| GS-02 | Categories sheet | Done |
| GS-03 | ProductNames sheet | Done |
| GS-04 | Settings sheet | Done |
| GS-05 | Auto-create dynamic columns | Done |
| GS-06 | Image URLs: comma-separated (no JSON wrapping) | Done |

### 7. Google Drive Image Storage

| ID | Requirement | Status |
|----|-------------|--------|
| DRV-01 | Root folder: `ProductCapture_Images` | Done |
| DRV-02 | Subfolder per Category | Done |
| DRV-03 | Subfolder per Product Name | Done |
| DRV-04 | Images saved inside product name folder | Done |

**Folder structure:**
```
ProductCapture_Images/
├── plants/
│   ├── Sen đá/
│   │   ├── prod_001_0.jpg
│   │   └── prod_001_1.jpg
│   └── Xương rồng/
├── pots/
│   └── Chậu sứ/
└── accessories/
```

### 8. PWA & Offline

| ID | Requirement | Status |
|----|-------------|--------|
| PWA-01 | Service Worker with cache-first strategy | Done |
| PWA-02 | Web App Manifest with icons | Done |
| PWA-03 | Add to Home Screen | Done |
| PWA-04 | Share Target API (receive images from other apps) | Done |
| PWA-05 | Relative paths for GitHub Pages subdirectory | Done |
| PWA-06 | Offline-first: save locally, sync when online | Done |

### 9. UX

| ID | Requirement | Status |
|----|-------------|--------|
| UX-01 | Bottom navigation (Capture / Data / Settings) | Done |
| UX-02 | Toast notifications | Done |
| UX-03 | Loading / disabled states | Done |
| UX-04 | EN/VI language toggle | Done |
| UX-05 | Pending sync badge on Settings tab | Done |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Offline** | App must work with no network; queue changes and sync when back online |
| **Storage** | Support 500+ products without storage errors (IndexedDB for images, localStorage for metadata) |
| **Performance** | Save button must respond within 100ms; thumbnails load lazily |
| **Compatibility** | iOS Safari 15+, Chrome Android 90+, Chrome Desktop |
| **Security** | API URL stored in localStorage (not in source code); never committed to Git |
| **Deployment** | Zero-build static files; GitHub Pages compatible |

---

## Data Model

### Google Sheet: Data

| Column | Type | Description |
|--------|------|-------------|
| ID | String | `prod_{timestamp}` |
| Category | String | Category ID |
| Created At | DateTime | ISO timestamp |
| Images | String | Drive URLs, comma-separated |
| Name | String | Product name |
| Price | Number | Price |
| Data JSON | JSON | Full data object |
| [Dynamic...] | Mixed | Dynamic field columns |

### Google Sheet: Categories

| Column | Type | Description |
|--------|------|-------------|
| ID | String | Category ID (e.g. `plants`) |
| Name EN | String | English name |
| Name VI | String | Vietnamese name |
| Icon | String | Emoji |
| Fields JSON | JSON | Field definitions array |

### Google Sheet: ProductNames

| Column | Type | Description |
|--------|------|-------------|
| ID | String | `pn_{timestamp}` |
| Name | String | Product name |
| Category | String | Category ID |
| Created At | DateTime | Timestamp |

---

## Backlog

| Priority | Feature | Description |
|----------|---------|-------------|
| P2 | Edit product | Modify saved product data |
| P2 | Unsorted search | Search without diacritics (Vietnamese) |
| P2 | Breadcrumb navigation | Back navigation in folder view |
| P3 | Export CSV/Excel | Download data as spreadsheet |
| P3 | Offline image queue | Buffer large images until sync window |
| P3 | QR code sharing | Share app URL via QR |
