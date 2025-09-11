import { ValidationUtils } from '../../src/utils/ValidationUtils.js';

describe('ValidationUtils', () => {
  describe('validateInput', () => {
    test('should return false for null input', () => {
      expect(ValidationUtils.validateInput(null, {})).toBe(false);
    });

    test('should return false for null schema', () => {
      expect(ValidationUtils.validateInput({}, null)).toBe(false);
    });

    test('should validate correct types', () => {
      const schema = {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' }
      };
      
      const input = {
        name: 'John',
        age: 30,
        active: true
      };

      expect(ValidationUtils.validateInput(input, schema)).toBe(true);
    });

    test('should reject incorrect types', () => {
      const schema = {
        name: { type: 'string' },
        age: { type: 'number' }
      };
      
      const input = {
        name: 'John',
        age: '30' // wrong type
      };

      expect(ValidationUtils.validateInput(input, schema)).toBe(false);
    });

    test('should reject missing required fields', () => {
      const schema = {
        name: { type: 'string' },
        age: { type: 'number' }
      };
      
      const input = {
        name: 'John'
      };

      expect(ValidationUtils.validateInput(input, schema)).toBe(false);
    });
  });
});
