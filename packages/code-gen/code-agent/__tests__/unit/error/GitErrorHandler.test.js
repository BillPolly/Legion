/**
 * GitErrorHandler Unit Tests
 * Phase 7.1: Error classification and handling system tests
 * 
 * Tests comprehensive Git error classification, recovery strategies,
 * and automated error handling capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitErrorHandler from '../../../src/error/GitErrorHandler.js';

describe('GitErrorHandler', () => {
  let errorHandler;

  beforeEach(async () => {
    errorHandler = new GitErrorHandler({
      enableAutoRecovery: true,
      maxRetryAttempts: 3,
      retryDelayMs: 100,
      enableLogging: false,
      enableMetrics: true
    });
    await errorHandler.initialize();
  });

  afterEach(async () => {
    if (errorHandler) {
      await errorHandler.cleanup();
    }
  });

  describe('Error Classification', () => {
    test('should classify authentication errors', () => {
      const authErrors = [
        new Error('authentication failed'),
        new Error('invalid credentials'),
        new Error('permission denied'),
        new Error('403 forbidden access'),
        new Error('401 unauthorized request')
      ];

      authErrors.forEach(error => {
        const classification = errorHandler.classifyError(error);
        expect(classification.classification).toBe('authentication');
        expect(classification.severity).toBe('high');
        expect(classification.recoverable).toBe(true);
        expect(classification.strategy).toBeDefined();
      });
    });

    test('should classify network errors', () => {
      const networkErrors = [
        new Error('network unreachable'),
        new Error('connection timed out'),
        new Error('ENOTFOUND github.com'),
        new Error('ECONNREFUSED connection refused'),
        new Error('socket error occurred')
      ];

      networkErrors.forEach(error => {
        const classification = errorHandler.classifyError(error);
        expect(classification.classification).toBe('network');
        expect(classification.severity).toBe('medium');
        expect(classification.recoverable).toBe(true);
      });
    });

    test('should classify conflict errors', () => {
      const conflictErrors = [
        new Error('merge conflict in file.txt'),
        new Error('automatic merge failed'),
        new Error('both modified: package.json'),
        new Error('unmerged paths detected')
      ];

      conflictErrors.forEach(error => {
        const classification = errorHandler.classifyError(error);
        expect(classification.classification).toBe('conflict');
        expect(classification.severity).toBe('medium');
        expect(classification.recoverable).toBe(true);
      });
    });

    test('should classify repository errors', () => {
      const repoErrors = [
        new Error('not a git repository'),
        new Error('repository not found'),
        new Error('fatal: not git repository'),
        new Error('repository corrupted')
      ];

      repoErrors.forEach(error => {
        const classification = errorHandler.classifyError(error);
        expect(classification.classification).toBe('repository');
        expect(classification.severity).toBe('high');
        expect(classification.recoverable).toBe(true);
      });
    });

    test('should classify rate limit errors', () => {
      const rateLimitErrors = [
        new Error('rate limit exceeded'),
        new Error('api rate limit hit'),
        new Error('403 rate limit'),
        new Error('secondary rate limit triggered')
      ];

      rateLimitErrors.forEach(error => {
        const classification = errorHandler.classifyError(error);
        expect(classification.classification).toBe('rateLimit');
        expect(classification.severity).toBe('low');
        expect(classification.recoverable).toBe(true);
      });
    });

    test('should handle unknown errors', () => {
      const unknownError = new Error('some completely unknown error message');
      const classification = errorHandler.classifyError(unknownError);
      
      expect(classification.classification).toBe('unknown');
      expect(classification.severity).toBe('unknown');
      expect(classification.recoverable).toBe(false);
      expect(classification.strategy).toBeNull();
    });

    test('should include context in classification', () => {
      const error = new Error('authentication failed');
      const context = { operation: 'push', repository: 'test-repo' };
      
      const classification = errorHandler.classifyError(error, context);
      expect(classification.context).toEqual(context);
      expect(classification.originalError).toBe(error);
      expect(classification.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle error with auto recovery enabled', async () => {
      const error = new Error('network unreachable');
      const context = {
        retryOperation: jest.fn().mockResolvedValue(true),
        testConnectivity: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.handleError(error, context);
      
      expect(result.success).toBe(true);
      expect(result.recovery.success).toBe(true);
      expect(result.recovery.strategy).toBe('connectivity-restored');
      expect(context.testConnectivity).toHaveBeenCalled();
    });

    test('should handle error with auto recovery disabled', async () => {
      errorHandler.config.enableAutoRecovery = false;
      
      const error = new Error('authentication failed');
      const result = await errorHandler.handleError(error);
      
      expect(result.success).toBe(false);
      expect(result.recovery).toBe('disabled');
      expect(result.error.classification).toBe('authentication');
    });

    test('should emit error events during handling', async () => {
      const error = new Error('merge conflict detected');
      const events = [];
      
      errorHandler.on('error-classified', (data) => events.push({ type: 'classified', data }));
      errorHandler.on('recovery-start', (data) => events.push({ type: 'recovery-start', data }));
      errorHandler.on('recovery-complete', (data) => events.push({ type: 'recovery-complete', data }));

      const context = {
        autoMerge: jest.fn().mockResolvedValue({ success: true })
      };

      await errorHandler.handleError(error, context);
      
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].type).toBe('classified');
      expect(events[0].data.classification).toBe('conflict');
    });

    test('should record metrics during error handling', async () => {
      const error = new Error('authentication failed');
      const context = {
        refreshCredentials: jest.fn().mockResolvedValue(true)
      };

      await errorHandler.handleError(error, context);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.successfulRecoveries).toBe(1);
      expect(metrics.errorsByType.authentication.count).toBe(1);
      expect(metrics.errorsByType.authentication.recovered).toBe(1);
    });
  });

  describe('Authentication Recovery', () => {
    test('should recover with credential refresh', async () => {
      const errorInfo = {
        classification: 'authentication',
        message: 'authentication failed'
      };
      
      const context = {
        refreshCredentials: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverAuthentication(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('refresh-credentials');
      expect(result.action).toBe('credentials-refreshed');
      expect(context.refreshCredentials).toHaveBeenCalled();
    });

    test('should check permissions during recovery', async () => {
      const errorInfo = {
        classification: 'authentication',
        message: 'permission denied'
      };
      
      const context = {
        checkPermissions: jest.fn().mockResolvedValue(false)
      };

      const result = await errorHandler.recoverAuthentication(errorInfo, context);
      
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('check-permissions');
      expect(result.action).toBe('insufficient-permissions');
    });

    test('should try fallback authentication', async () => {
      const errorInfo = {
        classification: 'authentication',
        message: 'invalid credentials'
      };
      
      const context = {
        fallbackAuth: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverAuthentication(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('fallback-auth');
      expect(result.action).toBe('fallback-auth-used');
    });

    test('should fail when no recovery options work', async () => {
      const errorInfo = {
        classification: 'authentication',
        message: 'authentication failed'
      };
      
      const context = {}; // No recovery functions provided

      const result = await errorHandler.recoverAuthentication(errorInfo, context);
      
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('all-failed');
      expect(result.action).toBe('manual-intervention-required');
    });
  });

  describe('Network Recovery', () => {
    test('should retry with exponential backoff', async () => {
      const errorInfo = {
        classification: 'network',
        message: 'connection timed out'
      };
      
      let attempts = 0;
      const context = {
        retryOperation: jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts === 2) {
            return Promise.resolve(true);
          }
          throw new Error('Still failing');
        })
      };

      const result = await errorHandler.recoverNetwork(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('retry-with-backoff');
      expect(result.attempts).toBe(2);
      expect(context.retryOperation).toHaveBeenCalledTimes(2);
    });

    test('should test connectivity during recovery', async () => {
      const errorInfo = {
        classification: 'network',
        message: 'network unreachable'
      };
      
      const context = {
        testConnectivity: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverNetwork(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('connectivity-restored');
      expect(result.action).toBe('network-available');
    });

    test('should fail after max retry attempts', async () => {
      const errorInfo = {
        classification: 'network',
        message: 'connection refused'
      };
      
      const context = {
        retryOperation: jest.fn().mockRejectedValue(new Error('Still failing'))
      };

      const result = await errorHandler.recoverNetwork(errorInfo, context);
      
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('retry-exhausted');
      expect(result.attempts).toBe(3); // maxRetryAttempts
    });
  });

  describe('Conflict Recovery', () => {
    test('should auto-merge conflicts', async () => {
      const errorInfo = {
        classification: 'conflict',
        message: 'merge conflict detected'
      };
      
      const context = {
        autoMerge: jest.fn().mockResolvedValue({ success: true })
      };

      const result = await errorHandler.recoverConflict(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('auto-merge');
      expect(result.action).toBe('conflicts-auto-resolved');
    });

    test('should prefer ours strategy', async () => {
      const errorInfo = {
        classification: 'conflict',
        message: 'automatic merge failed'
      };
      
      const context = {
        preferOurs: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverConflict(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('prefer-ours');
      expect(result.action).toBe('conflicts-resolved-prefer-ours');
    });

    test('should use interactive resolve', async () => {
      const errorInfo = {
        classification: 'conflict',
        message: 'both modified: package.json'
      };
      
      const context = {
        interactiveResolve: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverConflict(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('interactive-resolve');
      expect(result.action).toBe('conflicts-manually-resolved');
    });
  });

  describe('Rate Limit Recovery', () => {
    test('should extract reset time from error message', () => {
      const messages = [
        'rate limit exceeded, reset in 3600 seconds',
        'api rate limit hit, try again in 30 minutes',
        'secondary rate limit, reset in 1 hour'
      ];

      const resetTimes = messages.map(msg => errorHandler.extractResetTime(msg));
      
      expect(resetTimes[0]).toBe(3600); // 3600 seconds
      expect(resetTimes[1]).toBe(1800); // 30 minutes = 1800 seconds
      expect(resetTimes[2]).toBe(3600); // 1 hour = 3600 seconds
    });

    test('should wait and retry after rate limit', async () => {
      const errorInfo = {
        classification: 'rateLimit',
        message: 'rate limit exceeded, reset in 1 seconds'
      };
      
      const context = {
        retryOperation: jest.fn().mockResolvedValue(true)
      };

      const startTime = Date.now();
      const result = await errorHandler.recoverRateLimit(errorInfo, context);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('wait-and-retry');
      expect(result.action).toBe('rate-limit-reset-operation-retried');
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // Waited at least 1 second
    });

    test('should emit rate limit event', async () => {
      const errorInfo = {
        classification: 'rateLimit',
        message: 'rate limit exceeded'
      };
      
      const events = [];
      errorHandler.on('rate-limit-hit', (data) => events.push(data));

      await errorHandler.recoverRateLimit(errorInfo, {});
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('resetTime');
      expect(events[0]).toHaveProperty('waitTime');
      expect(events[0]).toHaveProperty('timestamp');
    });
  });

  describe('Repository Recovery', () => {
    test('should reinitialize repository', async () => {
      const errorInfo = {
        classification: 'repository',
        message: 'not a git repository'
      };
      
      const context = {
        reinitializeRepository: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverRepository(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('reinitialize');
      expect(result.action).toBe('repository-reinitialized');
    });

    test('should repair repository', async () => {
      const errorInfo = {
        classification: 'repository',
        message: 'repository corrupted'
      };
      
      const context = {
        repairRepository: jest.fn().mockResolvedValue(true)
      };

      const result = await errorHandler.recoverRepository(errorInfo, context);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('repair');
      expect(result.action).toBe('repository-repaired');
    });
  });

  describe('Metrics and Statistics', () => {
    test('should track error metrics', async () => {
      // Generate various errors
      await errorHandler.handleError(new Error('authentication failed'));
      await errorHandler.handleError(new Error('network unreachable'));
      await errorHandler.handleError(new Error('merge conflict'));
      await errorHandler.handleError(new Error('unknown error type'));

      const metrics = errorHandler.getMetrics();
      
      expect(metrics.totalErrors).toBe(4);
      expect(metrics.errorsByType.authentication.count).toBe(1);
      expect(metrics.errorsByType.network.count).toBe(1);
      expect(metrics.errorsByType.conflict.count).toBe(1);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    test('should reset metrics', () => {
      // Generate some errors first
      errorHandler.recordError({ classification: 'network' });
      errorHandler.recordError({ classification: 'authentication' });
      
      let metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
      
      errorHandler.resetMetrics();
      metrics = errorHandler.getMetrics();
      
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.successfulRecoveries).toBe(0);
      expect(metrics.failedRecoveries).toBe(0);
    });

    test('should calculate success rate correctly', async () => {
      // Mock successful recovery
      const context = { refreshCredentials: jest.fn().mockResolvedValue(true) };
      await errorHandler.handleError(new Error('authentication failed'), context);
      
      // Mock failed recovery
      await errorHandler.handleError(new Error('unknown error'));
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.successRate).toBe(50); // 1 success out of 2 total
    });
  });

  describe('Utility Functions', () => {
    test('should implement sleep utility', async () => {
      const startTime = Date.now();
      await errorHandler.sleep(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('should cleanup resources', async () => {
      const spy = jest.spyOn(errorHandler, 'removeAllListeners');
      await errorHandler.cleanup();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Configuration Options', () => {
    test('should respect maxRetryAttempts configuration', async () => {
      const customHandler = new GitErrorHandler({ 
        maxRetryAttempts: 1,
        retryDelayMs: 10
      });
      await customHandler.initialize();

      const errorInfo = { classification: 'network', message: 'timeout' };
      const context = {
        retryOperation: jest.fn().mockRejectedValue(new Error('Still failing'))
      };

      const result = await customHandler.recoverNetwork(errorInfo, context);
      
      expect(result.attempts).toBe(1);
      expect(context.retryOperation).toHaveBeenCalledTimes(1);
      
      await customHandler.cleanup();
    });

    test('should respect retryDelayMs configuration', async () => {
      const customHandler = new GitErrorHandler({ 
        retryDelayMs: 50,
        maxRetryAttempts: 2
      });
      await customHandler.initialize();

      const errorInfo = { classification: 'network', message: 'timeout' };
      const context = {
        retryOperation: jest.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValueOnce(true)
      };

      const startTime = Date.now();
      const result = await customHandler.recoverNetwork(errorInfo, context);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
      
      await customHandler.cleanup();
    });
  });
});