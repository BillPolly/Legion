/**
 * Unit tests for PlanExecutor
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';

describe('PlanExecutor', () => {
  let executor;

  beforeEach(() => {
    const mockPlanToolRegistry = {
      loadModulesForPlan: jest.fn().mockResolvedValue(),
      getTool: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'mock result' })
      })
    };

    executor = new PlanExecutor({
      planToolRegistry: mockPlanToolRegistry
    });
  });

  describe('constructor', () => {
    it('should create instance with planToolRegistry', () => {
      expect(executor).toBeInstanceOf(PlanExecutor);
      expect(executor.planToolRegistry).toBeDefined();
    });

    it('should create default planToolRegistry if none provided', () => {
      const defaultExecutor = new PlanExecutor({});
      expect(defaultExecutor.planToolRegistry).toBeDefined();
    });
  });

  describe('executePlan', () => {
    beforeEach(() => {
      // Mocks are already set up in the main beforeEach
    });

    it('should throw error for invalid plan', async () => {
      await expect(executor.executePlan(null)).rejects.toThrow('Invalid plan: must have steps array');
      await expect(executor.executePlan({})).rejects.toThrow('Invalid plan: must have steps array');
    });

    it('should accept valid plan with steps', async () => {
      const plan = {
        id: 'test',
        name: 'Test Plan',
        steps: []
      };
      
      const result = await executor.executePlan(plan);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(executor.planToolRegistry.loadModulesForPlan.mock.calls.length).toBe(1);
      expect(executor.planToolRegistry.loadModulesForPlan.mock.calls[0][0]).toBe(plan);
    });

    it('should execute plan with single step and actions', async () => {
      const plan = {
        id: 'test',
        name: 'Test Plan',
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            actions: [
              { type: 'test_tool', parameters: { input: 'test' } }
            ]
          }
        ]
      };
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1']);
      expect(result.failedSteps).toEqual([]);
      expect(executor.planToolRegistry.getTool.mock.calls.length).toBe(1);
      expect(executor.planToolRegistry.getTool.mock.calls[0][0]).toBe('test_tool');
    });

    it('should execute hierarchical plan with nested steps', async () => {
      const plan = {
        id: 'test',
        name: 'Hierarchical Plan',
        steps: [
          {
            id: 'parent',
            name: 'Parent Step',
            steps: [
              {
                id: 'child1',
                name: 'Child 1',
                actions: [
                  { type: 'tool1', parameters: {} }
                ]
              },
              {
                id: 'child2',
                name: 'Child 2',
                actions: [
                  { type: 'tool2', parameters: {} }
                ]
              }
            ]
          }
        ]
      };
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['child1', 'child2', 'parent']);
      expect(result.failedSteps).toEqual([]);
    });

    it('should handle step dependencies', async () => {
      const plan = {
        id: 'test',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'tool1', parameters: {} }]
          },
          {
            id: 'step2',
            dependencies: ['step1'],
            actions: [{ type: 'tool2', parameters: {} }]
          }
        ]
      };
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1', 'step2']);
    });

    it('should fail on unsatisfied dependencies', async () => {
      const plan = {
        id: 'test',
        steps: [
          {
            id: 'step1',
            dependencies: ['missing_step'],
            actions: [{ type: 'tool1', parameters: {} }]
          }
        ]
      };
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['step1']);
      expect(result.completedSteps).toEqual([]);
    });

    it('should stop on error when stopOnError is true', async () => {
      const failingToolExecute = jest.fn().mockRejectedValue(new Error('Tool failed'));
      const successToolExecute = jest.fn().mockResolvedValue({ success: true });
      
      executor.planToolRegistry.getTool = jest.fn().mockImplementation((toolName) => {
        if (toolName === 'failing_tool') {
          return { execute: failingToolExecute };
        } else {
          return { execute: successToolExecute };
        }
      });
      
      const plan = {
        id: 'test',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'step2',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };
      
      const result = await executor.executePlan(plan, { stopOnError: true, retries: 0, timeout: 1000 });
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['step1']);
      expect(result.skippedSteps).toEqual(['step2']);
      expect(failingToolExecute.mock.calls.length).toBe(1);
      expect(successToolExecute.mock.calls.length).toBe(0); // Should not be called
    });

    it('should continue on error when stopOnError is false', async () => {
      const failingToolExecute = jest.fn().mockRejectedValue(new Error('Tool failed'));
      const successToolExecute = jest.fn().mockResolvedValue({ success: true });
      
      executor.planToolRegistry.getTool = jest.fn().mockImplementation((toolName) => {
        if (toolName === 'failing_tool') {
          return { execute: failingToolExecute };
        } else {
          return { execute: successToolExecute };
        }
      });
      
      const plan = {
        id: 'test',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'step2',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };
      
      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['step1']);
      expect(result.completedSteps).toEqual(['step2']);
      expect(failingToolExecute.mock.calls.length).toBe(1);
      expect(successToolExecute.mock.calls.length).toBe(1); // Both should be called
    });
  });
});