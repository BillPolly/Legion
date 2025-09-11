describe('Example Test Suite', () => {
  test('basic functionality test', () => {
    expect(1 + 1).toBe(2);
  });

  test('async functionality test', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(true).toBe(true);
  });

  test('object testing', () => {
    const testObj = {
      name: 'test',
      value: 42
    };
    expect(testObj).toHaveProperty('name', 'test');
    expect(testObj.value).toBe(42);
  });
});