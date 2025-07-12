import { describe, it, expect, beforeEach } from '@jest/globals';
import { StringUtils } from '../../src/utils/StringUtils.js';

describe('StringUtils', () => {
  let stringUtils;

  beforeEach(() => {
    stringUtils = new StringUtils();
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(stringUtils.levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should calculate distance for different strings', () => {
      expect(stringUtils.levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(stringUtils.levenshteinDistance('', '')).toBe(0);
      expect(stringUtils.levenshteinDistance('hello', '')).toBe(5);
      expect(stringUtils.levenshteinDistance('', 'hello')).toBe(5);
    });

    it('should be case sensitive', () => {
      expect(stringUtils.levenshteinDistance('Hello', 'hello')).toBe(1);
    });

    it('should handle single character differences', () => {
      expect(stringUtils.levenshteinDistance('abc', 'abd')).toBe(1);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(stringUtils.calculateSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(stringUtils.calculateSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should calculate partial similarity', () => {
      const similarity = stringUtils.calculateSimilarity('hello', 'hallo');
      expect(similarity).toBeCloseTo(0.8, 1);
    });

    it('should handle empty strings', () => {
      expect(stringUtils.calculateSimilarity('', '')).toBe(1);
    });
  });

  describe('findBestMatch', () => {
    const candidates = ['calculator', 'calendar', 'calibrate', 'file', 'filter'];

    it('should find exact match', () => {
      expect(stringUtils.findBestMatch('calculator', candidates)).toBe('calculator');
    });

    it('should find match with small typo', () => {
      expect(stringUtils.findBestMatch('calander', candidates)).toBe('calendar');
    });

    it('should return null for no good match', () => {
      expect(stringUtils.findBestMatch('xyz', candidates)).toBe(null);
    });

    it('should handle empty candidates', () => {
      expect(stringUtils.findBestMatch('test', [])).toBe(null);
    });

    it('should be case insensitive', () => {
      expect(stringUtils.findBestMatch('FILE', candidates)).toBe('file');
    });

    it('should not match if distance > 3', () => {
      expect(stringUtils.findBestMatch('completely', candidates)).toBe(null);
    });
  });

  describe('findCloseMatches', () => {
    const candidates = ['calculator', 'calendar', 'calibrate', 'file', 'filter'];

    it('should find matches starting with input', () => {
      const matches = stringUtils.findCloseMatches('cal', candidates);
      expect(matches).toContain('calculator');
      expect(matches).toContain('calendar');
      expect(matches).toContain('calibrate');
    });

    it('should find matches with small edit distance', () => {
      const matches = stringUtils.findCloseMatches('filt', candidates);
      expect(matches).toContain('filter');
      expect(matches).toContain('file');
    });

    it('should return empty array for no matches', () => {
      expect(stringUtils.findCloseMatches('xyz', candidates)).toEqual([]);
    });

    it('should handle empty candidates', () => {
      expect(stringUtils.findCloseMatches('test', [])).toEqual([]);
    });
  });

  describe('splitCommandLine', () => {
    it('should split basic command', () => {
      const result = stringUtils.splitCommandLine('module.tool --arg value');
      expect(result).toEqual(['module.tool', '--arg', 'value']);
    });

    it('should handle quoted strings', () => {
      const result = stringUtils.splitCommandLine('tool --path "file with spaces.txt"');
      expect(result).toEqual(['tool', '--path', 'file with spaces.txt']);
    });

    it('should handle single quotes', () => {
      const result = stringUtils.splitCommandLine("tool --name 'John Doe'");
      expect(result).toEqual(['tool', '--name', 'John Doe']);
    });

    it('should handle escaped quotes', () => {
      const result = stringUtils.splitCommandLine('tool --text "He said \\"Hello\\""');
      expect(result).toEqual(['tool', '--text', 'He said \\"Hello\\"']);
    });

    it('should handle empty string', () => {
      const result = stringUtils.splitCommandLine('');
      expect(result).toEqual([]);
    });

    it('should handle multiple spaces', () => {
      const result = stringUtils.splitCommandLine('tool   --arg    value');
      expect(result).toEqual(['tool', '--arg', 'value']);
    });

    it('should handle nested quotes', () => {
      const result = stringUtils.splitCommandLine('tool --json \'{"key": "value"}\'');
      expect(result).toEqual(['tool', '--json', '{"key": "value"}']);
    });
  });

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(stringUtils.truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long strings', () => {
      expect(stringUtils.truncate('hello world', 8)).toBe('hello...');
    });

    it('should handle exact length', () => {
      expect(stringUtils.truncate('hello', 5)).toBe('hello');
    });

    it('should handle custom suffix', () => {
      expect(stringUtils.truncate('hello world', 8, '…')).toBe('hello w…');
    });

    it('should handle very short max length', () => {
      expect(stringUtils.truncate('hello', 3)).toBe('...');
    });

    it('should handle null string', () => {
      expect(stringUtils.truncate(null, 10)).toBe(null);
    });
  });

  describe('pad', () => {
    it('should pad string to specified length on the right', () => {
      expect(stringUtils.pad('hello', 10)).toBe('hello     ');
    });

    it('should not pad if string is already long enough', () => {
      expect(stringUtils.pad('hello world', 5)).toBe('hello world');
    });

    it('should pad with custom character', () => {
      expect(stringUtils.pad('hello', 10, '-')).toBe('hello-----');
    });

    it('should pad on the left', () => {
      expect(stringUtils.pad('hello', 10, ' ', 'left')).toBe('     hello');
    });

    it('should handle empty string', () => {
      expect(stringUtils.pad('', 5)).toBe('     ');
    });

    it('should handle null string', () => {
      expect(stringUtils.pad(null, 5)).toBe('     ');
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(stringUtils.toCamelCase('snake_case')).toBe('snakeCase');
    });

    it('should convert kebab-case to camelCase', () => {
      expect(stringUtils.toCamelCase('kebab-case')).toBe('kebabCase');
    });

    it('should handle mixed separators', () => {
      expect(stringUtils.toCamelCase('mixed_case-style')).toBe('mixedCaseStyle');
    });

    it('should handle already camelCase', () => {
      expect(stringUtils.toCamelCase('camelCase')).toBe('camelCase');
    });

    it('should handle single word', () => {
      expect(stringUtils.toCamelCase('word')).toBe('word');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(stringUtils.toKebabCase('camelCase')).toBe('camel-case');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(stringUtils.toKebabCase('PascalCase')).toBe('pascal-case');
    });

    it('should handle already kebab-case', () => {
      expect(stringUtils.toKebabCase('kebab-case')).toBe('kebab-case');
    });

    it('should handle consecutive capitals', () => {
      expect(stringUtils.toKebabCase('XMLHttpRequest')).toBe('xmlhttp-request');
    });

    it('should handle single word', () => {
      expect(stringUtils.toKebabCase('word')).toBe('word');
    });

    it('should handle all uppercase', () => {
      expect(stringUtils.toKebabCase('WORD')).toBe('word');
    });
  });
});