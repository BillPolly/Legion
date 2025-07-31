/**
 * Jest tests for PlanExecutor core functionality - simplified version
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';

describe('PlanExecutor Core', () => {
  let executor;
  let mockTool;
  let mockModuleLoader;

  beforeEach(() => {
    mockTool = {
      execute: jest.fn().mockResolvedValue({ success: true, result: 'test result' })
    };

    mockModuleLoader = {
      initialize: jest.fn().mockResolvedValue(),
      getTool: jest.fn().mockReturnValue(mockTool),
      hasTool: jest.fn().mockReturnValue(true),
      getToolNames: jest.fn().mockReturnValue(['test_tool'])
    };

    executor = new PlanExecutor({ moduleLoader: mockModuleLoader });
  });

  describe('constructor', () => {
    test('should create instance with moduleLoader', () => {
      expect(executor).toBeInstanceOf(PlanExecutor);
      expect(executor.moduleLoader).toBe(mockModuleLoader);
    });

    test('should require moduleLoader', () => {
      expect(() => new PlanExecutor({}))
        .toThrow('ModuleLoader is required for PlanExecutor');
    });

    test('should have static create method', () => {
      expect(typeof PlanExecutor.create).toBe('function');
    });
  });

  describe('plan validation', () => {
    test('should reject null plan', async () => {
      await expect(executor.executePlan(null))
        .rejects.toThrow('Invalid plan: must have steps array');
    });

    test('should reject plan without steps', async () => {
      await expect(executor.executePlan({}))
        .rejects.toThrow('Invalid plan: must have steps array');
    });

    test('should reject unvalidated plan', async () => {
      const plan = {
        id: 'test-plan',
        steps: [{ id: 'step1', actions: [] }]
      };

      await expect(executor.executePlan(plan))
        .rejects.toThrow('Plan must be validated before execution');
    });
  });

  describe('simple plan execution', () => {
    test('should execute basic plan successfully', async () => {
      const plan = {
        id: 'basic-plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            actions: [
              { type: 'test_tool', parameters: { param: 'value' } }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1']);
      expect(result.failedSteps).toEqual([]);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSteps).toBe(1);
    });

    test('should execute plan with multiple steps', async () => {
      const plan = {
        id: 'multi-step-plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          },
          {
            id: 'step2',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1', 'step2']);
      expect(result.statistics.totalSteps).toBe(2);
    });

    test('should handle steps without actions', async () => {
      const plan = {
        id: 'no-action-plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'Empty Step'
            // No actions
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1']);
    });
  });

  describe('error handling', () => {
    test('should handle missing tools', async () => {
      mockModuleLoader.getTool.mockReturnValue(null);

      const plan = {
        id: 'missing-tool-plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'nonexistent_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['step1']);
    }, 10000); // Increase timeout for this test

    test('should track execution statistics', async () => {
      const plan = {
        id: 'stats-plan',
        status: 'validated',
        steps: [
          { id: 'step1', actions: [{ type: 'test_tool', parameters: {} }] }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSteps).toBe(1);
      expect(result.statistics.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.statistics.executionTime).toBe('number');
    });
  });

  describe('hierarchical execution', () => {
    test('should handle nested steps', async () => {
      const plan = {
        id: 'nested-plan',
        status: 'validated',
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

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toContain('child');
      expect(result.completedSteps).toContain('parent');
    });
  });

  describe('event emission', () => {
    test('should be an EventEmitter', () => {
      expect(executor.on).toBeDefined();
      expect(executor.emit).toBeDefined();
      expect(typeof executor.on).toBe('function');
      expect(typeof executor.emit).toBe('function');
    });

    test('should emit events during execution', async () => {
      const events = [];
      
      executor.on('plan:start', (data) => events.push('plan:start'));
      executor.on('plan:complete', (data) => events.push('plan:complete'));
      executor.on('step:start', (data) => events.push('step:start'));
      executor.on('step:complete', (data) => events.push('step:complete'));

      const plan = {
        id: 'event-plan',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'test_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(events).toEqual([
        'plan:start',
        'step:start', 
        'step:complete',
        'plan:complete'
      ]);
    });
  });
});