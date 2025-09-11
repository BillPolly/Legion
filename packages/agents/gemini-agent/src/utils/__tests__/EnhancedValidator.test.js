import { EnhancedValidator } from '../EnhancedValidator.js';

describe('EnhancedValidator', () => {
  describe('validateComplexStructure', () => {
    test('should return false for null input', () => {
      expect(EnhancedValidator.validateComplexStructure(null)).toBe(false);
    });

    test('should return false for non-object input', () => {
      expect(EnhancedValidator.validateComplexStructure('string')).toBe(false);
    });

    test('should return true for valid object', () => {
      expect(EnhancedValidator.validateComplexStructure({})).toBe(true);
    });
  });

  describe('validateToolCall', () => {
    test('should validate correct tool call format', () => {
      const validToolCall = {
        name: 'testTool',
        args: { param: 'value' }
      };
      expect(EnhancedValidator.validateToolCall(validToolCall)).toBe(true);
    });

    test('should reject invalid tool call format', () => {
      const invalidToolCall = {
        name: 123,  // should be string
        args: 'invalid' // should be object
      };
      expect(EnhancedValidator.validateToolCall(invalidToolCall)).toBe(false);
    });
  });
});
