/**
 * Tests for Comprehensive Error Handling
 * 
 * Tests error recovery, resilient operations, error reporting,
 * and graceful degradation across the Aiur system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ErrorHandler } from '../../../src/errors/ErrorHandler.js';
import { ResilientOperations } from '../../../src/errors/ResilientOperations.js';
import { ErrorReportingSystem } from '../../../src/errors/ErrorReportingSystem.js';
import { AiurError, ValidationError, ExecutionError, NetworkError } from '../../../src/errors/AiurErrors.js';

describe('Comprehensive Error Handling', () => {
  let errorHandler;
  let resilientOps;
  let errorReporting;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      maxRetries: 3,
      backoffFactor: 2,
      timeout: 5000
    });
    
    resilientOps = new ResilientOperations(errorHandler);
    errorReporting = new ErrorReportingSystem({
      enableTelemetry: true,
      reportingThreshold: 'warning',
      healthCheckInterval: 0 // Disable health check timer in tests
    });
  });

  afterEach(() => {
    if (errorReporting && errorReporting.destroy) {
      errorReporting.destroy();
    }
  });

  describe('Error Classification', () => {
    test('should classify different error types correctly', () => {
      const validationError = new ValidationError('Invalid input');
      const executionError = new ExecutionError('Tool failed');
      const networkError = new NetworkError('Connection failed');
      
      expect(errorHandler.classifyError(validationError)).toBe('validation');
      expect(errorHandler.classifyError(executionError)).toBe('execution');
      expect(errorHandler.classifyError(networkError)).toBe('network');
      expect(errorHandler.classifyError(new Error('Unknown'))).toBe('unknown');
    });

    test('should determine if error is recoverable', () => {
      const networkError = new NetworkError('Timeout');
      const validationError = new ValidationError('Bad schema');
      
      expect(errorHandler.isRecoverable(networkError)).toBe(true);
      expect(errorHandler.isRecoverable(validationError)).toBe(false);
    });

    test('should calculate retry delay with exponential backoff', () => {
      expect(errorHandler.calculateRetryDelay(1)).toBe(1000);
      expect(errorHandler.calculateRetryDelay(2)).toBe(2000);
      expect(errorHandler.calculateRetryDelay(3)).toBe(4000);
      expect(errorHandler.calculateRetryDelay(4)).toBe(8000);
    });
  });

  describe('Retry Mechanisms', () => {
    test('should retry recoverable operations', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Temporary failure');
        }
        return 'success';
      });

      const result = await errorHandler.withRetry(operation);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-recoverable errors', async () => {
      const operation = jest.fn(async () => {
        throw new ValidationError('Invalid input');
      });

      await expect(errorHandler.withRetry(operation)).rejects.toThrow('Invalid input');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should respect max retry limit', async () => {
      const operation = jest.fn(async () => {
        throw new NetworkError('Always fails');
      });

      await expect(errorHandler.withRetry(operation)).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should apply jitter to retry delays', () => {
      const delay1 = errorHandler.calculateRetryDelay(1, true);
      const delay2 = errorHandler.calculateRetryDelay(1, true);
      
      // With jitter, delays should be different
      expect(delay1).not.toBe(delay2);
      expect(delay1).toBeGreaterThanOrEqual(500);
      expect(delay1).toBeLessThanOrEqual(1500);
    });
  });

  describe('Circuit Breaker', () => {
    test('should open circuit after failure threshold', async () => {
      const operation = jest.fn(async () => {
        throw new NetworkError('Service unavailable');
      });

      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.withCircuitBreaker('test-service', operation);
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should now be open
      expect(errorHandler.isCircuitOpen('test-service')).toBe(true);
      
      // Next call should fail fast
      const start = Date.now();
      await expect(
        errorHandler.withCircuitBreaker('test-service', operation)
      ).rejects.toThrow('Circuit breaker is open');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(100); // Should fail fast
    });

    test('should reset circuit after timeout', async () => {
      const operation = jest.fn(async () => 'success');
      
      // Force circuit open with timeout that has passed
      errorHandler._circuits.set('test-service', {
        state: 'open',
        failureCount: 10,
        successCount: 0,
        totalRequests: 10,
        lastFailureTime: Date.now() - 65000 // 65 seconds ago (more than 60s timeout)
      });

      // Should reset to half-open and succeed
      const result = await errorHandler.withCircuitBreaker('test-service', operation);
      
      expect(result).toBe('success');
      expect(errorHandler._circuits.get('test-service').state).toBe('closed');
    });

    test('should track circuit breaker metrics', async () => {
      const operation = jest.fn(async () => {
        throw new NetworkError('Fail');
      });

      try {
        await errorHandler.withCircuitBreaker('metrics-test', operation);
      } catch (e) {
        // Expected
      }

      const metrics = errorHandler.getCircuitBreakerMetrics('metrics-test');
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.successCount).toBe(0);
    });
  });

  describe('Graceful Degradation', () => {
    test('should provide fallback when primary operation fails', async () => {
      const primaryOp = async () => {
        throw new NetworkError('Primary service down');
      };
      
      const fallbackOp = async () => 'fallback result';
      
      const result = await resilientOps.withFallback(primaryOp, fallbackOp);
      
      expect(result).toBe('fallback result');
    });

    test('should return partial results on partial failure', async () => {
      const operations = [
        async () => 'result1',
        async () => { throw new Error('fail'); },
        async () => 'result3'
      ];

      const result = await resilientOps.executePartial(operations);
      
      expect(result.successes).toEqual(['result1', 'result3']);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].index).toBe(1);
    });

    test('should degrade service quality when under stress', () => {
      resilientOps.setStressLevel('high');
      
      const config = resilientOps.getDegradedConfig();
      
      expect(config.timeout).toBeLessThan(5000);
      expect(config.maxConcurrency).toBeLessThan(10);
      expect(config.skipNonEssential).toBe(true);
    });
  });

  describe('Error Aggregation', () => {
    test('should aggregate multiple errors', () => {
      const errors = [
        new ValidationError('Field A invalid'),
        new ValidationError('Field B invalid'),
        new ExecutionError('Tool failed')
      ];

      const aggregated = errorHandler.aggregateErrors(errors);
      
      expect(aggregated).toBeInstanceOf(AiurError);
      expect(aggregated.message).toContain('Multiple errors occurred');
      expect(aggregated.details.errors).toHaveLength(3);
      expect(aggregated.details.errorTypes).toEqual(['validation', 'execution']);
    });

    test('should group errors by type', () => {
      const errors = [
        new ValidationError('Error 1'),
        new ValidationError('Error 2'),
        new NetworkError('Error 3')
      ];

      const grouped = errorHandler.groupErrorsByType(errors);
      
      expect(grouped.validation).toHaveLength(2);
      expect(grouped.network).toHaveLength(1);
    });
  });

  describe('Error Recovery Strategies', () => {
    test('should suggest appropriate recovery actions', () => {
      const networkError = new NetworkError('Connection timeout');
      const validationError = new ValidationError('Invalid schema');
      
      const networkRecovery = errorHandler.suggestRecovery(networkError);
      const validationRecovery = errorHandler.suggestRecovery(validationError);
      
      expect(networkRecovery).toContain('retry operation');
      expect(networkRecovery).toContain('check network connectivity');
      expect(validationRecovery).toContain('validate input data');
      expect(validationRecovery).toContain('fix data format');
    });

    test('should execute automated recovery', async () => {
      const mockTool = {
        name: 'test-tool',
        execute: jest.fn()
          .mockRejectedValueOnce(new NetworkError('Timeout'))
          .mockResolvedValueOnce('recovered')
      };

      const result = await resilientOps.executeWithRecovery(mockTool, {});
      
      expect(result.result).toBe('recovered');
      expect(result.recovered).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Reporting', () => {
    test('should format error reports', () => {
      const error = new ExecutionError('Tool execution failed', {
        tool: 'test-tool',
        step: 'validation'
      });

      const report = errorReporting.formatErrorReport(error);
      
      expect(report).toMatchObject({
        type: 'execution',
        message: 'Tool execution failed',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          tool: 'test-tool',
          step: 'validation'
        }),
        severity: 'error',
        stack: expect.any(String)
      });
    });

    test('should track error frequencies', () => {
      errorReporting.recordError(new ValidationError('Error A'));
      errorReporting.recordError(new ValidationError('Error B'));
      errorReporting.recordError(new NetworkError('Error C'));

      const stats = errorReporting.getErrorStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.byType.validation).toBe(2);
      expect(stats.byType.network).toBe(1);
      expect(stats.mostCommon[0].type).toBe('validation');
    });

    test('should generate health reports', async () => {
      // Simulate some errors
      errorReporting.recordError(new NetworkError('Network issue'));
      errorReporting.recordError(new ExecutionError('Execution issue'));

      const healthReport = await errorReporting.generateHealthReport();
      
      expect(healthReport).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        errorRate: expect.any(Number),
        criticalErrors: expect.any(Number),
        recommendations: expect.any(Array),
        timestamp: expect.any(Date)
      });
    });

    test('should send alerts for critical errors', async () => {
      const alertSpy = jest.fn();
      errorReporting.onAlert(alertSpy);

      const criticalError = new ExecutionError('Critical system failure', {
        severity: 'critical'
      });

      await errorReporting.reportError(criticalError);
      
      expect(alertSpy).toHaveBeenCalledWith({
        level: 'critical',
        error: expect.objectContaining({
          message: 'Critical system failure',
          type: 'execution',
          severity: 'critical'
        }),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Context-Aware Error Handling', () => {
    test('should provide context-specific error messages', () => {
      const context = {
        operation: 'tool-execution',
        tool: 'file-reader',
        step: 'validation'
      };

      // Create a regular Error instead of ValidationError to test the wrapping logic
      const error = new Error('File not found');
      const contextualError = errorHandler.addContext(error, context);
      
      expect(contextualError.message).toContain('file-reader');
      expect(contextualError.message).toContain('validation');
      expect(contextualError.context).toEqual(context);
    });

    test('should adapt handling based on execution context', async () => {
      const strictContext = { mode: 'strict', allowPartialFailure: false };
      const lenientContext = { mode: 'lenient', allowPartialFailure: true };

      const failingOp = async () => {
        throw new ValidationError('Minor validation issue');
      };

      // Strict mode should throw
      await expect(
        resilientOps.executeWithContext(failingOp, strictContext)
      ).rejects.toThrow();

      // Lenient mode should return error info
      const result = await resilientOps.executeWithContext(failingOp, lenientContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.gracefullyHandled).toBe(true);
    });
  });

  describe('Error Prevention', () => {
    test('should validate inputs before execution', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        }
      };

      const validInput = { name: 'John', age: 25 };
      const invalidInput = { name: 'John' }; // missing age

      expect(errorHandler.validateInput(validInput, schema)).toBe(true);
      expect(() => errorHandler.validateInput(invalidInput, schema)).toThrow(ValidationError);
    });

    test('should detect potential issues early', () => {
      const config = {
        timeout: -1, // Invalid
        retries: 'invalid', // Wrong type
        maxMemory: 1024 * 1024 * 1024 * 10 // Too high
      };

      const issues = errorHandler.detectConfigurationIssues(config);
      
      expect(issues).toHaveLength(3);
      expect(issues[0].type).toBe('invalid-value');
      expect(issues[1].type).toBe('type-mismatch');
      expect(issues[2].type).toBe('resource-limit');
    });

    test('should provide configuration recommendations', () => {
      const currentConfig = {
        timeout: 1000,
        retries: 1,
        circuitBreakerThreshold: 10
      };

      const recommendations = errorHandler.getConfigurationRecommendations(currentConfig);
      
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          setting: 'timeout',
          current: 1000,
          suggested: expect.any(Number),
          reason: expect.any(String)
        })
      );
    });
  });

  describe('Error Recovery Workflows', () => {
    test('should execute multi-step recovery procedures', async () => {
      const recoverySteps = [
        async () => ({ action: 'clear-cache', success: true }),
        async () => ({ action: 'reset-connections', success: true }),
        async () => ({ action: 'reload-config', success: true })
      ];

      const result = await resilientOps.executeRecoveryWorkflow(recoverySteps);
      
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);
      expect(result.steps.every(step => step.success)).toBe(true);
    });

    test('should stop recovery on critical step failure', async () => {
      const recoverySteps = [
        async () => ({ action: 'step1', success: true }),
        async () => ({ action: 'step2', success: false, critical: true }),
        async () => ({ action: 'step3', success: true })
      ];

      const result = await resilientOps.executeRecoveryWorkflow(recoverySteps);
      
      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2); // Should stop after critical failure
      expect(result.failedAt).toBe('step2');
    });
  });

  describe('Performance Under Error Conditions', () => {
    test('should maintain performance during high error rates', async () => {
      const operations = Array(100).fill(null).map((_, i) => 
        async () => {
          if (i % 3 === 0) throw new NetworkError('Simulated failure');
          return `result-${i}`;
        }
      );

      const startTime = Date.now();
      const results = await resilientOps.executeConcurrent(operations, {
        maxConcurrency: 10,
        failFast: false
      });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(2000); // Should complete quickly
      expect(results.successes.length).toBeGreaterThan(60);
      expect(results.failures.length).toBeGreaterThan(30);
    });

    test('should implement backpressure under load', () => {
      // Simulate high load
      for (let i = 0; i < 1000; i++) {
        resilientOps.trackRequest();
      }

      const shouldThrottle = resilientOps.shouldApplyBackpressure();
      const throttleConfig = resilientOps.getBackpressureConfig();
      
      expect(shouldThrottle).toBe(true);
      expect(throttleConfig.delay).toBeGreaterThan(0);
      expect(throttleConfig.maxConcurrency).toBeLessThan(10);
    });
  });

  describe('Integration with Monitoring', () => {
    test('should emit error metrics', () => {
      const metricsCollector = [];
      errorReporting.onMetric((metric) => metricsCollector.push(metric));

      const error = new ExecutionError('Test error');
      errorReporting.recordError(error);

      expect(metricsCollector).toContainEqual(
        expect.objectContaining({
          name: 'error.count',
          value: 1,
          tags: { type: 'execution', severity: 'error' }
        })
      );
    });

    test('should integrate with external monitoring systems', async () => {
      const externalReporter = jest.fn();
      errorReporting.addExternalReporter(externalReporter);

      const error = new NetworkError('Network failure');
      await errorReporting.reportError(error);

      expect(externalReporter).toHaveBeenCalledWith(
        expect.objectContaining({
          error: error,
          formatted: expect.any(Object),
          severity: 'error'
        })
      );
    });
  });
});