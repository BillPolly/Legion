/**
 * String Utilities Tests - Simple string manipulation functions
 */

import { describe, test, expect } from '@jest/globals';

// Simple utility functions
function camelCase(str) {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}

function kebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function truncate(str, length, suffix = '...') {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function escapeHtml(str) {
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  return str.replace(/[&<>"']/g, match => htmlEscapes[match]);
}

describe('String Utilities', () => {
  describe('camelCase', () => {
    test('should convert kebab-case to camelCase', () => {
      expect(camelCase('hello-world')).toBe('helloWorld');
      expect(camelCase('test-case-string')).toBe('testCaseString');
    });

    test('should convert snake_case to camelCase', () => {
      expect(camelCase('hello_world')).toBe('helloWorld');
      expect(camelCase('test_case_string')).toBe('testCaseString');
    });

    test('should handle mixed separators', () => {
      expect(camelCase('hello-world_test')).toBe('helloWorldTest');
    });

    test('should leave already camelCase strings unchanged', () => {
      expect(camelCase('helloWorld')).toBe('helloWorld');
    });
  });

  describe('kebabCase', () => {
    test('should convert camelCase to kebab-case', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world');
      expect(kebabCase('testCaseString')).toBe('test-case-string');
    });

    test('should handle consecutive capitals', () => {
      expect(kebabCase('XMLHttpRequest')).toBe('x-m-l-http-request');
    });

    test('should leave already kebab-case strings unchanged', () => {
      expect(kebabCase('hello-world')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    test('should truncate long strings', () => {
      const longString = 'This is a very long string that needs to be truncated';
      expect(truncate(longString, 20)).toBe('This is a very lo...');
    });

    test('should not truncate short strings', () => {
      const shortString = 'Short';
      expect(truncate(shortString, 20)).toBe('Short');
    });

    test('should use custom suffix', () => {
      const longString = 'This is a long string';
      expect(truncate(longString, 10, ' [more]')).toBe('Thi [more]');
    });

    test('should handle edge cases', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate('test', 0)).toBe('...');
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
    });

    test('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    test('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
      expect(capitalize('Z')).toBe('Z');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML characters', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should escape quotes', () => {
      expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
      expect(escapeHtml("It's working")).toBe('It&#x27;s working');
    });

    test('should handle complex HTML', () => {
      const html = '<script>alert("XSS")</script>';
      const escaped = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(escapeHtml(html)).toBe(escaped);
    });

    test('should leave safe strings unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });
});