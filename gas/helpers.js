// ==================== HELPERS ====================
// Utility functions used by multiple modules

function getImagesFolderId() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'images_folder_id' && data[i][1]) {
      return data[i][1];
    }
  }

  return createImagesFolder();
}

function updateSetting(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) return;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function parseJSON(str, defaultValue) {
  try {
    if (typeof str === 'object') return str;
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

// Parse image cell: supports JSON array, comma-separated string, or empty
// Backwards compatible with existing sheet data stored as "url1, url2, url3"
function parseImageCell(cell) {
  if (!cell) return [];
  if (Array.isArray(cell)) return cell;
  const s = String(cell).trim();
  if (!s) return [];
  if (s.charAt(0) === '[') {
    try { return JSON.parse(s); } catch (e) { /* fall through */ }
  }
  // Comma-separated fallback
  return s.split(',').map(function(x) { return x.trim(); }).filter(function(x) { return x.length > 0; });
}
