import { ValidationService } from '../../src/services/ValidationService.js';
import { requestSchemas } from '../../src/config/validation-schemas.js';

describe('ValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  test('should validate valid chat request', () => {
    const validRequest = {
      message: 'Hello',
      userId: '123',
      context: {}
    };
    
    const result = validationService.validateRequest(validRequest, requestSchemas.chatRequest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject invalid chat request', () => {
    const invalidRequest = {
      message: 123, // Should be string
      userId: '123'
    };

    const result = validationService.validateRequest(invalidRequest, requestSchemas.chatRequest);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
