import { jest } from '@jest/globals';

describe('Basic Tests', () => {
  test('Jest is working', () => {
    expect(1 + 1).toBe(2);
  });

  test('String manipulation works', () => {
    const str = 'hello world';
    expect(str.toUpperCase()).toBe('HELLO WORLD');
  });

  test('Arrays work correctly', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});