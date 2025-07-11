const OpenAITool = require('../../src/core/OpenAITool');

// Test implementation of OpenAITool
class TestTool extends OpenAITool {
  constructor() {
    super();
    this.name = 'test_tool';
    this.description = 'A test tool for unit testing';
    this.parameters = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'A test message'
        },
        count: {
          type: 'number',
          description: 'A test count'
        }
      },
      required: ['message']
    };
  }

  async execute(args) {
    return {
      result: `Processed: ${args.message}`,
      count: args.count || 0
    };
  }
}

describe('OpenAITool', () => {
  describe('constructor', () => {
    it('should initialize with default properties', () => {
      const tool = new OpenAITool();
      expect(tool.name).toBe('');
      expect(tool.description).toBe('');
      expect(tool.parameters).toEqual({});
    });

    it('should allow setting properties in subclass', () => {
      const tool = new TestTool();
      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool for unit testing');
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
    });
  });

  describe('getDescription()', () => {
    it('should return correct OpenAI function format', () => {
      const tool = new TestTool();
      const description = tool.getDescription();

      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool for unit testing',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'A test message'
              },
              count: {
                type: 'number',
                description: 'A test count'
              }
            },
            required: ['message']
          }
        }
      });
    });

    it('should work with empty parameters', () => {
      const tool = new OpenAITool();
      tool.name = 'empty_tool';
      tool.description = 'Tool with no parameters';
      
      const description = tool.getDescription();
      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'empty_tool',
          description: 'Tool with no parameters',
          parameters: {}
        }
      });
    });

    it('should handle all parameter types', () => {
      const tool = new OpenAITool();
      tool.name = 'complex_tool';
      tool.description = 'Tool with all parameter types';
      tool.parameters = {
        type: 'object',
        properties: {
          stringParam: { type: 'string', description: 'A string' },
          numberParam: { type: 'number', description: 'A number' },
          booleanParam: { type: 'boolean', description: 'A boolean' },
          arrayParam: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'An array of strings' 
          },
          objectParam: { 
            type: 'object',
            properties: {
              nested: { type: 'string' }
            },
            description: 'An object parameter'
          }
        },
        required: ['stringParam']
      };

      const description = tool.getDescription();
      expect(description.function.parameters.properties).toHaveProperty('stringParam');
      expect(description.function.parameters.properties).toHaveProperty('numberParam');
      expect(description.function.parameters.properties).toHaveProperty('booleanParam');
      expect(description.function.parameters.properties).toHaveProperty('arrayParam');
      expect(description.function.parameters.properties).toHaveProperty('objectParam');
      expect(description.function.parameters.required).toEqual(['stringParam']);
    });
  });

  describe('execute()', () => {
    it('should throw error when not implemented', async () => {
      const tool = new OpenAITool();
      
      await expect(tool.execute({})).rejects.toThrow('execute() must be implemented by subclass');
    });

    it('should work when implemented in subclass', async () => {
      const tool = new TestTool();
      const result = await tool.execute({ message: 'Hello', count: 5 });
      
      expect(result).toEqual({
        result: 'Processed: Hello',
        count: 5
      });
    });

    it('should handle async execution', async () => {
      class AsyncTool extends OpenAITool {
        async execute(args) {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { delayed: true, ...args };
        }
      }

      const tool = new AsyncTool();
      const result = await tool.execute({ test: 'value' });
      expect(result).toEqual({ delayed: true, test: 'value' });
    });
  });

  describe('edge cases', () => {
    it('should handle tool with no description', () => {
      const tool = new OpenAITool();
      tool.name = 'minimal_tool';
      
      const description = tool.getDescription();
      expect(description.function.name).toBe('minimal_tool');
      expect(description.function.description).toBe('');
    });

    it('should handle special characters in name and description', () => {
      const tool = new OpenAITool();
      tool.name = 'tool-with.special_chars$123';
      tool.description = 'Description with "quotes" and \'apostrophes\' and \n newlines';
      
      const description = tool.getDescription();
      expect(description.function.name).toBe('tool-with.special_chars$123');
      expect(description.function.description).toContain('quotes');
      expect(description.function.description).toContain('apostrophes');
    });

    it('should not modify original parameters object', () => {
      const originalParams = {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      };
      
      const tool = new OpenAITool();
      tool.parameters = originalParams;
      
      const description = tool.getDescription();
      
      // Modify returned description
      description.function.parameters.properties.test.type = 'number';
      
      // Original should not change
      expect(originalParams.properties.test.type).toBe('string');
    });
  });
});