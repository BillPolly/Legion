/**
 * Unit tests for ResponseValidator
 */

import { jest } from '@jest/globals';
import { ResponseValidator } from '../../src/validators/ResponseValidator.js';

describe('ResponseValidator', () => {
  let validator;
  let mockTools;

  beforeEach(() => {
    mockTools = [
      {
        identifier: 'calculator',
        functions: [
          { name: 'add', arguments: [{ name: 'a', required: true }, { name: 'b', required: true }] },
          { name: 'multiply', arguments: [{ name: 'a', required: true }, { name: 'b', required: true }] }
        ]
      },
      {
        identifier: 'string_tools',
        functions: [
          { name: 'reverse', arguments: [{ name: 'text', required: true }] },
          { name: 'uppercase', arguments: [{ name: 'text', required: true }] }
        ]
      }
    ];
    validator = new ResponseValidator(mockTools);
  });

  describe('validateResponse', () => {
    it('should validate a valid response', () => {
      const response = {
        task_completed: true,
        response: {
          type: 'success',
          message: 'Task completed successfully'
        },
        use_tool: null
      };

      const result = validator.validateResponse(response);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object responses', () => {
      const result = validator.validateResponse('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Response must be an object');
    });

    it('should check for required fields', () => {
      const response = {
        response: {
          type: 'success',
          message: 'Missing task_completed'
        }
      };

      const result = validator.validateResponse(response);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: task_completed');
    });

    it('should validate task_completed type', () => {
      const response = {
        task_completed: 'yes', // Should be boolean
        response: {
          type: 'success',
          message: 'Test'
        }
      };

      const result = validator.validateResponse(response);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('task_completed must be a boolean');
    });

    it('should validate response object structure', () => {
      const response = {
        task_completed: true,
        response: {
          // Missing type
          message: 'Test'
        }
      };

      const result = validator.validateResponse(response);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response.type is required');
    });
  });

  describe('validateToolUse', () => {
    it('should validate valid tool use', () => {
      const toolUse = {
        identifier: 'calculator',
        function_name: 'add',
        args: [5, 3]
      };

      const result = validator.validateToolUse(toolUse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unknown tool identifier', () => {
      const toolUse = {
        identifier: 'unknown_tool',
        function_name: 'test',
        args: []
      };

      const result = validator.validateToolUse(toolUse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool identifier: unknown_tool');
    });

    it('should suggest similar tool names', () => {
      const toolUse = {
        identifier: 'calculater', // Typo
        function_name: 'add',
        args: [1, 2]
      };

      const result = validator.validateToolUse(toolUse);
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.tool).toBe('calculator');
    });

    it('should validate function names', () => {
      const toolUse = {
        identifier: 'calculator',
        function_name: 'subtract', // Not a valid function
        args: [5, 3]
      };

      const result = validator.validateToolUse(toolUse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown function: subtract for tool: calculator');
    });

    it('should suggest similar function names', () => {
      const toolUse = {
        identifier: 'string_tools',
        function_name: 'revers', // Typo
        args: ['test']
      };

      const result = validator.validateToolUse(toolUse);
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.function).toBe('reverse');
    });
  });

  describe('validateSchema', () => {
    it('should validate against custom schema', () => {
      const schema = {
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          items: { type: 'array' }
        }
      };

      const validResponse = {
        name: 'John',
        age: 30,
        items: [1, 2, 3]
      };

      const result = validator.validateSchema(validResponse, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should check required fields', () => {
      const schema = {
        required: ['name', 'email'],
        properties: {}
      };

      const response = {
        name: 'John'
        // Missing email
      };

      const result = validator.validateSchema(response, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: email');
    });

    it('should validate field types', () => {
      const schema = {
        properties: {
          count: { type: 'number' },
          active: { type: 'boolean' }
        }
      };

      const response = {
        count: '5', // Should be number
        active: 'yes' // Should be boolean
      };

      const result = validator.validateSchema(response, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field \'count\' must be of type number');
      expect(result.errors).toContain('Field \'active\' must be of type boolean');
    });
  });

  describe('similarity functions', () => {
    it('should calculate string similarity correctly', () => {
      const validator = new ResponseValidator();
      
      expect(validator.similarity('hello', 'hello')).toBe(1);
      expect(validator.similarity('hello', 'helo')).toBeGreaterThan(0.7);
      expect(validator.similarity('hello', 'world')).toBeLessThan(0.3);
      expect(validator.similarity('', '')).toBe(1);
    });

    it('should calculate Levenshtein distance correctly', () => {
      const validator = new ResponseValidator();
      
      expect(validator.levenshteinDistance('hello', 'hello')).toBe(0);
      expect(validator.levenshteinDistance('hello', 'helo')).toBe(1);
      expect(validator.levenshteinDistance('hello', 'world')).toBe(4);
      expect(validator.levenshteinDistance('', 'test')).toBe(4);
    });
  });
});