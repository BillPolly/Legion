/**
 * Tests for PlanExecutor Checkpoint Integration
 * 
 * Tests checkpoint creation, automatic checkpointing, rollback during execution,
 * and recovery from failures with checkpoint system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlanExecutor } from '../../../src/planning/PlanExecutor.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { CheckpointManager } from '../../../src/checkpoint/CheckpointManager.js';
import { StateCaptureSystem } from '../../../src/checkpoint/StateCaptureSystem.js';
import { RollbackSystem } from '../../../src/checkpoint/RollbackSystem.js';

describe('PlanExecutor Checkpoint Integration', () => {
  let toolRegistry;
  let handleRegistry;
  let executor;
  let plan;
  let checkpointManager;
  let stateCaptureSystem;
  let rollbackSystem;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    
    // Register test tools
    toolRegistry.registerTool({
      name: 'test_tool',
      async execute(params) {
        return { result: params.value * 2 };
      }
    });

    toolRegistry.registerTool({
      name: 'failing_tool',
      async execute() {
        throw new Error('Tool execution failed');
      }
    });

    toolRegistry.registerTool({
      name: 'slow_tool',
      async execute(params) {
        await new Promise(resolve => setTimeout(resolve, params.delay || 100));
        return { result: 'completed' };
      }
    });

    const mockPlanData = {
      id: 'checkpoint-executor-test',
      title: 'Checkpoint Executor Test Plan',
      description: 'A plan for testing checkpoint integration',
      steps: [
        {
          id: 'step1',
          title: 'Initialize',
          action: 'test_tool',
          parameters: { value: 10 },
          expectedOutputs: ['result']
        },
        {
          id: 'step2',
          title: 'Process',
          action: 'test_tool',
          parameters: { value: '@step1Result' },
          expectedOutputs: ['result'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Finalize',
          action: 'test_tool',
          parameters: { value: '@step2Result' },
          expectedOutputs: ['result'],
          dependsOn: ['step2']
        }
      ]
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
    checkpointManager = new CheckpointManager(plan, handleRegistry);
    stateCaptureSystem = new StateCaptureSystem(plan, handleRegistry, toolRegistry);
    rollbackSystem = new RollbackSystem(plan, handleRegistry, checkpointManager, stateCaptureSystem);
    
    executor = new PlanExecutor(toolRegistry, handleRegistry);
  });

  describe('Automatic Checkpointing', () => {
    test('should create checkpoints after each step when enabled', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(createCheckpointSpy).toHaveBeenCalledTimes(3);
      expect(createCheckpointSpy).toHaveBeenCalledWith(
        expect.stringContaining('After step1'),
        expect.any(Object)
      );
      expect(createCheckpointSpy).toHaveBeenCalledWith(
        expect.stringContaining('After step2'),
        expect.any(Object)
      );
      expect(createCheckpointSpy).toHaveBeenCalledWith(
        expect.stringContaining('After step3'),
        expect.any(Object)
      );
    });

    test('should not create checkpoints when disabled', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: false,
        checkpointManager
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(createCheckpointSpy).not.toHaveBeenCalled();
    });

    test('should create checkpoint with step metadata', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        checkpointOptions: {
          includeStepMetadata: true
        }
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      await executor.executeStep(plan, 'step1');
      
      expect(createCheckpointSpy).toHaveBeenCalledWith(
        expect.stringContaining('After step1'),
        expect.objectContaining({
          stepId: 'step1',
          stepTitle: 'Initialize'
        })
      );
    });

    test('should handle checkpoint creation failures gracefully', async () => {
      const failingCheckpointManager = {
        createCheckpoint: jest.fn().mockImplementation(() => {
          throw new Error('Checkpoint creation failed');
        })
      };

      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager: failingCheckpointManager
      });

      const result = await executor.executePlan(plan);
      
      // Execution should continue despite checkpoint failures
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(3);
    });
  });

  describe('Rollback During Execution', () => {
    test('should rollback to checkpoint on step failure', async () => {
      const planWithFailure = new AiurPlan({
        id: 'rollback-test',
        title: 'Rollback Test Plan',
        steps: [
          {
            id: 'step1',
            title: 'First step',
            action: 'test_tool',
            parameters: { value: 10 },
            expectedOutputs: ['result']
          },
          {
            id: 'step2',
            title: 'Failing step',
            action: 'failing_tool',
            parameters: {},
            dependsOn: ['step1']
          }
        ]
      }, handleRegistry);

      const failureCheckpointManager = new CheckpointManager(planWithFailure, handleRegistry);
      const failureRollbackSystem = new RollbackSystem(
        planWithFailure, 
        handleRegistry, 
        failureCheckpointManager, 
        stateCaptureSystem
      );
      
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager: failureCheckpointManager,
        rollbackSystem: failureRollbackSystem,
        rollbackOnFailure: true
      });

      const result = await executor.executePlan(planWithFailure);
      
      // Check that a checkpoint was created after step1
      const checkpoints = failureCheckpointManager.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
      
      expect(result.success).toBe(false);
      expect(result.completedSteps).toHaveLength(1);
      expect(result.failedSteps).toHaveLength(1);
      expect(result.rollbacks).toBeDefined();
      expect(result.rollbacks).toHaveLength(1);
      expect(result.rollbacks[0].stepId).toBe('step2');
    });

    test('should support custom rollback strategies', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        rollbackSystem,
        rollbackOnFailure: true,
        rollbackStrategy: 'partial',
        rollbackOptions: {
          includePlanState: true,
          includeHandleState: false
        }
      });

      const rollbackSpy = jest.spyOn(rollbackSystem, 'partialRollback');
      
      // Create a failing step
      plan.steps.push({
        id: 'step4',
        action: 'failing_tool',
        parameters: {},
        dependsOn: ['step3']
      });

      await executor.executePlan(plan);
      
      expect(rollbackSpy).toHaveBeenCalled();
      expect(rollbackSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          includePlanState: true,
          includeHandleState: false
        })
      );
    });

    test('should continue execution after successful rollback', async () => {
      const planWithRecovery = new AiurPlan({
        id: 'recovery-test',
        title: 'Recovery Test Plan',
        steps: [
          {
            id: 'step1',
            title: 'First step',
            action: 'test_tool',
            parameters: { value: 10 },
            expectedOutputs: ['result']
          },
          {
            id: 'step2',
            title: 'Retryable step',
            action: 'test_tool',
            parameters: { value: 20 },
            expectedOutputs: ['result'],
            dependsOn: ['step1']
          },
          {
            id: 'step3',
            title: 'Final step',
            action: 'test_tool',
            parameters: { value: 30 },
            expectedOutputs: ['result'],
            dependsOn: ['step2']
          }
        ]
      }, handleRegistry);

      const recoveryCheckpointManager = new CheckpointManager(planWithRecovery, handleRegistry);
      const recoveryRollbackSystem = new RollbackSystem(
        planWithRecovery,
        handleRegistry,
        recoveryCheckpointManager,
        stateCaptureSystem
      );

      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager: recoveryCheckpointManager,
        rollbackSystem: recoveryRollbackSystem,
        rollbackOnFailure: true,
        continueAfterRollback: true,
        maxRetries: 1
      });

      const result = await executor.executePlan(planWithRecovery);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(3);
    });
  });

  describe('Checkpoint Events and Monitoring', () => {
    test('should emit checkpoint events', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager
      });

      const checkpointCreated = jest.fn();
      const checkpointFailed = jest.fn();
      
      executor.on('checkpoint-created', checkpointCreated);
      executor.on('checkpoint-failed', checkpointFailed);
      
      await executor.executePlan(plan);
      
      expect(checkpointCreated).toHaveBeenCalledTimes(3);
      expect(checkpointCreated).toHaveBeenCalledWith(expect.objectContaining({
        planId: plan.id,
        stepId: 'step1',
        checkpointId: expect.any(String)
      }));
      expect(checkpointFailed).not.toHaveBeenCalled();
    });

    test('should track checkpoint statistics', async () => {
      // Add a small delay to checkpoint creation to ensure measurable time
      const originalCreate = checkpointManager.createCheckpoint;
      checkpointManager.createCheckpoint = function(...args) {
        const start = Date.now();
        // Busy wait for 10ms to simulate slow checkpoint creation
        while (Date.now() - start < 10) {
          // Do nothing
        }
        return originalCreate.apply(this, args);
      };
      
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        trackCheckpointStats: true
      });

      await executor.executePlan(plan);
      
      const stats = executor.getCheckpointStatistics();
      
      expect(stats.totalCheckpoints).toBe(3);
      expect(stats.successfulCheckpoints).toBe(3);
      expect(stats.failedCheckpoints).toBe(0);
      expect(stats.averageCheckpointTime).toBeGreaterThanOrEqual(9); // Allow for slight timing variance
    });
  });

  describe('Manual Checkpoint Control', () => {
    test('should create checkpoint on demand', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        checkpointManager
      });

      await executor.executeStep(plan, 'step1');
      
      const checkpointId = await executor.createCheckpoint('Manual checkpoint');
      
      expect(checkpointId).toBeDefined();
      expect(checkpointManager.hasCheckpoint(checkpointId)).toBe(true);
    });

    test('should rollback to specific checkpoint', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        checkpointManager,
        rollbackSystem
      });

      await executor.executeStep(plan, 'step1');
      const checkpoint1 = await executor.createCheckpoint('Checkpoint 1');
      
      await executor.executeStep(plan, 'step2');
      const checkpoint2 = await executor.createCheckpoint('Checkpoint 2');
      
      await executor.executeStep(plan, 'step3');
      
      // Rollback to first checkpoint
      const rollbackResult = await executor.rollbackToCheckpoint(checkpoint1);
      
      expect(rollbackResult.success).toBe(true);
      expect(plan.state.completedSteps).toEqual(['step1']);
    });

    test('should list available checkpoints', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager
      });

      await executor.executePlan(plan);
      
      const checkpoints = executor.listCheckpoints();
      
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].name).toContain('After step1');
    });
  });

  describe('Checkpoint Integration with Parallel Execution', () => {
    test('should handle checkpoints in parallel execution', async () => {
      const parallelPlan = new AiurPlan({
        id: 'parallel-checkpoint-test',
        title: 'Parallel Checkpoint Test',
        steps: [
          {
            id: 'parallel1',
            title: 'First parallel',
            action: 'slow_tool',
            parameters: { delay: 50 }
          },
          {
            id: 'parallel2',
            title: 'Second parallel',
            action: 'slow_tool',
            parameters: { delay: 50 }
          },
          {
            id: 'dependent',
            title: 'Dependent step',
            action: 'test_tool',
            parameters: { value: 100 },
            dependsOn: ['parallel1', 'parallel2']
          }
        ]
      }, handleRegistry);

      const parallelCheckpointManager = new CheckpointManager(parallelPlan, handleRegistry);
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        parallel: true,
        autoCheckpoint: true,
        checkpointManager: parallelCheckpointManager
      });

      const result = await executor.executePlan(parallelPlan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(3);
      
      const checkpoints = parallelCheckpointManager.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
    });

    test('should synchronize checkpoints in parallel execution', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        parallel: true,
        autoCheckpoint: true,
        checkpointManager,
        synchronizeCheckpoints: true
      });

      const checkpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      await executor.executePlan(plan);
      
      // Verify checkpoints are created in order despite parallel capability
      const calls = checkpointSpy.mock.calls;
      expect(calls[0][0]).toContain('step1');
      expect(calls[1][0]).toContain('step2');
      expect(calls[2][0]).toContain('step3');
    });
  });

  describe('Recovery Scenarios', () => {
    test('should recover from partial execution with checkpoint', async () => {
      // Execute partial plan
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager
      });

      await executor.executeStep(plan, 'step1');
      await executor.executeStep(plan, 'step2');
      
      const lastCheckpoint = checkpointManager.listCheckpoints().pop();
      
      // Create new executor instance (simulating recovery)
      const newExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        checkpointManager,
        rollbackSystem
      });

      // Resume from checkpoint
      const result = await newExecutor.resumeFromCheckpoint(plan, lastCheckpoint.id);
      
      expect(result.success).toBe(true);
      expect(result.resumedFrom).toBe('step2');
      expect(result.completedSteps).toEqual(['step3']); // Only newly completed steps
    });

    test('should handle checkpoint corruption gracefully', async () => {
      const corruptCheckpointManager = {
        getCheckpoint: jest.fn().mockReturnValue(null),
        hasCheckpoint: jest.fn().mockReturnValue(true),
        createCheckpoint: jest.fn().mockReturnValue('corrupt-id')
      };

      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        checkpointManager: corruptCheckpointManager,
        rollbackSystem
      });

      const result = await executor.resumeFromCheckpoint(plan, 'corrupt-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Checkpoint corrupted or not found');
    });
  });

  describe('Checkpoint Configuration', () => {
    test('should respect checkpoint intervals', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        checkpointInterval: 2 // Checkpoint every 2 steps
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      await executor.executePlan(plan);
      
      // With interval 2: checkpoint after step 2 and NO checkpoint after step 3
      // Because step 3 is the 3rd step and 3 % 2 = 1, not 0
      expect(createCheckpointSpy).toHaveBeenCalledTimes(1); // Only after step2
      expect(createCheckpointSpy).toHaveBeenCalledWith(
        expect.stringContaining('After step2'),
        expect.any(Object)
      );
    });

    test('should apply checkpoint filters', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        checkpointFilter: (stepId) => stepId !== 'step2' // Skip step2
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      await executor.executePlan(plan);
      
      expect(createCheckpointSpy).toHaveBeenCalledTimes(2);
      expect(createCheckpointSpy).not.toHaveBeenCalledWith(expect.stringContaining('step2'));
    });

    test('should use custom checkpoint naming', async () => {
      executor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true,
        checkpointManager,
        checkpointNaming: (stepId, stepTitle) => `Custom: ${stepTitle} (${stepId})`
      });

      const createCheckpointSpy = jest.spyOn(checkpointManager, 'createCheckpoint');
      
      await executor.executeStep(plan, 'step1');
      
      expect(createCheckpointSpy).toHaveBeenCalledWith('Custom: Initialize (step1)', expect.any(Object));
    });
  });
});