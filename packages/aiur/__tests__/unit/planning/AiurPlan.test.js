/**
 * Tests for AiurPlan class
 * 
 * Tests enhanced plan functionality with checkpoint management and handle integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

describe('AiurPlan', () => {
  let handleRegistry;
  let plan;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    
    const mockPlanData = {
      id: 'test-plan-1',
      title: 'Test Plan',
      description: 'A test plan for validation',
      steps: [
        {
          id: 'step1',
          title: 'Load data',
          description: 'Load initial data',
          action: 'file_read',
          parameters: { filePath: '/test/data.json' },
          expectedOutputs: ['loadedData']
        },
        {
          id: 'step2',
          title: 'Process data',
          description: 'Transform the loaded data',
          action: 'json_parse',
          parameters: { data: '@loadedData' },
          expectedOutputs: ['processedData'],
          dependsOn: ['step1']
        },
        {
          id: 'step3',
          title: 'Save results',
          description: 'Save processed data',
          action: 'file_write',
          parameters: { filePath: '/test/output.json', content: '@processedData' },
          dependsOn: ['step2']
        }
      ],
      metadata: {
        created: new Date(),
        author: 'test'
      }
    };

    plan = new AiurPlan(mockPlanData, handleRegistry);
  });

  describe('Plan Creation and Basic Properties', () => {
    test('should create plan with basic properties', () => {
      expect(plan.id).toBe('test-plan-1');
      expect(plan.title).toBe('Test Plan');
      expect(plan.description).toBe('A test plan for validation');
      expect(plan.steps).toHaveLength(3);
    });

    test('should initialize with handle registry', () => {
      expect(plan.handleRegistry).toBe(handleRegistry);
      expect(plan.state.handles).toEqual({});
    });

    test('should initialize execution state', () => {
      expect(plan.state.status).toBe('created');
      expect(plan.state.currentStep).toBeNull();
      expect(plan.state.completedSteps).toEqual([]);
      expect(plan.state.failedSteps).toEqual([]);
    });

    test('should initialize checkpoint system', () => {
      expect(plan.checkpoints).toEqual({});
      expect(plan.state.lastCheckpoint).toBeNull();
    });
  });

  describe('Plan Validation', () => {
    test('should validate plan structure', () => {
      const validation = plan.validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should detect missing dependencies', () => {
      const invalidPlan = new AiurPlan({
        id: 'invalid',
        steps: [
          {
            id: 'step1',
            action: 'test',
            dependsOn: ['nonexistent']
          }
        ]
      }, handleRegistry, { validateOnCreate: false });

      const validation = invalidPlan.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('dependency'))).toBe(true);
    });

    test('should detect circular dependencies', () => {
      const circularPlan = new AiurPlan({
        id: 'circular',
        steps: [
          {
            id: 'step1',
            action: 'test',
            dependsOn: ['step2']
          },
          {
            id: 'step2',
            action: 'test',
            dependsOn: ['step1']
          }
        ]
      }, handleRegistry, { validateOnCreate: false });

      const validation = circularPlan.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true);
    });

    test('should validate step parameters', () => {
      // Complete step1 first to satisfy dependency
      plan.startStep('step1');
      plan.completeStep('step1');
      
      const validation = plan.validateStep('step2');
      
      expect(validation.valid).toBe(true);
      expect(validation.resolvedParameters).toHaveProperty('data', '@loadedData');
    });
  });

  describe('Handle Integration', () => {
    test('should create handle for step output', () => {
      const stepOutput = { data: 'test data', id: 123 };
      
      plan.createStepHandle('step1', 'testOutput', stepOutput);
      
      expect(handleRegistry.existsByName('testOutput')).toBe(true);
      const handle = handleRegistry.getByName('testOutput');
      expect(handle.data).toEqual(stepOutput);
    });

    test('should track handle creation in state', () => {
      plan.createStepHandle('step1', 'testHandle', { value: 42 });
      
      expect(plan.state.handles).toHaveProperty('testHandle');
      expect(plan.state.handles.testHandle).toEqual({
        stepId: 'step1',
        createdAt: expect.any(Date)
      });
    });

    test('should get step handles', () => {
      plan.createStepHandle('step1', 'handle1', { a: 1 });
      plan.createStepHandle('step1', 'handle2', { b: 2 });
      plan.createStepHandle('step2', 'handle3', { c: 3 });
      
      const step1Handles = plan.getStepHandles('step1');
      expect(step1Handles).toHaveLength(2);
      expect(step1Handles.map(h => h.name)).toContain('handle1');
      expect(step1Handles.map(h => h.name)).toContain('handle2');
    });

    test('should resolve handle references in parameters', () => {
      handleRegistry.create('testData', { value: 'resolved' });
      
      const resolved = plan.resolveStepParameters({
        normal: 'value',
        handle: '@testData',
        nested: { ref: '@testData' }
      });
      
      expect(resolved.normal).toBe('value');
      expect(resolved.handle).toEqual({ value: 'resolved' });
      expect(resolved.nested.ref).toEqual({ value: 'resolved' });
    });

    test('should handle missing handle references gracefully', () => {
      const resolved = plan.resolveStepParameters({
        missing: '@nonexistent'
      });
      
      expect(resolved.missing).toBe('@nonexistent'); // Preserved for later resolution
    });
  });

  describe('Checkpoint Management', () => {
    test('should create checkpoint', () => {
      plan.state.currentStep = 'step1';
      plan.state.completedSteps = ['step1'];
      handleRegistry.create('testHandle', { data: 'checkpoint test' });
      
      const checkpointId = plan.createCheckpoint('after-step1');
      
      expect(plan.checkpoints).toHaveProperty(checkpointId);
      const checkpoint = plan.checkpoints[checkpointId];
      expect(checkpoint.name).toBe('after-step1');
      expect(checkpoint.planState.currentStep).toBe('step1');
      expect(checkpoint.handleSnapshot).toBeDefined();
    });

    test('should restore from checkpoint', () => {
      // Setup initial state
      plan.state.currentStep = 'step2';
      plan.state.completedSteps = ['step1', 'step2'];
      handleRegistry.create('tempHandle', { temp: true });
      
      // Create checkpoint
      const checkpointId = plan.createCheckpoint('test-restore');
      
      // Modify state after checkpoint
      plan.state.currentStep = 'step3';
      plan.state.completedSteps.push('step3');
      handleRegistry.create('newHandle', { new: true });
      
      // Restore from checkpoint
      plan.restoreFromCheckpoint(checkpointId);
      
      expect(plan.state.currentStep).toBe('step2');
      expect(plan.state.completedSteps).toEqual(['step1', 'step2']);
      expect(handleRegistry.existsByName('tempHandle')).toBe(true);
      expect(handleRegistry.existsByName('newHandle')).toBe(false);
    });

    test('should validate checkpoint before creation', () => {
      const validation = plan.validateCheckpoint();
      
      expect(validation.valid).toBe(true);
      expect(validation.canCreateCheckpoint).toBe(true);
    });

    test('should list available checkpoints', () => {
      plan.createCheckpoint('checkpoint1');
      plan.createCheckpoint('checkpoint2');
      
      const checkpoints = plan.listCheckpoints();
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints.map(c => c.name)).toContain('checkpoint1');
      expect(checkpoints.map(c => c.name)).toContain('checkpoint2');
    });

    test('should delete checkpoint', () => {
      const checkpointId = plan.createCheckpoint('temp-checkpoint');
      
      expect(plan.checkpoints).toHaveProperty(checkpointId);
      
      plan.deleteCheckpoint(checkpointId);
      
      expect(plan.checkpoints).not.toHaveProperty(checkpointId);
    });
  });

  describe('Execution State Management', () => {
    test('should update execution status', () => {
      plan.updateStatus('running');
      
      expect(plan.state.status).toBe('running');
      expect(plan.state.statusHistory).toHaveLength(2); // created + running
      expect(plan.state.statusHistory[1].status).toBe('running');
    });

    test('should mark step as started', () => {
      plan.startStep('step1');
      
      expect(plan.state.currentStep).toBe('step1');
      expect(plan.state.stepStates.step1.status).toBe('running');
      expect(plan.state.stepStates.step1.startedAt).toBeInstanceOf(Date);
    });

    test('should mark step as completed', () => {
      plan.startStep('step1');
      const output = { result: 'success' };
      
      plan.completeStep('step1', output);
      
      expect(plan.state.completedSteps).toContain('step1');
      expect(plan.state.stepStates.step1.status).toBe('completed');
      expect(plan.state.stepStates.step1.output).toEqual(output);
      expect(plan.state.stepStates.step1.completedAt).toBeInstanceOf(Date);
    });

    test('should mark step as failed', () => {
      plan.startStep('step1');
      const error = { message: 'Step failed', code: 'ERROR' };
      
      plan.failStep('step1', error);
      
      expect(plan.state.failedSteps).toContain('step1');
      expect(plan.state.stepStates.step1.status).toBe('failed');
      expect(plan.state.stepStates.step1.error).toEqual(error);
      expect(plan.state.stepStates.step1.failedAt).toBeInstanceOf(Date);
    });

    test('should calculate progress', () => {
      plan.startStep('step1');
      plan.completeStep('step1');
      plan.startStep('step2');
      plan.completeStep('step2');
      
      const progress = plan.getProgress();
      
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(Math.round((2/3) * 100));
    });

    test('should track execution duration', () => {
      plan.updateStatus('running');
      
      // Simulate some execution time
      jest.useFakeTimers();
      jest.advanceTimersByTime(5000); // 5 seconds
      
      const duration = plan.getExecutionDuration();
      expect(duration).toBeGreaterThan(4000);
      
      jest.useRealTimers();
    });
  });

  describe('Step Dependencies', () => {
    test('should get step dependencies', () => {
      const deps = plan.getStepDependencies('step2');
      
      expect(deps).toEqual(['step1']);
    });

    test('should get step dependents', () => {
      const dependents = plan.getStepDependents('step1');
      
      expect(dependents).toContain('step2');
    });

    test('should check if step can be executed', () => {
      // step1 has no dependencies
      expect(plan.canExecuteStep('step1')).toBe(true);
      
      // step2 depends on step1
      expect(plan.canExecuteStep('step2')).toBe(false);
      
      // Complete step1
      plan.startStep('step1');
      plan.completeStep('step1');
      expect(plan.canExecuteStep('step2')).toBe(true);
    });

    test('should get next executable steps', () => {
      let nextSteps = plan.getNextExecutableSteps();
      expect(nextSteps).toEqual(['step1']);
      
      plan.startStep('step1');
      plan.completeStep('step1');
      nextSteps = plan.getNextExecutableSteps();
      expect(nextSteps).toEqual(['step2']);
      
      plan.startStep('step2');
      plan.completeStep('step2');
      nextSteps = plan.getNextExecutableSteps();
      expect(nextSteps).toEqual(['step3']);
    });

    test('should detect if plan is complete', () => {
      expect(plan.isComplete()).toBe(false);
      
      plan.startStep('step1');
      plan.completeStep('step1');
      plan.startStep('step2');
      plan.completeStep('step2');
      expect(plan.isComplete()).toBe(false);
      
      plan.startStep('step3');
      plan.completeStep('step3');
      expect(plan.isComplete()).toBe(true);
    });
  });

  describe('Plan Serialization', () => {
    test('should export plan state', () => {
      plan.createStepHandle('step1', 'testHandle', { data: 'test' });
      plan.createCheckpoint('test-checkpoint');
      plan.startStep('step1');
      plan.completeStep('step1');
      
      const exported = plan.exportState();
      
      expect(exported.planId).toBe(plan.id);
      expect(exported.state).toEqual(plan.state);
      expect(exported.checkpoints).toBeDefined();
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });

    test('should import plan state', () => {
      const exportedState = {
        planId: plan.id,
        state: {
          status: 'running',
          completedSteps: ['step1'],
          currentStep: 'step2'
        },
        checkpoints: {},
        exportedAt: new Date()
      };
      
      plan.importState(exportedState);
      
      expect(plan.state.status).toBe('running');
      expect(plan.state.completedSteps).toContain('step1');
      expect(plan.state.currentStep).toBe('step2');
    });

    test('should clone plan', () => {
      plan.startStep('step1');
      plan.completeStep('step1');
      plan.createCheckpoint('test');
      
      const cloned = plan.clone();
      
      expect(cloned.id).toBe(plan.id);
      expect(cloned.state.completedSteps).toEqual(plan.state.completedSteps);
      expect(cloned.checkpoints).toEqual(plan.checkpoints);
      expect(cloned).not.toBe(plan); // Different instance
    });
  });

  describe('Event System', () => {
    test('should emit events during execution', () => {
      const events = [];
      
      plan.on('step-started', (data) => events.push({ type: 'step-started', ...data }));
      plan.on('step-completed', (data) => events.push({ type: 'step-completed', ...data }));
      
      plan.startStep('step1');
      plan.completeStep('step1', { result: 'test' });
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('step-started');
      expect(events[0].stepId).toBe('step1');
      expect(events[1].type).toBe('step-completed');
      expect(events[1].stepId).toBe('step1');
    });

    test('should emit checkpoint events', () => {
      const events = [];
      
      plan.on('checkpoint-created', (data) => events.push({ type: 'checkpoint-created', ...data }));
      
      const checkpointId = plan.createCheckpoint('test-event');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('checkpoint-created');
      expect(events[0].checkpointId).toBe(checkpointId);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid step operations', () => {
      expect(() => {
        plan.startStep('nonexistent');
      }).toThrow('Step not found: nonexistent');
      
      expect(() => {
        plan.completeStep('step1'); // Not started
      }).toThrow('Step not running: step1');
    });

    test('should handle checkpoint errors', () => {
      expect(() => {
        plan.restoreFromCheckpoint('nonexistent');
      }).toThrow('Checkpoint not found: nonexistent');
    });

    test('should validate state consistency', () => {
      // Manually corrupt state
      plan.state.completedSteps.push('nonexistent');
      
      const validation = plan.validateState();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});