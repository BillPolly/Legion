import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  defer, 
  delay, 
  createDeferred, 
  withTimeout, 
  retry 
} from '../../../src/utils/async.js';

describe('Async Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('defer', () => {
    it('should defer callback execution', async () => {
      jest.useRealTimers(); // Need real timers for microtasks
      const callback = jest.fn();
      const args = [1, 2, 3];
      
      defer(callback, ...args);
      
      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled();
      
      // Wait for next tick
      await Promise.resolve();
      
      expect(callback).toHaveBeenCalledWith(1, 2, 3);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should execute in order', async () => {
      jest.useRealTimers();
      const results = [];
      
      defer(() => results.push(1));
      defer(() => results.push(2));
      defer(() => results.push(3));
      
      expect(results).toEqual([]);
      
      await Promise.resolve();
      
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const promise = delay(1000);
      
      // Should be pending
      let resolved = false;
      promise.then(() => { resolved = true; });
      
      await Promise.resolve();
      expect(resolved).toBe(false);
      
      // Fast-forward time
      jest.advanceTimersByTime(999);
      await Promise.resolve();
      expect(resolved).toBe(false);
      
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await promise;
      expect(resolved).toBe(true);
    });

    it('should resolve with provided value', async () => {
      const value = { test: 'data' };
      const promise = delay(100, value);
      
      jest.advanceTimersByTime(100);
      const result = await promise;
      
      expect(result).toBe(value);
    });

    it('should handle zero delay', async () => {
      jest.useRealTimers();
      const promise = delay(0, 'immediate');
      const result = await promise;
      expect(result).toBe('immediate');
    });
  });

  describe('createDeferred', () => {
    it('should create a deferred promise', () => {
      const deferred = createDeferred();
      
      expect(deferred.promise).toBeInstanceOf(Promise);
      expect(typeof deferred.resolve).toBe('function');
      expect(typeof deferred.reject).toBe('function');
    });

    it('should resolve the promise', async () => {
      const deferred = createDeferred();
      const value = { result: 'success' };
      
      deferred.resolve(value);
      const result = await deferred.promise;
      
      expect(result).toBe(value);
    });

    it('should reject the promise', async () => {
      const deferred = createDeferred();
      const error = new Error('Test error');
      
      deferred.reject(error);
      
      await expect(deferred.promise).rejects.toThrow('Test error');
    });

    it('should handle multiple resolutions (only first counts)', async () => {
      const deferred = createDeferred();
      
      deferred.resolve('first');
      deferred.resolve('second');
      
      const result = await deferred.promise;
      expect(result).toBe('first');
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      jest.useRealTimers();
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      
      expect(result).toBe('success');
    });

    it('should reject if promise takes too long', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const neverResolves = new Promise(() => {});
      const timeoutMs = 10;
      
      await expect(withTimeout(neverResolves, timeoutMs)).rejects.toThrow(`Operation timed out after ${timeoutMs}ms`);
    });

    it('should provide custom timeout message', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const neverResolves = new Promise(() => {});
      
      await expect(withTimeout(neverResolves, 10, 'Custom timeout')).rejects.toThrow('Custom timeout');
    });

    it('should preserve original rejection', async () => {
      jest.useRealTimers();
      const error = new Error('Original error');
      const promise = Promise.reject(error);
      
      await expect(withTimeout(promise, 1000)).rejects.toThrow('Original error');
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      jest.useRealTimers();
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      jest.useRealTimers();
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockRejectedValueOnce(new Error('Second fail'))
        .mockResolvedValue('success');
      
      const result = await retry(fn, { maxAttempts: 3 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      jest.useRealTimers();
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retry(fn, { maxAttempts: 2 })).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should delay between retries', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const promise = retry(fn, { maxAttempts: 2, delay: 100 });
      
      // First attempt fails immediately
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Should wait 100ms before retry
      jest.advanceTimersByTime(99);
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(2);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should use exponential backoff', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      const result = await retry(fn, { 
        maxAttempts: 3, 
        delay: 10, // Use short delay for testing
        backoff: true 
      });
      const endTime = Date.now();
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      
      // Should take at least 10ms (first retry) + 20ms (second retry) = 30ms
      // But less than 100ms to be safe
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(25); // Allow some tolerance
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle synchronous functions', async () => {
      jest.useRealTimers();
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not yet');
        }
        return 'success';
      };
      
      const result = await retry(fn, { maxAttempts: 3, delay: 0 });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });
});