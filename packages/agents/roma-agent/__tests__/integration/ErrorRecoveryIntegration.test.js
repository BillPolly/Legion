/**
 * Integration tests for Error Recovery system
 * Tests the complete error recovery workflow including:
 * - Strategy fallback mechanisms
 * - Partial result recovery
 * - State rollback capabilities
 * - Recovery attempt tracking
 * - Cross-component integration
 */

import { ErrorRecovery } from '../../src/errors/ErrorRecovery.js';
import { ExecutionValidator } from '../../src/core/validation/ExecutionValidator.js';
import { 
  TaskError,
  DependencyError,
  CircularDependencyError,
  ResourceError,
  StrategyError,
  QueueError,
  SystemError
} from '../../src/errors/ROMAErrors.js';

describe('ErrorRecovery Integration', () => {
  let errorRecovery;
  let executionValidator;
  let mockLogger;
  let mockToolRegistry;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockToolRegistry = {
      getTool: jest.fn()
    };

    errorRecovery = new ErrorRecovery({
      logger: mockLogger,
      maxRecoveryAttempts: 3,
      enableStateRollback: true
    });

    executionValidator = new ExecutionValidator({
      logger: mockLogger,
      toolRegistry: mockToolRegistry,
      enableStrictValidation: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Strategy Fallback Integration', () => {
    it('should handle RecursiveExecutionStrategy failure with complete fallback workflow', async () => {
      const task = {
        id: 'complex-task',
        description: 'Complex task requiring recursive execution',
        strategy: 'RecursiveExecutionStrategy',
        subtasks: [
          { id: 'subtask1', description: 'First subtask' },
          { id: 'subtask2', description: 'Second subtask' }
        ]
      };

      const strategError = new StrategyError('Recursive strategy failed due to complexity', {
        strategy: 'RecursiveExecutionStrategy',
        cause: 'stack_overflow'
      });

      const context = {
        taskId: task.id,
        sessionId: 'test-session',
        attemptNumber: 1,
        originalStrategy: 'RecursiveExecutionStrategy'
      };

      // Test strategy fallback
      const fallbackResult = await errorRecovery.fallbackStrategy(task, 'RecursiveExecutionStrategy', strategError);
      
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.action).toBe('strategy_fallback');
      expect(fallbackResult.fallbackStrategy).toBe('AtomicExecutionStrategy');

      // Test recovery process
      const recoveryResult = await errorRecovery.recover(strategError, context);
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('fallback_strategy');
      expect(recoveryResult.fallbackStrategy).toBe('AtomicExecutionStrategy');

      // Verify logging
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('RecursiveExecutionStrategy failed'),
        expect.objectContaining({
          error: strategError.message,
          taskId: task.id
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using fallback strategy'),
        expect.objectContaining({
          originalStrategy: 'RecursiveExecutionStrategy',
          taskId: task.id
        })
      );
    });

    it('should handle cascade of strategy failures', async () => {
      const task = { id: 'cascade-task', description: 'Task requiring multiple fallbacks' };
      
      // First failure: OptimizedExecutionStrategy
      const optimizedError = new StrategyError('Optimized strategy failed');
      let fallback = await errorRecovery.fallbackStrategy(task, 'OptimizedExecutionStrategy', optimizedError);
      
      expect(fallback.success).toBe(true);
      expect(fallback.fallbackStrategy).toBe('RecursiveExecutionStrategy');

      // Second failure: RecursiveExecutionStrategy
      const recursiveError = new StrategyError('Recursive strategy failed');
      fallback = await errorRecovery.fallbackStrategy(task, 'RecursiveExecutionStrategy', recursiveError);
      
      expect(fallback.success).toBe(true);
      expect(fallback.fallbackStrategy).toBe('AtomicExecutionStrategy');

      // Third failure: AtomicExecutionStrategy (no more fallbacks)
      const atomicError = new StrategyError('Atomic strategy failed');
      fallback = await errorRecovery.fallbackStrategy(task, 'AtomicExecutionStrategy', atomicError);
      
      expect(fallback.success).toBe(false);
      expect(fallback.action).toBe('no_fallback_available');
    });
  });

  describe('Partial Result Recovery Integration', () => {
    it('should integrate with ExecutionValidator for result validation', async () => {
      const mockExecutionContext = {
        getCompletedSubtasks: () => [
          { 
            id: 'task1', 
            result: { success: true, data: 'completed' },
            validation: { valid: true }
          },
          { 
            id: 'task2', 
            result: { success: true, data: 'completed' },
            validation: { valid: true }
          }
        ],
        getPendingSubtasks: () => [
          { id: 'task3', description: 'Pending task' }
        ],
        getFailedSubtasks: () => [
          { 
            id: 'task4', 
            error: 'Tool execution failed',
            validation: { valid: false, errors: ['Tool not found'] }
          }
        ]
      };

      const networkError = new Error('ECONNREFUSED - Network connection failed');
      const partialResult = errorRecovery.recoverPartialResults(mockExecutionContext, networkError);

      expect(partialResult.partial).toBe(true);
      expect(partialResult.completed).toHaveLength(2);
      expect(partialResult.pending).toHaveLength(1);
      expect(partialResult.failed).toHaveLength(1);
      expect(partialResult.completionPercentage).toBe(50);
      expect(partialResult.errorType).toBe('network');
      expect(partialResult.recoverable).toBe(true);
      expect(partialResult.canResume).toBe(true);

      // Verify resume strategy suggestion
      expect(partialResult.resumeStrategy).toBeDefined();
      expect(partialResult.resumeStrategy.strategy).toBe('RecursiveExecutionStrategy');
      expect(partialResult.resumeStrategy.continueFromCheckpoint).toBe(true);
    });

    it('should handle validation of completed tasks during recovery', async () => {
      const mockExecutionContext = {
        getCompletedSubtasks: () => [
          {
            id: 'validated-task',
            tool: 'test_tool',
            result: { success: true, data: 'test output' }
          }
        ],
        getPendingSubtasks: () => [],
        getFailedSubtasks: () => []
      };

      // Mock tool for validation
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'test_tool',
        execute: jest.fn(),
        inputSchema: { type: 'object' }
      });

      const error = new Error('Partial execution failure');
      const partialResult = errorRecovery.recoverPartialResults(mockExecutionContext, error);

      // Validate the completed task result
      const completedTask = partialResult.completed[0];
      const validationResult = await executionValidator.validateAfterExecution(
        completedTask,
        completedTask.result,
        {}
      );

      expect(validationResult.valid).toBe(true);
      expect(partialResult.completed).toHaveLength(1);
      expect(partialResult.completionPercentage).toBe(100);
    });
  });

  describe('State Rollback Integration', () => {
    it('should handle complex state rollback with multiple components', async () => {
      const mockTaskQueue = {
        export: jest.fn().mockReturnValue({
          pending: ['task1', 'task2'],
          completed: ['task0'],
          failed: []
        }),
        import: jest.fn().mockResolvedValue(true)
      };

      const mockProgressStream = {
        export: jest.fn().mockReturnValue({
          progress: 25,
          currentTask: 'task1',
          totalTasks: 4
        }),
        import: jest.fn().mockResolvedValue(true)
      };

      const mockContext = {
        taskId: 'rollback-test',
        sessionId: 'test-session',
        taskQueue: mockTaskQueue,
        progressStream: mockProgressStream,
        customState: { customValue: 'test' }
      };

      // Create state snapshot
      const snapshot = await errorRecovery.createStateSnapshot(mockContext);

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.context).toEqual(mockContext);
      expect(snapshot.queueState).toEqual({
        pending: ['task1', 'task2'],
        completed: ['task0'],
        failed: []
      });
      expect(snapshot.progressState).toEqual({
        progress: 25,
        currentTask: 'task1',
        totalTasks: 4
      });

      // Test rollback
      const rollbackResult = await errorRecovery.rollbackState(snapshot, mockContext);

      expect(rollbackResult).toBe(true);
      expect(mockTaskQueue.import).toHaveBeenCalledWith(snapshot.queueState);
      expect(mockProgressStream.import).toHaveBeenCalledWith(snapshot.progressState);
    });

    it('should handle rollback failures gracefully', async () => {
      const mockTaskQueue = {
        export: jest.fn().mockReturnValue({ tasks: ['task1'] }),
        import: jest.fn().mockRejectedValue(new Error('Queue import failed'))
      };

      const mockContext = {
        taskQueue: mockTaskQueue
      };

      const snapshot = await errorRecovery.createStateSnapshot(mockContext);
      const rollbackResult = await errorRecovery.rollbackState(snapshot, mockContext);

      expect(rollbackResult).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'State rollback failed',
        expect.objectContaining({ error: 'Queue import failed' })
      );
    });
  });

  describe('Cross-Component Error Classification', () => {
    it('should classify errors from different components consistently', async () => {
      const errorCases = [
        {
          error: new TaskError('Tool not found: missing_tool'),
          expectedType: 'tool_missing',
          recoverable: false
        },
        {
          error: new ResourceError('ECONNREFUSED'),
          expectedType: 'network',
          recoverable: true
        },
        {
          error: new SystemError('Rate limit exceeded'),
          expectedType: 'rate_limit',
          recoverable: true
        },
        {
          error: new DependencyError('Circular dependency detected'),
          expectedType: 'circular_dependency',
          recoverable: false
        }
      ];

      for (const testCase of errorCases) {
        const classification = errorRecovery.classifyError(testCase.error);
        const recoverable = errorRecovery.isRecoverable(testCase.error);

        expect(classification).toBe(testCase.expectedType);
        expect(recoverable).toBe(testCase.recoverable);
      }
    });
  });

  describe('Recovery Attempt Tracking Integration', () => {
    it('should track recovery attempts across multiple error types', async () => {
      const context = { taskId: 'tracking-test', sessionId: 'test-session' };

      // First recovery attempt
      const taskError = new TaskError('Task execution failed', { isRetryable: () => true });
      const result1 = await errorRecovery.recover(taskError, context);
      expect(result1.success).toBe(true);

      // Second recovery attempt (same context)
      const resourceError = new ResourceError('Resource temporarily unavailable', { isRetryable: () => true });
      const result2 = await errorRecovery.recover(resourceError, context);
      expect(result2.success).toBe(true);

      // Third recovery attempt (exceeds limit)
      const systemError = new SystemError('System overload');
      const result3 = await errorRecovery.recover(systemError, context);
      expect(result3.success).toBe(true);

      // Fourth recovery attempt (should be rejected)
      const finalError = new TaskError('Final task failure', { isRetryable: () => true });
      const result4 = await errorRecovery.recover(finalError, context);
      expect(result4.success).toBe(false);
      expect(result4.reason).toBe('Maximum recovery attempts exceeded');

      // Verify statistics
      const stats = errorRecovery.getStatistics();
      expect(stats.totalAttempts).toBeGreaterThanOrEqual(4);
      expect(stats.successfulRecoveries).toBeGreaterThanOrEqual(3);
    });

    it('should isolate recovery attempts by context', async () => {
      const context1 = { taskId: 'task-1', sessionId: 'session-1' };
      const context2 = { taskId: 'task-2', sessionId: 'session-2' };

      // Multiple attempts for context1
      for (let i = 0; i < 3; i++) {
        const error = new TaskError('Task failed', { isRetryable: () => true });
        const result = await errorRecovery.recover(error, context1);
        expect(result.success).toBe(true);
      }

      // First attempt for context2 should still succeed
      const error = new TaskError('Task failed', { isRetryable: () => true });
      const result = await errorRecovery.recover(error, context2);
      expect(result.success).toBe(true);

      // Fourth attempt for context1 should fail
      const finalError = new TaskError('Final task failure', { isRetryable: () => true });
      const finalResult = await errorRecovery.recover(finalError, context1);
      expect(finalResult.success).toBe(false);
      expect(finalResult.reason).toBe('Maximum recovery attempts exceeded');
    });
  });

  describe('Error Recovery with Validation Integration', () => {
    it('should validate recovery prerequisites before attempting recovery', async () => {
      const task = {
        id: 'validation-test',
        tool: 'test_tool',
        params: { input: 'test' },
        requires: ['sessionId', 'userId'],
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', required: true }
          }
        }
      };

      const context = {
        sessionId: 'test-session',
        userId: 'test-user'
      };

      // Mock tool exists
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'test_tool',
        execute: jest.fn(),
        inputSchema: { type: 'object' }
      });

      // Validate task before recovery attempt
      const preValidation = await executionValidator.validateBeforeExecution(task, context);
      expect(preValidation.valid).toBe(true);

      // Simulate task error and recovery
      const taskError = new TaskError('Tool execution temporarily failed', { isRetryable: () => true });
      const recoveryResult = await errorRecovery.recover(taskError, { ...context, taskId: task.id });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.action).toBe('retry_task');
    });

    it('should handle recovery when validation fails', async () => {
      const invalidTask = {
        id: 'invalid-task',
        tool: 'missing_tool',
        requires: ['missingContext']
      };

      const context = { sessionId: 'test-session' };

      // Mock tool doesn't exist
      mockToolRegistry.getTool.mockResolvedValue(null);

      // Validate task (should fail)
      const preValidation = await executionValidator.validateBeforeExecution(invalidTask, context);
      expect(preValidation.valid).toBe(false);
      expect(preValidation.errors).toContain('Tool not found: missing_tool');
      expect(preValidation.errors).toContain('Missing required context: missingContext');

      // Attempt recovery for a task that can't be properly validated
      const taskError = new TaskError('Invalid task execution failed', { isRetryable: () => false });
      const recoveryResult = await errorRecovery.recover(taskError, { ...context, taskId: invalidTask.id });

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.action).toBe('fail_task');
    });
  });

  describe('Comprehensive Recovery Workflow', () => {
    it('should handle end-to-end recovery scenario with state management', async () => {
      const task = {
        id: 'comprehensive-test',
        description: 'Complex task with multiple recovery points',
        strategy: 'RecursiveExecutionStrategy',
        subtasks: [
          { id: 'subtask1', tool: 'tool1' },
          { id: 'subtask2', tool: 'tool2' },
          { id: 'subtask3', tool: 'tool3' }
        ]
      };

      const mockExecutionContext = {
        getCompletedSubtasks: () => [
          { id: 'subtask1', result: { success: true, data: 'completed' } }
        ],
        getPendingSubtasks: () => [
          { id: 'subtask2' },
          { id: 'subtask3' }
        ],
        getFailedSubtasks: () => [],
        taskQueue: {
          export: jest.fn().mockReturnValue({ pending: ['subtask2', 'subtask3'] }),
          import: jest.fn().mockResolvedValue(true)
        },
        progressStream: {
          export: jest.fn().mockReturnValue({ progress: 33, currentTask: 'subtask2' }),
          import: jest.fn().mockResolvedValue(true)
        }
      };

      const context = {
        taskId: task.id,
        sessionId: 'comprehensive-session',
        executionContext: mockExecutionContext,
        ...mockExecutionContext
      };

      // Step 1: Strategy failure
      const strategyError = new StrategyError('Recursive execution failed due to resource limits');
      
      // Step 2: Get fallback strategy
      const fallbackResult = await errorRecovery.fallbackStrategy(task, 'RecursiveExecutionStrategy', strategyError);
      expect(fallbackResult.success).toBe(true);
      expect(fallbackResult.fallbackStrategy).toBe('AtomicExecutionStrategy');

      // Step 3: Recover partial results
      const partialResult = errorRecovery.recoverPartialResults(mockExecutionContext, strategyError);
      expect(partialResult.completed).toHaveLength(1);
      expect(partialResult.pending).toHaveLength(2);
      expect(partialResult.completionPercentage).toBe(33);

      // Step 4: Create state snapshot before recovery
      const snapshot = await errorRecovery.createStateSnapshot(context);
      expect(snapshot.queueState).toBeDefined();
      expect(snapshot.progressState).toBeDefined();

      // Step 5: Attempt recovery
      const recoveryResult = await errorRecovery.recover(strategyError, context);
      expect(recoveryResult.success).toBe(true);

      // Step 6: Verify recovery tracking
      const attempts = errorRecovery.getRecoveryAttempts(strategyError, context);
      expect(attempts).toBe(1);

      // Verify logging throughout the process
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting error recovery'),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recovery attempt completed'),
        expect.any(Object)
      );
    });
  });

  describe('Error Recovery Performance and Cleanup', () => {
    it('should handle cleanup of old recovery history', async () => {
      // Add old recovery attempts
      const oldTimestamp = Date.now() - (48 * 60 * 60 * 1000); // 2 days old
      errorRecovery.recoveryHistory = [
        { 
          timestamp: oldTimestamp, 
          key: 'OLD_ERROR:old-task',
          error: 'OldError',
          success: true
        }
      ];

      // Add new recovery attempt
      const error = new TaskError('Recent error', { isRetryable: () => true });
      await errorRecovery.recover(error, { taskId: 'new-task' });

      // Trigger cleanup
      errorRecovery.cleanupRecoveryHistory();

      // Old entries should be removed
      const oldEntries = errorRecovery.recoveryHistory.filter(h => h.key === 'OLD_ERROR:old-task');
      expect(oldEntries).toHaveLength(0);

      // Recent entries should remain
      const recentEntries = errorRecovery.recoveryHistory.filter(h => h.key === 'TaskError:new-task');
      expect(recentEntries).toHaveLength(1);
    });

    it('should maintain performance with many recovery attempts', async () => {
      const startTime = Date.now();
      
      // Generate many recovery attempts
      for (let i = 0; i < 100; i++) {
        const error = new TaskError(`Error ${i}`, { isRetryable: () => true });
        const context = { taskId: `task-${i % 10}` }; // Reuse some task IDs
        
        const result = await errorRecovery.recover(error, context);
        
        // Some should succeed, some should fail due to attempt limits
        if (i % 10 < 3) {
          expect(result.success).toBe(true);
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds for 100 attempts)
      expect(duration).toBeLessThan(5000);
      
      // Verify statistics are reasonable
      const stats = errorRecovery.getStatistics();
      expect(stats.totalAttempts).toBe(100);
      expect(stats.successfulRecoveries).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });
  });
});