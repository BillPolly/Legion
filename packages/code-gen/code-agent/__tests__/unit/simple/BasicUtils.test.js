/**
 * Basic Utility Tests - Simple, fast unit tests
 */

import { describe, test, expect } from '@jest/globals';

describe('Basic Utilities', () => {
  test('should perform basic math operations', () => {
    expect(2 + 2).toBe(4);
    expect(10 * 5).toBe(50);
    expect(100 / 4).toBe(25);
  });

  test('should handle string operations', () => {
    const str = 'Hello World';
    expect(str.length).toBe(11);
    expect(str.toLowerCase()).toBe('hello world');
    expect(str.includes('World')).toBe(true);
  });

  test('should handle array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr.length).toBe(5);
    expect(arr.includes(3)).toBe(true);
    expect(arr.map(x => x * 2)).toEqual([2, 4, 6, 8, 10]);
  });

  test('should handle object operations', () => {
    const obj = { name: 'Test', version: '1.0.0' };
    expect(obj.name).toBe('Test');
    expect(Object.keys(obj)).toEqual(['name', 'version']);
    expect(Object.values(obj)).toEqual(['Test', '1.0.0']);
  });

  test('should handle promises', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  test('should handle async functions', async () => {
    const asyncFunction = async () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('done'), 10);
      });
    };
    
    const result = await asyncFunction();
    expect(result).toBe('done');
  });
});