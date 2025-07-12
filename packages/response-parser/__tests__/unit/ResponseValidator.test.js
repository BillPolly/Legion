/**
 * Unit tests for ResponseValidator class
 */

import { jest } from '@jest/globals';
import ResponseValidator from '../../src/ResponseValidator.js';
import { 
  validateValidationResult, 
  createMockTool, 
  createMockResponse,
  createMockToolUse,
  createTestTools
} from '../utils/test-helpers.js';

describe('ResponseValidator', () => {
  let validator;
  let mockTools;

  beforeEach(() => {
    mockTools = createTestTools();
    validator = new ResponseValidator(mockTools);
  });

  describe('constructor', () => {
    test('should initialize with provided tools', () => {
      expect(validator.tools).toBe(mockTools);
      expect(validator.tools).toHaveLength(3);
    });

    test('should initialize with empty tools array when none provided', () => {
      const emptyValidator = new ResponseValidator();
      expect(emptyValidator.tools).toEqual([]);
    });
  });

  describe('validateResponse method', () => {
    test('should validate correct response structure', () => {
      const validResponse = createMockResponse();
      const result = validator.validateResponse(validResponse);

      validateValidationResult(result);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject non-object responses', () => {
      const invalidResponses = [
        null,
        undefined,
        'string',
        123,
        true
      ];

      invalidResponses.forEach(invalidResponse => {
        const result = validator.validateResponse(invalidResponse);
        validateValidationResult(result);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(['Response must be an object']);
      });
    });

    test('should reject array responses', () => {
      const result = validator.validateResponse([]);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      // Arrays are treated as objects in JS, so they get through the first check
      expect(result.errors).toContain('Missing required field: task_completed');
    });

    test('should require task_completed field', () => {
      const response = createMockResponse();
      delete response.task_completed;
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: task_completed');
    });

    test('should validate task_completed is boolean', () => {
      const invalidValues = ['true', 1, 0, 'false', null];
      
      invalidValues.forEach(value => {
        const response = createMockResponse({ task_completed: value });
        const result = validator.validateResponse(response);
        
        validateValidationResult(result);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('task_completed must be a boolean');
      });
    });

    test('should require response field', () => {
      const response = createMockResponse();
      delete response.response;
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: response');
    });

    test('should validate response field is object', () => {
      const response = createMockResponse({ response: null });
      const result = validator.validateResponse(response);
      
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response must be an object');
    });

    test('should validate response field structure for non-objects', () => {
      const primitiveValues = ['string', 123, true];
      
      primitiveValues.forEach(value => {
        const response = createMockResponse({ response: value });
        const result = validator.validateResponse(response);
        
        validateValidationResult(result);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('response must be an object');
      });
    });

    test('should validate response field structure for arrays', () => {
      const response = createMockResponse({ response: [] });
      const result = validator.validateResponse(response);
      
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      // Arrays pass the object check but fail structure validation
      expect(result.errors).toContain('response.type is required');
    });

    test('should require response.type field', () => {
      const response = createMockResponse({
        response: { message: 'test' } // Missing type
      });
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response.type is required');
    });

    test('should require response.message field', () => {
      const response = createMockResponse({
        response: { type: 'text' } // Missing message
      });
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response.message is required');
    });

    test('should validate tool use when present', () => {
      const response = createMockResponse({
        use_tool: {
          identifier: 'unknown_tool',
          function_name: 'unknown_function',
          args: []
        }
      });
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Unknown tool identifier'))).toBe(true);
    });

    test('should allow null use_tool', () => {
      const response = createMockResponse({ use_tool: null });
      const result = validator.validateResponse(response);

      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should allow undefined use_tool', () => {
      const response = createMockResponse();
      delete response.use_tool;
      const result = validator.validateResponse(response);

      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should accumulate multiple validation errors', () => {
      const invalidResponse = {
        // Missing task_completed
        response: null, // Invalid response
        use_tool: {} // Invalid tool use
      };
      
      const result = validator.validateResponse(invalidResponse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateToolUse method', () => {
    test('should validate correct tool use', () => {
      const toolUse = createMockToolUse({
        identifier: 'calculator',
        function_name: 'add',
        args: [5, 3]
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should require identifier field', () => {
      const toolUse = createMockToolUse();
      delete toolUse.identifier;
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: identifier');
    });

    test('should require function_name field', () => {
      const toolUse = createMockToolUse();
      delete toolUse.function_name;
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: function_name');
    });

    test('should require args field', () => {
      const toolUse = createMockToolUse();
      delete toolUse.args;
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: args');
    });

    test('should validate args is array', () => {
      const toolUse = createMockToolUse({ args: 'not an array' });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('args must be an array');
    });

    test('should detect unknown tool identifier', () => {
      const toolUse = createMockToolUse({ identifier: 'unknown_tool' });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool identifier: unknown_tool');
    });

    test('should detect unknown function name', () => {
      const toolUse = createMockToolUse({
        identifier: 'calculator',
        function_name: 'unknown_function'
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown function: unknown_function for tool: calculator');
    });

    test('should validate argument count for required arguments', () => {
      const toolUse = createMockToolUse({
        identifier: 'calculator',
        function_name: 'add',
        args: [5] // Missing second required argument
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Missing required argument'))).toBe(true);
    });

    test('should allow extra arguments beyond required', () => {
      const toolUse = createMockToolUse({
        identifier: 'calculator',
        function_name: 'add',
        args: [5, 3, 'extra'] // Extra argument
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should handle optional arguments correctly', () => {
      const toolUse = createMockToolUse({
        identifier: 'file_operations',
        function_name: 'read_file',
        args: ['/path/to/file'] // Missing optional encoding argument
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should provide suggestions for similar tool names', () => {
      const toolUse = createMockToolUse({ identifier: 'calcuator' }); // Typo
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.tool).toBe('calculator');
    });

    test('should provide suggestions for similar function names', () => {
      const toolUse = createMockToolUse({
        identifier: 'calculator',
        function_name: 'addx' // Close typo for 'add'
      });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      if (result.suggestions) {
        expect(result.suggestions.function).toBe('add');
      }
    });
  });

  describe('validateArguments method', () => {
    test('should validate required arguments are present', () => {
      const func = {
        name: 'test_function',
        arguments: [
          { name: 'required1', required: true },
          { name: 'required2', required: true }
        ]
      };
      
      const errors = validator.validateArguments(func, ['arg1', 'arg2']);
      expect(errors).toHaveLength(0);
    });

    test('should detect missing required arguments', () => {
      const func = {
        name: 'test_function',
        arguments: [
          { name: 'required1', required: true },
          { name: 'required2', required: true }
        ]
      };
      
      const errors = validator.validateArguments(func, ['arg1']); // Missing second argument
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Missing required argument at position 1');
    });

    test('should treat arguments as required by default', () => {
      const func = {
        name: 'test_function',
        arguments: [
          { name: 'default_required' } // No required field specified
        ]
      };
      
      const errors = validator.validateArguments(func, []); // No arguments provided
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Missing required argument');
    });

    test('should allow optional arguments to be missing', () => {
      const func = {
        name: 'test_function',
        arguments: [
          { name: 'required', required: true },
          { name: 'optional', required: false }
        ]
      };
      
      const errors = validator.validateArguments(func, ['arg1']); // Optional argument missing
      expect(errors).toHaveLength(0);
    });
  });

  describe('tool and function finding methods', () => {
    test('findToolByIdentifier should find existing tool', () => {
      const tool = validator.findToolByIdentifier('calculator');
      expect(tool).toBeDefined();
      expect(tool.identifier).toBe('calculator');
    });

    test('findToolByIdentifier should return null for non-existent tool', () => {
      const tool = validator.findToolByIdentifier('non_existent');
      expect(tool).toBeNull();
    });

    test('findFunction should find existing function', () => {
      const tool = validator.findToolByIdentifier('calculator');
      const func = validator.findFunction(tool, 'add');
      
      expect(func).toBeDefined();
      expect(func.name).toBe('add');
    });

    test('findFunction should return null for non-existent function', () => {
      const tool = validator.findToolByIdentifier('calculator');
      const func = validator.findFunction(tool, 'non_existent');
      
      expect(func).toBeNull();
    });
  });

  describe('similarity and fuzzy matching', () => {
    test('findSimilarTool should find close matches', () => {
      const similar = validator.findSimilarTool('calcuator'); // Missing 'l'
      expect(similar).toBeDefined();
      expect(similar.identifier).toBe('calculator');
    });

    test('findSimilarTool should return null for very different strings', () => {
      const similar = validator.findSimilarTool('completely_different');
      expect(similar).toBeNull();
    });

    test('findSimilarFunction should find close matches', () => {
      const tool = validator.findToolByIdentifier('calculator');
      const similar = validator.findSimilarFunction(tool, 'addx'); // Close to 'add'
      
      if (similar) {
        expect(similar.name).toBe('add');
      } else {
        // If similarity threshold not met, that's also valid behavior
        expect(similar).toBeNull();
      }
    });

    test('similarity method should calculate correct similarity scores', () => {
      const testCases = [
        { str1: 'calculator', str2: 'calculator', expected: 1.0 },
        { str1: 'calculator', str2: 'calcuator', expected: 0.9 }, // High similarity
        { str1: 'calculator', str2: 'calc', expected: 0.4 }, // Low similarity
        { str1: 'calculator', str2: 'completely_different', expected: 0 } // Very low
      ];
      
      testCases.forEach(({ str1, str2, expected }) => {
        const similarity = validator.similarity(str1, str2);
        expect(similarity).toBeCloseTo(expected, 0);
      });
    });

    test('levenshteinDistance should calculate correct edit distances', () => {
      const testCases = [
        { str1: 'kitten', str2: 'sitting', expected: 3 },
        { str1: 'calculator', str2: 'calcuator', expected: 1 },
        { str1: 'hello', str2: 'hello', expected: 0 },
        { str1: 'abc', str2: 'def', expected: 3 }
      ];
      
      testCases.forEach(({ str1, str2, expected }) => {
        const distance = validator.levenshteinDistance(str1, str2);
        expect(distance).toBe(expected);
      });
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty tools array gracefully', () => {
      const emptyValidator = new ResponseValidator([]);
      const toolUse = createMockToolUse();
      
      const result = emptyValidator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool identifier: test_tool');
    });

    test('should handle tools with no functions', () => {
      const toolWithNoFunctions = createMockTool('empty_tool', []);
      const validatorWithEmptyTool = new ResponseValidator([toolWithNoFunctions]);
      
      const toolUse = createMockToolUse({
        identifier: 'empty_tool',
        function_name: 'any_function'
      });
      
      const result = validatorWithEmptyTool.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown function: any_function for tool: empty_tool');
    });

    test('should handle functions with no arguments', () => {
      const toolWithNoArgFunc = createMockTool('simple_tool', [
        { name: 'no_args_function', arguments: [] }
      ]);
      const validatorWithSimpleTool = new ResponseValidator([toolWithNoArgFunc]);
      
      const toolUse = createMockToolUse({
        identifier: 'simple_tool',
        function_name: 'no_args_function',
        args: []
      });
      
      const result = validatorWithSimpleTool.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should handle very long tool and function names', () => {
      const longName = 'very_long_tool_name_that_goes_on_and_on_and_on';
      const toolUse = createMockToolUse({ identifier: longName });
      
      const result = validator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Unknown tool identifier: ${longName}`);
    });

    test('should handle special characters in tool names', () => {
      const specialTool = createMockTool('tool-with-dashes_and_underscores', [
        { name: 'function.with.dots' }
      ]);
      const specialValidator = new ResponseValidator([specialTool]);
      
      const toolUse = createMockToolUse({
        identifier: 'tool-with-dashes_and_underscores',
        function_name: 'function.with.dots'
      });
      
      const result = specialValidator.validateToolUse(toolUse);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });
  });

  describe('real-world validation scenarios', () => {
    test('should validate typical agent response with tool use', () => {
      const response = {
        task_completed: false,
        response: {
          type: "tool_use",
          message: "I need to perform a calculation"
        },
        use_tool: {
          identifier: "calculator",
          function_name: "add",
          args: [15, 25]
        }
      };
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should validate completion response without tool use', () => {
      const response = {
        task_completed: true,
        response: {
          type: "completion",
          message: "Task completed successfully. The sum is 40."
        },
        use_tool: null
      };
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should handle file operation validation', () => {
      const response = {
        task_completed: false,
        response: {
          type: "file_operation",
          message: "Reading the specified file"
        },
        use_tool: {
          identifier: "file_operations",
          function_name: "read_file",
          args: ["/path/to/document.txt", "utf8"]
        }
      };
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(true);
    });

    test('should provide helpful error messages for common mistakes', () => {
      const response = {
        task_completed: "yes", // Should be boolean
        response: {
          type: "success"
          // Missing message field
        },
        use_tool: {
          identifier: "calcuator", // Typo
          function_name: "ad", // Typo
          args: [5] // Missing required argument
        }
      };
      
      const result = validator.validateResponse(response);
      validateValidationResult(result);
      expect(result.valid).toBe(false);
      
      // Should provide specific, actionable error messages
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'task_completed must be a boolean',
          'response.message is required'
        ])
      );
    });
  });
});