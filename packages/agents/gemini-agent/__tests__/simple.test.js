/**
 * Simple test to verify Jest is working
 */

describe('Basic Jest Setup', () => {
  test('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });
  
  test('should load Node.js modules', async () => {
    const fs = await import('fs');
    expect(typeof fs.readFileSync).toBe('function');
  });
});