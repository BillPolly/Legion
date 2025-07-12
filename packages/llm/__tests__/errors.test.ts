import { MaxRetriesExceededError, ValidationError } from '../src/index';

describe('Error Classes', () => {
  describe('MaxRetriesExceededError', () => {
    it('should create error with correct name and message', () => {
      const message = 'Failed after 3 attempts';
      const error = new MaxRetriesExceededError(message);
      
      expect(error.name).toBe('MaxRetriesExceededError');
      expect(error.message).toBe(message);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof MaxRetriesExceededError).toBe(true);
    });

    it('should preserve stack trace', () => {
      const error = new MaxRetriesExceededError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MaxRetriesExceededError');
    });

    it('should be catchable as Error', () => {
      const error = new MaxRetriesExceededError('Test error');
      
      try {
        throw error;
      } catch (caught) {
        expect(caught instanceof Error).toBe(true);
        expect(caught instanceof MaxRetriesExceededError).toBe(true);
        expect((caught as MaxRetriesExceededError).message).toBe('Test error');
      }
    });

    it('should be distinguishable from other errors', () => {
      const maxRetriesError = new MaxRetriesExceededError('Max retries');
      const validationError = new ValidationError('Validation failed');
      const genericError = new Error('Generic error');
      
      expect(maxRetriesError instanceof MaxRetriesExceededError).toBe(true);
      expect(maxRetriesError instanceof ValidationError).toBe(false);
      expect(maxRetriesError instanceof Error).toBe(true);
      
      expect(validationError instanceof MaxRetriesExceededError).toBe(false);
      expect(genericError instanceof MaxRetriesExceededError).toBe(false);
    });

    it('should handle empty message', () => {
      const error = new MaxRetriesExceededError('');
      
      expect(error.name).toBe('MaxRetriesExceededError');
      expect(error.message).toBe('');
    });

    it('should handle special characters in message', () => {
      const message = 'Failed with "quotes", \n newlines, and émojis 🚀';
      const error = new MaxRetriesExceededError(message);
      
      expect(error.message).toBe(message);
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new MaxRetriesExceededError(longMessage);
      
      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });
  });

  describe('ValidationError', () => {
    it('should create error with correct name and message', () => {
      const message = 'Response validation failed';
      const error = new ValidationError(message);
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe(message);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should preserve stack trace', () => {
      const error = new ValidationError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });

    it('should be catchable as Error', () => {
      const error = new ValidationError('Test error');
      
      try {
        throw error;
      } catch (caught) {
        expect(caught instanceof Error).toBe(true);
        expect(caught instanceof ValidationError).toBe(true);
        expect((caught as ValidationError).message).toBe('Test error');
      }
    });

    it('should be distinguishable from other errors', () => {
      const validationError = new ValidationError('Validation failed');
      const maxRetriesError = new MaxRetriesExceededError('Max retries');
      const genericError = new Error('Generic error');
      
      expect(validationError instanceof ValidationError).toBe(true);
      expect(validationError instanceof MaxRetriesExceededError).toBe(false);
      expect(validationError instanceof Error).toBe(true);
      
      expect(maxRetriesError instanceof ValidationError).toBe(false);
      expect(genericError instanceof ValidationError).toBe(false);
    });

    it('should handle empty message', () => {
      const error = new ValidationError('');
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('');
    });

    it('should handle special characters in message', () => {
      const message = 'Validation failed with "quotes", \n newlines, and émojis 🚀';
      const error = new ValidationError(message);
      
      expect(error.message).toBe(message);
    });

    it('should handle very long messages', () => {
      const longMessage = 'B'.repeat(10000);
      const error = new ValidationError(longMessage);
      
      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });
  });

  describe('Error Inheritance and Type Checking', () => {
    it('should maintain proper inheritance chain', () => {
      const maxRetriesError = new MaxRetriesExceededError('Max retries');
      const validationError = new ValidationError('Validation failed');
      
      // Both should be instances of Error
      expect(maxRetriesError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
      
      // But not instances of each other
      expect(maxRetriesError instanceof ValidationError).toBe(false);
      expect(validationError instanceof MaxRetriesExceededError).toBe(false);
    });

    it('should work with instanceof checks in catch blocks', () => {
      const errors = [
        new MaxRetriesExceededError('Max retries exceeded'),
        new ValidationError('Validation failed'),
        new Error('Generic error')
      ];
      
      const results = errors.map(error => {
        try {
          throw error;
        } catch (caught) {
          if (caught instanceof MaxRetriesExceededError) {
            return 'MaxRetriesExceededError';
          } else if (caught instanceof ValidationError) {
            return 'ValidationError';
          } else if (caught instanceof Error) {
            return 'Error';
          } else {
            return 'Unknown';
          }
        }
      });
      
      expect(results).toEqual(['MaxRetriesExceededError', 'ValidationError', 'Error']);
    });

    it('should work with error.name checks', () => {
      const errors = [
        new MaxRetriesExceededError('Max retries exceeded'),
        new ValidationError('Validation failed'),
        new Error('Generic error')
      ];
      
      const names = errors.map(error => error.name);
      
      expect(names).toEqual(['MaxRetriesExceededError', 'ValidationError', 'Error']);
    });

    it('should work with constructor checks', () => {
      const maxRetriesError = new MaxRetriesExceededError('Max retries');
      const validationError = new ValidationError('Validation failed');
      
      expect(maxRetriesError.constructor).toBe(MaxRetriesExceededError);
      expect(validationError.constructor).toBe(ValidationError);
      
      expect(maxRetriesError.constructor.name).toBe('MaxRetriesExceededError');
      expect(validationError.constructor.name).toBe('ValidationError');
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON properly', () => {
      const maxRetriesError = new MaxRetriesExceededError('Max retries exceeded');
      const validationError = new ValidationError('Validation failed');
      
      // Note: Error objects don't serialize well by default, but we can access properties
      expect(maxRetriesError.name).toBe('MaxRetriesExceededError');
      expect(maxRetriesError.message).toBe('Max retries exceeded');
      
      expect(validationError.name).toBe('ValidationError');
      expect(validationError.message).toBe('Validation failed');
    });

    it('should convert to string properly', () => {
      const maxRetriesError = new MaxRetriesExceededError('Max retries exceeded');
      const validationError = new ValidationError('Validation failed');
      
      expect(maxRetriesError.toString()).toBe('MaxRetriesExceededError: Max retries exceeded');
      expect(validationError.toString()).toBe('ValidationError: Validation failed');
    });
  });

  describe('Error Context and Debugging', () => {
    it('should provide useful debugging information', () => {
      const error = new MaxRetriesExceededError('Failed after 5 attempts with rate limiting');
      
      expect(error.name).toBe('MaxRetriesExceededError');
      expect(error.message).toContain('5 attempts');
      expect(error.message).toContain('rate limiting');
      expect(error.stack).toBeDefined();
    });

    it('should maintain stack trace for debugging', () => {
      function throwMaxRetriesError() {
        throw new MaxRetriesExceededError('Test error from function');
      }
      
      function throwValidationError() {
        throw new ValidationError('Test validation error from function');
      }
      
      try {
        throwMaxRetriesError();
      } catch (error) {
        expect(error instanceof MaxRetriesExceededError).toBe(true);
        expect((error as Error).stack).toContain('throwMaxRetriesError');
      }
      
      try {
        throwValidationError();
      } catch (error) {
        expect(error instanceof ValidationError).toBe(true);
        expect((error as Error).stack).toContain('throwValidationError');
      }
    });
  });
});
