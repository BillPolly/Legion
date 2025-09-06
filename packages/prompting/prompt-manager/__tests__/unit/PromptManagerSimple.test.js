/**
 * Simple unit tests for PromptManager without external dependencies
 * Tests core functionality using dependency injection
 */

import { RetryHandler } from '../../src/RetryHandler.js';

describe('PromptManager Core Functionality', () => {
  
  describe('RetryHandler', () => {
    test('should create retry handler with default configuration', () => {
      const handler = new RetryHandler();
      
      expect(handler.config.maxAttempts).toBe(3);
      expect(handler.config.errorFeedback.enabled).toBe(true);
      expect(handler.config.backoffMs).toBe(1000);
    });

    test('should allow configuration override', () => {
      const handler = new RetryHandler({
        maxAttempts: 5,
        backoffMs: 2000,
        errorFeedback: { enabled: false }
      });

      expect(handler.config.maxAttempts).toBe(5);
      expect(handler.config.backoffMs).toBe(2000);
      expect(handler.config.errorFeedback.enabled).toBe(false);
    });

    test('should generate error feedback correctly', () => {
      const handler = new RetryHandler();
      const errors = [
        { message: 'Invalid score value', suggestion: 'Use values between 0-10' },
        { message: 'Missing required field' }
      ];
      const originalPrompt = 'Analyze this data';

      const feedback = handler.generateErrorFeedback(errors, originalPrompt);
      
      expect(feedback).toContain('PREVIOUS RESPONSE HAD VALIDATION ERRORS');
      expect(feedback).toContain('Invalid score value');
      expect(feedback).toContain('Use values between 0-10');
      expect(feedback).toContain('ORIGINAL REQUEST');
      expect(feedback).toContain('Analyze this data');
      expect(feedback).toContain('PLEASE PROVIDE CORRECTED RESPONSE');
    });

    test('should execute retry logic successfully', async () => {
      const handler = new RetryHandler({ maxAttempts: 2 });
      let attemptCount = 0;

      const mockFunction = async (attempt) => {
        attemptCount++;
        if (attempt === 1) {
          return { success: false, errors: [{ message: 'First attempt failed' }] };
        }
        return { success: true, data: { result: 'success' } };
      };

      const result = await handler.executeWithRetry(mockFunction);

      expect(result.success).toBe(true);
      expect(result.data.result).toBe('success');
      expect(result.metadata.attempts).toBe(2);
      expect(attemptCount).toBe(2);
    });

    test('should handle exhausted retries', async () => {
      const handler = new RetryHandler({ maxAttempts: 2 });

      const mockFunction = async () => {
        return { success: false, errors: [{ message: 'Always fails' }] };
      };

      const result = await handler.executeWithRetry(mockFunction);

      expect(result.success).toBe(false);
      expect(result.stage).toBe('retry_exhausted');
      expect(result.totalAttempts).toBe(2);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate retry configuration', () => {
      const handler = new RetryHandler({ maxAttempts: 0 });
      
      expect(() => handler.validateConfiguration()).toThrow('maxAttempts must be at least 1');
    });

    test('should update configuration', () => {
      const handler = new RetryHandler();
      
      handler.updateConfiguration({ maxAttempts: 10 });
      expect(handler.config.maxAttempts).toBe(10);
    });

    test('should reset retry state', () => {
      const handler = new RetryHandler();
      handler.attemptHistory = [{ attempt: 1, errors: [] }];
      
      handler.reset();
      expect(handler.attemptHistory).toHaveLength(0);
    });
  });

  describe('Integration Patterns', () => {
    test('should support async function execution with context', async () => {
      const handler = new RetryHandler();
      let contextValue = 'initial';

      const mockFunction = async (attempt, lastError) => {
        if (attempt === 1) {
          contextValue = 'modified';
          return { success: false, errors: [{ message: 'Context test' }] };
        }
        
        expect(lastError).toBeDefined();
        expect(lastError.errors[0].message).toBe('Context test');
        return { success: true, data: { context: contextValue } };
      };

      const result = await handler.executeWithRetry(mockFunction);
      
      expect(result.success).toBe(true);
      expect(result.data.context).toBe('modified');
    });
  });
});