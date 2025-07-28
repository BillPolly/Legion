/**
 * Test for improved ResponseFormatter
 */

import { describe, test, expect } from '@jest/globals';
import { ResponseFormatter } from '../../src/client/cli-terminal-v2/components/ResponseFormatter.js';

describe('ResponseFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new ResponseFormatter();
  });

  describe('Calculator formatting', () => {
    test('should format calculator results nicely', () => {
      const result = {
        success: true,
        data: {
          result: 10,
          expression: "5+5"
        }
      };

      const formatted = formatter.format('calculator_evaluate', result);
      expect(formatted).toBe('5+5 = 10');
    });

    test('should format decimal results with proper precision', () => {
      const result = {
        success: true,
        data: {
          result: 3.141592653589793,
          expression: "Math.PI"
        }
      };

      const formatted = formatter.format('calculator_evaluate', result);
      expect(formatted).toBe('Math.PI = 3.141593');
    });

    test('should format calculator errors', () => {
      const result = {
        success: false,
        error: 'Invalid expression',
        data: {
          expression: "invalid"
        }
      };

      const formatted = formatter.format('calculator_evaluate', result);
      expect(formatted).toContain('❌ Calculation Error');
      expect(formatted).toContain('Invalid expression');
      expect(formatted).toContain('Expression: invalid');
    });
  });

  describe('File operation formatting', () => {
    test('should format file read results', () => {
      const result = {
        success: true,
        data: {
          path: '/test/file.txt',
          content: 'Hello\nWorld\nTest'
        }
      };

      const formatted = formatter.format('file_read', result);
      expect(formatted).toContain('📄 /test/file.txt');
      expect(formatted).toContain('3 lines');
      expect(formatted).toContain('Hello\nWorld\nTest');
    });

    test('should format file write results', () => {
      const result = {
        success: true,
        data: {
          path: '/test/output.txt',
          bytesWritten: 25
        }
      };

      const formatted = formatter.format('file_write', result);
      expect(formatted).toBe('✓ File written: /test/output.txt (25 bytes)');
    });

    test('should format directory listing', () => {
      const result = {
        success: true,
        data: {
          path: '/test',
          entries: [
            { name: 'subdir', type: 'directory' },
            { name: 'file.txt', type: 'file', size: 100 }
          ]
        }
      };

      const formatted = formatter.format('directory_list', result);
      expect(formatted).toContain('📁 /test (2 items)');
      expect(formatted).toContain('📁 subdir');
      expect(formatted).toContain('📄 file.txt (100 bytes)');
    });
  });

  describe('Context formatting', () => {
    test('should format context add results', () => {
      const result = {
        success: true,
        data: {
          name: 'my_variable'
        }
      };

      const formatted = formatter.format('context_add', result);
      expect(formatted).toBe('✓ Added context variable: @my_variable');
    });

    test('should format context get results', () => {
      const result = {
        success: true,
        data: {
          name: 'my_variable',
          data: 'Hello World',
          description: 'A test variable'
        }
      };

      const formatted = formatter.format('context_get', result);
      expect(formatted).toContain('📋 @my_variable:');
      expect(formatted).toContain('Description: A test variable');
      expect(formatted).toContain('Hello World');
    });
  });

  describe('Generic formatting', () => {
    test('should format simple success messages', () => {
      const result = {
        success: true,
        message: 'Operation completed'
      };

      const formatted = formatter.format('unknown_tool', result);
      expect(formatted).toBe('✓ Operation completed');
    });

    test('should format simple data values', () => {
      const result = {
        data: 'Simple string result'
      };

      const formatted = formatter.format('unknown_tool', result);
      expect(formatted).toBe('Simple string result');
    });

    test('should format simple numbers', () => {
      const result = {
        data: 42
      };

      const formatted = formatter.format('unknown_tool', result);
      expect(formatted).toBe('42');
    });

    test('should format error responses', () => {
      const result = {
        success: false,
        error: 'Something went wrong'
      };

      const formatted = formatter.format('unknown_tool', result);
      expect(formatted).toContain('❌ Error');
      expect(formatted).toContain('Something went wrong');
    });
  });

  describe('Default formatting', () => {
    test('should format simple arrays inline', () => {
      const result = ['apple', 'banana', 'cherry'];
      const formatted = formatter.formatDefault(result);
      expect(formatted).toBe('[apple, banana, cherry]');
    });

    test('should format empty arrays', () => {
      const result = [];
      const formatted = formatter.formatDefault(result);
      expect(formatted).toBe('(empty array)');
    });

    test('should format large arrays with preview', () => {
      const result = Array.from({length: 15}, (_, i) => `item${i}`);
      const formatted = formatter.formatDefault(result);
      expect(formatted).toContain('Array (15 items)');
    });

    test('should format empty objects', () => {
      const result = {};
      const formatted = formatter.formatDefault(result);
      expect(formatted).toBe('(empty object)');
    });

    test('should format large objects with summary', () => {
      const result = {
        prop1: 'value1',
        prop2: 'value2', 
        prop3: 'value3',
        prop4: 'value4',
        prop5: 'value5',
        prop6: 'value6'
      };
      const formatted = formatter.formatDefault(result);
      expect(formatted).toContain('Object with 6 properties');
    });
  });
});