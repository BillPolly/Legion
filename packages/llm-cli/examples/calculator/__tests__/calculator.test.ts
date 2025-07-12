import { CalculatorCLI } from '../calculator';
import { MockLLMProvider } from '../../../src/core/providers/MockLLMProvider';
import { setupCalculatorMock } from '../test-helpers';

describe('CalculatorCLI', () => {
  let cli: CalculatorCLI;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    
    // Configure mock to understand calculator commands
    setupCalculatorMock(mockProvider);
    
    cli = new CalculatorCLI({ llmProvider: mockProvider });
  });

  describe('basic arithmetic', () => {
    it('should handle addition', async () => {
      const result = await cli.process('What is 5 plus 3?');
      expect(result.response).toContain('8');
    });

    it('should handle subtraction', async () => {
      const result = await cli.process('Calculate 10 minus 4');
      expect(result.response).toContain('6');
    });

    it('should handle multiplication', async () => {
      const result = await cli.process('What is 6 times 7?');
      expect(result.response).toContain('42');
    });

    it('should handle division', async () => {
      const result = await cli.process('Divide 20 by 4');
      expect(result.response).toContain('5');
    });
  });

  describe('advanced operations', () => {
    it('should handle square root', async () => {
      const result = await cli.process('What is the square root of 16?');
      expect(result.response).toContain('4');
    });

    it('should handle powers', async () => {
      const result = await cli.process('What is 2 to the power of 8?');
      expect(result.response).toContain('256');
    });

    it('should handle percentages', async () => {
      const result = await cli.process('What is 20% of 150?');
      expect(result.response).toContain('30');
    });

    it('should handle complex expressions', async () => {
      const result = await cli.process('Calculate (5 + 3) * 2 - 4');
      expect(result.response).toContain('12');
    });
  });

  describe('memory operations', () => {
    it('should store and recall values', async () => {
      await cli.process('Store 42 as x');
      const result = await cli.process('What is x plus 8?');
      expect(result.response).toContain('50');
    });

    it('should list stored variables', async () => {
      await cli.process('Store 10 as a');
      await cli.process('Store 20 as b');
      const result = await cli.process('Show all variables');
      expect(result.response).toContain('a = 10');
      expect(result.response).toContain('b = 20');
    });

    it('should clear memory', async () => {
      await cli.process('Store 100 as total');
      await cli.process('Clear memory');
      const result = await cli.process('What is total?');
      expect(result.response).toContain('not defined');
    });
  });

  describe('unit conversions', () => {
    it('should convert length units', async () => {
      const result = await cli.process('Convert 5 kilometers to miles');
      expect(result.response).toContain('3.1');
    });

    it('should convert temperature', async () => {
      const result = await cli.process('Convert 100 Celsius to Fahrenheit');
      expect(result.response).toContain('212');
    });

    it('should convert currency', async () => {
      // Mock exchange rate
      const result = await cli.process('Convert 100 USD to EUR');
      expect(result.response).toMatch(/\d+(\.\d+)?/); // Any number
    });
  });

  describe('statistics', () => {
    it('should calculate mean', async () => {
      const result = await cli.process('What is the average of 10, 20, 30, 40, 50?');
      expect(result.response).toContain('30');
    });

    it('should calculate median', async () => {
      const result = await cli.process('Find the median of 1, 3, 5, 7, 9');
      expect(result.response).toContain('5');
    });

    it('should calculate standard deviation', async () => {
      const result = await cli.process('Calculate standard deviation of 2, 4, 6, 8, 10');
      expect(result.response).toMatch(/2\.8|3\.1/); // Approximately
    });
  });

  describe('help and history', () => {
    it('should provide help', async () => {
      const result = await cli.process('help');
      expect(result.response).toContain('Calculator');
      expect(result.response).toContain('operations');
    });

    it('should show calculation history', async () => {
      await cli.process('5 + 3');
      await cli.process('10 * 2');
      const result = await cli.process('Show history');
      expect(result.response).toContain('5 + 3 = 8');
      expect(result.response).toContain('10 * 2 = 20');
    });
  });

  describe('error handling', () => {
    it('should handle division by zero', async () => {
      const result = await cli.process('Divide 10 by 0');
      expect(result.response).toContain('cannot divide by zero');
    });

    it('should handle invalid expressions', async () => {
      const result = await cli.process('Calculate 5 plus plus 3');
      expect(result.response).toContain('Invalid');
    });

    it('should handle undefined variables', async () => {
      const result = await cli.process('What is xyz?');
      expect(result.response).toContain('not defined');
    });
  });

  describe('natural language understanding', () => {
    it('should understand various phrasings', async () => {
      const phrasings = [
        'Add 5 and 3',
        '5 + 3',
        'Sum of 5 and 3',
        'What do you get when you add 5 to 3?',
        '5 plus 3 equals?'
      ];

      for (const phrase of phrasings) {
        const result = await cli.process(phrase);
        expect(result.response).toContain('8');
      }
    });

    it('should handle conversational context', async () => {
      await cli.process('Calculate 10 plus 5');
      const result = await cli.process('Now multiply that by 2');
      expect(result.response).toContain('30');
    });
  });
});