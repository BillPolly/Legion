/**
 * Unit tests for Calculator Tool
 */

import { jest } from '@jest/globals';
import { CalculatorTool, CalculatorModule } from '../../src/calculator/CalculatorModule.js';
import { createMockToolCall, validateToolResult } from '../utils/test-helpers.js';

describe('CalculatorTool', () => {
  let calculator;

  beforeEach(() => {
    calculator = new CalculatorTool();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(calculator.name).toBe('calculator');
      expect(calculator.description).toBe('Performs mathematical calculations');
    });
  });

  describe('getToolDescription', () => {
    test('should return correct tool description format', () => {
      const description = calculator.getToolDescription();
      
      expect(description.type).toBe('function');
      expect(description.function.name).toBe('calculator_evaluate');
      expect(description.function.description).toContain('mathematical expression');
      expect(description.function.parameters.required).toContain('expression');
      expect(description.function.parameters.properties.expression.type).toBe('string');
    });

    test('should include output schemas for success and failure', () => {
      const description = calculator.getToolDescription();
      
      expect(description.function.output.success).toBeDefined();
      expect(description.function.output.failure).toBeDefined();
      expect(description.function.output.success.properties.result.type).toBe('number');
      expect(description.function.output.failure.properties.errorType.enum).toContain('syntax_error');
    });
  });

  describe('evaluate method', () => {
    test('should evaluate basic arithmetic expressions', async () => {
      expect(await calculator.evaluate('2 + 2')).toBe(4);
      expect(await calculator.evaluate('10 - 5')).toBe(5);
      expect(await calculator.evaluate('3 * 4')).toBe(12);
      expect(await calculator.evaluate('8 / 2')).toBe(4);
    });

    test('should evaluate complex mathematical expressions', async () => {
      expect(await calculator.evaluate('(10 + 5) * 3')).toBe(45);
      expect(await calculator.evaluate('Math.sqrt(16)')).toBe(4);
      expect(await calculator.evaluate('Math.pow(2, 3)')).toBe(8);
      expect(await calculator.evaluate('Math.PI * 2')).toBeCloseTo(6.283, 3);
    });

    test('should handle floating point calculations', async () => {
      expect(await calculator.evaluate('0.1 + 0.2')).toBeCloseTo(0.3, 5);
      expect(await calculator.evaluate('3.14159 * 2')).toBeCloseTo(6.28318, 5);
    });

    test('should throw error for dangerous keywords', async () => {
      const dangerousExpressions = [
        'import("fs")',
        'require("fs")',
        'process.exit()',
        'fs.readFile',
        'child_process.exec',
        'exec("rm -rf /")',
        'spawn("ls")'
      ];

      for (const expr of dangerousExpressions) {
        await expect(calculator.evaluate(expr)).rejects.toThrow('forbidden keyword');
      }
    });

    test('should throw error for invalid syntax', async () => {
      const invalidExpressions = [
        '2 +',
        '* 5',
        '(((',
        'undefined_function()'
      ];

      for (const expr of invalidExpressions) {
        await expect(calculator.evaluate(expr)).rejects.toThrow();
      }
    });
  });

  describe('invoke method', () => {
    test('should handle valid mathematical expressions', async () => {
      const toolCall = createMockToolCall('calculator_evaluate', { expression: '5 + 3' });
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(8);
      expect(result.data.expression).toBe('5 + 3');
    });

    test('should handle complex expressions', async () => {
      const toolCall = createMockToolCall('calculator_evaluate', { 
        expression: 'Math.sqrt(Math.pow(3, 2) + Math.pow(4, 2))' 
      });
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(5); // Pythagorean theorem: 3-4-5 triangle
    });

    test('should return failure for forbidden keywords', async () => {
      const toolCall = createMockToolCall('calculator_evaluate', { 
        expression: 'require("fs").readFileSync("/etc/passwd")' 
      });
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('forbidden_keyword');
      expect(result.data.expression).toBe('require("fs").readFileSync("/etc/passwd")');
      expect(result.error).toContain('forbidden keyword');
    });

    test('should return failure for syntax errors', async () => {
      const toolCall = createMockToolCall('calculator_evaluate', { expression: '2 +' });
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('evaluation_error');
      expect(result.data.expression).toBe('2 +');
    });

    test('should handle missing expression parameter', async () => {
      const toolCall = createMockToolCall('calculator_evaluate', {});
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain('expression');
    });

    test('should handle invalid JSON arguments', async () => {
      const toolCall = {
        id: 'test-call',
        type: 'function',
        function: {
          name: 'calculator_evaluate',
          arguments: 'invalid json'
        }
      };
      const result = await calculator.invoke(toolCall);

      validateToolResult(result);
      expect(result.success).toBe(false);
      expect(result.data.errorType).toBe('evaluation_error');
    });

    test('should handle edge cases', async () => {
      const testCases = [
        { expr: '0', expected: 0 },
        { expr: '-5', expected: -5 },
        { expr: '1/0', expected: Infinity },
        { expr: '-1/0', expected: -Infinity },
        { expr: '0/0', expected: NaN }
      ];

      for (const testCase of testCases) {
        const toolCall = createMockToolCall('calculator_evaluate', { expression: testCase.expr });
        const result = await calculator.invoke(toolCall);

        validateToolResult(result);
        expect(result.success).toBe(true);
        if (isNaN(testCase.expected)) {
          expect(isNaN(result.data.result)).toBe(true);
        } else {
          expect(result.data.result).toBe(testCase.expected);
        }
      }
    });
  });

  describe('parseArguments method', () => {
    test('should parse valid JSON arguments', () => {
      const args = calculator.parseArguments('{"expression": "2 + 2"}');
      expect(args.expression).toBe('2 + 2');
    });

    test('should throw error for invalid JSON', () => {
      expect(() => calculator.parseArguments('invalid json')).toThrow();
    });
  });

  describe('validateRequiredParameters method', () => {
    test('should pass validation when required parameters are present', () => {
      expect(() => calculator.validateRequiredParameters({ expression: '2 + 2' }, ['expression'])).not.toThrow();
    });

    test('should throw error when required parameters are missing', () => {
      expect(() => calculator.validateRequiredParameters({}, ['expression'])).toThrow();
    });
  });
});

describe('CalculatorModule', () => {
  let module;

  beforeEach(() => {
    module = new CalculatorModule();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(module.name).toBe('calculator');
      expect(module.tools).toHaveLength(1);
      expect(module.tools[0]).toBeInstanceOf(CalculatorTool);
    });

    test('should have no dependencies', () => {
      expect(CalculatorModule.dependencies).toEqual([]);
    });
  });

  describe('getTools method', () => {
    test('should return array of calculator tools', () => {
      const tools = module.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(CalculatorTool);
    });
  });

  describe('integration with module system', () => {
    test('should work with tool registry pattern', () => {
      const tools = module.getTools();
      const calculator = tools[0];
      
      expect(calculator.getToolDescription).toBeDefined();
      expect(calculator.invoke).toBeDefined();
      expect(typeof calculator.getToolDescription).toBe('function');
      expect(typeof calculator.invoke).toBe('function');
    });
  });
});