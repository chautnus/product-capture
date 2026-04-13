// ==================== COLUMNS MANAGEMENT ====================

/**
 * Lấy danh sách các cột hiện có trong sheet Data
 */
function getDataColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet || sheet.getLastColumn() === 0) {
    return { success: true, columns: CONFIG.FIXED_COLUMNS };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return { success: true, columns: headers.filter(h => h) };
}

/**
 * Thêm cột mới vào sheet Data
 */
function addColumn(columnName) {
  if (!columnName) {
    return { success: false, error: 'Column name is required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet) {
    return { success: false, error: 'Data sheet not found' };
  }

  // Lấy headers hiện tại
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Kiểm tra cột đã tồn tại chưa
  if (headers.includes(columnName)) {
    return { success: true, message: 'Column already exists', column: columnName };
  }

  // Thêm cột mới
  const newColIndex = lastCol + 1;
  sheet.getRange(1, newColIndex).setValue(columnName).setFontWeight('bold');

  Logger.log('Added column: ' + columnName + ' at index ' + newColIndex);

  return { success: true, column: columnName, index: newColIndex };
}

/**
 * Đồng bộ tất cả fields thành columns
 */
function syncFieldsToColumns(fields) {
  if (!fields || !Array.isArray(fields)) {
    return { success: false, error: 'Fields array is required' };
  }

  const results = [];

  fields.forEach(field => {
    const columnName = field.id || (field.name?.en) || field.name;
    if (columnName && !CONFIG.FIXED_COLUMNS.includes(columnName)) {
      const result = addColumn(columnName);
      results.push({ field: columnName, result: result });
    }
  });

  return { success: true, results: results };
}

/**
 * Đảm bảo cột tồn tại, nếu chưa thì tạo mới
 */
function ensureColumnExists(columnName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet) return -1;

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    CONFIG.FIXED_COLUMNS.forEach((col, i) => {
      sheet.getRange(1, i + 1).setValue(col);
    });
    return -1;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let colIndex = headers.indexOf(columnName);

  if (colIndex === -1) {
    const newColIndex = lastCol + 1;
    sheet.getRange(1, newColIndex).setValue(columnName).setFontWeight('bold');
    colIndex = newColIndex - 1;
    Logger.log('Created column: ' + columnName);
  }

  return colIndex;
}
