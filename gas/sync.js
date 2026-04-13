// ==================== SYNC ====================

function syncAll(data) {
  const results = {
    categories: { synced: 0, errors: [] },
    products: { synced: 0, errors: [] },
    columns: { created: 0 }
  };

  Logger.log('Starting syncAll v3...');

  // 1. Sync categories và tạo columns cho fields
  if (data.categories && data.categories.length > 0) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CATEGORIES);

    if (sheet) {
      if (sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }

      data.categories.forEach(cat => {
        try {
          sheet.appendRow([
            cat.id,
            cat.name?.en || cat.name || '',
            cat.name?.vi || cat.name || '',
            cat.icon || '📦',
            JSON.stringify(cat.fields || [])
          ]);
          results.categories.synced++;

          // Tạo columns cho fields
          if (cat.fields) {
            cat.fields.forEach(field => {
              const colName = field.id || field.name?.en || field.name;
              if (colName && !CONFIG.FIXED_COLUMNS.includes(colName) && colName !== 'name' && colName !== 'price') {
                const added = addColumn(colName);
                if (added.success && added.index) {
                  results.columns.created++;
                }
              }
            });
          }
        } catch (e) {
          results.categories.errors.push({ id: cat.id, error: e.toString() });
        }
      });
    }
  }

  // 2. Sync products
  if (data.products && data.products.length > 0) {
    data.products.forEach(product => {
      try {
        const result = saveProduct(product);
        if (result.success) {
          results.products.synced++;
        } else {
          results.products.errors.push({ id: product.id, error: result.error });
        }
      } catch (e) {
        results.products.errors.push({ id: product.id, error: e.toString() });
      }
    });
  }

  updateSetting('last_sync', new Date().toISOString());

  Logger.log('Sync completed: ' + JSON.stringify(results));

  return {
    success: true,
    results: results,
    message: 'Synced ' + results.categories.synced + ' categories, ' + results.products.synced + ' products, created ' + results.columns.created + ' columns'
  };
}
