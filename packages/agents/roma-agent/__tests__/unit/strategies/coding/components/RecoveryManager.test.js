import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RecoveryManager from '../../../../../src/strategies/coding/components/RecoveryManager.js';

describe('RecoveryManager', () => {
  let recoveryManager;
  let mockLlmClient;
  let mockToolRegistry;
  let mockProjectPlanner;

  beforeEach(() => {
    mockLlmClient = {
      sendMessage: jest.fn()
    };

    mockToolRegistry = {
      getTool: jest.fn()
    };

    mockProjectPlanner = {
      replan: jest.fn()
    };

    recoveryManager = new RecoveryManager(mockLlmClient, mockToolRegistry);
    recoveryManager.projectPlanner = mockProjectPlanner;
  });

  describe('Initialization', () => {
    it('should create a RecoveryManager instance', () => {
      expect(recoveryManager).toBeInstanceOf(RecoveryManager);
    });

    it('should initialize with proper dependencies', () => {
      expect(recoveryManager.llmClient).toBe(mockLlmClient);
      expect(recoveryManager.toolRegistry).toBe(mockToolRegistry);
    });

    it('should initialize with default configuration', () => {
      const config = recoveryManager.getConfiguration();
      expect(config).toMatchObject({
        maxRetries: {
          TRANSIENT: 3,
          RESOURCE: 2,
          LOGIC: 1,
          FATAL: 0
        },
        backoffStrategy: 'exponential',
        resourceCleanupEnabled: true,
        replanningEnabled: true
      });
    });
  });

  describe('Error Classification', () => {
    it('should classify transient errors correctly', () => {
      const networkError = new Error('ECONNRESET: Connection reset by peer');
      const rateLimitError = new Error('Rate limit exceeded');
      const timeoutError = new Error('Request timeout');

      expect(recoveryManager.classifyError(networkError)).toBe('TRANSIENT');
      expect(recoveryManager.classifyError(rateLimitError)).toBe('TRANSIENT');
      expect(recoveryManager.classifyError(timeoutError)).toBe('TRANSIENT');
    });

    it('should classify resource errors correctly', () => {
      const memoryError = new Error('JavaScript heap out of memory');
      const diskError = new Error('ENOSPC: no space left on device');
      const quotaError = new Error('Quota exceeded');

      expect(recoveryManager.classifyError(memoryError)).toBe('RESOURCE');
      expect(recoveryManager.classifyError(diskError)).toBe('RESOURCE');
      expect(recoveryManager.classifyError(quotaError)).toBe('RESOURCE');
    });

    it('should classify logic errors correctly', () => {
      const typeError = new TypeError('Cannot read property of undefined');
      const validationError = new Error('Invalid input: missing required field');
      const dependencyError = new Error('Missing dependency: express');

      expect(recoveryManager.classifyError(typeError)).toBe('LOGIC');
      expect(recoveryManager.classifyError(validationError)).toBe('LOGIC');
      expect(recoveryManager.classifyError(dependencyError)).toBe('LOGIC');
    });

    it('should classify fatal errors correctly', () => {
      const corruptionError = new Error('State corruption detected');
      const systemError = new Error('System failure: critical component unavailable');
      const unrecoverableError = new Error('Unrecoverable error: data integrity compromised');

      expect(recoveryManager.classifyError(corruptionError)).toBe('FATAL');
      expect(recoveryManager.classifyError(systemError)).toBe('FATAL');
      expect(recoveryManager.classifyError(unrecoverableError)).toBe('FATAL');
    });

    it('should default to LOGIC for unknown errors', () => {
      const unknownError = new Error('Some random error message');
      expect(recoveryManager.classifyError(unknownError)).toBe('LOGIC');
    });
  });

  describe('Recovery Strategy Selection', () => {
    it('should select retry with backoff for transient errors', async () => {
      const task = { id: 'task-1', type: 'generate', description: 'Test task' };
      const error = new Error('ECONNRESET');
      const attempt = 1;

      jest.spyOn(recoveryManager, 'retryWithBackoff').mockResolvedValue({ success: true });

      const result = await recoveryManager.recover(error, task, attempt);

      expect(recoveryManager.retryWithBackoff).toHaveBeenCalledWith(task, attempt);
      expect(result.success).toBe(true);
    });

    it('should select cleanup and retry for resource errors', async () => {
      const task = { id: 'task-2', type: 'test', description: 'Test task' };
      const error = new Error('JavaScript heap out of memory');
      const attempt = 1;

      jest.spyOn(recoveryManager, 'freeResources').mockResolvedValue(true);
      jest.spyOn(recoveryManager, 'retryTask').mockResolvedValue({ success: true });

      const result = await recoveryManager.recover(error, task, attempt);

      expect(recoveryManager.freeResources).toHaveBeenCalled();
      expect(recoveryManager.retryTask).toHaveBeenCalledWith(task);
      expect(result.success).toBe(true);
    });

    it('should select replanning for logic errors', async () => {
      const task = { id: 'task-3', type: 'validate', description: 'Test task' };
      const error = new TypeError('Invalid input');
      const attempt = 1;

      const mockReplan = { tasks: [{ id: 'replanned-task' }] };
      jest.spyOn(recoveryManager, 'replanTask').mockResolvedValue(mockReplan);
      jest.spyOn(recoveryManager, 'executeReplan').mockResolvedValue({ success: true });

      const result = await recoveryManager.recover(error, task, attempt);

      expect(recoveryManager.replanTask).toHaveBeenCalledWith(task, error);
      expect(recoveryManager.executeReplan).toHaveBeenCalledWith(mockReplan);
      expect(result.success).toBe(true);
    });

    it('should rollback for fatal errors', async () => {
      const task = { id: 'task-4', type: 'deploy', description: 'Test task' };
      const error = new Error('State corruption detected');
      const attempt = 1;

      jest.spyOn(recoveryManager, 'rollbackToCheckpoint').mockResolvedValue(true);

      await expect(recoveryManager.recover(error, task, attempt)).rejects.toThrow('Fatal error: State corruption detected');
      expect(recoveryManager.rollbackToCheckpoint).toHaveBeenCalled();
    });
  });

  describe('Retry with Backoff', () => {
    it('should calculate exponential backoff correctly', () => {
      const delay1 = recoveryManager.calculateBackoff(1, { strategy: 'exponential', baseMs: 1000 });
      const delay2 = recoveryManager.calculateBackoff(2, { strategy: 'exponential', baseMs: 1000 });
      const delay3 = recoveryManager.calculateBackoff(3, { strategy: 'exponential', baseMs: 1000 });

      expect(delay1).toBe(1000); // 1000 * 2^0
      expect(delay2).toBe(2000); // 1000 * 2^1
      expect(delay3).toBe(4000); // 1000 * 2^2
    });

    it('should calculate linear backoff correctly', () => {
      const delay1 = recoveryManager.calculateBackoff(1, { strategy: 'linear', baseMs: 1000 });
      const delay2 = recoveryManager.calculateBackoff(2, { strategy: 'linear', baseMs: 1000 });
      const delay3 = recoveryManager.calculateBackoff(3, { strategy: 'linear', baseMs: 1000 });

      expect(delay1).toBe(1000); // 1000 * 1
      expect(delay2).toBe(2000); // 1000 * 2
      expect(delay3).toBe(3000); // 1000 * 3
    });

    it('should use fixed delay for fixed strategy', () => {
      const delay1 = recoveryManager.calculateBackoff(1, { strategy: 'fixed', baseMs: 1500 });
      const delay2 = recoveryManager.calculateBackoff(2, { strategy: 'fixed', baseMs: 1500 });
      const delay3 = recoveryManager.calculateBackoff(3, { strategy: 'fixed', baseMs: 1500 });

      expect(delay1).toBe(1500);
      expect(delay2).toBe(1500);
      expect(delay3).toBe(1500);
    });

    it('should respect maximum retry attempts', async () => {
      const task = { 
        id: 'task-retry',
        type: 'generate',
        description: 'Test task',
        retry: { maxAttempts: 3, strategy: 'exponential', baseMs: 100 }
      };

      const result = await recoveryManager.retryWithBackoff(task, 4); // Exceeds max attempts

      expect(result.success).toBe(false);
      expect(result.reason).toBe('max_retries_exceeded');
      expect(result.attempts).toBe(4);
    });

    it('should create retry result with correct delay calculation', async () => {
      const task = { 
        id: 'task-retry',
        type: 'generate',
        description: 'Test task',
        retry: { maxAttempts: 3, strategy: 'exponential', baseMs: 1000 }
      };

      const result = await recoveryManager.retryWithBackoff(task, 2);

      expect(result.success).toBe(true);
      expect(result.action).toBe('retry');
      expect(result.delay).toBe(2000); // 1000 * 2^1
      expect(result.attempt).toBe(2);
    });
  });

  describe('Resource Management', () => {
    it('should free memory resources', async () => {
      global.gc = jest.fn(); // Mock garbage collector

      const freed = await recoveryManager.freeResources();

      expect(freed).toBe(true);
      expect(global.gc).toHaveBeenCalled();
    });

    it('should clear caches during resource cleanup', async () => {
      const mockCache = {
        clear: jest.fn(),
        size: 150
      };

      recoveryManager.cache = mockCache;

      const freed = await recoveryManager.freeResources();

      expect(freed).toBe(true);
      expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should handle missing garbage collector gracefully', async () => {
      const originalGc = global.gc;
      delete global.gc;

      const freed = await recoveryManager.freeResources();

      expect(freed).toBe(true); // Should still succeed without gc

      global.gc = originalGc; // Restore
    });
  });

  describe('Task Replanning', () => {
    it('should analyze failure reasons correctly', async () => {
      const task = { 
        id: 'failed-task',
        type: 'generate',
        description: 'Create Express server',
        strategy: 'SimpleNodeServer'
      };
      const error = new Error('Missing dependency: express');

      mockLlmClient.sendMessage.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              reason: 'missing_dependency',
              missingItems: ['express'],
              failedApproaches: ['SimpleNodeServer'],
              suggestedConstraints: {
                ensureDependencies: ['express'],
                useAlternativeStrategy: true
              }
            })
          }
        }]
      });

      const analysis = await recoveryManager.analyzeFailure(task, error);

      expect(analysis.reason).toBe('missing_dependency');
      expect(analysis.missingItems).toContain('express');
      expect(analysis.failedApproaches).toContain('SimpleNodeServer');
      expect(analysis.suggestedConstraints.ensureDependencies).toContain('express');
    });

    it('should extract constraints from failure analysis', () => {
      const analysis = {
        reason: 'invalid_syntax',
        failedApproaches: ['direct_generation'],
        suggestedConstraints: {
          useValidation: true,
          templateBased: true,
          avoidComplexSyntax: true
        }
      };

      const constraints = recoveryManager.extractConstraints(analysis);

      expect(constraints).toMatchObject({
        useValidation: true,
        templateBased: true,
        avoidComplexSyntax: true,
        avoidStrategies: ['direct_generation']
      });
    });

    it('should create replan request correctly', async () => {
      const task = { 
        id: 'replan-task',
        type: 'generate',
        description: 'Create API endpoints',
        strategy: 'SimpleNodeServer'
      };
      const error = new Error('Validation failed');

      const mockAnalysis = {
        reason: 'validation_failure',
        failedApproaches: ['SimpleNodeServer'],
        suggestedConstraints: {
          useStrictValidation: true,
          incrementalGeneration: true
        }
      };

      const mockReplan = {
        tasks: [
          { id: 'replan-1', type: 'validate', description: 'Validate requirements first' },
          { id: 'replan-2', type: 'generate', description: 'Generate with validation' }
        ]
      };

      jest.spyOn(recoveryManager, 'analyzeFailure').mockResolvedValue(mockAnalysis);
      mockProjectPlanner.replan.mockResolvedValue(mockReplan);

      const result = await recoveryManager.replanTask(task, error);

      expect(mockProjectPlanner.replan).toHaveBeenCalledWith({
        originalTask: task,
        failureReason: 'validation_failure',
        constraints: {
          useStrictValidation: true,
          incrementalGeneration: true,
          avoidStrategies: ['SimpleNodeServer']
        },
        avoidStrategies: ['SimpleNodeServer']
      });

      expect(result).toBe(mockReplan);
    });
  });

  describe('Checkpoint and Rollback', () => {
    it('should create checkpoint before risky operations', async () => {
      const state = {
        projectId: 'test-project',
        tasks: [{ id: 'task-1', status: 'completed' }],
        artifacts: [{ id: 'artifact-1', type: 'code' }]
      };

      const checkpointId = await recoveryManager.createCheckpoint(state);

      expect(checkpointId).toMatch(/^checkpoint_\d+$/);
      
      const storedCheckpoint = recoveryManager.getCheckpoint(checkpointId);
      expect(storedCheckpoint.state).toEqual(state);
      expect(storedCheckpoint.timestamp).toBeGreaterThan(Date.now() - 1000);
    });

    it('should rollback to specific checkpoint', async () => {
      const state1 = { projectId: 'test', tasks: [] };
      const state2 = { projectId: 'test', tasks: [{ id: 'task-1' }] };

      const checkpoint1 = await recoveryManager.createCheckpoint(state1);
      const checkpoint2 = await recoveryManager.createCheckpoint(state2);

      const result = await recoveryManager.rollbackToCheckpoint(checkpoint1);

      expect(result.success).toBe(true);
      expect(result.state).toEqual(state1);
      expect(result.checkpointId).toBe(checkpoint1);
    });

    it('should rollback to latest checkpoint if none specified', async () => {
      const state1 = { projectId: 'test', tasks: [] };
      const state2 = { projectId: 'test', tasks: [{ id: 'task-1' }] };

      await recoveryManager.createCheckpoint(state1);
      const latest = await recoveryManager.createCheckpoint(state2);

      const result = await recoveryManager.rollbackToCheckpoint();

      expect(result.success).toBe(true);
      expect(result.state).toEqual(state2);
      expect(result.checkpointId).toBe(latest);
    });

    it('should handle rollback failure gracefully', async () => {
      const result = await recoveryManager.rollbackToCheckpoint('non-existent-checkpoint');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Checkpoint not found: non-existent-checkpoint');
    });
  });

  describe('Default Recovery', () => {
    it('should provide default recovery strategy', async () => {
      const task = { id: 'unknown-task', type: 'unknown', description: 'Unknown task' };
      const error = new Error('Unknown error type');

      const result = await recoveryManager.defaultRecovery(task, error);

      expect(result.success).toBe(true);
      expect(result.action).toBe('log_and_continue');
      expect(result.logged).toBe(true);
      expect(result.task).toBe(task);
    });

    it('should log error details in default recovery', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const task = { id: 'log-task', type: 'test', description: 'Test task' };
      const error = new Error('Test error for logging');

      await recoveryManager.defaultRecovery(task, error);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Recovery: Using default strategy for unknown error type',
        expect.objectContaining({
          taskId: 'log-task',
          error: 'Test error for logging'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Recovery Statistics', () => {
    it('should track recovery attempts by error type', () => {
      recoveryManager.recordRecoveryAttempt('TRANSIENT', true);
      recoveryManager.recordRecoveryAttempt('TRANSIENT', false);
      recoveryManager.recordRecoveryAttempt('RESOURCE', true);
      recoveryManager.recordRecoveryAttempt('LOGIC', true);

      const stats = recoveryManager.getRecoveryStatistics();

      expect(stats.byType.TRANSIENT).toEqual({
        total: 2,
        successful: 1,
        failed: 1,
        successRate: 0.5
      });
      expect(stats.byType.RESOURCE).toEqual({
        total: 1,
        successful: 1,
        failed: 0,
        successRate: 1.0
      });
      expect(stats.overall.total).toBe(4);
      expect(stats.overall.successful).toBe(3);
    });

    it('should calculate overall success rate correctly', () => {
      recoveryManager.recordRecoveryAttempt('TRANSIENT', true);
      recoveryManager.recordRecoveryAttempt('TRANSIENT', true);
      recoveryManager.recordRecoveryAttempt('RESOURCE', false);
      recoveryManager.recordRecoveryAttempt('LOGIC', true);

      const stats = recoveryManager.getRecoveryStatistics();

      expect(stats.overall.successRate).toBe(0.75); // 3/4
    });
  });

  describe('Configuration Management', () => {
    it('should allow custom configuration', () => {
      const customConfig = {
        maxRetries: {
          TRANSIENT: 5,
          RESOURCE: 3,
          LOGIC: 2,
          FATAL: 0
        },
        backoffStrategy: 'linear',
        resourceCleanupEnabled: false
      };

      const customRecoveryManager = new RecoveryManager(mockLlmClient, mockToolRegistry, customConfig);
      const config = customRecoveryManager.getConfiguration();

      expect(config.maxRetries.TRANSIENT).toBe(5);
      expect(config.backoffStrategy).toBe('linear');
      expect(config.resourceCleanupEnabled).toBe(false);
    });

    it('should merge custom config with defaults', () => {
      const partialConfig = {
        maxRetries: {
          TRANSIENT: 10 // Only override this one
        }
      };

      const customRecoveryManager = new RecoveryManager(mockLlmClient, mockToolRegistry, partialConfig);
      const config = customRecoveryManager.getConfiguration();

      expect(config.maxRetries.TRANSIENT).toBe(10); // Custom value
      expect(config.maxRetries.RESOURCE).toBe(2);   // Default value
      expect(config.backoffStrategy).toBe('exponential'); // Default value
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null or undefined errors gracefully', () => {
      expect(recoveryManager.classifyError(null)).toBe('LOGIC');
      expect(recoveryManager.classifyError(undefined)).toBe('LOGIC');
    });

    it('should handle errors without message property', () => {
      const errorObject = { code: 'UNKNOWN_ERROR' };
      expect(recoveryManager.classifyError(errorObject)).toBe('LOGIC');
    });

    it('should handle circular reference errors during analysis', async () => {
      const circularError = new Error('Circular reference');
      const task = { id: 'circular-task' };
      task.circular = task; // Create circular reference

      // Should not throw despite circular reference
      const result = await recoveryManager.defaultRecovery(task, circularError);
      expect(result.success).toBe(true);
    });

    it('should validate recovery result format', async () => {
      const task = { id: 'format-task', type: 'test' };
      const error = new Error('Format test error');

      const result = await recoveryManager.recover(error, task, 1);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('action');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.action).toBe('string');
    });
  });
});