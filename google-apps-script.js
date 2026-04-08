/**
 * ====================================================
 * PRODUCT CAPTURE - GOOGLE APPS SCRIPT BACKEND v3
 * ====================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 
 * 1. Tạo Google Sheet mới: https://sheets.new
 * 2. Vào Extensions > Apps Script
 * 3. Xóa code mặc định, paste toàn bộ code này vào
 * 4. Lưu project (Ctrl+S)
 * 5. Chạy hàm `initialSetup()` (chọn từ dropdown > Run)
 * 6. Cấp quyền truy cập khi được hỏi
 * 7. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy URL deployment, paste vào app
 * 
 * VERSION 3.0 - New Features:
 * - Auto create columns for new fields
 * - ProductNames sheet for autocomplete
 * - Dynamic column management
 * 
 * ====================================================
 */

// ==================== CẤU HÌNH ====================
const CONFIG = {
  SHEETS: {
    DATA: 'Data',
    CATEGORIES: 'Categories',
    SETTINGS: 'Settings',
    PRODUCT_NAMES: 'ProductNames',
    USERS: 'Users'
  },
  IMAGES_FOLDER: 'ProductCapture_Images',
  // Các cột cố định trong sheet Data
  FIXED_COLUMNS: ['ID', 'Category', 'Created At', 'Images', 'Name', 'Price', 'Data JSON']
};

// ==================== KHỞI TẠO ====================

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Tạo sheet Data
  let dataSheet = ss.getSheetByName(CONFIG.SHEETS.DATA);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(CONFIG.SHEETS.DATA);
    dataSheet.appendRow(CONFIG.FIXED_COLUMNS);
    dataSheet.getRange(1, 1, 1, CONFIG.FIXED_COLUMNS.length)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('white');
    dataSheet.setFrozenRows(1);
    dataSheet.setColumnWidth(4, 300); // Images
    dataSheet.setColumnWidth(7, 400); // Data JSON
  }
  
  // 2. Tạo sheet Categories
  let categoriesSheet = ss.getSheetByName(CONFIG.SHEETS.CATEGORIES);
  if (!categoriesSheet) {
    categoriesSheet = ss.insertSheet(CONFIG.SHEETS.CATEGORIES);
    categoriesSheet.appendRow(['ID', 'Name EN', 'Name VI', 'Icon', 'Fields JSON']);
    categoriesSheet.getRange(1, 1, 1, 5)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('white');
    categoriesSheet.setFrozenRows(1);
    
    // Categories mẫu
    const defaultCategories = [
      ['plants', 'Plants', 'Cây cảnh', '🌿', JSON.stringify([
        {id: 'name', name: {en: 'Product Name', vi: 'Tên sản phẩm'}, type: 'text', required: true},
        {id: 'price', name: {en: 'Price', vi: 'Giá'}, type: 'number'},
        {id: 'size', name: {en: 'Size', vi: 'Kích thước'}, type: 'text'},
        {id: 'has_flowers', name: {en: 'Has Flowers', vi: 'Có hoa'}, type: 'boolean'},
        {id: 'care_level', name: {en: 'Care Level', vi: 'Độ khó chăm sóc'}, type: 'select', options: ['Easy', 'Medium', 'Hard']}
      ])],
      ['pots', 'Pots', 'Chậu', '🪴', JSON.stringify([
        {id: 'name', name: {en: 'Product Name', vi: 'Tên sản phẩm'}, type: 'text', required: true},
        {id: 'price', name: {en: 'Price', vi: 'Giá'}, type: 'number'},
        {id: 'material', name: {en: 'Material', vi: 'Chất liệu'}, type: 'select', options: ['Ceramic', 'Plastic', 'Terracotta', 'Metal']}
      ])],
      ['accessories', 'Accessories', 'Phụ kiện', '🛠', JSON.stringify([
        {id: 'name', name: {en: 'Product Name', vi: 'Tên sản phẩm'}, type: 'text', required: true},
        {id: 'price', name: {en: 'Price', vi: 'Giá'}, type: 'number'},
        {id: 'link', name: {en: 'Link/URL', vi: 'Đường dẫn'}, type: 'url'}
      ])]
    ];
    
    defaultCategories.forEach(row => categoriesSheet.appendRow(row));
  }
  
  // 3. Tạo sheet Settings
  let settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
    settingsSheet.appendRow(['Key', 'Value']);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    settingsSheet.appendRow(['images_folder_id', '']);
    settingsSheet.appendRow(['last_sync', '']);
  }
  
  // 4. Tạo sheet ProductNames (MỚI)
  let productNamesSheet = ss.getSheetByName(CONFIG.SHEETS.PRODUCT_NAMES);
  if (!productNamesSheet) {
    productNamesSheet = ss.insertSheet(CONFIG.SHEETS.PRODUCT_NAMES);
    productNamesSheet.appendRow(['ID', 'Name', 'Category', 'Created At']);
    productNamesSheet.getRange(1, 1, 1, 4)
      .setFontWeight('bold')
      .setBackground('#6aa84f')
      .setFontColor('white');
    productNamesSheet.setFrozenRows(1);
    productNamesSheet.setColumnWidth(2, 300); // Name column wider
  }
  
  // 5. Tạo sheet Users
  let usersSheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(CONFIG.SHEETS.USERS);
    usersSheet.appendRow(['ID', 'Username', 'Password', 'Role', 'Department', 'Created At']);
    usersSheet.getRange(1, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#e06666')
      .setFontColor('white');
    usersSheet.setFrozenRows(1);
    usersSheet.setColumnWidth(2, 180);
    // Tạo tài khoản admin mặc định
    usersSheet.appendRow(['user_' + Date.now(), 'admin', 'admin123', 'admin', '', new Date().toISOString()]);
  }

  // 6. Tạo folder lưu ảnh
  const folderId = createImagesFolder();
  
  // 6. Xóa sheet mặc định
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  Logger.log('✅ Setup hoàn tất! Version 3.0');
  Logger.log('📁 Folder ảnh ID: ' + folderId);
  
  SpreadsheetApp.getUi().alert(
    '✅ Setup hoàn tất! (Version 3.0)\n\n' +
    'Các sheet đã tạo:\n' +
    '• Data - Lưu sản phẩm\n' +
    '• Categories - Danh mục\n' +
    '• ProductNames - Tên sản phẩm (autocomplete)\n' +
    '• Settings - Cài đặt\n' +
    '• Users - Tài khoản (admin mặc định: admin / admin123)\n\n' +
    'Tiếp theo:\n' +
    '1. Deploy > New deployment > Web app\n' +
    '2. Execute as: Me\n' +
    '3. Who has access: Anyone\n' +
    '4. Copy URL và paste vào app'
  );
}

function createImagesFolder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  
  if (!settingsSheet) return null;
  
  const data = settingsSheet.getDataRange().getValues();
  
  // Kiểm tra folder đã tồn tại
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'images_folder_id' && data[i][1]) {
      try {
        DriveApp.getFolderById(data[i][1]);
        return data[i][1];
      } catch (e) {
        // Folder không tồn tại, tạo mới
      }
    }
  }
  
  // Tạo folder mới
  const folder = DriveApp.createFolder(CONFIG.IMAGES_FOLDER);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Lưu ID
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'images_folder_id') {
      settingsSheet.getRange(i + 1, 2).setValue(folder.getId());
      break;
    }
  }
  
  return folder.getId();
}

// ==================== WEB APP ====================

function doGet(e) {
  const action = e.parameter.action || 'ping';
  let result;
  
  try {
    switch (action) {
      case 'ping':
        result = { success: true, message: 'ProductCapture API v3.0', version: '3.0' };
        break;
      case 'getCategories':
        result = getCategories();
        break;
      case 'getData':
        result = getData(e.parameter.category);
        break;
      case 'getProductNames':
        result = getProductNames(e.parameter.category);
        break;
      case 'getColumns':
        result = getDataColumns();
        break;
      case 'login':
        result = loginUser(e.parameter.username, e.parameter.password);
        break;
      case 'getUsers':
        result = getUsers();
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log('POST action: ' + action);
    
    switch (action) {
      case 'saveProduct':
        result = saveProduct(data.product);
        break;
      case 'syncAll':
        result = syncAll(data);
        break;
      case 'deleteProduct':
        result = deleteProduct(data.id);
        break;
      case 'addProductName':
        result = addProductName(data.name, data.category);
        break;
      case 'addColumn':
        result = addColumn(data.columnName);
        break;
      case 'syncFields':
        result = syncFieldsToColumns(data.fields);
        break;
      case 'saveCategory':
        result = saveCategory(data.category);
        break;
      case 'deleteCategory':
        result = deleteCategory(data.id);
        break;
      case 'addUser':
        result = addUser(data.user);
        break;
      case 'updateUser':
        result = updateUser(data.user);
        break;
      case 'deleteUser':
        result = deleteUser(data.id);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    Logger.log('POST error: ' + error.toString());
    result = { success: false, error: error.toString() };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

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
    // Sử dụng field.id hoặc field.name.en làm tên cột
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
    // Sheet trống, tạo headers
    CONFIG.FIXED_COLUMNS.forEach((col, i) => {
      sheet.getRange(1, i + 1).setValue(col);
    });
    return -1;
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let colIndex = headers.indexOf(columnName);
  
  if (colIndex === -1) {
    // Thêm cột mới
    const newColIndex = lastCol + 1;
    sheet.getRange(1, newColIndex).setValue(columnName).setFontWeight('bold');
    colIndex = newColIndex - 1;
    Logger.log('Created column: ' + columnName);
  }
  
  return colIndex;
}

// ==================== PRODUCT NAMES ====================

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
  
  // Sắp xếp theo tên
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
  
  return { success: true, categories: categories };
}

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
        images: parseJSON(allData[i][3], []),
        data: productData
      };
      
      if (!category || category === 'all' || product.category === category) {
        products.push(product);
      }
    }
  }
  
  products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return { success: true, products: products };
}

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
  // Format ảnh: không có [""], chỉ URLs phân cách bởi dấu phẩy
  rowData[3] = imageUrls.join(', ');
  rowData[4] = product.data?.name || '';
  rowData[5] = product.data?.price || '';
  rowData[6] = JSON.stringify(product.data);
  
  // Dynamic columns - đảm bảo cột tồn tại và ghi giá trị
  if (product.data) {
    Object.keys(product.data).forEach(key => {
      if (key !== 'name' && key !== 'price') {
        let colIndex = headers.indexOf(key);
        
        // Nếu cột chưa tồn tại, tạo mới
        if (colIndex === -1) {
          const newColIndex = sheet.getLastColumn() + 1;
          sheet.getRange(1, newColIndex).setValue(key).setFontWeight('bold');
          
          // Cập nhật rowData
          rowData.push(product.data[key]);
          headers.push(key);
        } else {
          rowData[colIndex] = product.data[key];
        }
      }
    });
  }
  
  // Append row
  sheet.appendRow(rowData);
  
  // Thêm vào ProductNames nếu chưa có
  if (product.data?.name) {
    addProductName(product.data.name, product.category);
  }
  
  Logger.log('Saved product: ' + product.id + ' with ' + imageUrls.length + ' images');
  
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
  
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Tạo folder mới
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
    message: `Synced ${results.categories.synced} categories, ${results.products.synced} products, created ${results.columns.created} columns`
  };
}

// ==================== HELPERS ====================

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

// ==================== TEST FUNCTIONS ====================

// ==================== CATEGORY MANAGEMENT ====================

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

// ==================== USER MANAGEMENT ====================

function loginUser(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username and password required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet) {
    return { success: false, error: 'Users sheet not found. Run initialSetup() first.' };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const [id, uname, pwd, role, department] = data[i];
    if (uname === username && pwd === password) {
      return {
        success: true,
        user: { id: String(id), username: uname, role: role || 'user', department: department || '' }
      };
    }
  }

  return { success: false, error: 'Invalid credentials' };
}

function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet) return { success: false, error: 'Users sheet not found' };

  const data = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    const [id, username, , role, department, createdAt] = data[i];
    if (id) {
      users.push({ id: String(id), username, role: role || 'user', department: department || '', createdAt });
    }
  }

  return { success: true, users };
}

function addUser(userData) {
  if (!userData || !userData.username || !userData.password) {
    return { success: false, error: 'Username and password required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet) return { success: false, error: 'Users sheet not found' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userData.username) {
      return { success: false, error: 'Username already exists' };
    }
  }

  const id = userData.id || ('user_' + Date.now());
  sheet.appendRow([
    id,
    userData.username,
    userData.password,
    userData.role || 'user',
    userData.department || '',
    userData.createdAt || new Date().toISOString()
  ]);

  Logger.log('Added user: ' + userData.username);
  return { success: true, id };
}

function updateUser(userData) {
  if (!userData || !userData.id) {
    return { success: false, error: 'User ID required' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet) return { success: false, error: 'Users sheet not found' };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userData.id)) {
      const row = i + 1;
      if (userData.username) sheet.getRange(row, 2).setValue(userData.username);
      if (userData.password) sheet.getRange(row, 3).setValue(userData.password);
      if (userData.role) sheet.getRange(row, 4).setValue(userData.role);
      if (userData.department !== undefined) sheet.getRange(row, 5).setValue(userData.department);
      return { success: true };
    }
  }

  return { success: false, error: 'User not found' };
}

function deleteUser(userId) {
  if (!userId) return { success: false, error: 'User ID required' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet) return { success: false, error: 'Users sheet not found' };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      sheet.deleteRow(i + 1);
      Logger.log('Deleted user: ' + userId);
      return { success: true };
    }
  }

  return { success: false, error: 'User not found' };
}

// ==================== TEST FUNCTIONS ====================

function testSaveProduct() {
  const testProduct = {
    id: 'test_' + Date.now(),
    category: 'plants',
    createdAt: new Date().toISOString(),
    images: [],
    data: {
      name: 'Test Plant',
      price: '100000',
      size: 'Medium',
      has_flowers: true,
      custom_field: 'Custom Value'
    }
  };
  
  const result = saveProduct(testProduct);
  Logger.log('Test result: ' + JSON.stringify(result));
}

function testAddColumn() {
  const result = addColumn('test_column');
  Logger.log('Add column result: ' + JSON.stringify(result));
}

function testGetProductNames() {
  const result = getProductNames();
  Logger.log('Product names: ' + JSON.stringify(result));
}
