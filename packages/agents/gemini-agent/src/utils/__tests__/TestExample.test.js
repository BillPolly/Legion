describe('TestExample', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  test('should handle errors', () => {
    expect(() => {
      throw new Error('test error');
    }).toThrow('test error');
  });
});
