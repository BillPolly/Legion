import { jest } from '@jest/globals';

// Mock ToolResult
const mockToolResult = {
  success: jest.fn((data) => ({ success: true, data })),
  failure: jest.fn((error, data) => ({ success: false, error, data }))
};

jest.unstable_mockModule('../../src/tool/ToolResult.js', () => ({
  default: mockToolResult
}));

// Import after mocking
const { GenericTool } = await import('../../src/tool/GenericTool.js');
const Tool = (await import('../../src/tool/Tool.js')).default;

describe('GenericTool', () => {
  let mockLibraryInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock library instance
    mockLibraryInstance = {
      simpleMethod: jest.fn().mockReturnValue('simple result'),
      asyncMethod: jest.fn().mockResolvedValue('async result'),
      nested: {
        method: jest.fn().mockReturnValue('nested result')
      },
      method: jest.fn().mockReturnValue('method result'),
      errorMethod: jest.fn().mockImplementation(() => {
        throw new Error('Method failed');
      }),
      methodWithArgs: jest.fn().mockImplementation((arg1, arg2) => {
        return { arg1, arg2, result: 'success' };
      })
    };
  });

  describe('constructor', () => {
    it('should create instance with tool config', () => {
      const config = {
        name: 'test_tool',
        description: 'Test tool',
        function: 'simpleMethod',
        parameters: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('Test tool');
      expect(tool.config).toEqual(config);
      expect(tool.library).toBe(mockLibraryInstance);
    });

    it('should extend Tool base class', () => {
      const config = {
        name: 'test_tool',
        description: 'Test',
        function: 'method'
      };

      const tool = new GenericTool(config, mockLibraryInstance);

      expect(tool).toBeInstanceOf(Tool);
      expect(typeof tool.invoke).toBe('function');
      expect(typeof tool.getToolDescription).toBe('function');
    });
  });

  describe('resolveFunction', () => {
    it('should resolve simple function name', () => {
      const config = {
        name: 'test',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const func = tool.resolveFunction('simpleMethod');

      expect(func).toBe(mockLibraryInstance.simpleMethod);
    });

    it('should resolve nested function path', () => {
      const config = {
        name: 'test',
        function: 'nested.method'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const func = tool.resolveFunction('nested.method');

      expect(func).toBe(mockLibraryInstance.nested.method);
    });

    it('should handle array notation', () => {
      mockLibraryInstance.methods = [
        jest.fn().mockReturnValue('first'),
        jest.fn().mockReturnValue('second')
      ];

      const config = {
        name: 'test',
        function: 'methods[1]'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const func = tool.resolveFunction('methods[1]');

      expect(func).toBe(mockLibraryInstance.methods[1]);
    });

    it('should throw for missing function', () => {
      const config = {
        name: 'test',
        function: 'nonExistent'
      };

      expect(() => new GenericTool(config, mockLibraryInstance))
        .toThrow('Function \'nonExistent\' not found');
    });
  });

  describe('getToolDescription', () => {
    it('should return OpenAI function format', () => {
      const config = {
        name: 'test_tool',
        description: 'Test tool description',
        function: 'method',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input value' }
          },
          required: ['input']
        },
        output: {
          success: {
            type: 'object',
            properties: {
              result: { type: 'string' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const description = tool.getToolDescription();

      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool description',
          parameters: config.parameters,
          output: config.output
        }
      });
    });

    it('should provide default output schema if not specified', () => {
      const config = {
        name: 'test_tool',
        description: 'Test',
        function: 'method'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const description = tool.getToolDescription();

      expect(description.function.output).toBeDefined();
      expect(description.function.output.success).toBeDefined();
      expect(description.function.output.failure).toBeDefined();
    });
  });

  describe('invoke', () => {
    it('should invoke simple method successfully', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: JSON.stringify({ value: 'test' })
        }
      };

      const result = await tool.invoke(toolCall);

      expect(mockLibraryInstance.simpleMethod).toHaveBeenCalledWith({ value: 'test' });
      expect(mockToolResult.success).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should invoke async method', async () => {
      const config = {
        name: 'test_tool',
        function: 'asyncMethod',
        async: true
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: '{}'
        }
      };

      const result = await tool.invoke(toolCall);

      expect(mockLibraryInstance.asyncMethod).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle method errors', async () => {
      const config = {
        name: 'test_tool',
        function: 'errorMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: '{}'
        }
      };

      const result = await tool.invoke(toolCall);

      expect(mockToolResult.failure).toHaveBeenCalledWith(
        'Method failed',
        expect.any(Object)
      );
      expect(result.success).toBe(false);
    });

    it('should handle invalid JSON arguments', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: 'invalid json'
        }
      };

      const result = await tool.invoke(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle instance methods correctly', async () => {
      const config = {
        name: 'test_tool',
        function: 'methodWithArgs',
        instanceMethod: true,
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
            arg2: { type: 'number' }
          }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: JSON.stringify({ arg1: 'hello', arg2: 42 })
        }
      };

      const result = await tool.invoke(toolCall);

      expect(mockLibraryInstance.methodWithArgs).toHaveBeenCalledWith('hello', 42);
      expect(result.success).toBe(true);
    });

    it('should handle static methods', async () => {
      const staticLibrary = {
        staticMethod: jest.fn().mockReturnValue('static result')
      };

      const config = {
        name: 'test_tool',
        function: 'staticMethod',
        instanceMethod: false
      };

      const tool = new GenericTool(config, staticLibrary, 'staticMethod');
      
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: '{}'
        }
      };

      const result = await tool.invoke(toolCall);

      expect(staticLibrary.staticMethod).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('callFunction', () => {
    it('should call function with correct arguments', async () => {
      const config = {
        name: 'test_tool',
        function: 'methodWithArgs',
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string' },
            arg2: { type: 'number' }
          }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const args = { arg1: 'test', arg2: 123 };
      const result = await tool.callFunction(args);

      expect(mockLibraryInstance.methodWithArgs).toHaveBeenCalledWith('test', 123);
      expect(result).toEqual({ arg1: 'test', arg2: 123, result: 'success' });
    });

    it('should handle functions with no arguments', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = await tool.callFunction({});

      expect(mockLibraryInstance.simpleMethod).toHaveBeenCalledWith({});
      expect(result).toBe('simple result');
    });

    it('should preserve this context for instance methods', async () => {
      const obj = {
        value: 42,
        getValue: jest.fn(function() { return this.value; })
      };

      const config = {
        name: 'test_tool',
        function: 'getValue',
        instanceMethod: true
      };

      const tool = new GenericTool(config, obj);
      
      await tool.callFunction({});

      expect(obj.getValue).toHaveBeenCalled();
    });
  });

  describe('mapResult', () => {
    it('should return raw result without mapping', () => {
      const config = {
        name: 'test_tool',
        function: 'method'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = { data: 'test', status: 200 };
      const mapped = tool.mapResult(result);

      expect(mapped).toEqual(result);
    });

    it('should apply result mapping', () => {
      const config = {
        name: 'test_tool',
        function: 'method',
        resultMapping: {
          success: {
            content: '$.data',
            statusCode: '$.status'
          }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = { data: 'test content', status: 200, extra: 'ignored' };
      const mapped = tool.mapResult(result);

      expect(mapped).toEqual({
        content: 'test content',
        statusCode: 200
      });
    });

    it('should handle transform type', () => {
      const config = {
        name: 'test_tool',
        function: 'method',
        resultMapping: {
          transform: 'instance'
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = { someData: 'test' };
      const mapped = tool.mapResult(result);

      // For 'instance' transform, it wraps the result
      expect(mapped).toHaveProperty('instance');
    });
  });
});