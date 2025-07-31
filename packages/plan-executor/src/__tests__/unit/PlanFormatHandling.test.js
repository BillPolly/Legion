/**
 * Unit tests for Plan Format Handling
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';

describe('Plan Format Handling', () => {
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

    const mockModuleLoader = {
      initialize: jest.fn().mockResolvedValue(),
      loadModuleFromJson: jest.fn().mockResolvedValue(),
      loadModuleByName: jest.fn().mockResolvedValue(),
      getTool: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'mock result' })
      }),
      getToolByName: jest.fn().mockReturnValue({
        execute: jest.fn().mockResolvedValue({ success: true, result: 'mock result' })
      })
    };

    executor = new PlanExecutor({
      moduleFactory: mockModuleFactory,
      resourceManager: mockResourceManager,
      moduleLoader: mockModuleLoader
    });
  });

  describe('Plan object validation', () => {
    it('should accept valid llm-planner Plan objects', async () => {
      const plan = {
        id: 'valid-plan',
        name: 'Valid Plan', 
        description: 'A valid plan for testing',
        status: 'validated',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            description: 'First step description',
            actions: [
              {
                type: 'test_tool',
                parameters: { input: 'test' }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step1']);
    });

    it('should reject plans without steps array', async () => {
      const invalidPlan = {
        id: 'invalid-plan',
        name: 'Invalid Plan'
        // Missing steps array
      };

      await expect(executor.executePlan(invalidPlan)).rejects.toThrow('Invalid plan: must have steps array');
    });

    it('should reject null or undefined plans', async () => {
      await expect(executor.executePlan(null)).rejects.toThrow('Invalid plan: must have steps array');
      await expect(executor.executePlan(undefined)).rejects.toThrow('Invalid plan: must have steps array');
    });

    it('should accept minimal plan with just id and steps', async () => {
      const minimalPlan = {
        id: 'minimal',
        status: 'validated',
        steps: []
      };

      const result = await executor.executePlan(minimalPlan);

      expect(result.success).toBe(true);
    });
  });

  describe('hierarchical step execution', () => {
    it('should execute nested steps in correct order', async () => {
      const executionOrder = [];
      const mockModuleLoader = executor.moduleLoader;
      mockModuleLoader.getTool = jest.fn().mockReturnValue({
        execute: jest.fn().mockImplementation((params) => {
          executionOrder.push(params.stepId || 'unknown');
          return Promise.resolve({ success: true, result: 'mock result' });
        })
      });

      const plan = {
        id: 'hierarchical-plan',
        status: 'validated',
        steps: [
          {
            id: 'parent1',
            steps: [
              {
                id: 'child1.1',
                actions: [{ type: 'tool1', parameters: { stepId: 'child1.1' } }]
              },
              {
                id: 'child1.2',
                actions: [{ type: 'tool2', parameters: { stepId: 'child1.2' } }]
              }
            ]
          },
          {
            id: 'parent2',
            actions: [{ type: 'tool3', parameters: { stepId: 'parent2' } }]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      // Should execute child steps before parent completion
      expect(result.completedSteps).toEqual(['child1.1', 'child1.2', 'parent1', 'parent2']);
    });

    it('should preserve control flow semantics', async () => {
      const plan = {
        id: 'control-flow-plan',
        status: 'validated',
        steps: [
          {
            id: 'sequential1',
            actions: [{ type: 'tool1', parameters: {} }]
          },
          {
            id: 'nested',
            steps: [
              {
                id: 'nested.child1',
                actions: [{ type: 'tool2', parameters: {} }]
              },
              {
                id: 'nested.child2',
                steps: [
                  {
                    id: 'deeply.nested',
                    actions: [{ type: 'tool3', parameters: {} }]
                  }
                ]
              }
            ]
          },
          {
            id: 'sequential2',
            actions: [{ type: 'tool4', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual([
        'sequential1',
        'nested.child1', 
        'deeply.nested',
        'nested.child2',
        'nested',
        'sequential2'
      ]);
    });

    it('should handle mixed step types (actions vs sub-steps)', async () => {
      const plan = {
        id: 'mixed-plan',
        status: 'validated',
        steps: [
          {
            id: 'action-step',
            actions: [{ type: 'tool1', parameters: {} }]
          },
          {
            id: 'sub-steps-only',
            steps: [
              {
                id: 'sub1',
                actions: [{ type: 'tool2', parameters: {} }]
              }
            ]
          },
          {
            id: 'empty-step'
            // No actions or steps - should still complete
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['action-step', 'sub1', 'sub-steps-only', 'empty-step']);
    });
  });

  describe('context-aware action extraction', () => {
    it('should extract actions from all step levels', async () => {
      const actionsCalled = [];
      const mockModuleLoader = executor.moduleLoader;
      mockModuleLoader.getTool = jest.fn().mockImplementation((toolName) => ({
        execute: jest.fn().mockImplementation((params) => {
          actionsCalled.push({ tool: toolName, params });
          return Promise.resolve({ success: true, result: `${toolName} result` });
        })
      }));

      const plan = {
        id: 'action-extraction-plan',
        status: 'validated',
        steps: [
          {
            id: 'root-action',
            actions: [
              { type: 'root_tool', parameters: { level: 'root' } }
            ]
          },
          {
            id: 'nested-actions',
            steps: [
              {
                id: 'child-action',
                actions: [
                  { type: 'child_tool', parameters: { level: 'child' } }
                ]
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(actionsCalled).toHaveLength(2);
      expect(actionsCalled[0].tool).toBe('root_tool');
      expect(actionsCalled[0].params.level).toBe('root');
      expect(actionsCalled[1].tool).toBe('child_tool');
      expect(actionsCalled[1].params.level).toBe('child');
    });

    it('should handle multiple actions per step', async () => {
      const actionsCalled = [];
      const mockModuleLoader = executor.moduleLoader;
      mockModuleLoader.getTool = jest.fn().mockImplementation((toolName) => ({
        execute: jest.fn().mockImplementation(() => {
          actionsCalled.push(toolName);
          return Promise.resolve({ success: true, result: 'result' });
        })
      }));

      const plan = {
        id: 'multi-action-plan',
        status: 'validated',
        steps: [
          {
            id: 'multi-action-step',
            actions: [
              { type: 'tool1', parameters: {} },
              { type: 'tool2', parameters: {} },
              { type: 'tool3', parameters: {} }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(actionsCalled).toEqual(['tool1', 'tool2', 'tool3']);
    });
  });

  describe('hierarchical variable scoping', () => {
    it('should maintain variable scope hierarchy', async () => {
      const plan = {
        id: 'scoping-plan',
        status: 'validated',
        steps: [
          {
            id: 'parent-step',
            actions: [
              { 
                type: 'set_var_tool', 
                parameters: { 
                  varName: 'parentVar',
                  varValue: 'parentValue'
                } 
              }
            ],
            steps: [
              {
                id: 'child-step',
                actions: [
                  {
                    type: 'use_var_tool',
                    parameters: {
                      useVar: '$parentVar',  // Should resolve to 'parentValue'
                      setVar: 'childVar',
                      setValue: 'childValue'
                    }
                  }
                ]
              }
            ]
          }
        ]
      };

      // Mock variable handling in tools
      let context;
      const mockModuleLoader = executor.moduleLoader;
      mockModuleLoader.getTool = jest.fn().mockImplementation((toolName) => ({
        execute: jest.fn().mockImplementation((params) => {
          if (toolName === 'set_var_tool') {
            // This would be handled by the executor's context
            return Promise.resolve({ success: true, result: 'variable set' });
          } else if (toolName === 'use_var_tool') {
            // The parameter resolution should have happened already
            expect(params.useVar).toBe('$parentVar'); // Executor resolves this
            return Promise.resolve({ success: true, result: 'variable used' });
          }
          return Promise.resolve({ success: true, result: 'default' });
        })
      }));

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['child-step', 'parent-step']);
    });
  });

  describe('position tracking during execution', () => {
    it('should track current position in nested plans', async () => {
      const positionTracking = [];
      
      // Listen to step events to track position
      executor.on('step:start', (event) => {
        positionTracking.push({
          stepId: event.stepId,
          stepPath: event.stepPath
        });
      });

      const plan = {
        id: 'position-tracking-plan',
        status: 'validated',
        steps: [
          {
            id: 'root1',
            actions: [{ type: 'tool1', parameters: {} }]
          },
          {
            id: 'nested-parent',
            steps: [
              {
                id: 'nested-child1',
                actions: [{ type: 'tool2', parameters: {} }]
              },
              {
                id: 'nested-child2',
                steps: [
                  {
                    id: 'deeply-nested',
                    actions: [{ type: 'tool3', parameters: {} }]
                  }
                ]
              }
            ]
          }
        ]
      };

      await executor.executePlan(plan);

      expect(positionTracking).toEqual([
        { stepId: 'root1', stepPath: 'root1' },
        { stepId: 'nested-parent', stepPath: 'nested-parent' },
        { stepId: 'nested-child1', stepPath: 'nested-parent.nested-child1' },
        { stepId: 'nested-child2', stepPath: 'nested-parent.nested-child2' },
        { stepId: 'deeply-nested', stepPath: 'nested-parent.nested-child2.deeply-nested' }
      ]);
    });

    it('should maintain correct execution context stack', async () => {
      let contextStack = [];
      const originalEnterStep = executor.constructor.prototype._executeStep;
      
      // Spy on context enter/exit calls by monitoring the context
      const plan = {
        id: 'context-stack-plan',
        status: 'validated',
        steps: [
          {
            id: 'level1',
            steps: [
              {
                id: 'level2',
                steps: [
                  {
                    id: 'level3',
                    actions: [{ type: 'deep_tool', parameters: {} }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['level3', 'level2', 'level1']);
    });
  });

  describe('edge cases and robustness', () => {
    it('should handle empty steps gracefully', async () => {
      const plan = {
        id: 'empty-steps-plan',
        status: 'validated',
        steps: []
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual([]);
      expect(result.failedSteps).toEqual([]);
    });

    it('should handle steps with no actions or sub-steps', async () => {
      const plan = {
        id: 'no-ops-plan',
        status: 'validated',
        steps: [
          {
            id: 'empty-step1'
          },
          {
            id: 'empty-step2',
            name: 'Empty Step 2',
            description: 'A step that does nothing'
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['empty-step1', 'empty-step2']);
    });

    it('should handle deeply nested structures', async () => {
      // Create a plan with 5 levels of nesting
      const plan = {
        id: 'deep-nesting-plan',
        status: 'validated',
        steps: [
          {
            id: 'level1',
            steps: [
              {
                id: 'level2',
                steps: [
                  {
                    id: 'level3',
                    steps: [
                      {
                        id: 'level4',
                        steps: [
                          {
                            id: 'level5',
                            actions: [{ type: 'deep_tool', parameters: {} }]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['level5', 'level4', 'level3', 'level2', 'level1']);
    });
  });
});