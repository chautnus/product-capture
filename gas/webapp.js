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
