/**
 * Tests for ExecutionResult and StepResult classes
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ExecutionResult, StepResult, ExecutionState } from '../../src/core/execution/results/ExecutionResult.js';

describe('StepResult', () => {
  test('should create successful step result', () => {
    const result = StepResult.success('step1', { output: 'test' }, 1000, { artifact1: 'value1' });
    
    expect(result.stepId).toBe('step1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ output: 'test' });
    expect(result.executionTime).toBe(1000);
    expect(result.artifacts).toEqual({ artifact1: 'value1' });
    expect(result.error).toBeNull();
    expect(result.timestamp).toBeCloseTo(Date.now(), -2);
  });

  test('should create failure step result', () => {
    const error = new Error('Test error');
    const result = StepResult.failure('step1', error, 500);
    
    expect(result.stepId).toBe('step1');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.executionTime).toBe(500);
    expect(result.artifacts).toEqual({});
    expect(result.error).toBe(error);
    expect(result.timestamp).toBeCloseTo(Date.now(), -2);
  });
});

describe('ExecutionResult', () => {
  let result;

  beforeEach(() => {
    result = new ExecutionResult('test-plan');
  });

  test('should initialize correctly', () => {
    expect(result.planId).toBe('test-plan');
    expect(result.state).toBe(ExecutionState.RUNNING);
    expect(result.completedSteps).toEqual([]);
    expect(result.failedSteps).toEqual([]);
    expect(result.skippedSteps).toEqual([]);
    expect(result.artifactRegistry.size).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.startTime).toBeCloseTo(Date.now(), -2);
    expect(result.endTime).toBeNull();
  });

  test('should add completed step correctly', () => {
    const step = { id: 'step1', description: 'Test step' };
    const stepResult = StepResult.success('step1', { output: 'test' }, 1000, {
      testArtifact: { name: 'testArtifact', description: 'Test artifact', value: 'test-value' }
    });

    result.addCompletedStep(step, stepResult);

    expect(result.completedSteps).toHaveLength(1);
    expect(result.completedSteps[0].step).toEqual(step);
    expect(result.completedSteps[0].result).toBe(stepResult);
    expect(result.metrics.completedCount).toBe(1);
    expect(result.metrics.totalExecutionTime).toBe(1000);
    
    // Check artifact registry
    expect(result.artifactRegistry.has('testArtifact')).toBe(true);
    expect(result.artifactRegistry.get('testArtifact').sourceStep).toBe('step1');
  });

  test('should add failed step correctly', () => {
    const step = { id: 'step1', description: 'Test step' };
    const error = new Error('Test error');

    result.addFailedStep(step, error, 500);

    expect(result.failedSteps).toHaveLength(1);
    expect(result.failedSteps[0].step).toEqual(step);
    expect(result.failedSteps[0].error).toBe(error);
    expect(result.failedSteps[0].executionTime).toBe(500);
    expect(result.metrics.failedCount).toBe(1);
    expect(result.metrics.totalExecutionTime).toBe(500);
    expect(result.errors).toContain(error);
    expect(result.state).toBe(ExecutionState.FAILED);
    expect(result.endTime).not.toBeNull();
  });

  test('should add skipped step correctly', () => {
    const step = { id: 'step1', description: 'Test step' };

    result.addSkippedStep(step, 'Previous step failed');

    expect(result.skippedSteps).toHaveLength(1);
    expect(result.skippedSteps[0].step).toEqual(step);
    expect(result.skippedSteps[0].reason).toBe('Previous step failed');
    expect(result.metrics.skippedCount).toBe(1);
  });

  test('should mark as completed', () => {
    result.markCompleted(5);

    expect(result.state).toBe(ExecutionState.COMPLETED);
    expect(result.endTime).not.toBeNull();
    expect(result.metrics.totalSteps).toBe(5);
  });

  test('should mark as cancelled', () => {
    result.markCancelled('User cancelled');

    expect(result.state).toBe(ExecutionState.CANCELLED);
    expect(result.endTime).not.toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('User cancelled');
  });

  test('should calculate success rate correctly', () => {
    expect(result.getSuccessRate()).toBe(100); // No steps yet
    
    // Add some completed and failed steps
    const step1 = { id: 'step1' };
    const step2 = { id: 'step2' };
    const step3 = { id: 'step3' };
    
    result.addCompletedStep(step1, StepResult.success('step1', {}));
    result.addCompletedStep(step2, StepResult.success('step2', {}));
    result.addFailedStep(step3, new Error('Failed'));

    expect(result.getSuccessRate()).toBeCloseTo(66.67, 1);
  });

  test('should get duration correctly', async () => {
    // For a newly created result, duration should be small but non-negative
    const initialDuration = result.getDuration();
    expect(initialDuration).toBeGreaterThanOrEqual(0);
    
    // Wait a bit to ensure some time passes
    await new Promise(resolve => setTimeout(resolve, 10));
    
    result.markCompleted(1);
    const duration = result.getDuration();
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBe(result.endTime - result.startTime);
  });

  test('should get last failed step', () => {
    expect(result.getLastFailedStep()).toBeNull();
    
    const step1 = { id: 'step1' };
    const step2 = { id: 'step2' };
    
    result.addFailedStep(step1, new Error('Error 1'));
    result.addFailedStep(step2, new Error('Error 2'));

    const lastFailed = result.getLastFailedStep();
    expect(lastFailed.step.id).toBe('step2');
  });

  test('should generate summary correctly', () => {
    result.addCompletedStep({ id: 'step1' }, StepResult.success('step1', {}));
    result.addFailedStep({ id: 'step2' }, new Error('Test error'));
    result.artifactRegistry.set('artifact1', { value: 'test' });

    const summary = result.getSummary();

    expect(summary.planId).toBe('test-plan');
    expect(summary.state).toBe(ExecutionState.FAILED);
    expect(summary.metrics.completedCount).toBe(1);
    expect(summary.metrics.failedCount).toBe(1);
    expect(summary.successRate).toBe(50);
    expect(summary.artifactsCreated).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.lastError).toBe('Test error');
  });

  test('should generate replanning context', () => {
    // Add completed step
    result.addCompletedStep(
      { id: 'step1', description: 'Completed step' },
      StepResult.success('step1', { output: 'result1' })
    );
    
    // Add failed step
    result.addFailedStep(
      { id: 'step2', description: 'Failed step', tool: 'testTool' },
      new Error('Step failed')
    );
    
    // Add skipped step
    result.addSkippedStep(
      { id: 'step3', description: 'Skipped step' },
      'Previous step failed'
    );

    const context = result.getReplanningContext();

    expect(context.completedSteps).toHaveLength(1);
    expect(context.completedSteps[0].id).toBe('step1');
    expect(context.completedSteps[0].status).toBe('done');
    
    expect(context.failedSteps).toHaveLength(1);
    expect(context.failedSteps[0].id).toBe('step2');
    expect(context.failedSteps[0].status).toBe('failed');
    expect(context.failedSteps[0].tool).toBe('testTool');
    
    expect(context.remainingSteps).toHaveLength(1);
    expect(context.remainingSteps[0].id).toBe('step3');
    expect(context.remainingSteps[0].status).toBe('pending');

    expect(context.lastFailure).toBeDefined();
    expect(context.lastFailure.step.id).toBe('step2');
    expect(context.lastFailure.error).toBe('Step failed');

    expect(context.currentState).toBeDefined();
    expect(context.currentState.successRate).toBe(50);
  });
});