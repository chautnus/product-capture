// ==================== DATA (PRODUCTS) ====================

function getData(category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: true, products: [] };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  let products = [];

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0]) {
      // Parse data từ cột Data JSON
      let productData = parseJSON(allData[i][6], {});

      // Override với các cột động
      for (let j = 7; j < headers.length; j++) {
        if (headers[j] && allData[i][j]) {
          productData[headers[j]] = allData[i][j];
        }
      }

      // Override name và price
      productData.name = allData[i][4] || productData.name;
      productData.price = allData[i][5] || productData.price;

      const product = {
        id: allData[i][0],
        category: allData[i][1],
        createdAt: allData[i][2],
        images: parseImageCell(allData[i][3]),
        data: productData
      };

      if (!category || category === 'all' || product.category === category) {
        products.push(product);
      }
    }
  }

  products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { success: true, products: products, apiVersion: '4.7', deployedAt: new Date().toISOString().split('T')[0] };
}

/**
 * Lưu hoặc cập nhật sản phẩm — atomic write với LockService để tránh duplicate
 * ID check trước appendRow: nếu tồn tại → update, không → append (Bug 1 fix)
 */
function saveProduct(product) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet) {
    return { success: false, error: 'Data sheet not found' };
  }

  // Upload ảnh vào folder có cấu trúc: Parent > Category > ProductName
  let imageUrls = uploadImages(product.images || [], product.id, product.category, product.data?.name);

  // Lấy headers hiện tại
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : CONFIG.FIXED_COLUMNS;

  // Tạo row data
  const rowData = new Array(headers.length).fill('');

  // Fixed columns
  rowData[0] = product.id;
  rowData[1] = product.category;
  rowData[2] = product.createdAt || new Date().toISOString();
  rowData[3] = imageUrls.join(', ');
  rowData[4] = product.data?.name || '';
  rowData[5] = product.data?.price || '';
  rowData[6] = JSON.stringify(product.data);

  // Dynamic columns — đảm bảo cột tồn tại và ghi giá trị
  if (product.data) {
    Object.keys(product.data).forEach(key => {
      if (key !== 'name' && key !== 'price') {
        let colIndex = headers.indexOf(key);
        if (colIndex === -1) {
          const newColIndex = sheet.getLastColumn() + 1;
          sheet.getRange(1, newColIndex).setValue(key).setFontWeight('bold');
          rowData.push(product.data[key]);
          headers.push(key);
        } else {
          rowData[colIndex] = product.data[key];
        }
      }
    });
  }

  // Atomic write: LockService prevents race condition when 2 devices push same ID simultaneously
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // wait up to 30s for exclusive access

    // ID check: update existing row instead of blind append (Bug 1 dedup fix)
    const allData = sheet.getDataRange().getValues();
    let existingRowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === product.id) { existingRowIndex = i + 1; break; }
    }

    if (existingRowIndex !== -1) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('Updated product: ' + product.id);
    } else {
      sheet.appendRow(rowData);
      Logger.log('Saved new product: ' + product.id + ' with ' + imageUrls.length + ' images');
    }
  } finally {
    lock.releaseLock();
  }

  // Thêm vào ProductNames nếu chưa có
  if (product.data?.name) {
    addProductName(product.data.name, product.category);
  }

  return {
    success: true,
    product: { ...product, images: imageUrls },
    message: 'Saved with ' + imageUrls.length + ' images'
  };
}

/**
 * Upload ảnh với cấu trúc thư mục: Parent > Category > ProductName
 */
function uploadImages(images, productId, category, productName) {
  const imageUrls = [];

  if (!images || images.length === 0) return imageUrls;

  const parentFolderId = getImagesFolderId();
  if (!parentFolderId) return imageUrls;

  const parentFolder = DriveApp.getFolderById(parentFolderId);

  // Tạo/lấy folder Category
  const categoryFolderName = category || 'uncategorized';
  let categoryFolder = getOrCreateSubfolder(parentFolder, categoryFolderName);

  // Tạo/lấy folder ProductName
  const productFolderName = (productName || productId || 'unknown').toString().replace(/[\/\\:*?"<>|]/g, '_');
  let productFolder = getOrCreateSubfolder(categoryFolder, productFolderName);

  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];

    if (imageData && imageData.startsWith('data:image')) {
      try {
        const base64 = imageData.split(',')[1];
        const blob = Utilities.newBlob(
          Utilities.base64Decode(base64),
          'image/jpeg',
          productId + '_' + i + '.jpg'
        );
        const file = productFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrls.push('https://drive.google.com/uc?id=' + file.getId());
      } catch (e) {
        Logger.log('Image upload error: ' + e.toString());
      }
    } else if (imageData && imageData.startsWith('http')) {
      imageUrls.push(imageData);
    }
  }

  return imageUrls;
}

/**
 * Lấy hoặc tạo subfolder trong folder cha
 */
function getOrCreateSubfolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  const newFolder = parentFolder.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

function deleteProduct(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DATA);

  if (!sheet) return { success: false, error: 'Data sheet not found' };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Product not found' };
}
