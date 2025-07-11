const ResponseValidator = require('../../src/response-parser/ResponseValidator');

describe('ResponseValidator', () => {
  let validator;
  let mockTools;

  beforeEach(() => {
    mockTools = [
      {
        identifier: 'calculator_tool',
        name: 'Calculator Tool',
        functions: [
          {
            name: 'evaluate',
            arguments: [
              {
                name: 'expression',
                dataType: 'string',
                required: true
              }
            ]
          },
          {
            name: 'solve',
            arguments: [
              {
                name: 'equation',
                dataType: 'string',
                required: true
              },
              {
                name: 'variable',
                dataType: 'string',
                required: false
              }
            ]
          }
        ]
      },
      {
        identifier: 'file_tool',
        name: 'File Tool',
        functions: [
          {
            name: 'read',
            arguments: [
              {
                name: 'path',
                dataType: 'string',
                required: true
              }
            ]
          }
        ]
      }
    ];

    validator = new ResponseValidator(mockTools);
  });

  describe('validateResponse()', () => {
    it('should validate a complete valid response', () => {
      const response = {
        task_completed: true,
        response: {
          type: 'string',
          message: 'Task completed successfully'
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate response with tool use', () => {
      const response = {
        task_completed: false,
        response: {
          type: 'string',
          message: 'Calculating...'
        },
        use_tool: {
          identifier: 'calculator_tool',
          function_name: 'evaluate',
          args: ['2 + 2']
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const response = {
        response: {
          type: 'string',
          message: 'Missing task_completed'
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: task_completed');
    });

    it('should detect invalid task_completed type', () => {
      const response = {
        task_completed: 'yes', // Should be boolean
        response: {
          type: 'string',
          message: 'Invalid type'
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('task_completed must be a boolean');
    });

    it('should detect missing response object', () => {
      const response = {
        task_completed: true
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: response');
    });

    it('should detect invalid response structure', () => {
      const response = {
        task_completed: true,
        response: 'Just a string' // Should be object
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response must be an object');
    });

    it('should detect missing response.type', () => {
      const response = {
        task_completed: true,
        response: {
          message: 'Missing type'
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response.type is required');
    });

    it('should detect missing response.message', () => {
      const response = {
        task_completed: true,
        response: {
          type: 'string'
        }
      };

      const result = validator.validateResponse(response);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('response.message is required');
    });

    it('should handle empty response gracefully', () => {
      const result = validator.validateResponse({});
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null response', () => {
      const result = validator.validateResponse(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Response must be an object');
    });
  });

  describe('validateToolUse()', () => {
    it('should validate correct tool use', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'evaluate',
        args: ['42 * 17']
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect unknown tool identifier', () => {
      const toolUse = {
        identifier: 'unknown_tool',
        function_name: 'doSomething',
        args: []
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool identifier: unknown_tool');
    });

    it('should detect unknown function name', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'unknown_function',
        args: []
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown function: unknown_function for tool: calculator_tool');
    });

    it('should detect missing required arguments', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'evaluate',
        args: [] // Missing required 'expression' argument
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required argument at position 0 for function: evaluate');
    });

    it('should allow optional arguments', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'solve',
        args: ['x + 5 = 10'] // Only required arg, optional 'variable' omitted
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate all provided arguments', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'solve',
        args: ['x + 5 = 10', 'x']
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect args not being an array', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'evaluate',
        args: 'not an array'
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('args must be an array');
    });

    it('should handle missing tool use fields', () => {
      const toolUse = {
        identifier: 'calculator_tool'
        // Missing function_name and args
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: function_name');
      expect(result.errors).toContain('Missing required field: args');
    });
  });

  describe('findToolByIdentifier()', () => {
    it('should find existing tool', () => {
      const tool = validator.findToolByIdentifier('calculator_tool');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('Calculator Tool');
    });

    it('should return null for non-existent tool', () => {
      const tool = validator.findToolByIdentifier('non_existent');
      
      expect(tool).toBeNull();
    });

    it('should be case sensitive', () => {
      const tool = validator.findToolByIdentifier('CALCULATOR_TOOL');
      
      expect(tool).toBeNull();
    });
  });

  describe('findFunction()', () => {
    it('should find existing function', () => {
      const tool = mockTools[0];
      const func = validator.findFunction(tool, 'evaluate');
      
      expect(func).toBeDefined();
      expect(func.name).toBe('evaluate');
    });

    it('should return null for non-existent function', () => {
      const tool = mockTools[0];
      const func = validator.findFunction(tool, 'non_existent');
      
      expect(func).toBeNull();
    });
  });

  describe('fuzzy matching', () => {
    it('should suggest similar tool names', () => {
      const toolUse = {
        identifier: 'calculater_tool', // Typo
        function_name: 'evaluate',
        args: ['2 + 2']
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.tool).toBe('calculator_tool');
    });

    it('should suggest similar function names', () => {
      const toolUse = {
        identifier: 'calculator_tool',
        function_name: 'evaluat', // Typo
        args: ['2 + 2']
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.function).toBe('evaluate');
    });

    it('should not suggest if difference is too large', () => {
      const toolUse = {
        identifier: 'completely_different',
        function_name: 'evaluate',
        args: ['2 + 2']
      };

      const result = validator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.suggestions).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle tools with no functions', () => {
      const emptyValidator = new ResponseValidator([
        {
          identifier: 'empty_tool',
          name: 'Empty Tool',
          functions: []
        }
      ]);

      const toolUse = {
        identifier: 'empty_tool',
        function_name: 'anything',
        args: []
      };

      const result = emptyValidator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown function: anything for tool: empty_tool');
    });

    it('should handle empty tools array', () => {
      const emptyValidator = new ResponseValidator([]);
      
      const toolUse = {
        identifier: 'any_tool',
        function_name: 'any_function',
        args: []
      };

      const result = emptyValidator.validateToolUse(toolUse);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool identifier: any_tool');
    });
  });
});