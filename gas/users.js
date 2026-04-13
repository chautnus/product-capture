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
