/**
 * @jest-environment jsdom
 */

import { ErrorHandler } from '../../../src/error/ErrorHandler.js';

describe('Comprehensive Error Handling', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };

    errorHandler = new ErrorHandler({
      logger: mockLogger,
      enableRecovery: true,
      maxRetries: 3,
      retryDelay: 100
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Categorization', () => {
    test('should categorize WebSocket connection errors', () => {
      const error = new Error('WebSocket connection failed');
      error.code = 'CONNECTION_FAILED';

      const categorized = errorHandler.categorizeError(error, 'websocket');

      expect(categorized).toEqual({
        category: 'connection',
        type: 'websocket_connection_failed',
        severity: 'high',
        recoverable: true,
        retryable: true,
        userMessage: 'Connection lost. Attempting to reconnect...',
        technicalMessage: error.message,
        errorCode: 'CONNECTION_FAILED'
      });
    });

    test('should categorize agent execution errors', () => {
      const error = new Error('Agent execution timeout');
      error.code = 'EXECUTION_TIMEOUT';

      const categorized = errorHandler.categorizeError(error, 'agent');

      expect(categorized).toEqual({
        category: 'execution',
        type: 'agent_timeout',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        userMessage: 'Command timed out. Please try again.',
        technicalMessage: error.message,
        errorCode: 'EXECUTION_TIMEOUT'
      });
    });

    test('should categorize command validation errors', () => {
      const error = new Error('Invalid command parameters');
      error.code = 'VALIDATION_ERROR';

      const categorized = errorHandler.categorizeError(error, 'command');

      expect(categorized).toEqual({
        category: 'validation',
        type: 'invalid_parameters',
        severity: 'low',
        recoverable: false,
        retryable: false,
        userMessage: 'Invalid command parameters. Please check your input.',
        technicalMessage: error.message,
        errorCode: 'VALIDATION_ERROR'
      });
    });

    test('should categorize unknown errors', () => {
      const error = new Error('Unknown error occurred');

      const categorized = errorHandler.categorizeError(error, 'unknown');

      expect(categorized).toEqual({
        category: 'unknown',
        type: 'unknown_error',
        severity: 'medium',
        recoverable: false,
        retryable: false,
        userMessage: 'An unexpected error occurred. Please try again.',
        technicalMessage: error.message,
        errorCode: 'UNKNOWN_ERROR'
      });
    });
  });

  describe('Error Processing', () => {
    test('should process error with full context', async () => {
      const error = new Error('Test error');
      const context = {
        component: 'websocket',
        operation: 'connect',
        data: { url: 'ws://localhost:8080' }
      };

      const result = await errorHandler.handleError(error, context);

      expect(result).toEqual({
        handled: true,
        categorized: expect.any(Object),
        recoveryAction: expect.any(String),
        shouldRetry: expect.any(Boolean),
        userNotification: expect.any(Object)
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in websocket'),
        expect.objectContaining({
          error: error.message,
          context,
          category: expect.any(String)
        })
      );
    });

    test('should generate user notifications', async () => {
      const error = new Error('Connection refused');
      error.code = 'CONNECTION_REFUSED';

      const result = await errorHandler.handleError(error, { component: 'websocket' });

      expect(result.userNotification).toEqual({
        type: 'error',
        title: 'Connection Error',
        message: expect.any(String),
        actions: expect.arrayContaining([
          expect.objectContaining({
            label: 'Retry',
            action: 'retry'
          })
        ]),
        duration: expect.any(Number)
      });
    });

    test('should implement graceful degradation', async () => {
      const error = new Error('Service unavailable');
      error.code = 'SERVICE_UNAVAILABLE';

      const result = await errorHandler.handleError(error, { 
        component: 'agent',
        fallbackMode: 'offline'
      });

      expect(result.recoveryAction).toBe('graceful_degradation');
      expect(result.fallbackEnabled).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should implement automatic retry with exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce('Success');

      const result = await errorHandler.withRetry(operation, {
        maxRetries: 3,
        baseDelay: 50,
        exponentialBackoff: true
      });

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should respect maximum retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(errorHandler.withRetry(operation, {
        maxRetries: 2,
        baseDelay: 10
      })).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should handle circuit breaker pattern', async () => {
      // Trigger circuit breaker with multiple failures
      const operation = jest.fn().mockRejectedValue(new Error('Service down'));

      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.withCircuitBreaker(operation, 'test-service');
        } catch (e) {
          // Expected failures
        }
      }

      // Circuit should be open now
      const result = await errorHandler.withCircuitBreaker(operation, 'test-service');
      expect(result.circuitOpen).toBe(true);
      expect(operation).toHaveBeenCalledTimes(5); // No additional calls
    });
  });

  describe('Error Logging', () => {
    test('should log errors with proper severity levels', async () => {
      const highSeverityError = new Error('Critical system failure');
      highSeverityError.code = 'SYSTEM_FAILURE';

      await errorHandler.handleError(highSeverityError, { component: 'system' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in system'),
        expect.objectContaining({
          severity: 'critical'
        })
      );
    });

    test('should include error metadata in logs', async () => {
      const error = new Error('Test error');
      const context = {
        component: 'test',
        userId: 'user123',
        sessionId: 'session456'
      };

      await errorHandler.handleError(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: error.message,
          context,
          timestamp: expect.any(Number),
          stack: expect.any(String)
        })
      );
    });

    test('should sanitize sensitive data in logs', async () => {
      const error = new Error('Authentication failed');
      const context = {
        component: 'auth',
        credentials: { username: 'user', password: 'secret123' },
        apiKey: 'super-secret-key'
      };

      await errorHandler.handleError(error, context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({
            credentials: expect.objectContaining({
              username: 'user',
              password: '[REDACTED]'
            }),
            apiKey: '[REDACTED]'
          })
        })
      );
    });
  });

  describe('Error Monitoring', () => {
    test('should track error metrics', () => {
      const error = new Error('Test error');

      errorHandler.handleError(error, { component: 'test' });

      const metrics = errorHandler.getErrorMetrics();
      expect(metrics).toEqual({
        totalErrors: 1,
        errorsByCategory: expect.objectContaining({
          unknown: 1
        }),
        errorsBySeverity: expect.objectContaining({
          medium: 1
        }),
        errorsByComponent: expect.objectContaining({
          test: 1
        }),
        recentErrors: expect.arrayContaining([
          expect.objectContaining({
            message: 'Test error',
            timestamp: expect.any(Number)
          })
        ])
      });
    });

    test('should identify error patterns', async () => {
      // Generate multiple similar errors
      for (let i = 0; i < 3; i++) {
        const error = new Error('Connection timeout');
        error.code = 'TIMEOUT';
        await errorHandler.handleError(error, { component: 'websocket' });
      }

      const patterns = errorHandler.analyzeErrorPatterns();
      expect(patterns).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pattern: 'repeated_websocket_timeout',
          count: 3,
          recommendation: expect.any(String)
        })
      ]));
    });

    test('should generate error reports', () => {
      const error = new Error('Test error');
      errorHandler.handleError(error, { component: 'test' });

      const report = errorHandler.generateErrorReport();
      expect(report).toEqual({
        summary: {
          totalErrors: 1,
          timeRange: expect.any(Object),
          topErrors: expect.any(Array)
        },
        details: {
          byCategory: expect.any(Object),
          bySeverity: expect.any(Object),
          byComponent: expect.any(Object)
        },
        recommendations: expect.any(Array)
      });
    });
  });

  describe('Configuration', () => {
    test('should accept custom error handling configuration', () => {
      const customHandler = new ErrorHandler({
        maxRetries: 5,
        retryDelay: 200,
        circuitBreakerThreshold: 10,
        enableTelemetry: false
      });

      expect(customHandler.config).toEqual({
        maxRetries: 5,
        retryDelay: 200,
        circuitBreakerThreshold: 10,
        enableTelemetry: false,
        enableRecovery: true,
        logLevel: 'error'
      });
    });

    test('should validate configuration parameters', () => {
      expect(() => {
        new ErrorHandler({
          maxRetries: -1
        });
      }).toThrow('Invalid configuration: maxRetries must be >= 0');

      expect(() => {
        new ErrorHandler({
          retryDelay: 'invalid'
        });
      }).toThrow('Invalid configuration: retryDelay must be a number');
    });
  });

  describe('Integration', () => {
    test('should integrate with existing error boundaries', async () => {
      const boundaryHandler = jest.fn();
      errorHandler.setErrorBoundary(boundaryHandler);

      const error = new Error('Boundary test');
      await errorHandler.handleError(error, { component: 'ui' });

      expect(boundaryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          context: { component: 'ui' },
          categorized: expect.any(Object)
        })
      );
    });

    test('should provide middleware for different components', () => {
      const websocketMiddleware = errorHandler.createMiddleware('websocket');
      const agentMiddleware = errorHandler.createMiddleware('agent');

      expect(websocketMiddleware).toBeInstanceOf(Function);
      expect(agentMiddleware).toBeInstanceOf(Function);
    });
  });
});