import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RetryManager } from '../../../src/core/retry/RetryManager.js';

describe('RetryManager', () => {
  let retryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 10,
      jitterMax: 0,
      logger: null
    });
  });

  it('calculates exponential backoff delay with jitter', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const firstDelay = retryManager.calculateDelay(1, 100, 2);
    const secondDelay = retryManager.calculateDelay(2, 100, 2);

    expect(firstDelay).toBeGreaterThanOrEqual(100);
    expect(secondDelay).toBeGreaterThan(firstDelay);

    Math.random.mockRestore();
  });

  it('identifies non-retryable errors', () => {
    const error = new Error('Authentication failed: invalid key');
    const shouldRetry = retryManager.shouldRetry(error, 1, 'auth_error');
    expect(shouldRetry).toBe(false);
  });

  it('retries operation until it succeeds within max attempts', async () => {
    let attemptCount = 0;
    const operation = jest.fn(async () => {
      attemptCount += 1;
      if (attemptCount < 2) {
        throw new Error('Transient failure');
      }
      return 'success';
    });

    const result = await retryManager.retry(operation, {
      operationId: 'test-operation'
    });

    expect(result).toBe('success');
    expect(attemptCount).toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
