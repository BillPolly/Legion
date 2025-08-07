/**
 * Tests for Tool Creation Patterns and Factories
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest } from '@jest/globals';
import { 
  createToolFromMethod,
  createToolFromFunction, 
  generateMetadataFromConfig,
  ToolFactory
} from '../../src/utils/ToolFactory.js';

describe('Tool Creation Patterns', () => {
  describe('createToolFromMethod', () => {
    test('should create tool from bound method', async () => {
      const testObject = {
        value: 'test',
        testMethod(input) {
          return { result: `${this.value}: ${input.message}` };
        }
      };

      const tool = createToolFromMethod(
        'testTool',
        testObject.testMethod.bind(testObject),
        { description: 'Test tool from method' }
      );

      expect(tool.name).toBe('testTool');
      const result = await tool.execute({ message: 'hello' });
      expect(result).toEqual({ result: 'test: hello' });
    });

    test('should create tool from async method', async () => {
      const testObject = {
        async asyncMethod(input) {
          return new Promise(resolve => {
            setTimeout(() => resolve({ result: input.value * 2 }), 10);
          });
        }
      };

      const tool = createToolFromMethod(
        'asyncTool',
        testObject.asyncMethod.bind(testObject),
        { description: 'Async test tool' }
      );

      const result = await tool.execute({ value: 5 });
      expect(result).toEqual({ result: 10 });
    });
  });

  describe('createToolFromFunction', () => {
    test('should create tool from standalone function', async () => {
      const testFunction = (input) => {
        return { sum: input.a + input.b };
      };

      const metadata = {
        description: 'Adds two numbers',
        input: { a: 'number', b: 'number' },
        output: { sum: 'number' }
      };

      const tool = createToolFromFunction('addTool', testFunction, metadata);

      expect(tool.name).toBe('addTool');
      const result = await tool.execute({ a: 3, b: 4 });
      expect(result).toEqual({ sum: 7 });
    });

    test('should handle errors in function', async () => {
      const errorFunction = () => {
        throw new Error('Test error');
      };

      const tool = createToolFromFunction('errorTool', errorFunction, {});
      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Test error',
          details: {
            tool: 'errorTool',
            timestamp: expect.any(Number)
          }
        }
      });
    });
  });

  describe('generateMetadataFromConfig', () => {
    test('should generate basic metadata from config', () => {
      const config = {
        description: 'Test tool',
        input: { name: 'string', age: 'number' },
        output: { greeting: 'string' }
      };

      const metadata = generateMetadataFromConfig(config);

      expect(metadata).toEqual({
        description: 'Test tool',
        input: { name: 'string', age: 'number' },
        output: { greeting: 'string' }
      });
    });

    test('should generate metadata with examples', () => {
      const config = {
        description: 'Calculator tool',
        input: { a: 'number', b: 'number' },
        output: { result: 'number' },
        examples: [
          { input: { a: 2, b: 3 }, output: { result: 5 } }
        ]
      };

      const metadata = generateMetadataFromConfig(config);

      expect(metadata.examples).toEqual([
        { input: { a: 2, b: 3 }, output: { result: 5 } }
      ]);
    });
  });

  describe('ToolFactory', () => {
    test('should create multiple tools from method configuration', () => {
      const mathObject = {
        add(input) { return { result: input.a + input.b }; },
        multiply(input) { return { result: input.a * input.b }; },
        subtract(input) { return { result: input.a - input.b }; }
      };

      const toolConfig = {
        add: {
          description: 'Add two numbers',
          input: { a: 'number', b: 'number' },
          output: { result: 'number' }
        },
        multiply: {
          description: 'Multiply two numbers',
          input: { a: 'number', b: 'number' },
          output: { result: 'number' }
        }
      };

      const factory = new ToolFactory(mathObject);
      const tools = factory.createFromConfig(toolConfig);

      expect(tools.add).toBeDefined();
      expect(tools.multiply).toBeDefined();
      expect(tools.subtract).toBeUndefined(); // Not in config
    });

    test('should support parameter mapping', async () => {
      const testObject = {
        processData(firstName, lastName, age) {
          return { fullName: `${firstName} ${lastName}`, isAdult: age >= 18 };
        }
      };

      const toolConfig = {
        processData: {
          description: 'Process person data',
          parameterMapping: (input) => [input.first, input.last, input.years],
          input: { first: 'string', last: 'string', years: 'number' },
          output: { fullName: 'string', isAdult: 'boolean' }
        }
      };

      const factory = new ToolFactory(testObject);
      const tools = factory.createFromConfig(toolConfig);

      const result = await tools.processData.execute({
        first: 'John',
        last: 'Doe', 
        years: 25
      });

      expect(result).toEqual({
        fullName: 'John Doe',
        isAdult: true
      });
    });

    test('should support output transformation', async () => {
      const testObject = {
        getData() {
          return { name: 'test', value: 42, extra: 'ignore' };
        }
      };

      const toolConfig = {
        getData: {
          description: 'Get filtered data',
          outputTransform: (result) => ({ 
            name: result.name, 
            value: result.value,
            doubled: result.value * 2
          })
        }
      };

      const factory = new ToolFactory(testObject);
      const tools = factory.createFromConfig(toolConfig);

      const result = await tools.getData.execute({});

      expect(result).toEqual({
        name: 'test',
        value: 42,
        doubled: 84
      });
    });
  });
});