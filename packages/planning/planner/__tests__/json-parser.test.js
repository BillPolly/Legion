/**
 * Unit tests for json-parser utility
 */

import { describe, it, expect } from '@jest/globals';
import { extractJSON } from '../src/utils/json-parser.js';

describe('json-parser', () => {
  describe('extractJSON', () => {
    it('should parse clean JSON directly', () => {
      const input = '{"type": "sequence", "id": "root"}';
      const result = extractJSON(input);
      expect(result).toEqual({ type: 'sequence', id: 'root' });
    });

    it('should extract JSON from markdown code blocks', () => {
      const input = `
        Here is the plan:
        \`\`\`json
        {
          "type": "sequence",
          "id": "root",
          "children": []
        }
        \`\`\`
      `;
      const result = extractJSON(input);
      expect(result).toEqual({
        type: 'sequence',
        id: 'root',
        children: []
      });
    });

    it('should extract JSON from code blocks without json tag', () => {
      const input = `
        \`\`\`
        {"type": "action", "tool": "file_write"}
        \`\`\`
      `;
      const result = extractJSON(input);
      expect(result).toEqual({ type: 'action', tool: 'file_write' });
    });

    it('should extract JSON with text before and after', () => {
      const input = 'Here is the JSON: {"value": 123} and some text after';
      const result = extractJSON(input);
      expect(result).toEqual({ value: 123 });
    });

    it('should handle nested objects', () => {
      const input = '{"outer": {"inner": {"deep": "value"}}}';
      const result = extractJSON(input);
      expect(result).toEqual({
        outer: {
          inner: {
            deep: 'value'
          }
        }
      });
    });

    it('should handle arrays', () => {
      const input = '{"items": [1, 2, 3], "nested": [{"a": 1}]}';
      const result = extractJSON(input);
      expect(result).toEqual({
        items: [1, 2, 3],
        nested: [{ a: 1 }]
      });
    });

    it('should handle JSON5 features (trailing commas, single quotes)', () => {
      const input = "{type: 'sequence', id: 'root', children: [],}";
      const result = extractJSON(input);
      expect(result).toEqual({
        type: 'sequence',
        id: 'root',
        children: []
      });
    });

    it('should handle strings with braces inside', () => {
      const input = '{"message": "This {has} braces", "value": 123}';
      const result = extractJSON(input);
      expect(result).toEqual({
        message: 'This {has} braces',
        value: 123
      });
    });

    it('should handle escaped quotes', () => {
      const input = '{"message": "He said \\"hello\\""}';
      const result = extractJSON(input);
      expect(result).toEqual({
        message: 'He said "hello"'
      });
    });

    it('should throw error for invalid input', () => {
      expect(() => extractJSON(null)).toThrow('Invalid input');
      expect(() => extractJSON('')).toThrow('Invalid input');
      expect(() => extractJSON(123)).toThrow('Invalid input');
    });

    it('should throw error when no JSON found', () => {
      expect(() => extractJSON('just plain text')).toThrow('No valid JSON');
      expect(() => extractJSON('{ broken json')).toThrow();
    });

    it('should extract first valid JSON object when multiple exist', () => {
      const input = '{"first": 1} some text {"second": 2}';
      const result = extractJSON(input);
      expect(result).toEqual({ first: 1 });
    });

    it('should handle multiline JSON', () => {
      const input = `
        {
          "type": "sequence",
          "id": "root",
          "children": [
            {
              "type": "action",
              "tool": "file_write"
            }
          ]
        }
      `;
      const result = extractJSON(input);
      expect(result.type).toBe('sequence');
      expect(result.children).toHaveLength(1);
    });
  });
});