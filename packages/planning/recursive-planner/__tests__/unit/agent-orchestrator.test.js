/**
 * Tests for AgentOrchestrator class
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AgentOrchestrator, OrchestratorConfig } from '../../src/core/orchestration/AgentOrchestrator.js';
import { PlanExecutor } from '../../src/core/execution/PlanExecutor.js';
import { ExecutionResult, StepResult } from '../../src/core/execution/results/ExecutionResult.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';

describe('AgentOrchestrator', () => {
  let orchestrator;
  let mockPlanningAgent;
  let mockExecutor;
  let mockTools;

  beforeEach(() => {
    // Mock planning agent
    mockPlanningAgent = {
      createPlan: jest.fn(),
      replan: jest.fn(),
      setDependencies: jest.fn(),
      getStats: jest.fn().mockReturnValue({ type: 'planning' })
    };

    // Mock executor
    mockExecutor = {
      execute: jest.fn(),
      getExecutionStats: jest.fn().mockReturnValue({ totalExecutions: 0 })
    };

    // Mock tools
    mockTools = [
      { name: 'tool1', run: jest.fn() },
      { name: 'tool2', run: jest.fn() }
    ];

    const config = new OrchestratorConfig({
      maxReplanAttempts: 3,
      debugMode: false
    });

    orchestrator = new AgentOrchestrator(mockPlanningAgent, mockExecutor, config);
  });

  describe('successful execution', () => {
    test('should achieve goal on first attempt', async () => {
      // Mock successful plan and execution
      const plan = [
        new PlanStep('step1', 'Test step', 'tool1', { param: 'value' }, [])
      ];

      const executionResult = new ExecutionResult('test-plan');
      executionResult.addCompletedStep(
        plan[0],
        StepResult.success('step1', { result: 'success' }, 1000)
      );
      executionResult.markCompleted(1);

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockExecutor.execute.mockResolvedValue(executionResult);

      const result = await orchestrator.achieve('Test goal', mockTools);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Goal achieved: Test goal');
      expect(result.context.attempts).toBe(1);
      expect(result.context.executionSummary.metrics.totalSteps).toBe(1);

      expect(mockPlanningAgent.createPlan).toHaveBeenCalledWith('Test goal', mockTools, {});
      expect(mockExecutor.execute).toHaveBeenCalledWith(
        plan,
        mockTools,
        expect.any(Object), // artifact registry
        expect.objectContaining({ attempt: 1 })
      );
    });
  });

  describe('replanning scenarios', () => {
    test('should replan after execution failure', async () => {
      const goal = 'Test goal with failure';

      // First plan
      const initialPlan = [
        new PlanStep('step1', 'This will fail', 'tool1', {}, [])
      ];

      // Failed execution result
      const failedResult = new ExecutionResult('test-plan');
      failedResult.addFailedStep(initialPlan[0], new Error('Tool failed'));

      // Second plan (after replanning)
      const replan = [
        new PlanStep('step1_retry', 'Retry with different approach', 'tool2', {}, [])
      ];

      // Successful execution result
      const successResult = new ExecutionResult('test-plan-2');
      successResult.addCompletedStep(
        replan[0],
        StepResult.success('step1_retry', { result: 'success' }, 1000)
      );
      successResult.markCompleted(1);

      // Mock the sequence
      mockPlanningAgent.createPlan.mockResolvedValueOnce(initialPlan);
      mockExecutor.execute.mockResolvedValueOnce(failedResult);
      mockPlanningAgent.replan.mockResolvedValueOnce(replan);
      mockExecutor.execute.mockResolvedValueOnce(successResult);

      const result = await orchestrator.achieve(goal, mockTools);

      expect(result.success).toBe(true);
      expect(result.context.attempts).toBe(2);

      expect(mockPlanningAgent.createPlan).toHaveBeenCalledTimes(1);
      expect(mockPlanningAgent.replan).toHaveBeenCalledTimes(1);
      expect(mockExecutor.execute).toHaveBeenCalledTimes(2);

      // Verify replan was called with correct context
      expect(mockPlanningAgent.replan).toHaveBeenCalledWith(
        goal,
        failedResult,
        mockTools,
        {}
      );
    });

    test('should fail after max replan attempts', async () => {
      const goal = 'Impossible goal';

      // Always return failing plans and execution
      const plan = [new PlanStep('step1', 'Always fails', 'tool1', {}, [])];
      const failedResult = new ExecutionResult('test-plan');
      failedResult.addFailedStep(plan[0], new Error('Always fails'));

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockPlanningAgent.replan.mockResolvedValue(plan);
      mockExecutor.execute.mockResolvedValue(failedResult);

      const result = await orchestrator.achieve(goal, mockTools);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to achieve goal after 3 attempts');

      // Should have tried 3 times (initial + 2 replans)
      expect(mockPlanningAgent.createPlan).toHaveBeenCalledTimes(1);
      expect(mockPlanningAgent.replan).toHaveBeenCalledTimes(2);
      expect(mockExecutor.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    test('should handle planning errors', async () => {
      const planningError = new Error('Planning failed');
      mockPlanningAgent.createPlan.mockRejectedValue(planningError);

      const result = await orchestrator.achieve('Test goal', mockTools);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Planning failed');
      expect(result.error).toBe(planningError);
    });

    test('should handle execution errors', async () => {
      const plan = [new PlanStep('step1', 'Test step', 'tool1', {}, [])];
      const executionError = new Error('Execution failed');

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockExecutor.execute.mockRejectedValue(executionError);

      const result = await orchestrator.achieve('Test goal', mockTools);

      expect(result.success).toBe(false);
      expect(result.error).toBe(executionError);
    });

    test('should handle replanning errors', async () => {
      const goal = 'Test goal';

      // First execution fails
      const initialPlan = [new PlanStep('step1', 'Fails', 'tool1', {}, [])];
      const failedResult = new ExecutionResult('test-plan');
      failedResult.addFailedStep(initialPlan[0], new Error('Tool failed'));

      // Replanning also fails
      const replanError = new Error('Replanning failed');

      mockPlanningAgent.createPlan.mockResolvedValue(initialPlan);
      mockExecutor.execute.mockResolvedValue(failedResult);
      mockPlanningAgent.replan.mockRejectedValue(replanError);

      const result = await orchestrator.achieve(goal, mockTools);

      expect(result.success).toBe(false);
      expect(result.error).toBe(replanError);

      expect(mockPlanningAgent.replan).toHaveBeenCalledTimes(1);
    });
  });

  describe('resource constraints', () => {
    test('should respect resource constraints', async () => {
      const config = new OrchestratorConfig({
        resourceConstraints: {
          wouldExceedLimits: jest.fn().mockReturnValue(true)
        }
      });

      const constrainedOrchestrator = new AgentOrchestrator(mockPlanningAgent, mockExecutor, config);

      const result = await constrainedOrchestrator.achieve('Test goal', mockTools);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Resource limits exceeded');
    });
  });

  describe('dependency injection', () => {
    test('should propagate dependencies to planning agent', () => {
      const dependencies = {
        tracer: { startSpan: jest.fn() },
        llm: { complete: jest.fn() }
      };

      orchestrator.setDependencies(dependencies);

      expect(mockPlanningAgent.setDependencies).toHaveBeenCalledWith(dependencies);
    });
  });

  describe('statistics and monitoring', () => {
    test('should provide orchestrator statistics', async () => {
      // Perform one successful orchestration
      const plan = [new PlanStep('step1', 'Test', 'tool1', {}, [])];
      const result = new ExecutionResult('test-plan');
      result.addCompletedStep(plan[0], StepResult.success('step1', {}, 1000));
      result.markCompleted(1);

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockExecutor.execute.mockResolvedValue(result);

      await orchestrator.achieve('Test goal', mockTools);

      const stats = orchestrator.getStats();

      expect(stats.orchestratorId).toBeDefined();
      expect(stats.totalOrchestrations).toBe(1);
      expect(stats.successfulOrchestrations).toBe(1);
      expect(stats.averageAttempts).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.planningAgent).toEqual({ type: 'planning' });
      expect(stats.executor).toEqual({ totalExecutions: 0 });
    });

    test('should track multiple orchestrations', async () => {
      const plan = [new PlanStep('step1', 'Test', 'tool1', {}, [])];
      
      // First orchestration - success
      const successResult = new ExecutionResult('test-plan-1');
      successResult.addCompletedStep(plan[0], StepResult.success('step1', {}, 1000));
      successResult.markCompleted(1);

      // Second orchestration - failure
      const failureResult = new ExecutionResult('test-plan-2');
      failureResult.addFailedStep(plan[0], new Error('Failed'));

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockExecutor.execute
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(failureResult);

      // Perform orchestrations
      await orchestrator.achieve('Goal 1', mockTools);
      await orchestrator.achieve('Goal 2', mockTools);

      const stats = orchestrator.getStats();

      expect(stats.totalOrchestrations).toBe(2);
      expect(stats.successfulOrchestrations).toBe(1);
      expect(stats.averageAttempts).toBe(1);
    });

    test('should clear history', async () => {
      const plan = [new PlanStep('step1', 'Test', 'tool1', {}, [])];
      const result = new ExecutionResult('test-plan');
      result.markCompleted(1);

      mockPlanningAgent.createPlan.mockResolvedValue(plan);
      mockExecutor.execute.mockResolvedValue(result);

      await orchestrator.achieve('Test goal', mockTools);

      expect(orchestrator.getStats().totalOrchestrations).toBe(1);

      orchestrator.clearHistory();

      expect(orchestrator.getStats().totalOrchestrations).toBe(0);
    });
  });

  describe('configuration', () => {
    test('should use default configuration', () => {
      const defaultOrchestrator = new AgentOrchestrator(mockPlanningAgent);

      expect(defaultOrchestrator.config.maxReplanAttempts).toBe(3);
      expect(defaultOrchestrator.config.debugMode).toBe(false);
      expect(defaultOrchestrator.config.continueOnFailure).toBe(false);
      expect(defaultOrchestrator.executor).toBeInstanceOf(PlanExecutor);
    });

    test('should accept custom configuration', () => {
      const config = new OrchestratorConfig({
        maxReplanAttempts: 5,
        debugMode: true,
        continueOnFailure: true,
        executionStrategy: 'parallel'
      });

      const customOrchestrator = new AgentOrchestrator(mockPlanningAgent, mockExecutor, config);

      expect(customOrchestrator.config.maxReplanAttempts).toBe(5);
      expect(customOrchestrator.config.debugMode).toBe(true);
      expect(customOrchestrator.config.continueOnFailure).toBe(true);
      expect(customOrchestrator.config.executionStrategy).toBe('parallel');
    });
  });
});