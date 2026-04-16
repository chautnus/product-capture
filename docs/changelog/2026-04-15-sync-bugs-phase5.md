---
id: chg_sync_bugs_phase5_20260415
type: changelog
title: "Fix Category Sync Bugs — Phase 5 (app.js split + addToPending)"
tags: [sync, categories, app.js, split, bug-fix]
keywords: [addToPending, CREATE_CATEGORY, UPDATE_CATEGORY, initSettingsListeners, SYSTEM_LOCK]
status: active
created: 2026-04-15
updated: 2026-04-15
summary: "Phase 5: split app.js (275→204 lines) + add addToPending to category handlers so categories sync to cloud"
---

## Fixed

### Bug A — Categories never synced to cloud on Create
- **File:** `js/app.js` line 117
- **Handler:** `confirm-add-category`
- **Change:** Added `addToPending('CREATE_CATEGORY', newCat)` after pushing to `appData.categories`
- **Impact:** New categories now enter the pending queue and sync to Google Sheet on next push

### Bug B — Categories never synced to cloud on Edit
- **File:** `js/app.js` line 129
- **Handler:** `confirm-edit-category`
- **Change:** Added `addToPending('UPDATE_CATEGORY', { ...category })` after updating category fields
- **Impact:** Category edits (name, icon) now propagate to cloud on next sync

## Changed

### app.js Split (SYSTEM LOCK unblock)
- **Moved:** `initSettingsListeners()` (73 lines, lines 143-215) from `js/app.js` → appended to `js/settings.js`
- **Result:** `js/app.js` 275 → 204 lines (under SYSTEM LOCK threshold of 250)
- **Result:** `js/settings.js` 101 → 174 lines
- **No import changes needed** — plain global scripts, all functions share window scope

## Context
All earlier phases (1-4) were completed in prior session (commits 3277a72, 42ebebb).
Phase 5 was the final set of bugs found after reviewing GAS code:
the category modal handlers silently dropped edits without queueing them for cloud sync.
GAS redeploy remains a manual step for the user.
