import { RequestValidationService } from '../../src/services/RequestValidationService';

describe('RequestValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = new RequestValidationService();
  });

  test('should register schema correctly', () => {
    const mockSchema = {
      validate: () => true
    };
    validationService.registerSchema('/test', mockSchema);
    expect(validationService.schemas.has('/test')).toBe(true);
  });

  test('should throw error when validating with non-existent schema', () => {
    expect(() => {
      validationService.validateRequest('/nonexistent', {});
    }).toThrow('No schema found for path: /nonexistent');
  });

  test('should validate data with registered schema', () => {
    let validateCalled = false;
    let validateArgs = null;
    const mockSchema = {
      validate: (data) => {
        validateCalled = true;
        validateArgs = data;
        return true;
      }
    };
    validationService.registerSchema('/test', mockSchema);
    const result = validationService.validateRequest('/test', { data: 'test' });
    expect(result).toBe(true);
    expect(validateCalled).toBe(true);
    expect(validateArgs).toEqual({ data: 'test' });
  });
});
