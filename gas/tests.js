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
