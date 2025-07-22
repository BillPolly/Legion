/**
 * ConsoleCapture unit tests
 * 
 * Following TDD approach - tests written before implementation
 */

import { jest } from '@jest/globals';
import { ConsoleCapture } from '../../src/ConsoleCapture.js';
import { DatabaseManager } from '../../src/DatabaseManager.js';

describe('ConsoleCapture', () => {
  let consoleCapture;
  let mockDb;
  let originalConsole;

  beforeEach(() => {
    // Mock database
    mockDb = {
      recordConsole: jest.fn().mockResolvedValue()
    };

    // Save original console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    consoleCapture = new ConsoleCapture(mockDb);
  });

  afterEach(async () => {
    // Restore original console
    await consoleCapture.teardown();
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe('Console method interception', () => {
    test('should intercept console.log', async () => {
      await consoleCapture.setup('test-run-id');

      console.log('test message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-id',
          level: 'log',
          message: 'test message'
        })
      );
    });

    test('should intercept console.error', async () => {
      await consoleCapture.setup('test-run-id');

      console.error('error message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-id',
          level: 'error',
          message: 'error message'
        })
      );
    });

    test('should intercept console.warn', async () => {
      await consoleCapture.setup('test-run-id');

      console.warn('warning message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-id',
          level: 'warn',
          message: 'warning message'
        })
      );
    });

    test('should intercept console.info', async () => {
      await consoleCapture.setup('test-run-id');

      console.info('info message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-id',
          level: 'info',
          message: 'info message'
        })
      );
    });

    test('should intercept console.debug', async () => {
      await consoleCapture.setup('test-run-id');

      console.debug('debug message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run-id',
          level: 'debug',
          message: 'debug message'
        })
      );
    });

    test('should preserve original console behavior', async () => {
      // Create a mock function to track calls
      const logMock = jest.fn();
      const originalLog = console.log;
      console.log = logMock;
      
      // Create new instance with mocked console
      const captureWithMock = new ConsoleCapture(mockDb);
      await captureWithMock.setup('test-run-id');
      
      // The intercepted console should call our mock
      console.log('test message');

      expect(logMock).toHaveBeenCalledWith('test message');
      
      // Cleanup
      await captureWithMock.teardown();
      console.log = originalLog;
    });
  });

  describe('AsyncLocalStorage context', () => {
    test('should create context for test execution', async () => {
      await consoleCapture.setup('test-run-id');

      const context = { testPath: '/test.js', testName: 'test case' };
      
      await consoleCapture.runWithContext(context, () => {
        const currentContext = consoleCapture.getContext();
        expect(currentContext).toEqual(context);
      });
    });

    test('should maintain context across async operations', async () => {
      await consoleCapture.setup('test-run-id');

      const context = { testPath: '/test.js', testName: 'async test' };
      
      await consoleCapture.runWithContext(context, async () => {
        // Initial context
        expect(consoleCapture.getContext()).toEqual(context);

        // After async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(consoleCapture.getContext()).toEqual(context);

        // Nested async
        await Promise.resolve().then(() => {
          expect(consoleCapture.getContext()).toEqual(context);
        });
      });
    });

    test('should isolate context between tests', async () => {
      await consoleCapture.setup('test-run-id');

      const context1 = { testPath: '/test1.js', testName: 'test 1' };
      const context2 = { testPath: '/test2.js', testName: 'test 2' };

      // Run first context
      await consoleCapture.runWithContext(context1, () => {
        expect(consoleCapture.getContext()).toEqual(context1);
      });

      // Run second context
      await consoleCapture.runWithContext(context2, () => {
        expect(consoleCapture.getContext()).toEqual(context2);
      });

      // Outside any context
      expect(consoleCapture.getContext()).toBeUndefined();
    });

    test('should handle missing context gracefully', async () => {
      await consoleCapture.setup('test-run-id');

      // Console without context
      console.log('no context message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          testPath: undefined,
          testName: undefined
        })
      );
    });
  });

  describe('Console message recording', () => {
    test('should capture message with timestamp', async () => {
      await consoleCapture.setup('test-run-id');

      const beforeTime = Date.now();
      console.log('test message');
      const afterTime = Date.now();

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      );

      const call = mockDb.recordConsole.mock.calls[0][0];
      expect(call.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(call.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should capture method type', async () => {
      await consoleCapture.setup('test-run-id');

      console.log('log message');
      console.error('error message');
      console.warn('warn message');

      expect(mockDb.recordConsole).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ level: 'log' })
      );
      expect(mockDb.recordConsole).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ level: 'error' })
      );
      expect(mockDb.recordConsole).toHaveBeenNthCalledWith(3,
        expect.objectContaining({ level: 'warn' })
      );
    });

    test('should capture stack trace', async () => {
      await consoleCapture.setup('test-run-id');

      console.log('test message');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          stackTrace: expect.stringContaining('Error')
        })
      );
    });

    test('should associate with current test context', async () => {
      await consoleCapture.setup('test-run-id');

      const context = { testPath: '/test.js', testName: 'context test' };
      
      await consoleCapture.runWithContext(context, () => {
        console.log('context message');
      });

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          testPath: '/test.js',
          testName: 'context test'
        })
      );
    });

    test('should handle multiple arguments', async () => {
      await consoleCapture.setup('test-run-id');

      console.log('message', 'with', 'multiple', 'args');

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'message with multiple args'
        })
      );
    });

    test('should handle non-string arguments', async () => {
      await consoleCapture.setup('test-run-id');

      const obj = { key: 'value' };
      const arr = [1, 2, 3];
      
      console.log('Object:', obj, 'Array:', arr);

      expect(mockDb.recordConsole).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Object:')
        })
      );
    });
  });

  describe('Console restoration', () => {
    test('should restore original methods', async () => {
      await consoleCapture.setup('test-run-id');
      
      // Console should be intercepted
      expect(console.log).not.toBe(originalConsole.log);
      
      await consoleCapture.teardown();
      
      // Console should be restored
      expect(console.log).toBe(originalConsole.log);
      expect(console.error).toBe(originalConsole.error);
      expect(console.warn).toBe(originalConsole.warn);
      expect(console.info).toBe(originalConsole.info);
      expect(console.debug).toBe(originalConsole.debug);
    });

    test('should clean up on error', async () => {
      await consoleCapture.setup('test-run-id');
      
      // Simulate error scenario
      mockDb.recordConsole.mockRejectedValueOnce(new Error('DB Error'));
      
      // Should not throw when console is called
      expect(() => console.log('test')).not.toThrow();
      
      await consoleCapture.teardown();
      expect(console.log).toBe(originalConsole.log);
    });

    test('should handle multiple setup/teardown cycles', async () => {
      // First cycle
      await consoleCapture.setup('run-1');
      console.log('cycle 1');
      await consoleCapture.teardown();
      
      // Second cycle
      await consoleCapture.setup('run-2');
      console.log('cycle 2');
      await consoleCapture.teardown();
      
      // Third cycle
      await consoleCapture.setup('run-3');
      console.log('cycle 3');
      await consoleCapture.teardown();
      
      expect(mockDb.recordConsole).toHaveBeenCalledTimes(3);
      expect(console.log).toBe(originalConsole.log);
    });
  });
});