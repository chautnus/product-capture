# ProductSnap

A PWA for capturing and cataloging product photos, synced to Google Sheets and Google Drive.

Built for shop owners who need to photograph inventory quickly on mobile, fill in product details, and have everything automatically organized in Google Sheets.

## Features

- **Camera capture** — web camera API + native phone camera button
- **Dynamic forms** — custom fields per category (text, number, boolean, select, date/time, URL)
- **Product name autocomplete** — pulls from existing products + Google Sheets
- **Folder-view data browser** — Category → Product Name → Items
- **Offline-first** — saves locally, syncs to cloud when online
- **Share Target API** — receive images shared from Gallery, Zalo, WhatsApp, etc.
- **Bilingual UI** — EN / VI toggle

## Live Demo

[https://chautnus.github.io/product-capture/](https://chautnus.github.io/product-capture/)

## Quick Start (Mobile)

1. Open the demo URL above on your phone
2. Tap the browser menu → **Add to Home Screen** to install as PWA
3. Go to **Settings** tab → paste your Apps Script URL → tap **Test Connection**
4. Switch to **Capture** tab → take photos → fill in form → **Save Product**

## Backend Setup (Google Apps Script)

The app requires a Google Apps Script backend to sync data.

1. Create a new Google Sheet at [sheets.new](https://sheets.new)
2. Go to **Extensions → Apps Script**
3. Delete the default code, paste the contents of `google-apps-script.js`
4. Save the project (Ctrl+S)
5. Run the `initialSetup()` function (select from the dropdown, click **Run**)
6. Grant permissions when prompted
7. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Copy the deployment URL and paste it into the app's Settings → Apps Script URL

> **Important:** Every time you update backend code, you must create a **New deployment** (not edit the existing one). The deployment URL changes each time.

## File Structure

```
product-capture/
├── index.html              # HTML shell
├── app.css                 # All styles
├── app.js                  # All application logic
├── sw.js                   # Service Worker (offline cache + Share Target)
├── manifest.json           # PWA config (icons, share_target)
├── google-apps-script.js   # Backend — paste into Apps Script editor
├── README.md
├── CHANGELOG.md
└── docs/
    ├── PRD.md              # Product requirements
    └── ARCHITECTURE.md     # System architecture
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript |
| PWA | Service Worker, Web App Manifest, Share Target API |
| Storage (local) | localStorage (metadata) + IndexedDB (images) |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Image storage | Google Drive |
| Hosting | GitHub Pages |

## Automated Deployment

### GitHub Pages

After setup, push changes with:
```bash
git add .
git commit -m "Update: description"
git push origin main
```

GitHub Pages auto-deploys from the `main` branch.

### Google Apps Script (via clasp)

For automated backend deployment:
```bash
# One-time setup
npm install -g @google/clasp
clasp login
# Create .clasp.json with your Script ID (see docs/ARCHITECTURE.md)

# Deploy
clasp push
clasp deploy --description "v4.0"
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full clasp setup instructions.

## Development Notes

- No build step required — edit files directly and push to GitHub Pages
- `app.js` and `app.css` are separated from `index.html` for maintainability
- Images are stored in IndexedDB (not localStorage) to avoid 5-10MB quota limits
- The pending queue in `syncState` stores product metadata only; images are loaded from IndexedDB at sync time
