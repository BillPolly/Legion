import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
/**
 * @jest-environment jsdom
 */

import { RateLimiter } from '../../../src/error/RateLimiter.js';

describe('Rate Limiting and Throttling', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      defaultLimit: 10,
      defaultWindow: 1000, // 1 second
      burstLimit: 20,
      enableBurst: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const key = 'test-command';
      
      // Should allow first 10 requests
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(key);
        expect(result).toEqual({
          allowed: true,
          limit: 10,
          remaining: 9 - i,
          resetTime: expect.any(Number),
          retryAfter: null
        });
      }
    });

    test('should block requests when rate limit exceeded', async () => {
      const key = 'test-command';
      
      // Consume all allowed requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Next request should be blocked
      const result = await rateLimiter.checkLimit(key);
      expect(result).toEqual({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetTime: expect.any(Number),
        retryAfter: expect.any(Number)
      });
    });

    test('should reset limit after time window', async () => {
      jest.useFakeTimers();
      const key = 'test-command';
      
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Should be blocked
      let result = await rateLimiter.checkLimit(key);
      expect(result.allowed).toBe(false);
      
      // Advance time past window
      jest.advanceTimersByTime(1100);
      
      // Should be allowed again
      result = await rateLimiter.checkLimit(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should handle different keys independently', async () => {
      const key1 = 'command-1';
      const key2 = 'command-2';
      
      // Consume all requests for key1
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key1);
      }
      
      // key1 should be blocked
      const result1 = await rateLimiter.checkLimit(key1);
      expect(result1.allowed).toBe(false);
      
      // key2 should still be allowed
      const result2 = await rateLimiter.checkLimit(key2);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Burst Handling', () => {
    test('should allow burst requests when enabled', async () => {
      const key = 'burst-test';
      
      // Consume normal limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Should allow burst requests up to burst limit
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(key, { allowBurst: true });
        expect(result.allowed).toBe(true);
        expect(result.burst).toBe(true);
      }
      
      // Should block after burst limit
      const result = await rateLimiter.checkLimit(key, { allowBurst: true });
      expect(result.allowed).toBe(false);
    });

    test('should track burst usage separately', async () => {
      const key = 'burst-test';
      
      // Use normal requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Use burst requests
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkLimit(key, { allowBurst: true });
      }
      
      const stats = rateLimiter.getStats(key);
      expect(stats).toEqual({
        normalUsage: 8,
        burstUsage: 0,
        totalUsage: 8,
        normalRemaining: 2,
        burstRemaining: 12,
        resetTime: expect.any(Number)
      });
    });

    test('should disable burst when configured', async () => {
      const limiter = new RateLimiter({
        defaultLimit: 5,
        defaultWindow: 1000,
        enableBurst: false
      });
      
      const key = 'no-burst-test';
      
      // Consume normal limit
      for (let i = 0; i < 5; i++) {
        await limiter.checkLimit(key);
      }
      
      // Burst should not be allowed
      const result = await limiter.checkLimit(key, { allowBurst: true });
      expect(result.allowed).toBe(false);
      expect(result.burst).toBeUndefined();
    });
  });

  describe('Custom Limits', () => {
    test('should use custom limit for specific keys', async () => {
      rateLimiter.setCustomLimit('high-priority', {
        limit: 50,
        window: 1000
      });
      
      const key = 'high-priority';
      
      // Should allow 50 requests instead of default 10
      for (let i = 0; i < 50; i++) {
        const result = await rateLimiter.checkLimit(key);
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(50);
      }
      
      // 51st request should be blocked
      const result = await rateLimiter.checkLimit(key);
      expect(result.allowed).toBe(false);
    });

    test('should handle per-command rate limits', async () => {
      rateLimiter.setCommandLimits({
        'inspect_element': { limit: 100, window: 1000 },
        'analyze_performance': { limit: 5, window: 5000 },
        'audit_accessibility': { limit: 3, window: 10000 }
      });
      
      // High limit command
      for (let i = 0; i < 100; i++) {
        const result = await rateLimiter.checkLimit('inspect_element');
        expect(result.allowed).toBe(true);
      }
      
      // Low limit command
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit('analyze_performance');
        expect(result.allowed).toBe(true);
      }
      
      const result = await rateLimiter.checkLimit('analyze_performance');
      expect(result.allowed).toBe(false);
    });

    test('should use default limits for unknown commands', async () => {
      const result = await rateLimiter.checkLimit('unknown_command');
      expect(result.limit).toBe(10); // Default limit
    });
  });

  describe('Throttling', () => {
    test('should implement request throttling', async () => {
      const throttler = rateLimiter.createThrottler('throttle-test', {
        maxConcurrent: 3,
        queueSize: 10
      });
      
      const results = [];
      const promises = [];
      
      // Create 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          throttler.execute(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return `result-${i}`;
          })
        );
      }
      
      const allResults = await Promise.all(promises);
      expect(allResults).toHaveLength(5);
      expect(allResults).toEqual(expect.arrayContaining([
        'result-0', 'result-1', 'result-2', 'result-3', 'result-4'
      ]));
    });

    test('should reject requests when queue is full', async () => {
      const throttler = rateLimiter.createThrottler('queue-test', {
        maxConcurrent: 1,
        queueSize: 2
      });
      
      const longRunningTask = () => new Promise(resolve => 
        setTimeout(() => resolve('done'), 200)
      );
      
      // Start one request (will be executing)
      const promise1 = throttler.execute(longRunningTask);
      
      // Add two to queue (will fill queue)
      const promise2 = throttler.execute(longRunningTask);
      const promise3 = throttler.execute(longRunningTask);
      
      // Fourth request should be rejected
      await expect(throttler.execute(longRunningTask)).rejects.toThrow('Queue full');
      
      // Cleanup
      await Promise.all([promise1, promise2, promise3]);
    });

    test('should provide throttling statistics', async () => {
      const throttler = rateLimiter.createThrottler('stats-test', {
        maxConcurrent: 2,
        queueSize: 5
      });
      
      // Add some requests
      const promises = [];
      for (let i = 0; i < 4; i++) {
        promises.push(throttler.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return i;
        }));
      }
      
      const stats = throttler.getStats();
      expect(stats).toEqual({
        executing: expect.any(Number),
        queued: expect.any(Number),
        completed: expect.any(Number),
        rejected: expect.any(Number),
        maxConcurrent: 2,
        queueSize: 5
      });
      
      await Promise.all(promises);
    });
  });

  describe('Rate Limit Violations', () => {
    test('should track rate limit violations', async () => {
      const key = 'violation-test';
      
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Generate violations
      await rateLimiter.checkLimit(key);
      await rateLimiter.checkLimit(key);
      
      const violations = rateLimiter.getViolations(key);
      expect(violations).toEqual({
        count: 2,
        firstViolation: expect.any(Number),
        lastViolation: expect.any(Number),
        pattern: 'normal'
      });
    });

    test('should detect violation patterns', async () => {
      const key = 'pattern-test';
      
      // Generate rapid violations
      for (let i = 0; i < 15; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      const violations = rateLimiter.getViolations(key);
      expect(violations.pattern).toBe('burst');
      expect(violations.count).toBe(5); // 15 - 10 allowed
    });

    test('should implement violation penalties', async () => {
      rateLimiter.enablePenalties({
        escalation: true,
        maxPenalty: 5000,
        penaltyMultiplier: 2
      });
      
      const key = 'penalty-test';
      
      // Consume normal requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Generate violations
      const violation1 = await rateLimiter.checkLimit(key);
      expect(violation1.penaltyTime).toBeGreaterThan(0);
      
      const violation2 = await rateLimiter.checkLimit(key);
      expect(violation2.penaltyTime).toBeGreaterThan(violation1.penaltyTime);
    });
  });

  describe('Error Responses', () => {
    test('should generate appropriate error responses', async () => {
      const key = 'error-test';
      
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      const error = rateLimiter.generateRateLimitError(key);
      expect(error).toEqual({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('Rate limit'),
        retryAfter: expect.any(Number),
        limit: 10,
        window: 1000
      });
    });

    test('should generate user-friendly messages', async () => {
      const key = 'message-test';
      
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      const message = rateLimiter.getUserMessage(key);
      expect(message).toEqual({
        title: 'Rate Limit Reached',
        message: expect.stringContaining('requests per 1 second'),
        severity: 'warning',
        actions: expect.arrayContaining([
          expect.objectContaining({ 
            label: 'Wait and Retry',
            action: 'wait'
          })
        ])
      });
    });
  });

  describe('Configuration and Management', () => {
    test('should accept custom configuration', () => {
      const customLimiter = new RateLimiter({
        defaultLimit: 50,
        defaultWindow: 5000,
        burstLimit: 100,
        enableBurst: false,
        enablePenalties: true,
        storageType: 'memory'
      });
      
      expect(customLimiter.config).toEqual(expect.objectContaining({
        defaultLimit: 50,
        defaultWindow: 5000,
        burstLimit: 100,
        enableBurst: false,
        enablePenalties: true
      }));
    });

    test('should validate configuration parameters', () => {
      expect(() => {
        new RateLimiter({
          defaultLimit: -1
        });
      }).toThrow('Invalid configuration: defaultLimit must be > 0');
      
      expect(() => {
        new RateLimiter({
          defaultWindow: 0
        });
      }).toThrow('Invalid configuration: defaultWindow must be > 0');
    });

    test('should provide rate limiting statistics', async () => {
      const keys = ['test1', 'test2', 'test3'];
      
      // Generate some activity
      for (const key of keys) {
        for (let i = 0; i < 5; i++) {
          await rateLimiter.checkLimit(key);
        }
      }
      
      const stats = rateLimiter.getGlobalStats();
      expect(stats).toEqual({
        totalRequests: 15,
        totalKeys: 3,
        violatedKeys: 0,
        averageUsage: 5,
        topKeys: expect.arrayContaining([
          expect.objectContaining({
            key: expect.any(String),
            requests: 5
          })
        ])
      });
    });

    test('should support rate limit monitoring', async () => {
      const monitor = jest.fn();
      rateLimiter.onRateLimit(monitor);
      
      const key = 'monitor-test';
      
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkLimit(key);
      }
      
      // Generate violation
      await rateLimiter.checkLimit(key);
      
      expect(monitor).toHaveBeenCalledWith({
        key,
        limit: 10,
        usage: 11,
        violation: true,
        timestamp: expect.any(Number)
      });
    });

    test('should cleanup expired entries', async () => {
      jest.useFakeTimers();
      
      const key = 'cleanup-test';
      await rateLimiter.checkLimit(key);
      
      // Advance time past cleanup threshold
      jest.advanceTimersByTime(60000); // 1 minute
      
      rateLimiter.cleanup();
      
      const stats = rateLimiter.getStats(key);
      expect(stats).toEqual({
        normalUsage: 0,
        burstUsage: 0,
        totalUsage: 0,
        normalRemaining: 10,
        burstRemaining: 20,
        resetTime: expect.any(Number)
      });
    });
  });
});