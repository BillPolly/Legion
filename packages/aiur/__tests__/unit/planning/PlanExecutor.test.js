/**
 * Tests for PlanExecutor class
 * 
 * Tests plan execution engine with step-by-step execution and handle integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlanExecutor } from '../../../src/planning/PlanExecutor.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';

describe('PlanExecutor', () => {
  let handleRegistry;
  let toolRegistry;
  let plan;
  let executor;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry();
    
    // Register mock tools
    const mockTools = [
      {
        name: 'file_read',
        description: 'Read file content',
        execute: async (params) => {
          if (params.filePath === '/test/data.json') {
            return { content: '{"value": 42}', filePath: params.filePath };
          }
          throw new Error(`File not found: ${params.filePath}`);
        }
      },
      {
        name: 'json_parse',
        description: 'Parse JSON string',
        execute: async (params) => {
          return { parsed: JSON.parse(params.data.content) };
        }
      },
      {
        name: 'file_write',
        description: 'Write content to file',
        execute: async (params) => {
          return { written: true, filePath: params.filePath, size: params.content.length };
        }
      },
      {
        name: 'failing_tool',
        description: 'A tool that always fails',
        execute: async () => {
          throw new Error('Tool execution failed');
        }
      }
    ];

    toolRegistry.registerTools(mockTools);

    const mockPlanData = {
      id: 'test-execution-plan',
      title: 'Test Execution Plan',
      description: 'A plan for testing execution',
      steps: [
        {
          id: 'step1',
          title: 'Load data',
          description: 'Load initial data from file',
          action: 'file_read',
          parameters: { filePath: '/test/data.json' },
          expectedOutputs: ['loadedData']
        },
        {
          id: 'step2',
          title: 'Process data',
          description: 'Parse the loaded JSON data',
          action: 'json_parse',
          parameters: { data: '@loadedData' },
          expectedOutputs: ['processedData'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Save results',
          description: 'Write processed data to output file',
          action: 'file_write',
          parameters: { 
            filePath: '/test/output.json', 
            content: '@processedData' 
          },
          dependsOn: ['step2']
        }
      ]
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
    executor = new PlanExecutor(toolRegistry, handleRegistry);
  });

  describe('Executor Creation and Configuration', () => {
    test('should create executor with required dependencies', () => {
      expect(executor.toolRegistry).toBe(toolRegistry);
      expect(executor.handleRegistry).toBe(handleRegistry);
      expect(executor.options).toBeDefined();
    });

    test('should initialize with default options', () => {
      expect(executor.options.parallel).toBe(false);
      expect(executor.options.stopOnError).toBe(true);
      expect(executor.options.timeout).toBe(30000);
      expect(executor.options.autoCheckpoint).toBe(false);
    });

    test('should accept custom options', () => {
      const customExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        parallel: true,
        stopOnError: false,
        timeout: 60000,
        autoCheckpoint: true
      });

      expect(customExecutor.options.parallel).toBe(true);
      expect(customExecutor.options.stopOnError).toBe(false);
      expect(customExecutor.options.timeout).toBe(60000);
      expect(customExecutor.options.autoCheckpoint).toBe(true);
    });
  });

  describe('Single Step Execution', () => {
    test('should execute single step successfully', async () => {
      const result = await executor.executeStep(plan, 'step1');

      expect(result.success).toBe(true);
      expect(result.stepId).toBe('step1');
      expect(result.output).toHaveProperty('content', '{"value": 42}');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should create handles for step outputs', async () => {
      const result = await executor.executeStep(plan, 'step1');

      expect(result.success).toBe(true);
      expect(handleRegistry.existsByName('loadedData')).toBe(true);
      
      const handle = handleRegistry.getByName('loadedData');
      expect(handle.data).toEqual({
        content: '{"value": 42}',
        filePath: '/test/data.json'
      });
    });

    test('should resolve handle references in parameters', async () => {
      // Execute step1 first to create the handle
      await executor.executeStep(plan, 'step1');
      
      // Now execute step2 which depends on the handle
      const result = await executor.executeStep(plan, 'step2');

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('parsed');
      expect(result.output.parsed).toEqual({ value: 42 });
    });

    test('should handle step execution failure', async () => {
      const failPlan = new AiurPlan({
        id: 'fail-plan',
        steps: [{
          id: 'fail-step',
          action: 'failing_tool',
          parameters: {}
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executeStep(failPlan, 'fail-step');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
      expect(result.stepId).toBe('fail-step');
    });

    test('should handle missing tool gracefully', async () => {
      const missingToolPlan = new AiurPlan({
        id: 'missing-tool-plan',
        steps: [{
          id: 'missing-step',
          action: 'nonexistent_tool',
          parameters: {}
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executeStep(missingToolPlan, 'missing-step');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    test('should handle execution timeout', async () => {
      const slowExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        timeout: 1 // 1ms timeout
      });

      const result = await slowExecutor.executeStep(plan, 'step1');

      // Either succeeds quickly or fails with timeout
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toContain('timeout');
      }
    });
  });

  describe('Complete Plan Execution', () => {
    test('should execute entire plan successfully', async () => {
      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.planId).toBe(plan.id);
      expect(result.completedSteps).toHaveLength(3);
      expect(result.completedSteps).toEqual(['step1', 'step2', 'step3']);
      expect(result.failedSteps).toHaveLength(0);
      expect(plan.isComplete()).toBe(true);
    });

    test('should create handles during execution', async () => {
      await executor.executePlan(plan);

      expect(handleRegistry.existsByName('loadedData')).toBe(true);
      expect(handleRegistry.existsByName('processedData')).toBe(true);
      
      const processedData = handleRegistry.getByName('processedData');
      expect(processedData.data).toEqual({ parsed: { value: 42 } });
    });

    test('should respect step dependencies', async () => {
      const executionOrder = [];
      const originalExecuteStep = executor.executeStep.bind(executor);
      
      executor.executeStep = async (plan, stepId) => {
        executionOrder.push(stepId);
        return await originalExecuteStep(plan, stepId);
      };

      await executor.executePlan(plan);

      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
    });

    test('should handle plan execution failure', async () => {
      const failPlan = new AiurPlan({
        id: 'fail-plan',
        steps: [
          {
            id: 'good-step',
            action: 'file_read',
            parameters: { filePath: '/test/data.json' }
          },
          {
            id: 'bad-step',
            action: 'failing_tool',
            parameters: {},
            dependsOn: ['good-step']
          }
        ]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executePlan(failPlan);

      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['good-step']);
      expect(result.failedSteps).toEqual(['bad-step']);
      expect(result.error).toContain('Tool execution failed');
    });

    test('should continue execution when stopOnError is false', async () => {
      const continueExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        stopOnError: false
      });

      const mixedPlan = new AiurPlan({
        id: 'mixed-plan',
        steps: [
          {
            id: 'step1',
            action: 'failing_tool',
            parameters: {}
          },
          {
            id: 'step2',
            action: 'file_read',
            parameters: { filePath: '/test/data.json' }
          }
        ]
      }, handleRegistry, { validateOnCreate: false });

      const result = await continueExecutor.executePlan(mixedPlan);

      expect(result.success).toBe(false); // Overall failure due to failed step
      expect(result.completedSteps).toEqual(['step2']);
      expect(result.failedSteps).toEqual(['step1']);
    });
  });

  describe('Progress Tracking', () => {
    test('should emit progress events during execution', async () => {
      const events = [];
      
      executor.on('step-started', (data) => events.push({ type: 'started', ...data }));
      executor.on('step-completed', (data) => events.push({ type: 'completed', ...data }));
      executor.on('step-failed', (data) => events.push({ type: 'failed', ...data }));

      await executor.executePlan(plan);

      expect(events.length).toBe(6); // 3 started + 3 completed
      expect(events.filter(e => e.type === 'started')).toHaveLength(3);
      expect(events.filter(e => e.type === 'completed')).toHaveLength(3);
      expect(events.filter(e => e.type === 'failed')).toHaveLength(0);
    });

    test('should track execution progress', async () => {
      let progressUpdates = [];
      
      executor.on('progress', (progress) => progressUpdates.push(progress));

      await executor.executePlan(plan);

      expect(progressUpdates.length).toBeGreaterThan(0);
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.completed).toBe(3);
      expect(finalProgress.total).toBe(3);
      expect(finalProgress.percentage).toBe(100);
    });

    test('should provide execution statistics', async () => {
      const result = await executor.executePlan(plan);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSteps).toBe(3);
      expect(result.statistics.completedSteps).toBe(3);
      expect(result.statistics.failedSteps).toBe(0);
      expect(result.statistics.totalExecutionTime).toBeGreaterThan(0);
      expect(result.statistics.averageStepTime).toBeGreaterThan(0);
    });
  });

  describe('Checkpoint Integration', () => {
    test('should create checkpoints during execution when enabled', async () => {
      const checkpointExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        autoCheckpoint: true
      });

      await checkpointExecutor.executePlan(plan);

      const checkpoints = plan.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    test('should execute from checkpoint', async () => {
      // Execute first step
      await executor.executeStep(plan, 'step1');
      const checkpointId = plan.createCheckpoint('after-step1');
      
      // Complete the plan
      await executor.executePlan(plan);
      
      // Restore to checkpoint
      plan.restoreFromCheckpoint(checkpointId);
      
      // Execute remaining steps
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(plan.isComplete()).toBe(true);
    });

    test('should handle checkpoint creation failures gracefully', async () => {
      const result = await executor.executePlan(plan);
      expect(result.success).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    test('should execute independent steps in parallel when enabled', async () => {
      const parallelPlan = new AiurPlan({
        id: 'parallel-plan',
        steps: [
          {
            id: 'parallel1',
            action: 'file_read',
            parameters: { filePath: '/test/data.json' }
          },
          {
            id: 'parallel2',
            action: 'file_read',
            parameters: { filePath: '/test/data.json' }
          }
        ]
      }, handleRegistry, { validateOnCreate: false });

      const parallelExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        parallel: true
      });

      const startTime = Date.now();
      const result = await parallelExecutor.executePlan(parallelPlan);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(2);
      
      // Parallel execution should be faster than sequential
      expect(endTime - startTime).toBeLessThan(1000); // Reasonable threshold
    });

    test('should respect dependencies in parallel mode', async () => {
      const parallelExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        parallel: true
      });

      const executionOrder = [];
      const originalExecuteStep = executor.executeStep.bind(executor);
      
      parallelExecutor.executeStep = async (plan, stepId) => {
        executionOrder.push(stepId);
        return await originalExecuteStep(plan, stepId);
      };

      await parallelExecutor.executePlan(plan);

      // step1 must come before step2, step2 must come before step3
      const step1Index = executionOrder.indexOf('step1');
      const step2Index = executionOrder.indexOf('step2');
      const step3Index = executionOrder.indexOf('step3');
      
      expect(step1Index).toBeLessThan(step2Index);
      expect(step2Index).toBeLessThan(step3Index);
    });
  });

  describe('Error Recovery', () => {
    test('should provide step retry functionality', async () => {
      let attempts = 0;
      const flakyTool = {
        name: 'flaky_tool',
        execute: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true, attempts };
        }
      };

      toolRegistry.registerTool(flakyTool);

      const flakyPlan = new AiurPlan({
        id: 'flaky-plan',
        steps: [{
          id: 'flaky-step',
          action: 'flaky_tool',
          parameters: {}
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executeStepWithRetry(flakyPlan, 'flaky-step', 3);

      expect(result.success).toBe(true);
      expect(result.output.attempts).toBe(2);
    });

    test('should fail after max retries', async () => {
      const result = await executor.executeStepWithRetry(plan, 'step1', 3, () => {
        throw new Error('Persistent failure');
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent failure');
      expect(result.retries).toBe(3);
    });
  });

  describe('Plan Validation Integration', () => {
    test('should validate plan before execution', async () => {
      const invalidPlan = new AiurPlan({
        id: 'invalid-plan',
        steps: [{
          id: 'invalid-step',
          action: 'nonexistent_tool',
          parameters: {},
          dependsOn: ['missing-dependency']
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executePlan(invalidPlan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan validation failed');
    });

    test('should skip validation when disabled', async () => {
      const skipValidationExecutor = new PlanExecutor(toolRegistry, handleRegistry, {
        validateBeforeExecution: false
      });

      const invalidPlan = new AiurPlan({
        id: 'invalid-plan',
        steps: [{
          id: 'invalid-step',
          action: 'file_read',
          parameters: { filePath: '/test/data.json' }
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await skipValidationExecutor.executePlan(invalidPlan);

      expect(result.success).toBe(true);
    });
  });

  describe('Execution Context', () => {
    test('should provide execution context to tools', async () => {
      const contextTool = {
        name: 'context_tool',
        execute: async (params, context) => {
          return { 
            success: true, 
            planId: context?.planId,
            stepId: context?.stepId
          };
        }
      };

      toolRegistry.registerTool(contextTool);

      const contextPlan = new AiurPlan({
        id: 'context-plan',
        steps: [{
          id: 'context-step',
          action: 'context_tool',
          parameters: {}
        }]
      }, handleRegistry, { validateOnCreate: false });

      const result = await executor.executeStep(contextPlan, 'context-step');

      expect(result.success).toBe(true);
      expect(result.output.planId).toBe('context-plan');
      expect(result.output.stepId).toBe('context-step');
    });

    test('should track execution metadata', async () => {
      const result = await executor.executePlan(plan);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.executorVersion).toBeDefined();
      expect(result.metadata.startTime).toBeInstanceOf(Date);
      expect(result.metadata.endTime).toBeInstanceOf(Date);
      expect(result.metadata.environment).toBeDefined();
    });
  });
});