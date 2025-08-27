/**
 * Comprehensive test suite for CalculatorModule
 * Tests both unit and integration functionality
 * Following TDD principles with 100% coverage requirement
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import CalculatorModule from '../CalculatorModule.js';

describe('CalculatorModule', () => {
  let calculatorModule;
  let resourceManager;

  beforeEach(async () => {
    // Get ResourceManager instance
    resourceManager = await ResourceManager.getInstance();
    
    // Create fresh module instance for each test
    calculatorModule = await CalculatorModule.create(resourceManager);
  });

  afterEach(() => {
    // Clean up any resources
    if (calculatorModule) {
      calculatorModule = null;
    }
  });

  describe('Module Creation and Initialization', () => {
    it('should create module with correct metadata', () => {
      expect(calculatorModule.name).toBe('calculator');
      expect(calculatorModule.description).toBe('Mathematical calculation tools for evaluating expressions and performing computations');
      expect(calculatorModule.version).toBe('1.0.0');
    });

    it('should have ResourceManager injected', () => {
      expect(calculatorModule.resourceManager).toBe(resourceManager);
    });

    it('should register calculator tool during initialization', () => {
      const tools = calculatorModule.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('calculator');
    });

    it('should have proper module structure', () => {
      expect(calculatorModule).toHaveProperty('initialize');
      expect(calculatorModule).toHaveProperty('getTools');
      expect(calculatorModule).toHaveProperty('registerTool');
      expect(typeof calculatorModule.initialize).toBe('function');
    });

    it('should create module via static create method', async () => {
      const newModule = await CalculatorModule.create(resourceManager);
      expect(newModule).toBeInstanceOf(CalculatorModule);
      expect(newModule.resourceManager).toBe(resourceManager);
    });
  });

  describe('Calculator Tool Functionality', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    it('should have correct tool metadata', () => {
      expect(calculatorTool.name).toBe('calculator');
      expect(calculatorTool.shortName).toBe('calc');
      expect(calculatorTool.description).toBe('Evaluates mathematical expressions and performs calculations');
    });

    it('should have proper input schema', () => {
      const schema = calculatorTool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.expression).toBeDefined();
      expect(schema.properties.expression.type).toEqual(['string', 'number']);
      expect(schema.required).toContain('expression');
    });

    it('should have proper output schema', () => {
      const schema = calculatorTool.outputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.result).toBeDefined();
      expect(schema.properties.expression).toBeDefined();
      expect(schema.properties.result.type).toBe('number');
      expect(schema.properties.expression.type).toBe('string');
      expect(schema.required).toEqual(['result', 'expression']);
    });

    it('should have getMetadata method', () => {
      expect(typeof calculatorTool.getMetadata).toBe('function');
      const metadata = calculatorTool.getMetadata();
      expect(metadata.name).toBe('calculator');
      expect(metadata.shortName).toBe('calc');
      expect(metadata.category).toBe('mathematical');
      expect(metadata.tags).toContain('math');
      expect(metadata.security).toBeDefined();
    });

    it('should have validate method', () => {
      expect(typeof calculatorTool.validate).toBe('function');
    });
  });

  describe('Mathematical Operations', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    describe('Basic Arithmetic', () => {
      it('should perform addition correctly', async () => {
        const result = await calculatorTool.execute({ expression: '2 + 3' });
        expect(result.result).toBe(5);
        expect(result.expression).toBe('2 + 3');
      });

      it('should perform subtraction correctly', async () => {
        const result = await calculatorTool.execute({ expression: '10 - 4' });
        expect(result.result).toBe(6);
        expect(result.expression).toBe('10 - 4');
      });

      it('should perform multiplication correctly', async () => {
        const result = await calculatorTool.execute({ expression: '6 * 7' });
        expect(result.result).toBe(42);
        expect(result.expression).toBe('6 * 7');
      });

      it('should perform division correctly', async () => {
        const result = await calculatorTool.execute({ expression: '15 / 3' });
        expect(result.result).toBe(5);
        expect(result.expression).toBe('15 / 3');
      });

      it('should handle decimal operations', async () => {
        const result = await calculatorTool.execute({ expression: '3.14 * 2' });
        expect(result.result).toBe(6.28);
        expect(result.expression).toBe('3.14 * 2');
      });
    });

    describe('Complex Expressions', () => {
      it('should handle parentheses and order of operations', async () => {
        const result = await calculatorTool.execute({ expression: '(10 + 5) * 3 / 5' });
        expect(result.result).toBe(9);
        expect(result.expression).toBe('(10 + 5) * 3 / 5');
      });

      it('should handle nested parentheses', async () => {
        const result = await calculatorTool.execute({ expression: '((2 + 3) * (4 + 1)) / 5' });
        expect(result.result).toBe(5);
        expect(result.expression).toBe('((2 + 3) * (4 + 1)) / 5');
      });

      it('should handle mathematical functions', async () => {
        const result = await calculatorTool.execute({ expression: 'Math.sqrt(16)' });
        expect(result.result).toBe(4);
        expect(result.expression).toBe('Math.sqrt(16)');
      });

      it('should handle power operations', async () => {
        const result = await calculatorTool.execute({ expression: 'Math.pow(2, 3)' });
        expect(result.result).toBe(8);
        expect(result.expression).toBe('Math.pow(2, 3)');
      });

      it('should handle trigonometric functions', async () => {
        const result = await calculatorTool.execute({ expression: 'Math.sin(Math.PI / 2)' });
        expect(result.result).toBe(1);
        expect(result.expression).toBe('Math.sin(Math.PI / 2)');
      });
    });

    describe('Edge Cases', () => {
      it('should handle large numbers correctly', async () => {
        const result = await calculatorTool.execute({ expression: '784 * 566' });
        expect(result.result).toBe(443744);
        expect(result.expression).toBe('784 * 566');
      });

      it('should handle negative numbers', async () => {
        const result = await calculatorTool.execute({ expression: '-5 + 10' });
        expect(result.result).toBe(5);
        expect(result.expression).toBe('-5 + 10');
      });

      it('should handle zero operations', async () => {
        const result = await calculatorTool.execute({ expression: '0 * 100' });
        expect(result.result).toBe(0);
        expect(result.expression).toBe('0 * 100');
      });

      it('should handle division by zero', async () => {
        const result = await calculatorTool.execute({ expression: '1 / 0' });
        expect(result.result).toBe(Infinity);
        expect(result.expression).toBe('1 / 0');
      });
    });
  });

  describe('Input Handling', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    it('should convert number input to string', async () => {
      const result = await calculatorTool.execute({ expression: 42 });
      expect(result.result).toBe(42);
      expect(result.expression).toBe('42');
    });

    it('should handle string expressions', async () => {
      const result = await calculatorTool.execute({ expression: '5 + 5' });
      expect(result.result).toBe(10);
      expect(result.expression).toBe('5 + 5');
    });

    it('should handle whitespace in expressions', async () => {
      const result = await calculatorTool.execute({ expression: ' 2  +  3 ' });
      expect(result.result).toBe(5);
      expect(result.expression).toBe(' 2  +  3 ');
    });
  });

  describe('Tool Validation', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    describe('Input Validation', () => {
      it('should validate valid input correctly', () => {
        const result = calculatorTool.validate({ expression: '2 + 2' });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject missing expression', () => {
        const result = calculatorTool.validate({});
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression is required');
      });

      it('should reject null parameters', () => {
        const result = calculatorTool.validate(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Parameters must be an object');
      });

      it('should reject invalid expression type', () => {
        const result = calculatorTool.validate({ expression: true });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression must be a string or number');
      });

      it('should reject dangerous keywords', () => {
        const result = calculatorTool.validate({ expression: 'require("fs")' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Expression contains forbidden keyword: require');
      });

      it('should accept number expressions', () => {
        const result = calculatorTool.validate({ expression: 42 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Metadata Validation', () => {
      it('should provide complete metadata', () => {
        const metadata = calculatorTool.getMetadata();
        expect(metadata.name).toBe('calculator');
        expect(metadata.description).toBe('Evaluates mathematical expressions and performs calculations');
        expect(metadata.shortName).toBe('calc');
        expect(metadata.inputSchema).toBeDefined();
        expect(metadata.outputSchema).toBeDefined();
        expect(metadata.version).toBe('1.0.0');
        expect(metadata.category).toBe('mathematical');
        expect(metadata.tags).toEqual(['math', 'calculation', 'evaluation']);
        expect(metadata.security).toBeDefined();
        expect(metadata.security.evaluation).toBe('safe');
      });

      it('should include security information', () => {
        const metadata = calculatorTool.getMetadata();
        expect(metadata.security.dangerousKeywords).toEqual([
          'import', 'require', 'process', 'fs', 'child_process', 'exec', 'spawn'
        ]);
      });
    });
  });

  describe('Error Handling', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    it('should throw error for empty expression', async () => {
      await expect(calculatorTool.execute({ expression: '' }))
        .rejects.toThrow('Expression is required');
    });

    it('should throw error for null expression', async () => {
      await expect(calculatorTool.execute({ expression: null }))
        .rejects.toThrow('Expression is required');
    });

    it('should throw error for undefined expression', async () => {
      await expect(calculatorTool.execute({}))
        .rejects.toThrow();
    });

    it('should throw error for invalid syntax', async () => {
      await expect(calculatorTool.execute({ expression: '2 +' }))
        .rejects.toThrow('Failed to evaluate expression');
    });

    it('should throw error for invalid characters', async () => {
      await expect(calculatorTool.execute({ expression: '2 + @' }))
        .rejects.toThrow('Failed to evaluate expression');
    });

    describe('Security Validation', () => {
      const dangerousExpressions = [
        'require("fs")',
        'import("fs")',
        'process.exit()',
        'exec("rm -rf /")',
        'spawn("cat", ["/etc/passwd"])',
        'child_process.exec("ls")',
        'fs.readFileSync("/etc/passwd")'
      ];

      dangerousExpressions.forEach(expr => {
        it(`should block dangerous expression: ${expr}`, async () => {
          await expect(calculatorTool.execute({ expression: expr }))
            .rejects.toThrow('Expression contains forbidden keyword');
        });
      });

      it('should allow safe Math functions', async () => {
        const result = await calculatorTool.execute({ expression: 'Math.abs(-5)' });
        expect(result.result).toBe(5);
      });

      it('should allow safe mathematical operations', async () => {
        const result = await calculatorTool.execute({ expression: '2 * Math.PI * 5' });
        expect(result.result).toBeCloseTo(31.416, 3);
      });
    });
  });

  describe('Tool Events and Logging', () => {
    let calculatorTool;
    let eventSpy;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
      
      // Spy on event emission methods
      eventSpy = {
        progress: jest.spyOn(calculatorTool, 'progress').mockImplementation(() => {}),
        info: jest.spyOn(calculatorTool, 'info').mockImplementation(() => {}),
        warning: jest.spyOn(calculatorTool, 'warning').mockImplementation(() => {})
      };
    });

    afterEach(() => {
      // Restore spies
      Object.values(eventSpy).forEach(spy => spy.mockRestore());
    });

    it('should emit progress event during calculation', async () => {
      await calculatorTool.execute({ expression: '2 + 2' });
      
      expect(eventSpy.progress).toHaveBeenCalledWith(
        'Evaluating expression: 2 + 2',
        0
      );
    });

    it('should emit info event on completion', async () => {
      await calculatorTool.execute({ expression: '3 * 4' });
      
      expect(eventSpy.info).toHaveBeenCalledWith(
        'Calculation completed: 3 * 4 = 12'
      );
    });

    it('should emit warning for dangerous expressions', async () => {
      await expect(calculatorTool.execute({ expression: 'require("fs")' }))
        .rejects.toThrow();
      
      expect(eventSpy.warning).toHaveBeenCalledWith(
        'Expression contains forbidden keyword: require',
        {
          expression: 'require("fs")',
          keyword: 'require'
        }
      );
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end through module interface', async () => {
      const tools = calculatorModule.getTools();
      expect(tools).toHaveLength(1);
      
      const calculatorTool = tools[0];
      const result = await calculatorTool.execute({ expression: '100 / 4' });
      
      expect(result).toEqual({
        result: 25,
        expression: '100 / 4'
      });
    });

    it('should handle multiple consecutive calculations', async () => {
      const tools = calculatorModule.getTools();
      const calculatorTool = tools[0];
      
      const results = await Promise.all([
        calculatorTool.execute({ expression: '1 + 1' }),
        calculatorTool.execute({ expression: '2 * 2' }),
        calculatorTool.execute({ expression: '3 * 3' }),
        calculatorTool.execute({ expression: '4 * 4' })
      ]);
      
      expect(results.map(r => r.result)).toEqual([2, 4, 9, 16]);
    });

    it('should maintain tool state correctly across calculations', async () => {
      const tools = calculatorModule.getTools();
      const calculatorTool = tools[0];
      
      // First calculation
      const result1 = await calculatorTool.execute({ expression: '5 + 5' });
      expect(result1.result).toBe(10);
      
      // Second calculation should be independent
      const result2 = await calculatorTool.execute({ expression: '3 * 3' });
      expect(result2.result).toBe(9);
      
      // Tool should maintain proper structure
      expect(calculatorTool.name).toBe('calculator');
      expect(calculatorTool.shortName).toBe('calc');
    });
  });

  describe('Performance Tests', () => {
    let calculatorTool;

    beforeEach(() => {
      const tools = calculatorModule.getTools();
      calculatorTool = tools[0];
    });

    it('should handle complex calculations efficiently', async () => {
      const complexExpression = 'Math.sqrt(Math.pow(3, 4) + Math.pow(4, 3)) * Math.PI / 2';
      
      const startTime = Date.now();
      const result = await calculatorTool.execute({ expression: complexExpression });
      const endTime = Date.now();
      
      expect(result.result).toBeCloseTo(18.915, 3);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    });

    it('should handle large numbers without significant delay', async () => {
      const largeExpression = '999999999 * 999999999';
      
      const startTime = Date.now();
      const result = await calculatorTool.execute({ expression: largeExpression });
      const endTime = Date.now();
      
      expect(result.result).toBe(999999998000000001);
      expect(endTime - startTime).toBeLessThan(50); // Should complete in <50ms
    });
  });
});