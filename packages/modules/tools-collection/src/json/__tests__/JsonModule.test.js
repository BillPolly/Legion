/**
 * Comprehensive test suite for JsonModule
 * Tests all 4 JSON manipulation tools with 100% coverage
 */

import JsonModule from '../JsonModule.js';
import { ResourceManager } from '@legion/resource-manager';

describe('JsonModule', () => {
  let resourceManager;
  let jsonModule;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    jsonModule = await JsonModule.create(resourceManager);
  });

  describe('Module Creation and Initialization', () => {
    test('should create module with correct metadata', () => {
      expect(jsonModule.name).toBe('json');
      expect(jsonModule.description).toContain('JSON manipulation');
      expect(jsonModule.version).toBe('1.0.0');
    });

    test('should have ResourceManager injected', () => {
      expect(jsonModule.resourceManager).toBe(resourceManager);
    });

    test('should register all JSON tools during initialization', () => {
      const expectedTools = ['json_parse', 'json_stringify', 'json_validate', 'json_extract'];
      
      for (const toolName of expectedTools) {
        expect(jsonModule.getTool(toolName)).toBeDefined();
      }
    });

    test('should have proper module structure', () => {
      expect(typeof jsonModule.initialize).toBe('function');
      expect(typeof jsonModule.getTool).toBe('function');
      expect(typeof jsonModule.getTools).toBe('function');
    });

    test('should create module via static create method', async () => {
      const module = await JsonModule.create(resourceManager);
      expect(module).toBeInstanceOf(JsonModule);
      expect(module.resourceManager).toBe(resourceManager);
    });
  });

  describe('JSON Parse Tool', () => {
    let tool;

    beforeEach(() => {
      tool = jsonModule.getTool('json_parse');
    });

    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('json_parse');
      expect(tool.description).toContain('Parse JSON string');
    });

    test('should have getMetadata method', () => {
      expect(typeof tool.getMetadata).toBe('function');
      const metadata = tool.getMetadata();
      expect(metadata.name).toBe('json_parse');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
    });

    test('should have validate method', () => {
      expect(typeof tool.validate).toBe('function');
      const validation = tool.validate({ json_string: '{"test": true}' });
      expect(validation.valid).toBe(true);
    });

    test('should parse simple JSON correctly', async () => {
      const result = await tool.execute({ json_string: '{"name": "test", "value": 42}' });
      
      expect(result.data.parsed).toEqual({ name: 'test', value: 42 });
      expect(result.data.result).toEqual({ name: 'test', value: 42 });
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(false);
    });

    test('should parse JSON array correctly', async () => {
      const result = await tool.execute({ json_string: '[1, 2, 3, "test"]' });
      
      expect(result.data.parsed).toEqual([1, 2, 3, 'test']);
      expect(result.data.result).toEqual([1, 2, 3, 'test']);
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(true);
    });

    test('should parse JSON primitives correctly', async () => {
      const testCases = [
        { input: '"hello"', expected: 'hello', type: 'string', isArray: false },
        { input: '42', expected: 42, type: 'number', isArray: false },
        { input: 'true', expected: true, type: 'boolean', isArray: false },
        { input: 'null', expected: null, type: 'object', isArray: false }
      ];

      for (const testCase of testCases) {
        const result = await tool.execute({ json_string: testCase.input });
        expect(result.data.parsed).toBe(testCase.expected);
        expect(result.data.type).toBe(testCase.type);
        expect(result.data.isArray).toBe(testCase.isArray);
      }
    });

    test('should handle nested objects correctly', async () => {
      const complexJson = '{"user": {"name": "John", "address": {"city": "NYC", "zip": 10001}}}';
      const result = await tool.execute({ json_string: complexJson });
      
      expect(result.data.parsed.user.name).toBe('John');
      expect(result.data.parsed.user.address.city).toBe('NYC');
      expect(result.data.parsed.user.address.zip).toBe(10001);
    });

    test('should handle invalid JSON gracefully', async () => {
      const result = await tool.execute({ json_string: '{"invalid": json}' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing json_string parameter', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle empty string', async () => {
      const result = await tool.execute({ json_string: '' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('JSON Stringify Tool', () => {
    let tool;

    beforeEach(() => {
      tool = jsonModule.getTool('json_stringify');
    });

    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('json_stringify');
      expect(tool.description).toContain('Convert JavaScript object');
    });

    test('should have compliance methods', () => {
      expect(typeof tool.getMetadata).toBe('function');
      expect(typeof tool.validate).toBe('function');
    });

    test('should stringify simple object correctly', async () => {
      const input = { name: 'test', value: 42 };
      const result = await tool.execute({ object: input });
      
      expect(result.data.json).toBe('{\n  "name": "test",\n  "value": 42\n}');
      expect(result.data.result).toBe(result.data.json);
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should stringify with custom indentation', async () => {
      const input = { a: 1, b: 2 };
      const result = await tool.execute({ object: input, indent: 0 });
      
      expect(result.data.json).toBe('{"a":1,"b":2}');
      expect(result.data.json).not.toContain('\n');
    });

    test('should stringify with custom indentation (4 spaces)', async () => {
      const input = { test: true };
      const result = await tool.execute({ object: input, indent: 4 });
      
      expect(result.data.json).toContain('    "test": true');
    });

    test('should sort keys when requested', async () => {
      const input = { z: 1, a: 2, m: 3 };
      const result = await tool.execute({ object: input, sort_keys: true, indent: 0 });
      
      expect(result.data.json).toBe('{"a":2,"m":3,"z":1}');
    });

    test('should handle nested objects with sorted keys', async () => {
      const input = { 
        z: { b: 1, a: 2 }, 
        a: { y: 3, x: 4 } 
      };
      const result = await tool.execute({ object: input, sort_keys: true, indent: 0 });
      
      // Keys should be sorted at all levels
      expect(result.data.json).toBe('{"a":{"x":4,"y":3},"z":{"a":2,"b":1}}');
    });

    test('should handle arrays correctly', async () => {
      const input = [1, 'test', { key: 'value' }, null];
      const result = await tool.execute({ object: input, indent: 0 });
      
      expect(result.data.json).toBe('[1,"test",{"key":"value"},null]');
    });

    test('should handle null and undefined', async () => {
      const result1 = await tool.execute({ object: null });
      expect(result1.data.json).toBe('null');
      
      const result2 = await tool.execute({ object: undefined });
      expect(result2.data.json).toBeUndefined();
    });

    test('should handle missing object parameter', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should calculate length correctly', async () => {
      const input = { test: 'value' };
      const result = await tool.execute({ object: input });
      
      expect(result.data.length).toBe(result.data.json.length);
      expect(typeof result.data.length).toBe('number');
    });
  });

  describe('JSON Validate Tool', () => {
    let tool;

    beforeEach(() => {
      tool = jsonModule.getTool('json_validate');
    });

    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('json_validate');
      expect(tool.description).toContain('Validate if a string is valid JSON');
    });

    test('should have compliance methods', () => {
      expect(typeof tool.getMetadata).toBe('function');
      expect(typeof tool.validate).toBe('function');
    });

    test('should validate valid JSON objects', async () => {
      const result = await tool.execute({ json_string: '{"valid": true}' });
      
      expect(result.data.valid).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(false);
      expect(result.data.message).toBe('Valid JSON');
    });

    test('should validate valid JSON arrays', async () => {
      const result = await tool.execute({ json_string: '[1, 2, 3]' });
      
      expect(result.data.valid).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(true);
      expect(result.data.message).toBe('Valid JSON');
    });

    test('should validate JSON primitives', async () => {
      const testCases = [
        { input: '"string"', type: 'string', isArray: false },
        { input: '42', type: 'number', isArray: false },
        { input: 'true', type: 'boolean', isArray: false },
        { input: 'null', type: 'object', isArray: false }
      ];

      for (const testCase of testCases) {
        const result = await tool.execute({ json_string: testCase.input });
        expect(result.data.valid).toBe(true);
        expect(result.data.type).toBe(testCase.type);
        expect(result.data.isArray).toBe(testCase.isArray);
      }
    });

    test('should detect invalid JSON with error details', async () => {
      const result = await tool.execute({ json_string: '{"invalid": json}' });
      
      expect(result.data.valid).toBe(false);
      expect(result.data.isValid).toBe(false);
      expect(result.data.error).toContain('Unexpected token');
      expect(result.data.message).toContain('Invalid JSON');
      expect(typeof result.data.position).toBe('number');
      expect(typeof result.data.line).toBe('number');
      expect(typeof result.data.column).toBe('number');
    });

    test('should handle missing quotes error', async () => {
      const result = await tool.execute({ json_string: '{key: "value"}' });
      
      expect(result.data.valid).toBe(false);
      expect(result.data.error).toBeDefined();
      expect(result.data.position).toBeGreaterThan(0);
    });

    test('should handle unclosed braces error', async () => {
      const result = await tool.execute({ json_string: '{"test": "value"' });
      
      expect(result.data.valid).toBe(false);
      expect(result.data.error).toBeDefined();
    });

    test('should calculate line and column numbers correctly', async () => {
      const multilineJson = `{
  "valid": true,
  "invalid": json
}`;
      const result = await tool.execute({ json_string: multilineJson });
      
      expect(result.data.valid).toBe(false);
      expect(result.data.line).toBeGreaterThan(1);
      expect(result.data.column).toBeGreaterThan(1);
    });

    test('should handle empty string', async () => {
      const result = await tool.execute({ json_string: '' });
      
      expect(result.data.valid).toBe(false);
      expect(result.data.error).toContain('Unexpected end');
    });

    test('should handle missing json_string parameter', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('JSON Extract Tool', () => {
    let tool;

    beforeEach(() => {
      tool = jsonModule.getTool('json_extract');
    });

    test('should have correct tool metadata', () => {
      expect(tool.name).toBe('json_extract');
      expect(tool.description).toContain('Extract a value from a JSON object');
    });

    test('should have compliance methods', () => {
      expect(typeof tool.getMetadata).toBe('function');
      expect(typeof tool.validate).toBe('function');
    });

    test('should extract simple property', async () => {
      const obj = { name: 'John', age: 30 };
      const result = await tool.execute({ json_object: obj, path: 'name' });
      
      expect(result.data.value).toBe('John');
      expect(result.data.found).toBe(true);
      expect(result.data.path).toBe('name');
    });

    test('should extract nested property', async () => {
      const obj = { user: { profile: { name: 'John' } } };
      const result = await tool.execute({ json_object: obj, path: 'user.profile.name' });
      
      expect(result.data.value).toBe('John');
      expect(result.data.found).toBe(true);
      expect(result.data.path).toBe('user.profile.name');
    });

    test('should extract array element by index', async () => {
      const obj = { items: ['first', 'second', 'third'] };
      const result = await tool.execute({ json_object: obj, path: 'items[1]' });
      
      expect(result.data.value).toBe('second');
      expect(result.data.found).toBe(true);
      expect(result.data.path).toBe('items[1]');
    });

    test('should extract from nested arrays', async () => {
      const obj = { 
        users: [
          { name: 'John', scores: [10, 20, 30] },
          { name: 'Jane', scores: [15, 25, 35] }
        ]
      };
      const result = await tool.execute({ json_object: obj, path: 'users[1].scores[2]' });
      
      expect(result.data.value).toBe(35);
      expect(result.data.found).toBe(true);
    });

    test('should handle non-existent path', async () => {
      const obj = { name: 'John' };
      const result = await tool.execute({ json_object: obj, path: 'age' });
      
      expect(result.data.value).toBeNull();
      expect(result.data.found).toBe(false);
      expect(result.data.path).toBe('age');
    });

    test('should return default value when path not found', async () => {
      const obj = { name: 'John' };
      const result = await tool.execute({ 
        json_object: obj, 
        path: 'age', 
        default_value: 25 
      });
      
      expect(result.data.value).toBe(25);
      expect(result.data.found).toBe(false);
    });

    test('should handle null object', async () => {
      const result = await tool.execute({ json_object: null, path: 'any.path' });
      
      expect(result.data.value).toBeNull();
      expect(result.data.found).toBe(false);
    });

    test('should handle undefined nested properties', async () => {
      const obj = { user: null };
      const result = await tool.execute({ json_object: obj, path: 'user.name' });
      
      expect(result.data.value).toBeNull();
      expect(result.data.found).toBe(false);
    });

    test('should extract root-level arrays', async () => {
      const obj = ['first', 'second', 'third'];
      const result = await tool.execute({ json_object: obj, path: '[1]' });
      
      expect(result.data.value).toBe('second');
      expect(result.data.found).toBe(true);
    });

    test('should handle array index out of bounds', async () => {
      const obj = { items: ['one', 'two'] };
      const result = await tool.execute({ json_object: obj, path: 'items[5]' });
      
      expect(result.data.value).toBeNull();
      expect(result.data.found).toBe(false);
    });

    test('should handle missing required parameters', async () => {
      const result1 = await tool.execute({ json_object: {} });
      expect(result1.success).toBe(false);
      expect(result1.error).toBeDefined();
      
      const result2 = await tool.execute({ path: 'test' });
      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should work end-to-end parse -> extract -> stringify', async () => {
      const jsonString = '{"users": [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]}';
      
      // Parse JSON
      const parseTool = jsonModule.getTool('json_parse');
      const parsed = await parseTool.execute({ json_string: jsonString });
      
      // Extract value
      const extractTool = jsonModule.getTool('json_extract');
      const extracted = await extractTool.execute({ 
        json_object: parsed.data.parsed, 
        path: 'users[1].name' 
      });
      
      // Stringify result
      const stringifyTool = jsonModule.getTool('json_stringify');
      const stringified = await stringifyTool.execute({ 
        object: { extractedName: extracted.data.value }, 
        indent: 0 
      });
      
      expect(extracted.data.value).toBe('Jane');
      expect(stringified.data.json).toBe('{"extractedName":"Jane"}');
    });

    test('should validate then parse successfully', async () => {
      const jsonString = '{"test": "value"}';
      
      const validateTool = jsonModule.getTool('json_validate');
      const validation = await validateTool.execute({ json_string: jsonString });
      
      expect(validation.data.valid).toBe(true);
      
      const parseTool = jsonModule.getTool('json_parse');
      const parsed = await parseTool.execute({ json_string: jsonString });
      
      expect(parsed.data.parsed).toEqual({ test: 'value' });
    });

    test('should handle multiple concurrent operations', async () => {
      const operations = [
        jsonModule.getTool('json_parse').execute({ json_string: '{"a": 1}' }),
        jsonModule.getTool('json_stringify').execute({ object: { b: 2 } }),
        jsonModule.getTool('json_validate').execute({ json_string: '{"c": 3}' }),
        jsonModule.getTool('json_extract').execute({ json_object: { d: 4 }, path: 'd' })
      ];
      
      const results = await Promise.all(operations);
      
      expect(results[0].data.parsed).toEqual({ a: 1 });
      expect(results[1].data.json).toContain('"b": 2');
      expect(results[2].data.valid).toBe(true);
      expect(results[3].data.value).toBe(4);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large JSON objects efficiently', async () => {
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      
      const stringifyTool = jsonModule.getTool('json_stringify');
      const start = Date.now();
      const result = await stringifyTool.execute({ object: largeObject, indent: 0 });
      const duration = Date.now() - start;
      
      expect(result.data.json).toContain('"key999":"value999"');
      expect(duration).toBeLessThan(100); // Should complete quickly
    });

    test('should handle deep nested structures efficiently', async () => {
      let nested = { value: 'deep' };
      for (let i = 0; i < 100; i++) {
        nested = { level: i, child: nested };
      }
      
      const extractTool = jsonModule.getTool('json_extract');
      
      // Build deep path
      let path = '';
      for (let i = 0; i < 100; i++) {
        path += 'child.';
      }
      path += 'value';
      
      const start = Date.now();
      const result = await extractTool.execute({ json_object: nested, path });
      const duration = Date.now() - start;
      
      expect(result.data.value).toBe('deep');
      expect(duration).toBeLessThan(50);
    });

    test('should validate large JSON strings efficiently', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item${i}` }));
      const jsonString = JSON.stringify(largeArray);
      
      const validateTool = jsonModule.getTool('json_validate');
      const start = Date.now();
      const result = await validateTool.execute({ json_string: jsonString });
      const duration = Date.now() - start;
      
      expect(result.data.valid).toBe(true);
      expect(result.data.isArray).toBe(true);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle tool execution errors gracefully', async () => {
      const parseTool = jsonModule.getTool('json_parse');
      
      const result = await parseTool.execute({ json_string: 'invalid json' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should maintain consistent error response format', async () => {
      const tools = [
        { tool: jsonModule.getTool('json_parse'), params: {} },
        { tool: jsonModule.getTool('json_stringify'), params: {} },
        { tool: jsonModule.getTool('json_validate'), params: {} },
        { tool: jsonModule.getTool('json_extract'), params: {} }
      ];

      for (const { tool, params } of tools) {
        const result = await tool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('should handle circular references in stringify', async () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      const stringifyTool = jsonModule.getTool('json_stringify');
      
      const result = await stringifyTool.execute({ object: obj });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/circular|Converting circular structure/i);
    });
  });
});