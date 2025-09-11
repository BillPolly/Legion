import { ValidationHelper } from '../../src/utils/ValidationHelper';

describe('ValidationHelper', () => {
  describe('validateToolInput', () => {
    test('should validate valid input', () => {
      const input = { name: 'test', value: 123 };
      const schema = {
        name: { type: 'string', required: true },
        value: { type: 'number', required: true }
      };
      expect(() => ValidationHelper.validateToolInput(input, schema)).not.toThrow();
    });

    test('should throw error for missing required field', () => {
      const input = { name: 'test' };
      const schema = {
        name: { type: 'string', required: true },
        value: { type: 'number', required: true }
      };
      expect(() => ValidationHelper.validateToolInput(input, schema))
        .toThrow('Missing required field: value');
    });

    test('should throw error for invalid type', () => {
      const input = { name: 'test', value: 'not-a-number' };
      const schema = {
        name: { type: 'string', required: true },
        value: { type: 'number', required: true }
      };
      expect(() => ValidationHelper.validateToolInput(input, schema))
        .toThrow('Invalid type for value: expected number');
    });
  });

  describe('validateToolOutput', () => {
    test('should validate output matching schema', () => {
      const output = [1, 2, 3];
      const schema = { type: 'object', format: 'array' };
      expect(() => ValidationHelper.validateToolOutput(output, schema)).not.toThrow();
    });

    test('should throw error for invalid output format', () => {
      const output = 'not-an-array';
      const schema = { type: 'object', format: 'array' };
      expect(() => ValidationHelper.validateToolOutput(output, schema))
        .toThrow('Output type mismatch: expected object');
    });
  });

  describe('validateType', () => {
    test('should validate matching types', () => {
      expect(() => ValidationHelper.validateType('test', 'string')).not.toThrow();
      expect(() => ValidationHelper.validateType(123, 'number')).not.toThrow();
    });

    test('should throw error for type mismatch', () => {
      expect(() => ValidationHelper.validateType('test', 'number'))
        .toThrow('Type mismatch: expected number, got string');
    });
  });
});
