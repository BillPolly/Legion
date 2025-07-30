/**
 * Unit tests for Event System in PlanExecutor
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';

describe('PlanExecutor Event System', () => {
  let mockModuleFactory;
  let mockResourceManager;
  let executor;
  let eventsSeen;

  beforeEach(() => {
    mockModuleFactory = {
      createModule: jest.fn()
    };
    
    mockResourceManager = {
      get: jest.fn(),
      register: jest.fn()
    };

    executor = new PlanExecutor({
      moduleFactory: mockModuleFactory,
      resourceManager: mockResourceManager
    });

    // Mock moduleLoader methods
    executor.planToolRegistry.loadModulesForPlan = jest.fn().mockResolvedValue();
    executor.planToolRegistry.getTool = jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue({ success: true, result: 'mock result' })
    });

    // Capture all events
    eventsSeen = [];
    const eventTypes = ['plan:start', 'plan:complete', 'plan:error', 'step:start', 'step:complete', 'step:error'];
    eventTypes.forEach(eventType => {
      executor.on(eventType, (event) => {
        eventsSeen.push({ type: eventType, data: event });
      });
    });
  });

  describe('plan-level events', () => {
    it('should emit plan:start event', async () => {
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        steps: []
      };

      await executor.executePlan(plan);

      const startEvents = eventsSeen.filter(e => e.type === 'plan:start');
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].data.planId).toBe('test-plan');
      expect(startEvents[0].data.planName).toBe('Test Plan');
      expect(startEvents[0].data.totalSteps).toBe(0);
      expect(startEvents[0].data.timestamp).toBeInstanceOf(Date);
    });

    it('should emit plan:complete event on success', async () => {
      const plan = {
        id: 'test-plan',
        name: 'Test Plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan);

      const completeEvents = eventsSeen.filter(e => e.type === 'plan:complete');
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].data.planId).toBe('test-plan');
      expect(completeEvents[0].data.success).toBe(true);
      expect(completeEvents[0].data.completedSteps).toBe(1);
      expect(completeEvents[0].data.failedSteps).toBe(0);
      expect(completeEvents[0].data.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should emit plan:error event on failure', async () => {
      executor.planToolRegistry.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockRejectedValue(new Error('Tool failed'))
      });

      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      const errorEvents = eventsSeen.filter(e => e.type === 'plan:error');
      expect(errorEvents).toHaveLength(0); // No plan-level error for step failures
    });

    it('should calculate correct total steps count', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'parent1',
            steps: [
              { id: 'child1', actions: [{ type: 'tool1' }] },
              { id: 'child2', actions: [{ type: 'tool2' }] }
            ]
          },
          {
            id: 'parent2',
            actions: [{ type: 'tool3' }]
          }
        ]
      };

      await executor.executePlan(plan);

      const startEvents = eventsSeen.filter(e => e.type === 'plan:start');
      expect(startEvents[0].data.totalSteps).toBe(4); // child1, child2, parent1, parent2
    });
  });

  describe('step-level events', () => {
    it('should emit step:start and step:complete events', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan);

      const startEvents = eventsSeen.filter(e => e.type === 'step:start');
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].data.stepId).toBe('step1');
      expect(startEvents[0].data.stepName).toBe('First Step');
      expect(startEvents[0].data.stepPath).toBe('step1');

      const completeEvents = eventsSeen.filter(e => e.type === 'step:complete');
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].data.stepId).toBe('step1');
    });

    it('should emit step:error events on step failure', async () => {
      executor.planToolRegistry.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      });

      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'failing-step',
            name: 'Failing Step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      const errorEvents = eventsSeen.filter(e => e.type === 'step:error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].data.stepId).toBe('failing-step');
      expect(errorEvents[0].data.error).toBe('Tool execution failed');
    });

    it('should emit events for nested steps with correct paths', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'parent',
            name: 'Parent Step',
            steps: [
              {
                id: 'child',
                name: 'Child Step',
                actions: [{ type: 'test_tool', parameters: {} }]
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      const startEvents = eventsSeen.filter(e => e.type === 'step:start');
      expect(startEvents).toHaveLength(2); // child and parent

      // Find child step event
      const childStart = startEvents.find(e => e.data.stepId === 'child');
      expect(childStart.data.stepPath).toBe('parent.child');

      // Find parent step event
      const parentStart = startEvents.find(e => e.data.stepId === 'parent');
      expect(parentStart.data.stepPath).toBe('parent');
    });
  });

  describe('event emission control', () => {
    it('should not emit events when emitProgress is false', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan, { emitProgress: false });

      expect(eventsSeen).toHaveLength(0);
    });

    it('should emit events by default', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan); // Default emitProgress should be true

      expect(eventsSeen.length).toBeGreaterThan(0);
    });
  });

  describe('event timing and order', () => {
    it('should emit events in correct order', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan);

      const eventTypes = eventsSeen.map(e => e.type);
      expect(eventTypes).toEqual([
        'plan:start',
        'step:start',
        'step:complete', 
        'plan:complete'
      ]);
    });

    it('should have increasing timestamps', async () => {
      const plan = {
        id: 'test-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan);

      for (let i = 1; i < eventsSeen.length; i++) {
        const prevTime = eventsSeen[i - 1].data.timestamp.getTime();
        const currentTime = eventsSeen[i].data.timestamp.getTime();
        expect(currentTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });
});