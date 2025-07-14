/**
 * Tests for ErrorHandler - Error handling patterns and utilities
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ErrorHandler } from '../../src/utils/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      enableLogging: false, // Disable logging during tests
      autoCleanup: false // Disable auto cleanup during tests
    });
  });

  describe('Constructor', () => {
    test('should create ErrorHandler with default configuration', () => {
      expect(errorHandler).toBeDefined();
      expect(errorHandler.config).toBeDefined();
      expect(errorHandler.errorHistory).toBeDefined();
      expect(errorHandler.errorCounts).toBeDefined();
    });

    test('should create with custom configuration', () => {
      const customConfig = {
        maxErrorHistory: 500,
        enableLogging: false,
        retryAttempts: 2
      };

      const customHandler = new ErrorHandler(customConfig);
      expect(customHandler.config.maxErrorHistory).toBe(500);
      expect(customHandler.config.enableLogging).toBe(false);
      expect(customHandler.config.retryAttempts).toBe(2);
    });
  });

  describe('Error Classification', () => {
    test('should classify syntax errors', () => {
      const syntaxError = new SyntaxError('Unexpected token');
      const classification = errorHandler.classifyError(syntaxError);
      
      expect(classification.category).toBe('syntax');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify reference errors', () => {
      const refError = new ReferenceError('variable is not defined');
      const classification = errorHandler.classifyError(refError);
      
      expect(classification.category).toBe('reference');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify type errors', () => {
      const typeError = new TypeError('Cannot read property of undefined');
      const classification = errorHandler.classifyError(typeError);
      
      expect(classification.category).toBe('type');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify file system errors', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      fsError.code = 'ENOENT';
      const classification = errorHandler.classifyError(fsError);
      
      expect(classification.category).toBe('filesystem');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify network errors', () => {
      const networkError = new Error('Network request failed');
      networkError.code = 'ENOTFOUND';
      const classification = errorHandler.classifyError(networkError);
      
      expect(classification.category).toBe('network');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify validation errors', () => {
      const validationError = new Error('Invalid input provided');
      validationError.type = 'ValidationError';
      const classification = errorHandler.classifyError(validationError);
      
      expect(classification.category).toBe('validation');
      expect(classification.severity).toBe('warning');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify unknown errors as generic', () => {
      const unknownError = new Error('Something went wrong');
      const classification = errorHandler.classifyError(unknownError);
      
      expect(classification.category).toBe('generic');
      expect(classification.severity).toBe('error');
      expect(classification.recoverable).toBe(false);
    });
  });

  describe('Error Recording and History', () => {
    test('should record error with metadata', () => {
      const error = new Error('Test error');
      const context = { operation: 'file-read', file: 'test.js' };
      
      errorHandler.recordError(error, context);
      
      expect(errorHandler.errorHistory.length).toBe(1);
      expect(errorHandler.errorHistory[0].error).toBe(error);
      expect(errorHandler.errorHistory[0].context).toEqual(context);
      expect(errorHandler.errorHistory[0].timestamp).toBeDefined();
    });

    test('should limit error history size', () => {
      const limitedHandler = new ErrorHandler({ maxErrorHistory: 3 });
      
      for (let i = 0; i < 5; i++) {
        limitedHandler.recordError(new Error(`Error ${i}`));
      }
      
      expect(limitedHandler.errorHistory.length).toBe(3);
      expect(limitedHandler.errorHistory[0].error.message).toBe('Error 2'); // Oldest kept
      expect(limitedHandler.errorHistory[2].error.message).toBe('Error 4'); // Newest
    });

    test('should track error counts by category', () => {
      errorHandler.recordError(new SyntaxError('Syntax error 1'));
      errorHandler.recordError(new SyntaxError('Syntax error 2'));
      errorHandler.recordError(new TypeError('Type error 1'));
      
      expect(errorHandler.getErrorCounts().syntax).toBe(2);
      expect(errorHandler.getErrorCounts().type).toBe(1);
      expect(errorHandler.getErrorCounts().total).toBe(3);
    });

    test('should get recent errors', () => {
      for (let i = 0; i < 5; i++) {
        errorHandler.recordError(new Error(`Error ${i}`));
      }
      
      const recent = errorHandler.getRecentErrors(3);
      expect(recent.length).toBe(3);
      expect(recent[0].error.message).toBe('Error 4'); // Most recent first
      expect(recent[2].error.message).toBe('Error 2');
    });

    test('should filter errors by category', () => {
      errorHandler.recordError(new SyntaxError('Syntax error'));
      errorHandler.recordError(new TypeError('Type error'));
      errorHandler.recordError(new ReferenceError('Reference error'));
      
      const syntaxErrors = errorHandler.getErrorsByCategory('syntax');
      const typeErrors = errorHandler.getErrorsByCategory('type');
      
      expect(syntaxErrors.length).toBe(1);
      expect(typeErrors.length).toBe(1);
      expect(syntaxErrors[0].error.constructor.name).toBe('SyntaxError');
    });
  });

  describe('Error Recovery and Suggestions', () => {
    test('should suggest fixes for syntax errors', () => {
      const syntaxError = new SyntaxError('Unexpected token }');
      const suggestions = errorHandler.getSuggestions(syntaxError);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('bracket') || s.includes('brace'))).toBe(true);
    });

    test('should suggest fixes for reference errors', () => {
      const refError = new ReferenceError('myVariable is not defined');
      const suggestions = errorHandler.getSuggestions(refError);
      
      expect(suggestions.some(s => s.includes('Declare') || s.includes('Define') || s.includes('declare') || s.includes('define'))).toBe(true);
    });

    test('should suggest fixes for type errors', () => {
      const typeError = new TypeError('Cannot read property of undefined');
      const suggestions = errorHandler.getSuggestions(typeError);
      
      expect(suggestions.some(s => s.includes('null') || s.includes('undefined'))).toBe(true);
    });

    test('should suggest fixes for file system errors', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      fsError.code = 'ENOENT';
      const suggestions = errorHandler.getSuggestions(fsError);
      
      expect(suggestions.some(s => s.includes('file') && s.includes('exist'))).toBe(true);
    });

    test('should generate recovery strategies', () => {
      const error = new Error('Network timeout');
      error.code = 'ETIMEDOUT';
      
      const strategies = errorHandler.getRecoveryStrategies(error);
      
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.type === 'retry')).toBe(true);
    });

    test('should check if error is recoverable', () => {
      const recoverableError = new SyntaxError('Missing semicolon');
      const nonRecoverableError = new Error('Out of memory');
      nonRecoverableError.code = 'ENOMEM';
      
      expect(errorHandler.isRecoverable(recoverableError)).toBe(true);
      expect(errorHandler.isRecoverable(nonRecoverableError)).toBe(false);
    });
  });

  describe('Error Formatting and Display', () => {
    test('should format error for display', () => {
      const error = new SyntaxError('Unexpected token at line 10');
      const formatted = errorHandler.formatError(error);
      
      expect(formatted).toHaveProperty('type');
      expect(formatted).toHaveProperty('message');
      expect(formatted).toHaveProperty('category');
      expect(formatted).toHaveProperty('suggestions');
      expect(formatted.type).toBe('SyntaxError');
    });

    test('should extract line numbers from error messages', () => {
      const error = new Error('Error at line 42, column 15');
      const lineInfo = errorHandler.extractLineInfo(error.message);
      
      expect(lineInfo.line).toBe(42);
      expect(lineInfo.column).toBe(15);
    });

    test('should extract file paths from error messages', () => {
      const error = new Error('Error in file /path/to/file.js');
      const fileInfo = errorHandler.extractFileInfo(error.message);
      
      expect(fileInfo.file).toBe('/path/to/file.js');
    });

    test('should create user-friendly error summaries', () => {
      errorHandler.recordError(new SyntaxError('Missing bracket'));
      errorHandler.recordError(new TypeError('Type mismatch'));
      errorHandler.recordError(new ReferenceError('Undefined variable'));
      
      const summary = errorHandler.createErrorSummary();
      
      expect(summary).toHaveProperty('totalErrors');
      expect(summary).toHaveProperty('categoryCounts');
      expect(summary).toHaveProperty('mostCommon');
      expect(summary).toHaveProperty('recommendations');
      expect(summary.totalErrors).toBe(3);
    });
  });

  describe('Context and Stack Trace Analysis', () => {
    test('should analyze stack traces', () => {
      const error = new Error('Test error');
      Error.captureStackTrace(error);
      
      const analysis = errorHandler.analyzeStackTrace(error);
      
      expect(analysis).toHaveProperty('frames');
      expect(analysis).toHaveProperty('origin');
      expect(Array.isArray(analysis.frames)).toBe(true);
    });

    test('should identify error source location', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.testFunction (/path/to/file.js:10:15)
    at /path/to/another.js:5:10`;
      
      const location = errorHandler.getErrorLocation(error);
      
      expect(location).toHaveProperty('file');
      expect(location).toHaveProperty('line');
      expect(location).toHaveProperty('column');
      expect(location.file).toContain('file.js');
      expect(location.line).toBe(10);
    });

    test('should extract function context from stack', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.generateCode (/src/generator.js:25:10)
    at Object.processFile (/src/processor.js:15:5)`;
      
      const context = errorHandler.getFunctionContext(error);
      
      expect(context).toHaveProperty('function');
      expect(context).toHaveProperty('file');
      expect(context.function).toBe('generateCode');
    });
  });

  describe('Error Retry and Circuit Breaker', () => {
    test('should implement retry logic', async () => {
      let attempts = 0;
      const flakyOperation = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await errorHandler.retry(flakyOperation, {
        maxAttempts: 3,
        delay: 10
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should fail after max retry attempts', async () => {
      const alwaysFailingOperation = () => {
        throw new Error('Permanent failure');
      };

      await expect(errorHandler.retry(alwaysFailingOperation, {
        maxAttempts: 2,
        delay: 10
      })).rejects.toThrow('Permanent failure');
    });

    test('should implement exponential backoff', async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      };

      try {
        await errorHandler.retry(() => {
          throw new Error('Fail');
        }, {
          maxAttempts: 3,
          delay: 100,
          backoff: 'exponential'
        }).catch(() => {});

        expect(delays.length).toBe(2); // Only 2 delays for 3 attempts
        expect(delays[0]).toBe(200); // 100 * 2^1
        expect(delays[1]).toBe(400); // 100 * 2^2
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    test('should implement circuit breaker pattern', async () => {
      const failingOperation = () => {
        throw new Error('Service unavailable');
      };

      // Trip the circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await errorHandler.withCircuitBreaker('test-service', failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should now be open
      const circuitState = errorHandler.getCircuitState('test-service');
      expect(circuitState.state).toBe('open');

      // Next call should fail immediately
      const start = Date.now();
      try {
        await errorHandler.withCircuitBreaker('test-service', failingOperation);
      } catch (error) {
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(50); // Should fail fast
      }
    });
  });

  describe('Error Aggregation and Reporting', () => {
    test('should aggregate errors by pattern', () => {
      errorHandler.recordError(new SyntaxError('Missing semicolon at line 10'));
      errorHandler.recordError(new SyntaxError('Missing semicolon at line 15'));
      errorHandler.recordError(new TypeError('Type error at line 5'));
      errorHandler.recordError(new TypeError('Type error at line 8'));

      const aggregated = errorHandler.aggregateErrors();

      expect(aggregated).toHaveProperty('patterns');
      expect(aggregated.patterns.some(p => p.type === 'SyntaxError' && p.count === 2)).toBe(true);
      expect(aggregated.patterns.some(p => p.type === 'TypeError' && p.count === 2)).toBe(true);
    });

    test('should generate error reports', () => {
      errorHandler.recordError(new Error('Error 1'));
      errorHandler.recordError(new Error('Error 2'));

      const report = errorHandler.generateReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('details');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('timestamp');
      expect(typeof report.summary).toBe('string');
    });

    test('should export error data', () => {
      errorHandler.recordError(new Error('Test error'));

      const exported = errorHandler.exportErrorData();

      expect(exported).toHaveProperty('errors');
      expect(exported).toHaveProperty('counts');
      expect(exported).toHaveProperty('timestamp');
      expect(Array.isArray(exported.errors)).toBe(true);
    });

    test('should import error data', () => {
      const errorData = {
        errors: [
          {
            error: { message: 'Imported error', name: 'Error' },
            timestamp: Date.now(),
            context: { source: 'import' }
          }
        ],
        counts: { generic: 1, total: 1 }
      };

      errorHandler.importErrorData(errorData);

      expect(errorHandler.errorHistory.length).toBe(1);
      expect(errorHandler.errorHistory[0].error.message).toBe('Imported error');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up old errors automatically', () => {
      const handler = new ErrorHandler({
        maxErrorHistory: 100,
        autoCleanup: true,
        cleanupInterval: 50
      });

      // Add errors with old timestamps
      for (let i = 0; i < 50; i++) {
        const error = new Error(`Old error ${i}`);
        handler.recordError(error);
        // Manually set old timestamp
        handler.errorHistory[i].timestamp = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      }

      // Add recent error
      handler.recordError(new Error('Recent error'));

      // Trigger cleanup
      handler.cleanupOldErrors();

      expect(handler.errorHistory.length).toBeLessThan(51);
      expect(handler.errorHistory.some(e => e.error.message === 'Recent error')).toBe(true);
    });

    test('should handle memory pressure gracefully', () => {
      const handler = new ErrorHandler({ maxErrorHistory: 10 });

      // Add many errors
      for (let i = 0; i < 20; i++) {
        handler.recordError(new Error(`Error ${i}`));
      }

      expect(handler.errorHistory.length).toBe(10);
      expect(handler.errorHistory[0].error.message).toBe('Error 10'); // Oldest kept
    });

    test('should optimize error storage', () => {
      const handler = new ErrorHandler({ optimizeStorage: true });

      const largeError = new Error('Error with large context');
      const largeContext = {
        data: new Array(1000).fill('large-data-chunk'),
        metadata: { source: 'test' }
      };

      handler.recordError(largeError, largeContext);

      const stored = handler.errorHistory[0];
      expect(stored.context.data).toBeUndefined(); // Should be stripped
      expect(stored.context.metadata).toBeDefined(); // Should be kept
    });
  });

  describe('Integration and Extensibility', () => {
    test('should support custom error handlers', () => {
      const customHandler = jest.fn();
      errorHandler.addCustomHandler('syntax', customHandler);

      const syntaxError = new SyntaxError('Test syntax error');
      errorHandler.handleError(syntaxError);

      expect(customHandler).toHaveBeenCalledWith(syntaxError, expect.any(Object));
    });

    test('should support error transformation', () => {
      const transformer = (error) => {
        const transformed = new Error(`Transformed: ${error.message}`);
        transformed.original = error;
        return transformed;
      };

      errorHandler.addTransformer('syntax', transformer);

      const original = new SyntaxError('Original error');
      const result = errorHandler.transformError(original);

      expect(result.message).toBe('Transformed: Original error');
      expect(result.original).toBe(original);
    });

    test('should emit error events', (done) => {
      const mockEventEmitter = {
        emit: jest.fn()
      };
      
      const handler = new ErrorHandler({
        eventEmitter: mockEventEmitter,
        emitEvents: true
      });

      handler.recordError(new Error('Test error'));

      // Check that event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          error: expect.any(Error),
          classification: expect.any(Object)
        })
      );
      
      done();
    });
  });
});