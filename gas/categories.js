// ==================== CATEGORIES ====================

function getCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CATEGORIES);

  if (!sheet) {
    return { success: false, error: 'Categories sheet not found' };
  }

  const data = sheet.getDataRange().getValues();
  const categories = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      categories.push({
        id: data[i][0],
        name: { en: data[i][1], vi: data[i][2] },
        icon: data[i][3],
        fields: parseJSON(data[i][4], [])
      });
    }
  }

  return { success: true, categories: categories, apiVersion: '4.7', deployedAt: new Date().toISOString().split('T')[0] };
}

/**
 * Lưu hoặc cập nhật category
 */
function saveCategory(category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CATEGORIES);

  if (!sheet) return { success: false, error: 'Categories sheet not found' };

  const data = sheet.getDataRange().getValues();
  let found = false;

  // Tìm category có sẵn
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === category.id) {
      // Cập nhật
      sheet.getRange(i + 1, 1, 1, 5).setValues([[
        category.id,
        category.name?.en || category.name || '',
        category.name?.vi || category.name || '',
        category.icon || '📦',
        JSON.stringify(category.fields || [])
      ]]);
      found = true;
      break;
    }
  }

  if (!found) {
    // Thêm mới
    sheet.appendRow([
      category.id,
      category.name?.en || category.name || '',
      category.name?.vi || category.name || '',
      category.icon || '📦',
      JSON.stringify(category.fields || [])
    ]);
  }

  return { success: true, category: category };
}

/**
 * Xóa category
 */
function deleteCategory(categoryId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CATEGORIES);

  if (!sheet) return { success: false, error: 'Categories sheet not found' };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === categoryId) {
      sheet.deleteRow(i + 1);
      Logger.log('Deleted category: ' + categoryId);
      return { success: true };
    }
  }

  return { success: false, error: 'Category not found' };
}
