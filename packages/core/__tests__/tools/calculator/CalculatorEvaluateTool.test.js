const CalculatorEvaluateTool = require('../../../src/tools/calculator/CalculatorEvaluateTool');

describe('CalculatorEvaluateTool', () => {
  let tool;

  beforeEach(() => {
    tool = new CalculatorEvaluateTool();
  });

  describe('constructor', () => {
    it('should set correct tool properties', () => {
      expect(tool.name).toBe('calculator_evaluate');
      expect(tool.description).toBe('Evaluates a mathematical expression and returns the result');
      expect(tool.parameters).toEqual({
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")'
          }
        },
        required: ['expression']
      });
    });
  });

  describe('getDescription()', () => {
    it('should return correct OpenAI format', () => {
      const description = tool.getDescription();
      
      expect(description).toEqual({
        type: 'function',
        function: {
          name: 'calculator_evaluate',
          description: 'Evaluates a mathematical expression and returns the result',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'JavaScript mathematical expression to evaluate (e.g., "784*566", "Math.sqrt(16)", "(10+5)*3/5")'
              }
            },
            required: ['expression']
          }
        }
      });
    });
  });

  describe('execute()', () => {
    it('should evaluate simple arithmetic', async () => {
      const result = await tool.execute({ expression: '2 + 2' });
      expect(result).toEqual({ result: 4 });
    });

    it('should evaluate complex expressions', async () => {
      const result = await tool.execute({ expression: '(10 + 5) * 3 / 5' });
      expect(result).toEqual({ result: 9 });
    });

    it('should evaluate expressions with Math functions', async () => {
      const result = await tool.execute({ expression: 'Math.sqrt(16) + Math.pow(2, 3)' });
      expect(result).toEqual({ result: 12 });
    });

    it('should handle multiplication', async () => {
      const result = await tool.execute({ expression: '784 * 566' });
      expect(result).toEqual({ result: 443744 });
    });

    it('should handle decimal results', async () => {
      const result = await tool.execute({ expression: '10 / 3' });
      expect(result.result).toBeCloseTo(3.333333);
    });

    it('should evaluate trigonometric functions', async () => {
      const result = await tool.execute({ expression: 'Math.sin(Math.PI / 2)' });
      expect(result).toEqual({ result: 1 });
    });

    it('should handle constants', async () => {
      const result = await tool.execute({ expression: 'Math.PI * 2' });
      expect(result.result).toBeCloseTo(6.28318, 4);
    });

    it('should handle order of operations', async () => {
      const result = await tool.execute({ expression: '2 + 3 * 4' });
      expect(result).toEqual({ result: 14 });
    });

    it('should throw error for invalid expressions', async () => {
      await expect(tool.execute({ expression: 'invalid math' }))
        .rejects.toThrow('Failed to evaluate expression');
    });

    it('should throw error for non-mathematical expressions', async () => {
      await expect(tool.execute({ expression: 'console.log("test")' }))
        .rejects.toThrow('Failed to evaluate expression');
    });

    it('should handle expressions with parentheses', async () => {
      const result = await tool.execute({ expression: '((2 + 3) * (4 + 5)) / 3' });
      expect(result).toEqual({ result: 15 });
    });

    it('should handle very large numbers', async () => {
      const result = await tool.execute({ expression: '999999999 * 999999999' });
      expect(result).toEqual({ result: 999999998000000001 });
    });

    it('should handle negative numbers', async () => {
      const result = await tool.execute({ expression: '-5 + 3' });
      expect(result).toEqual({ result: -2 });
    });

    it('should handle zero division', async () => {
      const result = await tool.execute({ expression: '1 / 0' });
      expect(result).toEqual({ result: Infinity });
    });

    it('should log expressions when evaluating', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await tool.execute({ expression: '5 + 5' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Evaluating expression:', '5 + 5');
      expect(consoleSpy).toHaveBeenCalledWith('Result:', 10);
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty expression', async () => {
      await expect(tool.execute({ expression: '' }))
        .rejects.toThrow('Failed to evaluate expression');
    });

    it('should handle whitespace', async () => {
      const result = await tool.execute({ expression: '  2  +  2  ' });
      expect(result).toEqual({ result: 4 });
    });

    it('should handle missing expression parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow();
    });

    it('should handle null expression', async () => {
      await expect(tool.execute({ expression: null }))
        .rejects.toThrow();
    });
  });
});