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

  // 4. Tạo sheet ProductNames
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

  // 7. Xóa sheet mặc định
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
