/**
 * Tests for PlanExecutor class
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlanExecutor, ExecutionConfig, ExecutionStrategy } from '../../src/core/execution/PlanExecutor.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';
import { ExecutionState } from '../../src/core/execution/results/ExecutionResult.js';

describe('PlanExecutor', () => {
  let executor;
  let mockTools;
  let simplePlan;

  beforeEach(() => {
    const config = new ExecutionConfig({
      strategy: ExecutionStrategy.SEQUENTIAL,
      debugMode: false,
      stepTimeout: 5000
    });

    executor = new PlanExecutor(config);

    // Create mock tools
    mockTools = [
      {
        name: 'addNumbers',
        run: jest.fn().mockResolvedValue({
          success: true,
          data: { result: 5, operation: 'addition' }
        })
      },
      {
        name: 'multiplyNumbers',
        run: jest.fn().mockResolvedValue({
          success: true,
          data: { result: 10, operation: 'multiplication' }
        })
      },
      {
        name: 'failingTool',
        run: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      }
    ];

    // Create simple plan
    simplePlan = [
      new PlanStep(
        'step1',
        'Add 2 + 3',
        'addNumbers',
        { a: 2, b: 3 },
        [],
        { result: { name: 'sum', description: 'The sum result' } }
      ),
      new PlanStep(
        'step2',
        'Multiply result by 2',
        'multiplyNumbers',
        { a: '@sum', b: 2 },
        ['step1'],
        { result: { name: 'product', description: 'The multiplication result' } }
      )
    ];
  });

  describe('sequential execution', () => {
    test('should execute plan successfully', async () => {
      const result = await executor.execute(simplePlan, mockTools);

      expect(result.isComplete()).toBe(true);
      expect(result.completedSteps).toHaveLength(2);
      expect(result.failedSteps).toHaveLength(0);
      expect(result.metrics.completedCount).toBe(2);
      expect(result.metrics.failedCount).toBe(0);

      // Check tool calls
      expect(mockTools[0].run).toHaveBeenCalledWith({ a: 2, b: 3 });
      expect(mockTools[1].run).toHaveBeenCalledWith({ a: 5, b: 2 }); // @sum resolved to 5

      // Check artifacts
      expect(result.artifactRegistry.has('sum')).toBe(true);
      expect(result.artifactRegistry.has('product')).toBe(true);
      expect(result.artifactRegistry.get('sum').value).toBe(5);
      expect(result.artifactRegistry.get('product').value).toBe(10);
    });

    test('should handle tool execution failure', async () => {
      const failingPlan = [
        new PlanStep('step1', 'This will fail', 'failingTool', {}, [])
      ];

      const result = await executor.execute(failingPlan, mockTools);

      expect(result.isFailed()).toBe(true);
      expect(result.completedSteps).toHaveLength(0);
      expect(result.failedSteps).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Tool execution failed');
    });

    test('should handle missing tool', async () => {
      const planWithMissingTool = [
        new PlanStep('step1', 'Use missing tool', 'nonExistentTool', {}, [])
      ];

      const result = await executor.execute(planWithMissingTool, mockTools);

      expect(result.isFailed()).toBe(true);
      expect(result.failedSteps).toHaveLength(1);
      expect(result.errors[0].message).toContain('Tool \'nonExistentTool\' not found');
    });

    test('should resolve artifact references', async () => {
      const result = await executor.execute(simplePlan, mockTools);

      expect(result.isComplete()).toBe(true);
      
      // Verify that step2 received the resolved artifact value
      expect(mockTools[1].run).toHaveBeenCalledWith({ a: 5, b: 2 });
    });

    test('should handle artifact reference to non-existent artifact', async () => {
      const planWithBadReference = [
        new PlanStep('step1', 'Reference missing artifact', 'addNumbers', { a: '@nonExistent', b: 3 }, [])
      ];

      const result = await executor.execute(planWithBadReference, mockTools);

      expect(result.isFailed()).toBe(true);
      expect(result.errors[0].message).toContain('Artifact \'nonExistent\' not found in registry');
    });
  });

  describe('execution strategies', () => {
    test('should support parallel execution config', () => {
      const config = new ExecutionConfig({
        strategy: ExecutionStrategy.PARALLEL,
        maxParallelSteps: 2
      });

      const parallelExecutor = new PlanExecutor(config);
      expect(parallelExecutor.config.strategy).toBe(ExecutionStrategy.PARALLEL);
      expect(parallelExecutor.config.maxParallelSteps).toBe(2);
    });

    test('should support dependency-aware execution config', () => {
      const config = new ExecutionConfig({
        strategy: ExecutionStrategy.DEPENDENCY_AWARE,
        maxParallelSteps: 3
      });

      const dependencyExecutor = new PlanExecutor(config);
      expect(dependencyExecutor.config.strategy).toBe(ExecutionStrategy.DEPENDENCY_AWARE);
      expect(dependencyExecutor.config.maxParallelSteps).toBe(3);
    });
  });

  describe('continue on failure', () => {
    test('should stop execution by default on failure', async () => {
      const mixedPlan = [
        new PlanStep('step1', 'This will pass', 'addNumbers', { a: 1, b: 2 }, []),
        new PlanStep('step2', 'This will fail', 'failingTool', {}, []),
        new PlanStep('step3', 'This should be skipped', 'addNumbers', { a: 3, b: 4 }, [])
      ];

      const result = await executor.execute(mixedPlan, mockTools);

      expect(result.isFailed()).toBe(true);
      expect(result.completedSteps).toHaveLength(1);
      expect(result.failedSteps).toHaveLength(1);
      expect(result.skippedSteps).toHaveLength(1);
      expect(result.skippedSteps[0].reason).toBe('Previous step failed');
    });

    test('should continue execution when configured', async () => {
      const config = new ExecutionConfig({
        strategy: ExecutionStrategy.SEQUENTIAL,
        continueOnFailure: true
      });
      const continuingExecutor = new PlanExecutor(config);

      const mixedPlan = [
        new PlanStep('step1', 'This will pass', 'addNumbers', { a: 1, b: 2 }, []),
        new PlanStep('step2', 'This will fail', 'failingTool', {}, []),
        new PlanStep('step3', 'This should still run', 'addNumbers', { a: 3, b: 4 }, [])
      ];

      const result = await continuingExecutor.execute(mixedPlan, mockTools);

      expect(result.isFailed()).toBe(true); // Still marked as failed due to step2
      expect(result.completedSteps).toHaveLength(2); // step1 and step3
      expect(result.failedSteps).toHaveLength(1); // step2
      expect(result.skippedSteps).toHaveLength(0); // Nothing skipped
    });
  });

  describe('artifact extraction', () => {
    test('should extract artifacts from successful results', async () => {
      const result = await executor.execute(simplePlan, mockTools);

      expect(result.isComplete()).toBe(true);
      
      // Check extracted artifacts
      const sumArtifact = result.artifactRegistry.get('sum');
      expect(sumArtifact).toBeDefined();
      expect(sumArtifact.name).toBe('sum');
      expect(sumArtifact.description).toBe('The sum result');
      expect(sumArtifact.value).toBe(5);
      expect(sumArtifact.sourceField).toBe('result');

      const productArtifact = result.artifactRegistry.get('product');
      expect(productArtifact).toBeDefined();
      expect(productArtifact.name).toBe('product');
      expect(productArtifact.description).toBe('The multiplication result');
      expect(productArtifact.value).toBe(10);
      expect(productArtifact.sourceField).toBe('result');
    });

    test('should not extract artifacts from failed steps', async () => {
      const planWithFailingStep = [
        new PlanStep(
          'step1',
          'This will fail',
          'failingTool',
          {},
          [],
          { result: { name: 'shouldNotExist', description: 'Should not be created' } }
        )
      ];

      const result = await executor.execute(planWithFailingStep, mockTools);

      expect(result.isFailed()).toBe(true);
      expect(result.artifactRegistry.has('shouldNotExist')).toBe(false);
    });
  });

  describe('execution metrics', () => {
    test('should track execution metrics correctly', async () => {
      const result = await executor.execute(simplePlan, mockTools);

      expect(result.metrics.totalSteps).toBe(2);
      expect(result.metrics.completedCount).toBe(2);
      expect(result.metrics.failedCount).toBe(0);
      expect(result.metrics.skippedCount).toBe(0);
      expect(result.metrics.totalExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.getSuccessRate()).toBe(100);
      expect(result.getDuration()).toBeGreaterThanOrEqual(0);
    });

    test('should provide execution stats', async () => {
      await executor.execute(simplePlan, mockTools);
      
      const stats = executor.getExecutionStats();
      
      expect(stats.isExecuting).toBe(false);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('timeout handling', () => {
    test('should timeout long-running tools', async () => {
      const slowTool = {
        name: 'slowTool',
        run: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
        )
      };

      const config = new ExecutionConfig({
        stepTimeout: 100 // 100ms timeout
      });
      const timeoutExecutor = new PlanExecutor(config);

      const slowPlan = [
        new PlanStep('step1', 'This will timeout', 'slowTool', {}, [])
      ];

      const result = await timeoutExecutor.execute(slowPlan, [slowTool]);

      expect(result.isFailed()).toBe(true);
      expect(result.errors[0].message).toContain('timed out after 100ms');
    });
  });

  describe('concurrent execution prevention', () => {
    test('should prevent concurrent executions', async () => {
      // Start first execution (don't await yet)
      const promise1 = executor.execute(simplePlan, mockTools);
      
      // Try to start second execution immediately
      await expect(executor.execute(simplePlan, mockTools))
        .rejects.toThrow('PlanExecutor is already executing a plan');
      
      // Wait for first execution to complete
      await promise1;
      
      // Now second execution should work
      const result2 = await executor.execute(simplePlan, mockTools);
      expect(result2.isComplete()).toBe(true);
    });
  });
});