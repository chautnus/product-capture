// ==================== PRODUCT NAMES (Autocomplete) ====================

/**
 * Lấy danh sách ProductNames cho autocomplete
 */
function getProductNames(category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCT_NAMES);

  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, names: [] };
  }

  const data = sheet.getDataRange().getValues();
  const names = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) { // Name column
      if (!category || category === 'all' || data[i][2] === category) {
        names.push({
          id: data[i][0],
          name: data[i][1],
          category: data[i][2]
        });
      }
    }
  }

  names.sort((a, b) => a.name.localeCompare(b.name));

  return { success: true, names: names };
}

/**
 * Thêm ProductName mới
 */
function addProductName(name, category) {
  if (!name) {
    return { success: false, error: 'Name is required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCT_NAMES);

  if (!sheet) {
    return { success: false, error: 'ProductNames sheet not found. Run initialSetup()' };
  }

  // Kiểm tra đã tồn tại chưa
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toLowerCase() === name.toLowerCase()) {
      if (!category || data[i][2] === category) {
        return { success: true, message: 'Name already exists', id: data[i][0] };
      }
    }
  }

  // Thêm mới
  const id = 'pn_' + Date.now();
  sheet.appendRow([id, name, category || '', new Date().toISOString()]);

  Logger.log('Added product name: ' + name);

  return { success: true, id: id, name: name, category: category };
}
