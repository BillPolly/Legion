/**
 * Sample test file for testing Jester
 */

describe('Math operations', () => {
  beforeEach(() => {
    console.log('Setting up math test');
  });

  test('should add numbers correctly', () => {
    console.log('Testing addition');
    expect(2 + 2).toBe(4);
  });

  test('should multiply numbers correctly', () => {
    console.log('Testing multiplication');
    expect(3 * 4).toBe(12);
  });

  test('should fail on purpose', () => {
    console.error('This test is designed to fail');
    expect(1 + 1).toBe(3);
  });

  test('should be slow', async () => {
    console.log('Starting slow test');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('Slow test completed');
    expect(true).toBe(true);
  });
});