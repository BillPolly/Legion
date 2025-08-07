/**
 * Tests for Method Wrapping utilities
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest } from '@jest/globals';
import { 
  wrapMethod,
  wrapAsyncMethod,
  createParameterMapper,
  createOutputTransformer,
  MethodWrapper
} from '../../src/utils/MethodWrapper.js';

describe('Method Wrapping', () => {
  describe('wrapMethod - Direct method wrapping', () => {
    test('should wrap synchronous method', async () => {
      const obj = {
        value: 10,
        multiply(input) {
          return this.value * input.x;
        }
      };

      const wrapped = wrapMethod(obj, 'multiply');
      const result = await wrapped({ x: 5 });
      
      expect(result).toBe(50);
    });

    test('should preserve this context', async () => {
      const obj = {
        name: 'test',
        greet(input) {
          return `${input.greeting}, ${this.name}`;
        }
      };

      const wrapped = wrapMethod(obj, 'greet');
      const result = await wrapped({ greeting: 'Hello' });
      
      expect(result).toBe('Hello, test');
    });

    test('should handle methods that return objects', async () => {
      const obj = {
        getData(input) {
          return { id: input.id, timestamp: 12345 };
        }
      };

      const wrapped = wrapMethod(obj, 'getData');
      const result = await wrapped({ id: 'test123' });
      
      expect(result).toEqual({ id: 'test123', timestamp: 12345 });
    });
  });

  describe('wrapAsyncMethod - Async method wrapping', () => {
    test('should wrap async method', async () => {
      const obj = {
        async fetchData(input) {
          return new Promise(resolve => {
            setTimeout(() => resolve({ url: input.url, data: 'fetched' }), 10);
          });
        }
      };

      const wrapped = wrapAsyncMethod(obj, 'fetchData');
      const result = await wrapped({ url: 'https://test.com' });
      
      expect(result).toEqual({ url: 'https://test.com', data: 'fetched' });
    });

    test('should handle async method errors', async () => {
      const obj = {
        async failingMethod() {
          throw new Error('Async error');
        }
      };

      const wrapped = wrapAsyncMethod(obj, 'failingMethod');
      await expect(wrapped({})).rejects.toThrow('Async error');
    });
  });

  describe('createParameterMapper - Parameter transformation', () => {
    test('should map input parameters to method arguments', async () => {
      const obj = {
        processUser(firstName, lastName, age) {
          return `${firstName} ${lastName}, age ${age}`;
        }
      };

      const mapper = createParameterMapper({
        first: 0,  // Map to arg[0]
        last: 1,   // Map to arg[1]
        years: 2   // Map to arg[2]
      });

      const wrapped = wrapMethod(obj, 'processUser', { parameterMapper: mapper });
      const result = await wrapped({ first: 'John', last: 'Doe', years: 30 });
      
      expect(result).toBe('John Doe, age 30');
    });

    test('should support function-based parameter mapping', async () => {
      const obj = {
        calculate(a, b, operation) {
          if (operation === 'add') return a + b;
          if (operation === 'multiply') return a * b;
          return 0;
        }
      };

      const mapper = createParameterMapper((input) => [
        input.x,
        input.y,
        input.op
      ]);

      const wrapped = wrapMethod(obj, 'calculate', { parameterMapper: mapper });
      const result = await wrapped({ x: 5, y: 3, op: 'multiply' });
      
      expect(result).toBe(15);
    });

    test('should handle default values in parameter mapping', async () => {
      const obj = {
        greet(name, greeting) {
          return `${greeting} ${name}`;
        }
      };

      const mapper = createParameterMapper({
        name: 0,
        greeting: { index: 1, default: 'Hello' }
      });

      const wrapped = wrapMethod(obj, 'greet', { parameterMapper: mapper });
      const result = await wrapped({ name: 'Alice' });
      
      expect(result).toBe('Hello Alice');
    });
  });

  describe('createOutputTransformer - Output transformation', () => {
    test('should transform method output', async () => {
      const obj = {
        getRawData() {
          return { value: 42, extra: 'ignore', timestamp: 12345 };
        }
      };

      const transformer = createOutputTransformer((output) => ({
        result: output.value,
        time: output.timestamp
      }));

      const wrapped = wrapMethod(obj, 'getRawData', { outputTransformer: transformer });
      const result = await wrapped({});
      
      expect(result).toEqual({ result: 42, time: 12345 });
    });

    test('should support async transformers', async () => {
      const obj = {
        getValue() {
          return 10;
        }
      };

      const transformer = createOutputTransformer(async (output) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { doubled: output * 2 };
      });

      const wrapped = wrapMethod(obj, 'getValue', { outputTransformer: transformer });
      const result = await wrapped({});
      
      expect(result).toEqual({ doubled: 20 });
    });
  });

  describe('MethodWrapper - Configuration-driven wrapping', () => {
    test('should wrap methods based on configuration', () => {
      const mathObj = {
        add(a, b) { return a + b; },
        multiply(a, b) { return a * b; },
        divide(a, b) { return a / b; }
      };

      const config = {
        add: {
          parameterMapping: { x: 0, y: 1 },
          outputTransform: (result) => ({ sum: result })
        },
        multiply: {
          parameterMapping: { a: 0, b: 1 },
          outputTransform: (result) => ({ product: result })
        }
      };

      const wrapper = new MethodWrapper(mathObj);
      const wrappedMethods = wrapper.wrapFromConfig(config);

      expect(wrappedMethods.add).toBeDefined();
      expect(wrappedMethods.multiply).toBeDefined();
      expect(wrappedMethods.divide).toBeUndefined();
    });

    test('should apply parameter mapping from config', async () => {
      const obj = {
        format(template, value) {
          return template.replace('{}', value);
        }
      };

      const config = {
        format: {
          parameterMapping: { template: 0, data: 1 }
        }
      };

      const wrapper = new MethodWrapper(obj);
      const wrapped = wrapper.wrapFromConfig(config);
      
      const result = await wrapped.format({ template: 'Value: {}', data: 42 });
      expect(result).toBe('Value: 42');
    });

    test('should apply output transformation from config', async () => {
      const obj = {
        getStats() {
          return { count: 10, total: 100, average: 10 };
        }
      };

      const config = {
        getStats: {
          outputTransform: (stats) => ({
            summary: `Count: ${stats.count}, Avg: ${stats.average}`
          })
        }
      };

      const wrapper = new MethodWrapper(obj);
      const wrapped = wrapper.wrapFromConfig(config);
      
      const result = await wrapped.getStats({});
      expect(result).toEqual({ summary: 'Count: 10, Avg: 10' });
    });

    test('should auto-discover and wrap all methods', () => {
      const obj = {
        method1() { return 1; },
        method2() { return 2; },
        method3() { return 3; },
        notAMethod: 'string value'
      };

      const wrapper = new MethodWrapper(obj);
      const wrappedMethods = wrapper.wrapAll();

      expect(wrappedMethods.method1).toBeDefined();
      expect(wrappedMethods.method2).toBeDefined();
      expect(wrappedMethods.method3).toBeDefined();
      expect(wrappedMethods.notAMethod).toBeUndefined();
    });
  });
});