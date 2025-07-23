/**
 * Unit tests for PlanExecutor
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';

describe('PlanExecutor', () => {
  let mockModuleFactory;
  let mockResourceManager;
  let executor;

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
  });

  describe('constructor', () => {
    it('should create instance with required options', () => {
      expect(executor).toBeInstanceOf(PlanExecutor);
      expect(executor.moduleFactory).toBe(mockModuleFactory);
      expect(executor.resourceManager).toBe(mockResourceManager);
      expect(executor.moduleLoader).toBeDefined();
    });

    it('should throw error if moduleFactory is missing', () => {
      expect(() => {
        new PlanExecutor({});
      }).toThrow('ModuleFactory is required');
    });
  });

  describe('executePlan', () => {
    beforeEach(() => {
      // Mock moduleLoader methods - don't let it do any real loading
      executor.moduleLoader.loadModulesForPlan = jest.fn().mockResolvedValue();
      executor.moduleLoader._loadAllAvailableModules = jest.fn().mockResolvedValue();
      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'mock result' })
      });
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
      expect(executor.moduleLoader.loadModulesForPlan.mock.calls.length).toBe(1);
      expect(executor.moduleLoader.loadModulesForPlan.mock.calls[0][0]).toBe(plan);
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
      expect(executor.moduleLoader.getTool.mock.calls.length).toBe(1);
      expect(executor.moduleLoader.getTool.mock.calls[0][0]).toBe('test_tool');
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
      
      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
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
      
      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
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