import { ValidationOrchestrationService } from '../../src/services/ValidationOrchestrationService.js';

describe('ValidationOrchestrationService', () => {
  let service;

  beforeEach(() => {
    service = new ValidationOrchestrationService();
  });

  describe('validateToolRequest', () => {
    test('should validate correct tool request', () => {
      const validRequest = {
        name: 'testTool',
        args: { param: 'value' }
      };
      const result = service.validateToolRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid tool request', () => {
      const invalidRequest = {
        name: 123,
        args: 'invalid'
      };
      const result = service.validateToolRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validateComplexData', () => {
    test('should validate complex data structure', () => {
      const validData = {
        nested: {
          data: 'value'
        }
      };
      const result = service.validateComplexData(validData);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid data structure', () => {
      const result = service.validateComplexData(null);
      expect(result.isValid).toBe(false);
    });
  });
});
