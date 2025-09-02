/**
 * ContextManager Unit Tests
 * 
 * Tests for extracted BT Executor context management utilities
 */

import { ContextManager } from '../ContextManager.js';
import { describe, test, expect } from '@jest/globals';

describe('ContextManager', () => {
  describe('resolveParams', () => {
    test('resolves @varName references correctly', () => {
      const context = {
        artifacts: {
          user_name: "John",
          file_path: "/tmp/test.txt",
          count: 42
        }
      };

      const params = {
        name: "@user_name",
        path: "@file_path", 
        iterations: "@count",
        constant: "hello"
      };

      const resolved = ContextManager.resolveParams(params, context);

      expect(resolved).toEqual({
        name: "John",
        path: "/tmp/test.txt",
        iterations: 42,
        constant: "hello"
      });
    });

    test('handles missing artifacts gracefully', () => {
      const context = { artifacts: { existing: "value" } };
      const params = { 
        exists: "@existing", 
        missing: "@nonexistent"
      };

      const resolved = ContextManager.resolveParams(params, context);

      expect(resolved).toEqual({
        exists: "value",
        missing: undefined
      });
    });

    test('handles empty context', () => {
      const context = {};
      const params = { var: "@missing", constant: "test" };

      const resolved = ContextManager.resolveParams(params, context);

      expect(resolved).toEqual({
        var: undefined,
        constant: "test"
      });
    });
  });

  describe('formatContextForPrompt', () => {
    test('formats context variables correctly', () => {
      const context = {
        artifacts: {
          short_text: "Hello",
          long_text: "a".repeat(60),
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { key1: "value1", key2: "value2" },
          null_val: null
        }
      };

      const formatted = ContextManager.formatContextForPrompt(context);

      expect(formatted).toContain('short_text: "Hello"');
      expect(formatted).toContain('long_text: "aaa...'); // Truncated
      expect(formatted).toContain('number: 42');
      expect(formatted).toContain('boolean: true');
      expect(formatted).toContain('array: Array(3)');
      expect(formatted).toContain('object: Object(2 keys)');
      expect(formatted).toContain('null_val: null');
    });

    test('handles empty context', () => {
      const context = { artifacts: {} };
      const formatted = ContextManager.formatContextForPrompt(context);
      expect(formatted).toBe('No context variables stored.');
    });

    test('handles missing artifacts', () => {
      const context = {};
      const formatted = ContextManager.formatContextForPrompt(context);
      expect(formatted).toBe('No context variables stored.');
    });
  });

  describe('getVariablePreview', () => {
    test('handles string values', () => {
      expect(ContextManager.getVariablePreview("short")).toBe('"short"');
      expect(ContextManager.getVariablePreview("a".repeat(60))).toMatch(/"a{47}\.\.\."/);
    });

    test('handles numeric values', () => {
      expect(ContextManager.getVariablePreview(42)).toBe('42');
      expect(ContextManager.getVariablePreview(3.14)).toBe('3.14');
      expect(ContextManager.getVariablePreview(-17)).toBe('-17');
    });

    test('handles boolean values', () => {
      expect(ContextManager.getVariablePreview(true)).toBe('true');
      expect(ContextManager.getVariablePreview(false)).toBe('false');
    });

    test('handles array values', () => {
      expect(ContextManager.getVariablePreview([])).toBe('Array(0)');
      expect(ContextManager.getVariablePreview([1, 2, 3])).toBe('Array(3)');
      expect(ContextManager.getVariablePreview(new Array(100))).toBe('Array(100)');
    });

    test('handles object values', () => {
      expect(ContextManager.getVariablePreview({})).toBe('Object(0 keys)');
      expect(ContextManager.getVariablePreview({a: 1, b: 2})).toBe('Object(2 keys)');
      
      const largeObj = {};
      for (let i = 0; i < 50; i++) {
        largeObj[`key${i}`] = i;
      }
      expect(ContextManager.getVariablePreview(largeObj)).toBe('Object(50 keys)');
    });

    test('handles null and undefined', () => {
      expect(ContextManager.getVariablePreview(null)).toBe('null');
      expect(ContextManager.getVariablePreview(undefined)).toBe('undefined');
    });

    test('handles unusual types', () => {
      const symbol = Symbol('test');
      const fn = () => {};
      
      expect(ContextManager.getVariablePreview(symbol)).toBe('symbol');
      expect(ContextManager.getVariablePreview(fn)).toBe('function');
    });
  });

  describe('validateContextVariable', () => {
    test('validates proper variable names', () => {
      expect(() => ContextManager.validateContextVariable('valid_name', 'value')).not.toThrow();
      expect(() => ContextManager.validateContextVariable('_underscore', 'value')).not.toThrow();
      expect(() => ContextManager.validateContextVariable('name123', 'value')).not.toThrow();
      expect(() => ContextManager.validateContextVariable('CamelCase', 'value')).not.toThrow();
    });

    test('rejects invalid variable names', () => {
      expect(() => ContextManager.validateContextVariable('', 'value')).toThrow();
      expect(() => ContextManager.validateContextVariable(null, 'value')).toThrow();
      expect(() => ContextManager.validateContextVariable(undefined, 'value')).toThrow();
      expect(() => ContextManager.validateContextVariable('123invalid', 'value')).toThrow();
      expect(() => ContextManager.validateContextVariable('invalid-name', 'value')).toThrow();
      expect(() => ContextManager.validateContextVariable('invalid name', 'value')).toThrow();
    });

    test('rejects undefined values', () => {
      expect(() => ContextManager.validateContextVariable('valid_name', undefined)).toThrow();
    });

    test('allows null values', () => {
      expect(() => ContextManager.validateContextVariable('valid_name', null)).not.toThrow();
    });
  });

  describe('validateParameterResolution', () => {
    test('passes validation for properly resolved parameters', () => {
      const resolvedParams = {
        name: "John",
        count: 42,
        path: "/tmp/file.txt"
      };
      const originalParams = {
        name: "@user_name",
        count: "@user_count", 
        path: "/tmp/file.txt"
      };

      const errors = ContextManager.validateParameterResolution(resolvedParams, originalParams);
      expect(errors).toEqual([]);
    });

    test('detects unresolved variable references', () => {
      const resolvedParams = {
        name: "John",
        missing: undefined,
        unresolved: "@still_unresolved"
      };
      const originalParams = {
        name: "@user_name",
        missing: "@missing_var",
        unresolved: "@still_unresolved"  
      };

      const errors = ContextManager.validateParameterResolution(resolvedParams, originalParams);
      
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('@missing_var (variable not found in context)');
      expect(errors[1]).toContain('@still_unresolved (variable reference not resolved)');
    });
  });

  describe('formatChatHistory', () => {
    test('formats chat history with role labels', () => {
      const chatHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'agent', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const formatted = ContextManager.formatChatHistory(chatHistory);
      
      expect(formatted).toBe('User: Hello\nAgent: Hi there!\nUser: How are you?');
    });

    test('limits to recent messages', () => {
      const longHistory = [];
      for (let i = 0; i < 10; i++) {
        longHistory.push({ role: 'user', content: `Message ${i}` });
      }

      const formatted = ContextManager.formatChatHistory(longHistory, 3);
      
      expect(formatted.split('\n')).toHaveLength(3);
      expect(formatted).toContain('Message 7');
      expect(formatted).toContain('Message 9');
      expect(formatted).not.toContain('Message 0');
    });

    test('handles empty chat history', () => {
      const formatted = ContextManager.formatChatHistory([]);
      expect(formatted).toBe('No previous chat history.');
    });
  });

  describe('Context Utilities', () => {
    test('createContextSnapshot provides accurate summary', () => {
      const context = {
        artifacts: {
          file1: "content1",
          data: { key: "value" },
          results: [1, 2, 3]
        }
      };

      const snapshot = ContextManager.createContextSnapshot(context);

      expect(snapshot.variableCount).toBe(3);
      expect(snapshot.variables).toEqual(['file1', 'data', 'results']);
      expect(snapshot.variablePreviews).toHaveProperty('file1');
      expect(snapshot.variablePreviews).toHaveProperty('data');
      expect(snapshot.variablePreviews).toHaveProperty('results');
      expect(snapshot.totalSize).toBeGreaterThan(0);
    });

    test('safeSerializeContext handles circular references', () => {
      const circular = { name: 'test' };
      circular.self = circular; // Create circular reference

      const context = {
        artifacts: {
          safe_var: "hello",
          circular_var: circular
        }
      };

      const serialized = ContextManager.safeSerializeContext(context);

      expect(serialized.artifacts.safe_var).toBe("hello");
      expect(typeof serialized.artifacts.circular_var).toBe('string');
      expect(serialized.artifacts.circular_var).toContain('[object]');
    });

    test('mergeContexts combines artifacts correctly', () => {
      const base = {
        artifacts: { var1: "value1", var2: "value2" }
      };
      const additional = {
        artifacts: { var2: "updated_value2", var3: "value3" }
      };

      const merged = ContextManager.mergeContexts(base, additional);

      expect(merged.artifacts).toEqual({
        var1: "value1",
        var2: "updated_value2", // Should overwrite
        var3: "value3"
      });
    });
  });
});