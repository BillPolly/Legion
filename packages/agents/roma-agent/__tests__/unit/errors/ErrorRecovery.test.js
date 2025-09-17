/**
 * Unit tests for ErrorRecovery class enhancements
 * Tests new fallback strategy mechanism, partial result recovery, and error classification
 */

import { ErrorRecovery } from '../../../src/errors/ErrorRecovery.js';
import { 
  TaskError,
  DependencyError,
  CircularDependencyError,
  ResourceError,
  StrategyError,
  QueueError,
  SystemError
} from '../../../src/errors/ROMAErrors.js';

describe('ErrorRecovery', () => {
  let errorRecovery;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    errorRecovery = new ErrorRecovery({
      logger: mockLogger,
      maxRecoveryAttempts: 3,
      enableStateRollback: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const recovery = new ErrorRecovery();
      expect(recovery.maxRecoveryAttempts).toBe(3);
      expect(recovery.enableStateRollback).toBe(true);
      expect(recovery.recoveryStrategies.size).toBeGreaterThan(0);
    });

    it('should accept custom options', () => {
      const recovery = new ErrorRecovery({
        maxRecoveryAttempts: 5,
        enableStateRollback: false
      });
      expect(recovery.maxRecoveryAttempts).toBe(5);
      expect(recovery.enableStateRollback).toBe(false);
    });

    it('should register default recovery strategies', () => {
      expect(errorRecovery.recoveryStrategies.size).toBeGreaterThan(0);
    });
  });

  describe('fallbackStrategy', () => {
    it('should provide fallback for RecursiveExecutionStrategy', async () => {
      const task = { id: 'test-task', description: 'test task' };
      const error = new Error('Strategy failed');
      
      const result = await errorRecovery.fallbackStrategy(task, 'RecursiveExecutionStrategy', error);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('strategy_fallback');
      expect(result.fallbackStrategy).toBe('AtomicExecutionStrategy');
      expect(result.delay).toBe(1000);
    });

    it('should provide fallback for ParallelExecutionStrategy', async () => {
      const task = { id: 'test-task' };
      const error = new Error('Parallel execution failed');
      
      const result = await errorRecovery.fallbackStrategy(task, 'ParallelExecutionStrategy', error);
      
      expect(result.success).toBe(true);
      expect(result.fallbackStrategy).toBe('SequentialExecutionStrategy');
    });

    it('should provide fallback for SequentialExecutionStrategy', async () => {
      const task = { id: 'test-task' };
      const error = new Error('Sequential execution failed');
      
      const result = await errorRecovery.fallbackStrategy(task, 'SequentialExecutionStrategy', error);
      
      expect(result.success).toBe(true);
      expect(result.fallbackStrategy).toBe('AtomicExecutionStrategy');
    });

    it('should provide fallback for OptimizedExecutionStrategy', async () => {
      const task = { id: 'test-task' };
      const error = new Error('Optimized execution failed');
      
      const result = await errorRecovery.fallbackStrategy(task, 'OptimizedExecutionStrategy', error);
      
      expect(result.success).toBe(true);
      expect(result.fallbackStrategy).toBe('RecursiveExecutionStrategy');
    });

    it('should return no fallback for unknown strategy', async () => {
      const task = { id: 'test-task' };
      const error = new Error('Unknown strategy failed');
      
      const result = await errorRecovery.fallbackStrategy(task, 'UnknownStrategy', error);
      
      expect(result.success).toBe(false);
      expect(result.action).toBe('no_fallback_available');
      expect(result.message).toContain('UnknownStrategy');
    });

    it('should log strategy fallback attempts', async () => {
      const task = { id: 'test-task' };
      const error = new Error('Strategy failed');
      
      await errorRecovery.fallbackStrategy(task, 'RecursiveExecutionStrategy', error);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('RecursiveExecutionStrategy failed'),
        expect.objectContaining({
          error: 'Strategy failed',
          taskId: 'test-task'
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using fallback strategy'),
        expect.objectContaining({
          originalStrategy: 'RecursiveExecutionStrategy',
          taskId: 'test-task'
        })
      );
    });
  });

  describe('recoverPartialResults', () => {
    let mockExecutionContext;

    beforeEach(() => {
      mockExecutionContext = {
        getCompletedSubtasks: jest.fn(),
        getPendingSubtasks: jest.fn(),
        getFailedSubtasks: jest.fn()
      };
    });

    it('should recover partial results with completion percentage', () => {
      mockExecutionContext.getCompletedSubtasks.mockReturnValue([
        { id: 'task1', result: 'success' },
        { id: 'task2', result: 'success' }
      ]);
      mockExecutionContext.getPendingSubtasks.mockReturnValue([
        { id: 'task3' }
      ]);
      mockExecutionContext.getFailedSubtasks.mockReturnValue([
        { id: 'task4', error: 'failed' }
      ]);

      const error = new Error('Execution partially failed');
      const result = errorRecovery.recoverPartialResults(mockExecutionContext, error);

      expect(result.partial).toBe(true);
      expect(result.completed).toHaveLength(2);
      expect(result.pending).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.completionPercentage).toBe(50); // 2 of 4 tasks completed
      expect(result.canResume).toBe(true);
      expect(result.recoverable).toBe(true);
    });

    it('should handle context without subtask methods', () => {
      const contextWithoutMethods = {};
      const error = new Error('Test error');
      
      const result = errorRecovery.recoverPartialResults(contextWithoutMethods, error);
      
      expect(result.partial).toBe(true);
      expect(result.completed).toEqual([]);
      expect(result.pending).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.completionPercentage).toBe(0);
    });

    it('should classify error types correctly', () => {
      mockExecutionContext.getCompletedSubtasks.mockReturnValue([]);
      mockExecutionContext.getPendingSubtasks.mockReturnValue([]);
      mockExecutionContext.getFailedSubtasks.mockReturnValue([]);

      const networkError = new Error('ECONNREFUSED');
      const result = errorRecovery.recoverPartialResults(mockExecutionContext, networkError);
      
      expect(result.errorType).toBe('network');
    });

    it('should suggest resume strategy for high completion rate', () => {
      mockExecutionContext.getCompletedSubtasks.mockReturnValue(
        Array.from({ length: 9 }, (_, i) => ({ id: `task${i}` }))
      );
      mockExecutionContext.getPendingSubtasks.mockReturnValue([{ id: 'task9' }]);
      mockExecutionContext.getFailedSubtasks.mockReturnValue([]);

      const error = new Error('Near completion failure');
      const result = errorRecovery.recoverPartialResults(mockExecutionContext, error);

      expect(result.resumeStrategy.strategy).toBe('AtomicExecutionStrategy');
      expect(result.resumeStrategy.reason).toContain('High completion rate');
      expect(result.resumeStrategy.skipCompleted).toBe(true);
    });

    it('should suggest sequential strategy for many failures', () => {
      mockExecutionContext.getCompletedSubtasks.mockReturnValue([{ id: 'task1' }]);
      mockExecutionContext.getPendingSubtasks.mockReturnValue([{ id: 'task2' }]);
      mockExecutionContext.getFailedSubtasks.mockReturnValue([
        { id: 'task3' }, { id: 'task4' }, { id: 'task5' }
      ]);

      const error = new Error('Multiple failures');
      const result = errorRecovery.recoverPartialResults(mockExecutionContext, error);

      expect(result.resumeStrategy.strategy).toBe('SequentialExecutionStrategy');
      expect(result.resumeStrategy.reason).toContain('Many failures');
      expect(result.resumeStrategy.retryFailed).toBe(true);
    });

    it('should suggest recursive strategy for moderate completion', () => {
      mockExecutionContext.getCompletedSubtasks.mockReturnValue([
        { id: 'task1' }, { id: 'task2' }
      ]);
      mockExecutionContext.getPendingSubtasks.mockReturnValue([
        { id: 'task3' }, { id: 'task4' }
      ]);
      mockExecutionContext.getFailedSubtasks.mockReturnValue([{ id: 'task5' }]);

      const error = new Error('Moderate completion failure');
      const result = errorRecovery.recoverPartialResults(mockExecutionContext, error);

      expect(result.resumeStrategy.strategy).toBe('RecursiveExecutionStrategy');
      expect(result.resumeStrategy.reason).toContain('Moderate completion');
      expect(result.resumeStrategy.continueFromCheckpoint).toBe(true);
    });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      expect(errorRecovery.classifyError(new Error('ECONNREFUSED'))).toBe('network');
      expect(errorRecovery.classifyError(new Error('ENOTFOUND'))).toBe('network');
      expect(errorRecovery.classifyError(new Error('socket hang up'))).toBe('network');
      expect(errorRecovery.classifyError(new Error('getaddrinfo ENOTFOUND'))).toBe('network');
    });

    it('should classify timeout errors', () => {
      expect(errorRecovery.classifyError(new Error('ETIMEDOUT'))).toBe('timeout');
      expect(errorRecovery.classifyError(new Error('ESOCKETTIMEDOUT'))).toBe('timeout');
    });

    it('should classify rate limit errors', () => {
      expect(errorRecovery.classifyError(new Error('Rate limit exceeded'))).toBe('rate_limit');
      expect(errorRecovery.classifyError(new Error('Too many requests'))).toBe('rate_limit');
      expect(errorRecovery.classifyError(new Error('quota exceeded'))).toBe('rate_limit');
    });

    it('should classify parsing errors', () => {
      expect(errorRecovery.classifyError(new Error('Invalid JSON'))).toBe('parsing');
      expect(errorRecovery.classifyError(new Error('JSON.parse error'))).toBe('parsing');
      expect(errorRecovery.classifyError(new Error('Unexpected token'))).toBe('parsing');
      expect(errorRecovery.classifyError(new SyntaxError('Invalid syntax'))).toBe('parsing');
    });

    it('should classify tool errors', () => {
      expect(errorRecovery.classifyError(new Error('Tool not found'))).toBe('tool_missing');
      expect(errorRecovery.classifyError(new Error('Unknown tool'))).toBe('tool_missing');
      expect(errorRecovery.classifyError(new Error('Tool execution failed'))).toBe('tool_failure');
      expect(errorRecovery.classifyError(new Error('Tool timeout'))).toBe('tool_timeout');
    });

    it('should classify LLM errors', () => {
      expect(errorRecovery.classifyError(new Error('OpenAI error'))).toBe('llm_failure');
      expect(errorRecovery.classifyError(new Error('Anthropic error'))).toBe('llm_failure');
      expect(errorRecovery.classifyError(new Error('Claude error'))).toBe('llm_failure');
      expect(errorRecovery.classifyError(new Error('Model not found'))).toBe('llm_failure');
      expect(errorRecovery.classifyError(new Error('Token limit exceeded'))).toBe('llm_token_limit');
    });

    it('should classify authentication errors', () => {
      expect(errorRecovery.classifyError(new Error('Authentication failed'))).toBe('auth_error');
      expect(errorRecovery.classifyError(new Error('Invalid API key'))).toBe('auth_error');
      expect(errorRecovery.classifyError(new Error('Unauthorized'))).toBe('auth_error');
      expect(errorRecovery.classifyError(new Error('Permission denied'))).toBe('permission_error');
    });

    it('should classify resource errors', () => {
      expect(errorRecovery.classifyError(new Error('Out of memory'))).toBe('resource_exhausted');
      expect(errorRecovery.classifyError(new Error('Disk full'))).toBe('resource_exhausted');
      expect(errorRecovery.classifyError(new Error('Memory limit exceeded'))).toBe('resource_exhausted');
    });

    it('should classify validation errors', () => {
      expect(errorRecovery.classifyError(new Error('Validation failed'))).toBe('validation_error');
      expect(errorRecovery.classifyError(new Error('Schema mismatch'))).toBe('validation_error');
      expect(errorRecovery.classifyError(new Error('Required field missing'))).toBe('validation_error');
    });

    it('should classify by error code when available', () => {
      const error = new Error('Some error');
      error.code = 'ECONNREFUSED';
      expect(errorRecovery.classifyError(error)).toBe('network');
    });

    it('should check stack trace for classification', () => {
      const error = new Error('Generic error');
      error.stack = 'Error: Generic error\n    at TimeoutError.constructor';
      expect(errorRecovery.classifyError(error)).toBe('timeout');
    });

    it('should return unknown for unclassified errors', () => {
      expect(errorRecovery.classifyError(new Error('Some random error'))).toBe('unknown');
    });
  });

  describe('isRecoverable', () => {
    it('should identify non-recoverable errors by message', () => {
      expect(errorRecovery.isRecoverable(new Error('Authentication failed'))).toBe(false);
      expect(errorRecovery.isRecoverable(new Error('Invalid API key'))).toBe(false);
      expect(errorRecovery.isRecoverable(new Error('Permission denied'))).toBe(false);
      expect(errorRecovery.isRecoverable(new Error('Tool not found'))).toBe(false);
      expect(errorRecovery.isRecoverable(new Error('Circular dependency detected'))).toBe(false);
    });

    it('should identify non-recoverable errors by code', () => {
      const error = new Error('Some error');
      error.code = 'AUTH_ERROR';
      expect(errorRecovery.isRecoverable(error)).toBe(false);

      error.code = 'PERMISSION_DENIED';
      expect(errorRecovery.isRecoverable(error)).toBe(false);

      error.code = 'CIRCULAR_DEPENDENCY';
      expect(errorRecovery.isRecoverable(error)).toBe(false);
    });

    it('should identify recoverable errors', () => {
      expect(errorRecovery.isRecoverable(new Error('ECONNREFUSED'))).toBe(true);
      expect(errorRecovery.isRecoverable(new Error('Timeout error'))).toBe(true);
      expect(errorRecovery.isRecoverable(new Error('Rate limit exceeded'))).toBe(true);
      expect(errorRecovery.isRecoverable(new Error('Temporary failure'))).toBe(true);
    });
  });

  describe('recover', () => {
    let taskError;

    beforeEach(() => {
      taskError = new TaskError('Test task failed', { isRetryable: () => true });
    });

    it('should successfully recover with appropriate strategy', async () => {
      const context = { taskId: 'test-task', attemptNumber: 1 };
      
      const result = await errorRecovery.recover(taskError, context);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('retry_task');
      expect(result.delay).toBe(2000);
    });

    it('should fail recovery when max attempts exceeded', async () => {
      // Add multiple recovery attempts to history
      for (let i = 0; i < 3; i++) {
        await errorRecovery.recover(taskError, { taskId: 'test-task' });
      }
      
      const result = await errorRecovery.recover(taskError, { taskId: 'test-task' });
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Maximum recovery attempts exceeded');
      expect(result.attempts).toBe(3);
    });

    it('should handle errors without available strategies', async () => {
      class UnknownError extends Error {}
      const unknownError = new UnknownError('Unknown error type');
      
      const result = await errorRecovery.recover(unknownError);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('No recovery strategy available');
    });

    it('should handle recovery strategy execution errors', async () => {
      // Register a strategy that throws an error
      errorRecovery.registerStrategy(Error, {
        name: 'failing_strategy',
        execute: async () => {
          throw new Error('Strategy execution failed');
        }
      });
      
      const result = await errorRecovery.recover(new Error('Test error'));
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Strategy execution failed');
    });

    it('should create and track recovery attempts', async () => {
      const initialHistoryLength = errorRecovery.recoveryHistory.length;
      
      await errorRecovery.recover(taskError, { taskId: 'test-task' });
      
      expect(errorRecovery.recoveryHistory.length).toBe(initialHistoryLength + 1);
      expect(errorRecovery.recoveryHistory[initialHistoryLength].key).toBe('TaskError:test-task');
    });
  });

  describe('state management', () => {
    it('should create state snapshots', async () => {
      const mockContext = {
        taskQueue: {
          export: jest.fn().mockReturnValue({ tasks: ['task1', 'task2'] })
        },
        progressStream: {
          export: jest.fn().mockReturnValue({ progress: 50 })
        }
      };

      const snapshot = await errorRecovery.createStateSnapshot(mockContext);

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.context).toEqual(mockContext);
      expect(snapshot.queueState).toEqual({ tasks: ['task1', 'task2'] });
      expect(snapshot.progressState).toEqual({ progress: 50 });
    });

    it('should rollback to previous state', async () => {
      const mockContext = {
        taskQueue: {
          import: jest.fn()
        },
        progressStream: {
          import: jest.fn()
        }
      };

      const snapshot = {
        timestamp: Date.now(),
        queueState: { tasks: ['task1'] },
        progressState: { progress: 25 }
      };

      const result = await errorRecovery.rollbackState(snapshot, mockContext);

      expect(result).toBe(true);
      expect(mockContext.taskQueue.import).toHaveBeenCalledWith({ tasks: ['task1'] });
      expect(mockContext.progressStream.import).toHaveBeenCalledWith({ progress: 25 });
    });

    it('should handle rollback failures gracefully', async () => {
      const mockContext = {
        taskQueue: {
          import: jest.fn().mockRejectedValue(new Error('Import failed'))
        }
      };

      const snapshot = {
        timestamp: Date.now(),
        queueState: { tasks: ['task1'] }
      };

      const result = await errorRecovery.rollbackState(snapshot, mockContext);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'State rollback failed',
        expect.objectContaining({ error: 'Import failed' })
      );
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide recovery statistics', () => {
      // Add some mock history
      errorRecovery.recoveryHistory = [
        { error: 'TaskError', success: true, result: { strategy: 'task_recovery' } },
        { error: 'NetworkError', success: false, result: { strategy: 'network_recovery' } },
        { error: 'TaskError', success: true, result: { strategy: 'task_recovery' } }
      ];

      const stats = errorRecovery.getStatistics();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulRecoveries).toBe(2);
      expect(stats.successRate).toBe(66.67);
      expect(stats.errorTypeStats.TaskError).toBe(2);
      expect(stats.recoveryStrategies.task_recovery.attempts).toBe(2);
      expect(stats.recoveryStrategies.task_recovery.successes).toBe(2);
    });

    it('should export configuration', () => {
      const config = errorRecovery.exportConfig();

      expect(config.maxRecoveryAttempts).toBe(3);
      expect(config.enableStateRollback).toBe(true);
      expect(config.registeredStrategies).toBeInstanceOf(Array);
      expect(config.historySize).toBe(0);
    });

    it('should clear recovery history', () => {
      errorRecovery.recoveryHistory = [
        { error: 'TaskError', success: true }
      ];

      errorRecovery.clearHistory();

      expect(errorRecovery.recoveryHistory).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('Recovery history cleared');
    });
  });

  describe('custom strategy registration', () => {
    it('should register custom recovery strategies', () => {
      const customStrategy = {
        name: 'custom_strategy',
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      errorRecovery.registerStrategy(Error, customStrategy);

      expect(errorRecovery.recoveryStrategies.get(Error)).toBe(customStrategy);
    });

    it('should validate strategy requirements', () => {
      expect(() => {
        errorRecovery.registerStrategy(Error, { name: 'invalid' });
      }).toThrow('Recovery strategy must have name and execute function');

      expect(() => {
        errorRecovery.registerStrategy(Error, { execute: () => {} });
      }).toThrow('Recovery strategy must have name and execute function');
    });
  });

  describe('cleanup and maintenance', () => {
    it('should cleanup old recovery history', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const twoDaysAgo = now - (48 * 60 * 60 * 1000);

      errorRecovery.recoveryHistory = [
        { timestamp: now, error: 'Recent' },
        { timestamp: oneDayAgo, error: 'OneDayOld' },
        { timestamp: twoDaysAgo, error: 'TwoDaysOld' }
      ];

      errorRecovery.cleanupRecoveryHistory();

      expect(errorRecovery.recoveryHistory).toHaveLength(2);
      expect(errorRecovery.recoveryHistory.find(h => h.error === 'TwoDaysOld')).toBeUndefined();
    });

    it('should generate consistent recovery keys', () => {
      const error1 = new Error('Test error');
      error1.code = 'TEST_ERROR';
      const context1 = { taskId: 'task-123' };

      const error2 = new Error('Different message');
      error2.code = 'TEST_ERROR';
      const context2 = { taskId: 'task-123' };

      const key1 = errorRecovery.getRecoveryKey(error1, context1);
      const key2 = errorRecovery.getRecoveryKey(error2, context2);

      expect(key1).toBe(key2);
      expect(key1).toBe('TEST_ERROR:task-123');
    });
  });
});