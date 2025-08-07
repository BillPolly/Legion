/**
 * Tests for JSON module tools
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/tool-system';
import JsonModule from '../../src/json/JsonModule.js';

describe('JSON Module Tools', () => {
  let resourceManager;
  let moduleFactory;
  let jsonModule;
  let tools;

  beforeEach(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleFactory and load JSON module
    moduleFactory = new ModuleFactory(resourceManager);
    jsonModule = moduleFactory.createModule(JsonModule);
    tools = jsonModule.getTools();
  });

  describe('json_stringify tool', () => {
    test('should stringify simple object and return json field', async () => {
      const stringifyTool = tools.find(t => t.name === 'json_stringify');
      expect(stringifyTool).toBeDefined();

      const result = await stringifyTool.invoke({
        function: {
          name: 'json_stringify',
          arguments: JSON.stringify({
            object: { name: 'test', value: 123 },
            indent: 2
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.json).toBeDefined();
      expect(result.data.json_string).toBeDefined();
      expect(typeof result.data.json).toBe('string');
      expect(typeof result.data.json_string).toBe('string');
      expect(result.data.json).toBe(result.data.json_string); // Should be the same
      expect(result.data.length).toBeDefined();
      
      // Verify it's valid JSON
      const parsed = JSON.parse(result.data.json);
      expect(parsed).toEqual({ name: 'test', value: 123 });
    });

    test('should handle complex objects', async () => {
      const stringifyTool = tools.find(t => t.name === 'json_stringify');
      
      const complexObject = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ],
        settings: {
          theme: 'dark',
          notifications: true
        }
      };

      const result = await stringifyTool.invoke({
        function: {
          name: 'json_stringify',
          arguments: JSON.stringify({
            object: complexObject,
            indent: 2
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.json).toBeDefined();
      expect(typeof result.data.json).toBe('string');
      
      const parsed = JSON.parse(result.data.json);
      expect(parsed).toEqual(complexObject);
    });
  });

  describe('json_parse tool', () => {
    test('should parse JSON string and return parsed field', async () => {
      const parseTool = tools.find(t => t.name === 'json_parse');
      expect(parseTool).toBeDefined();

      const testObject = { name: 'test', value: 123, nested: { key: 'value' } };
      const jsonString = JSON.stringify(testObject);

      const result = await parseTool.invoke({
        function: {
          name: 'json_parse',
          arguments: JSON.stringify({
            json_string: jsonString
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.parsed).toBeDefined();
      expect(result.data.result).toBeDefined();
      expect(result.data.parsed).toEqual(testObject);
      expect(result.data.result).toEqual(testObject); // Should be the same
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(false);
    });

    test('should handle arrays', async () => {
      const parseTool = tools.find(t => t.name === 'json_parse');
      
      const testArray = [1, 2, 3, 4, 5];
      const jsonString = JSON.stringify(testArray);

      const result = await parseTool.invoke({
        function: {
          name: 'json_parse',
          arguments: JSON.stringify({
            json_string: jsonString
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.parsed).toEqual(testArray);
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(true);
    });

    test('should handle invalid JSON', async () => {
      const parseTool = tools.find(t => t.name === 'json_parse');

      const result = await parseTool.invoke({
        function: {
          name: 'json_parse',
          arguments: JSON.stringify({
            json_string: 'invalid json {'
          })
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/Unexpected token|not valid JSON|JSON/i);
    });
  });

  describe('json_validate tool', () => {
    test('should validate valid JSON and return valid/isValid fields', async () => {
      const validateTool = tools.find(t => t.name === 'json_validate');
      expect(validateTool).toBeDefined();

      const validJson = JSON.stringify({ name: 'test', value: 123 });

      const result = await validateTool.invoke({
        function: {
          name: 'json_validate',
          arguments: JSON.stringify({
            json_string: validJson
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.valid).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.type).toBe('object');
      expect(result.data.isArray).toBe(false);
      expect(result.data.message).toBe('Valid JSON');
    });

    test('should handle invalid JSON', async () => {
      const validateTool = tools.find(t => t.name === 'json_validate');

      const result = await validateTool.invoke({
        function: {
          name: 'json_validate',
          arguments: JSON.stringify({
            json_string: 'invalid json {'
          })
        }
      });

      expect(result.success).toBe(true); // Validation returns success even for invalid JSON
      expect(result.data.valid).toBe(false);
      expect(result.data.isValid).toBe(false);
      expect(result.data.error).toBeDefined();
      expect(result.data.message).toMatch(/Invalid JSON/);
    });
  });

  describe('json_extract tool', () => {
    test('should extract values using dot notation', async () => {
      const extractTool = tools.find(t => t.name === 'json_extract');
      expect(extractTool).toBeDefined();

      const testObject = {
        user: {
          profile: {
            name: 'Alice',
            age: 30
          }
        },
        items: ['apple', 'banana', 'cherry']
      };

      // Extract nested object property
      const result1 = await extractTool.invoke({
        function: {
          name: 'json_extract',
          arguments: JSON.stringify({
            json_object: testObject,
            path: 'user.profile.name'
          })
        }
      });

      expect(result1.success).toBe(true);
      expect(result1.data.value).toBe('Alice');
      expect(result1.data.found).toBe(true);
      expect(result1.data.path).toBe('user.profile.name');

      // Extract array element (though this test doesn't cover array notation yet)
      const result2 = await extractTool.invoke({
        function: {
          name: 'json_extract',
          arguments: JSON.stringify({
            json_object: testObject,
            path: 'user.profile.age'
          })
        }
      });

      expect(result2.success).toBe(true);
      expect(result2.data.value).toBe(30);
      expect(result2.data.found).toBe(true);
    });

    test('should return default value for missing paths', async () => {
      const extractTool = tools.find(t => t.name === 'json_extract');

      const testObject = { existing: 'value' };

      const result = await extractTool.invoke({
        function: {
          name: 'json_extract',
          arguments: JSON.stringify({
            json_object: testObject,
            path: 'nonexistent.path',
            default_value: 'default'
          })
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.value).toBe('default');
      expect(result.data.found).toBe(false);
    });
  });
});