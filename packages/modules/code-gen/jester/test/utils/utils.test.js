/**
 * Utility Functions Tests
 * Tests for generateId, parseStackTrace, and extractLocation functions
 */

import { generateId, parseStackTrace, extractLocation } from '../../src/utils/index.js';

describe('Utility Functions', () => {
  describe('generateId', () => {
    test('creates unique identifiers', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('includes timestamp for uniqueness', () => {
      const id1 = generateId('same-content');
      // Small delay to ensure different timestamp
      const id2 = generateId('same-content');
      
      expect(id1).not.toBe(id2);
    });

    test('generates consistent length identifiers', () => {
      const id1 = generateId('short');
      const id2 = generateId('much-longer-content-string');
      
      expect(id1.length).toBe(16);
      expect(id2.length).toBe(16);
    });

    test('handles empty content', () => {
      const id = generateId('');
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(16);
    });
  });

  describe('parseStackTrace', () => {
    test('handles valid stack traces', () => {
      const stackTrace = `Error: Test error
    at Object.test (/path/to/file.js:10:5)
    at processImmediate (internal/timers.js:456:26)`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        function: 'Object.test',
        file: '/path/to/file.js',
        line: 10,
        column: 5
      });
      expect(result[1]).toEqual({
        function: 'processImmediate',
        file: 'internal/timers.js',
        line: 456,
        column: 26
      });
    });

    test('handles empty/null input', () => {
      expect(parseStackTrace('')).toEqual([]);
      expect(parseStackTrace(null)).toEqual([]);
      expect(parseStackTrace(undefined)).toEqual([]);
    });

    test('extracts function names correctly', () => {
      const stackTrace = `Error: Test
    at myFunction (/path/file.js:1:1)
    at anonymous (/path/file.js:2:2)`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result[0].function).toBe('myFunction');
      expect(result[1].function).toBe('anonymous');
    });

    test('extracts file paths correctly', () => {
      const stackTrace = `Error: Test
    at func (/absolute/path/file.js:1:1)
    at func2 (relative/path/file.js:2:2)`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result[0].file).toBe('/absolute/path/file.js');
      expect(result[1].file).toBe('relative/path/file.js');
    });

    test('extracts line/column numbers', () => {
      const stackTrace = `Error: Test
    at func (/path/file.js:123:456)`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result[0].line).toBe(123);
      expect(result[0].column).toBe(456);
    });

    test('handles alternative stack trace format', () => {
      const stackTrace = `Error: Test
    at /path/file.js:10:5`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result[0]).toEqual({
        function: 'anonymous',
        file: '/path/file.js',
        line: 10,
        column: 5
      });
    });

    test('handles malformed stack trace lines', () => {
      const stackTrace = `Error: Test
    at validLine (/path/file.js:1:1)
    invalid line format
    at anotherValidLine (/path/file2.js:2:2)`;
      
      const result = parseStackTrace(stackTrace);
      
      expect(result).toHaveLength(2); // Only lines with 'at ' are processed
      expect(result[0].function).toBe('validLine');
      expect(result[1].function).toBe('anotherValidLine');
    });
  });

  describe('extractLocation', () => {
    test('finds first non-node_modules frame', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.test (node_modules/jest/lib/jest.js:10:5)
    at myFunction (/path/to/my-file.js:20:10)
    at anotherFunction (/path/to/another-file.js:30:15)`;
      
      const result = extractLocation(error);
      
      expect(result).toEqual({
        file: '/path/to/my-file.js',
        line: 20,
        column: 10
      });
    });

    test('handles errors without stack traces', () => {
      const error = new Error('Test error');
      error.stack = undefined;
      
      const result = extractLocation(error);
      
      expect(result).toBeNull();
    });

    test('handles errors with only node_modules frames', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.test (node_modules/jest/lib/jest.js:10:5)
    at internal (node_modules/internal/process.js:20:10)`;
      
      const result = extractLocation(error);
      
      expect(result).toBeNull();
    });

    test('handles errors with no parseable frames', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    invalid stack trace format`;
      
      const result = extractLocation(error);
      
      expect(result).toBeNull();
    });

    test('returns first valid frame when multiple exist', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at firstFunction (/path/to/first.js:10:5)
    at secondFunction (/path/to/second.js:20:10)`;
      
      const result = extractLocation(error);
      
      expect(result).toEqual({
        file: '/path/to/first.js',
        line: 10,
        column: 5
      });
    });
  });
});
