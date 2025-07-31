import { jest } from '@jest/globals';
import { z } from 'zod';

// Import GenericTool and Tool
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
      expect(typeof tool.execute).toBe('function');
      expect(typeof tool.run).toBe('function');
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

    it('should throw error for non-existent function', () => {
      const config = {
        name: 'test',
        function: 'nonExistent'
      };

      expect(() => {
        new GenericTool(config, mockLibraryInstance);
      }).toThrow("Function 'nonExistent' not found");
    });

    it('should throw error for non-function property', () => {
      mockLibraryInstance.notAFunction = 'string value';
      
      const config = {
        name: 'test',
        function: 'notAFunction'
      };

      expect(() => {
        new GenericTool(config, mockLibraryInstance);
      }).toThrow("not found or is not a function");
    });
  });

  describe('jsonSchemaToZod', () => {
    it('should convert string schema', () => {
      const jsonSchema = {
        type: 'string',
        minLength: 3,
        maxLength: 10
      };

      const zodSchema = GenericTool.jsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse('ab')).toThrow(); // too short
      expect(() => zodSchema.parse('12345678901')).toThrow(); // too long
      expect(zodSchema.parse('hello')).toBe('hello');
    });

    it('should convert number schema', () => {
      const jsonSchema = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      const zodSchema = GenericTool.jsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(-1)).toThrow();
      expect(() => zodSchema.parse(101)).toThrow();
      expect(zodSchema.parse(50)).toBe(50);
    });

    it('should convert object schema with required fields', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const zodSchema = GenericTool.jsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse({})).toThrow(); // missing required 'name'
      expect(zodSchema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(zodSchema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
    });

    it('should convert array schema', () => {
      const jsonSchema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3
      };

      const zodSchema = GenericTool.jsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse([])).toThrow(); // too few
      expect(() => zodSchema.parse(['a', 'b', 'c', 'd'])).toThrow(); // too many
      expect(zodSchema.parse(['hello'])).toEqual(['hello']);
    });

    it('should handle enum values', () => {
      const jsonSchema = {
        type: 'string',
        enum: ['red', 'green', 'blue']
      };

      const zodSchema = GenericTool.jsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse('yellow')).toThrow();
      expect(zodSchema.parse('red')).toBe('red');
    });
  });

  describe('execute', () => {
    it('should execute simple method', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const params = { value: 'test' };

      const result = await tool.execute(params);

      expect(mockLibraryInstance.simpleMethod).toHaveBeenCalledWith({ value: 'test' });
      expect(result).toBe('simple result');
    });

    it('should execute async method', async () => {
      const config = {
        name: 'test_tool',
        function: 'asyncMethod',
        async: true
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const params = {};

      const result = await tool.execute(params);

      expect(mockLibraryInstance.asyncMethod).toHaveBeenCalled();
      expect(result).toBe('async result');
    });

    it('should handle method errors', async () => {
      const config = {
        name: 'test_tool',
        function: 'errorMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const params = {};

      await expect(tool.execute(params)).rejects.toThrow('Method failed');
      expect(mockLibraryInstance.errorMethod).toHaveBeenCalled();
    });

    it('should handle validation with zod schema', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod',
        parameters: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          },
          required: ['value']
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      // Invalid params - missing required field
      const params = {};

      await expect(tool.run(params)).rejects.toThrow();
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
      
      const params = { arg1: 'hello', arg2: 42 };

      const result = await tool.execute(params);

      expect(mockLibraryInstance.methodWithArgs).toHaveBeenCalledWith('hello', 42);
      expect(result).toEqual({ arg1: 'hello', arg2: 42, result: 'success' });
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

      const tool = new GenericTool(config, staticLibrary);
      
      const params = {};

      const result = await tool.execute(params);

      expect(staticLibrary.staticMethod).toHaveBeenCalled();
      expect(result).toBe('static result');
    });
  });

  describe('prepareArguments', () => {
    it('should pass whole object when no parameters defined', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const args = { foo: 'bar', baz: 42 };

      const result = await tool.execute(args);

      expect(mockLibraryInstance.simpleMethod).toHaveBeenCalledWith(args);
    });

    it('should extract parameters in order when multiple defined', async () => {
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

      const result = await tool.execute(args);

      expect(mockLibraryInstance.methodWithArgs).toHaveBeenCalledWith('test', 123);
    });
  });

  describe('result mapping', () => {
    it('should return raw result when no mapping defined', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = await tool.execute({});

      expect(result).toBe('simple result');
    });

    it('should apply result mapping when defined', async () => {
      mockLibraryInstance.complexMethod = jest.fn().mockReturnValue({
        data: { value: 42 },
        status: 'ok'
      });

      const config = {
        name: 'test_tool',
        function: 'complexMethod',
        resultMapping: {
          value: 'data.value',
          success: { path: 'status', transform: 'equals:ok' }
        }
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      
      const result = await tool.execute({});

      expect(result).toEqual({
        value: 42,
        success: true
      });
    });
  });

  describe('event emission', () => {
    it('should emit progress events', async () => {
      const config = {
        name: 'test_tool',
        function: 'simpleMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const progressEvents = [];
      
      tool.on('event', (event) => {
        if (event.type === 'progress') {
          progressEvents.push(event);
        }
      });

      await tool.execute({});

      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0].message).toContain('Executing simpleMethod');
      expect(progressEvents[0].data.percentage).toBe(0);
      expect(progressEvents[1].message).toContain('Completed simpleMethod');
      expect(progressEvents[1].data.percentage).toBe(100);
    });

    it('should emit error events on failure', async () => {
      const config = {
        name: 'test_tool',
        function: 'errorMethod'
      };

      const tool = new GenericTool(config, mockLibraryInstance);
      const errorEvents = [];
      
      tool.on('event', (event) => {
        if (event.type === 'error') {
          errorEvents.push(event);
        }
      });

      try {
        await tool.run({});
      } catch (e) {
        // Expected error
      }

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].message).toBe('Method failed');
    });
  });
});