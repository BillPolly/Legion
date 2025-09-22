/**
 * Unit tests for ExecutionStrategy
 * Tests the migration of ExecutionOrchestrator component to TaskStrategy pattern
 * Phase 3.1 Migration Test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import ExecutionStrategy from '../../../../src/strategies/coding/ExecutionStrategy.js';

describe('ExecutionStrategy', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let strategy;
  let mockStrategies;
  let mockStateManager;

  beforeEach(async () => {
    // Get real ResourceManager singleton and services
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();
    
    // Create mock strategies for ExecutionOrchestrator
    mockStrategies = {
      SimpleNodeServer: {
        getName: () => 'SimpleNodeServer',
        onParentMessage: jest.fn().mockResolvedValue({ success: true, artifacts: [] })
      },
      SimpleNodeTest: {
        getName: () => 'SimpleNodeTest', 
        onParentMessage: jest.fn().mockResolvedValue({ success: true, artifacts: [] })
      },
      FileSystem: {
        getName: () => 'FileSystem',
        onParentMessage: jest.fn().mockResolvedValue({ success: true, artifacts: [] })
      }
    };
    
    // Create mock state manager
    mockStateManager = {
      updateTask: jest.fn().mockResolvedValue(true),
      addArtifact: jest.fn().mockResolvedValue(true)
    };
    
    // Create strategy instance
    strategy = new ExecutionStrategy(mockStrategies, mockStateManager);
  });

  describe('Basic Properties', () => {
    test('should create strategy instance', () => {
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('Execution');
    });

    test('should accept strategies and stateManager in constructor', () => {
      expect(strategy.strategies).toBe(mockStrategies);
      expect(strategy.stateManager).toBe(mockStateManager);
    });

    test('should initialize with default options', () => {
      expect(strategy.options.maxRetries).toBe(3);
      expect(strategy.options.backoffStrategy).toBe('exponential');
      expect(strategy.options.validateResults).toBe(true);
    });

    test('should accept custom options', () => {
      const customStrategy = new ExecutionStrategy(mockStrategies, mockStateManager, {
        maxRetries: 5,
        backoffStrategy: 'linear',
        validateResults: false
      });
      
      expect(customStrategy.options.maxRetries).toBe(5);
      expect(customStrategy.options.backoffStrategy).toBe('linear');
      expect(customStrategy.options.validateResults).toBe(false);
    });
  });

  describe('TaskStrategy Interface', () => {
    test('should implement getName method', () => {
      expect(typeof strategy.getName).toBe('function');
      expect(strategy.getName()).toBe('Execution');
    });

    test('should implement onParentMessage method', () => {
      expect(typeof strategy.onParentMessage).toBe('function');
    });

    test('should implement onChildMessage method', () => {
      expect(typeof strategy.onChildMessage).toBe('function');
    });
  });

  describe('Component Wrapping', () => {
    test('should not initialize component until first use', () => {
      expect(strategy.executionOrchestrator).toBeNull();
    });

    test('should have extractExecutionPlan helper method', () => {
      expect(typeof strategy._extractExecutionPlan).toBe('function');
    });

    test('should have context extraction helper', () => {
      expect(typeof strategy._getContextFromTask).toBe('function');
    });

    test('should have execution plan processor', () => {
      expect(typeof strategy._executePlan).toBe('function');
    });
  });

  describe('Message Handling', () => {
    test('should handle start message with project plan artifact', async () => {
      const mockTask = {
        id: 'task-123',
        description: 'Execute calculator API project',
        getAllArtifacts: () => ({
          'project-plan': {
            content: {
              projectId: 'calc-api-123',
              phases: [
                {
                  phase: 'setup',
                  priority: 1,
                  tasks: [
                    {
                      id: 'setup-1',
                      action: 'create-structure',
                      strategy: 'FileSystem',
                      description: 'Create project structure',
                      dependencies: [],
                      retry: { maxAttempts: 3, strategy: 'exponential' },
                      validation: { required: true }
                    }
                  ]
                }
              ],
              structure: { directories: ['src', 'tests'], files: ['package.json'] }
            },
            description: 'Project execution plan',
            type: 'plan'
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      // Should return successful result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.execution).toBeDefined();
      expect(result.result.phasesCompleted).toBe(1);
      expect(result.artifacts).toContain('execution-result');
    });

    test('should handle start message with simple plan structure', async () => {
      const mockTask = {
        id: 'task-456',
        description: 'Execute simple plan',
        getAllArtifacts: () => ({
          'plan': {
            content: {
              phases: [
                {
                  phase: 'build',
                  tasks: [
                    {
                      id: 'build-1',
                      strategy: 'SimpleNodeServer',
                      action: 'create-server',
                      dependencies: [],
                      retry: { maxAttempts: 2 }
                    }
                  ]
                }
              ]
            }
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result.phasesCompleted).toBe(1);
    });

    test('should handle abort message', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'abort' });
      
      expect(result.acknowledged).toBe(true);
      expect(result.aborted).toBe(true);
    });

    test('should handle unknown message types', async () => {
      const mockTask = {};
      
      const result = await strategy.onParentMessage(mockTask, { type: 'unknown' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should handle work message same as start', async () => {
      const mockTask = {
        id: 'task-789',
        description: 'Execute work plan',
        getAllArtifacts: () => ({
          'project-plan': {
            content: {
              phases: [
                {
                  phase: 'test',
                  tasks: [
                    {
                      id: 'test-1',
                      strategy: 'SimpleNodeTest',
                      dependencies: [],
                      retry: { maxAttempts: 1 }
                    }
                  ]
                }
              ]
            }
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'work' });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Plan Extraction', () => {
    test('should extract plan from project-plan artifact', () => {
      const planContent = {
        phases: [{ phase: 'setup', tasks: [] }],
        structure: { directories: ['src'] }
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'project-plan': { content: planContent }
        })
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toEqual(planContent);
    });

    test('should extract plan from execution-plan artifact', () => {
      const planContent = {
        phases: [{ phase: 'build', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'execution-plan': { content: planContent }
        })
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toEqual(planContent);
    });

    test('should extract plan from generic plan artifact', () => {
      const planContent = {
        phases: [{ phase: 'deploy', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({
          'plan': { content: planContent }
        })
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toEqual(planContent);
    });

    test('should extract plan from task input', () => {
      const planContent = {
        phases: [{ phase: 'validation', tasks: [] }]
      };
      
      const mockTask = {
        getAllArtifacts: () => ({}),
        input: { plan: planContent }
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toEqual(planContent);
    });

    test('should handle JSON description with plan structure', () => {
      const planContent = {
        phases: [{ phase: 'integration', tasks: [] }]
      };
      
      const mockTask = {
        description: JSON.stringify(planContent),
        getAllArtifacts: () => ({})
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toEqual(planContent);
    });

    test('should return null when no plan found', () => {
      const mockTask = {
        description: 'plain text description',
        getAllArtifacts: () => ({})
      };

      const plan = strategy._extractExecutionPlan(mockTask);
      expect(plan).toBeNull();
    });
  });

  describe('Context Extraction', () => {
    test('should extract basic context from task', () => {
      const mockTask = {
        id: 'task-123',
        description: 'Test execution task',
        workspaceDir: '/tmp/workspace'
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.taskId).toBe('task-123');
      expect(context.description).toBe('Test execution task');
      expect(context.workspaceDir).toBe('/tmp/workspace');
    });

    test('should include artifacts in context', () => {
      const mockTask = {
        id: 'task-456',
        description: 'Test task',
        getAllArtifacts: () => ({
          'plan': { content: 'data' },
          'config': { content: 'settings' }
        })
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.existingArtifacts).toEqual(['plan', 'config']);
    });

    test('should include conversation history in context', () => {
      const mockTask = {
        id: 'task-789',
        description: 'Test task',
        getConversationContext: () => [
          { role: 'user', content: 'Execute plan' },
          { role: 'assistant', content: 'Starting execution' }
        ]
      };

      const context = strategy._getContextFromTask(mockTask);
      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing execution plan gracefully', async () => {
      const mockTask = {
        description: 'Execute project',
        getAllArtifacts: () => ({}),
        addConversationEntry: jest.fn()
      };

      const result = await strategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toBe('No execution plan found for execution');
    });

    test('should handle component initialization errors', async () => {
      // Create strategy without required dependencies
      const invalidStrategy = new ExecutionStrategy(null, null);
      
      const mockTask = {
        description: 'Test task',
        getAllArtifacts: () => ({
          'project-plan': {
            content: { phases: [] }
          }
        }),
        addConversationEntry: jest.fn()
      };

      const result = await invalidStrategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result).toMatch(/requires strategies and stateManager/);
    });

    test('should handle execution errors gracefully', async () => {
      // Mock strategies to throw errors
      const failingStrategies = {
        FailingStrategy: {
          getName: () => 'FailingStrategy',
          onParentMessage: jest.fn().mockRejectedValue(new Error('Strategy failed'))
        }
      };
      
      const failingStrategy = new ExecutionStrategy(failingStrategies, mockStateManager);
      
      const mockTask = {
        description: 'Test failing execution',
        getAllArtifacts: () => ({
          'project-plan': {
            content: {
              phases: [
                {
                  phase: 'failing-phase',
                  tasks: [
                    {
                      id: 'fail-1',
                      strategy: 'FailingStrategy',
                      dependencies: [],
                      retry: { maxAttempts: 1 }
                    }
                  ]
                }
              ]
            }
          }
        }),
        addConversationEntry: jest.fn(),
        storeArtifact: jest.fn()
      };

      const result = await failingStrategy.onParentMessage(mockTask, { type: 'start' });
      
      expect(result.success).toBe(false);
      expect(result.result.execution.phases[0].success).toBe(false);
    });
  });

  describe('Child Message Handling', () => {
    test('should acknowledge child completion messages', async () => {
      const mockChildTask = {
        parent: { id: 'parent-task' }
      };
      
      const result = await strategy.onChildMessage(mockChildTask, { type: 'completed' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should acknowledge child failure messages', async () => {
      const mockChildTask = {
        parent: { id: 'parent-task' }
      };
      
      const result = await strategy.onChildMessage(mockChildTask, { type: 'failed' });
      
      expect(result.acknowledged).toBe(true);
    });

    test('should require child task to have parent', async () => {
      const orphanChild = { parent: null };
      
      await expect(strategy.onChildMessage(orphanChild, { type: 'completed' }))
        .rejects.toThrow('Child task has no parent');
    });
  });

  describe('Plan Execution', () => {
    test('should execute phases in order', async () => {
      const plan = {
        projectId: 'test-project',
        phases: [
          {
            phase: 'phase1',
            priority: 1,
            tasks: [
              {
                id: 'task1',
                strategy: 'SimpleNodeServer',
                dependencies: [],
                retry: { maxAttempts: 1 }
              }
            ]
          },
          {
            phase: 'phase2', 
            priority: 2,
            tasks: [
              {
                id: 'task2',
                strategy: 'SimpleNodeTest',
                dependencies: [],
                retry: { maxAttempts: 1 }
              }
            ]
          }
        ]
      };
      
      const mockTask = {
        storeArtifact: jest.fn()
      };

      const result = await strategy._executePlan(plan, mockTask);
      
      expect(result.success).toBe(true);
      expect(result.phases).toHaveLength(2);
      expect(result.phases[0].phase).toBe('phase1');
      expect(result.phases[1].phase).toBe('phase2');
    });

    test('should stop execution on critical phase failure', async () => {
      // Mock strategy to fail
      mockStrategies.SimpleNodeServer.onParentMessage.mockRejectedValue(new Error('Critical failure'));
      
      const plan = {
        phases: [
          {
            phase: 'critical',
            priority: 1, // Critical priority
            tasks: [
              {
                id: 'critical-task',
                strategy: 'SimpleNodeServer',
                dependencies: [],
                retry: { maxAttempts: 1 }
              }
            ]
          },
          {
            phase: 'should-not-run',
            priority: 2,
            tasks: [
              {
                id: 'skip-task',
                strategy: 'SimpleNodeTest',
                dependencies: [],
                retry: { maxAttempts: 1 }
              }
            ]
          }
        ]
      };
      
      const mockTask = {
        storeArtifact: jest.fn()
      };

      const result = await strategy._executePlan(plan, mockTask);
      
      expect(result.success).toBe(false);
      expect(result.phases).toHaveLength(1); // Second phase should not execute
    });
  });
});