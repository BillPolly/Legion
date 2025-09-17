/**
 * Test suite for DependencyResolver
 * Tests dependency analysis, graph construction, topological sorting, and optimization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DependencyResolver } from '../../../src/core/DependencyResolver.js';

describe('DependencyResolver', () => {
  let resolver;
  let mockToolRegistry;
  let mockResourceManager;
  let mockLlmClient;
  let mockSimplePromptClient;

  beforeEach(() => {
    mockToolRegistry = {
      getTool: jest.fn()
    };

    mockResourceManager = {
      get: jest.fn()
    };

    mockLlmClient = {
      complete: jest.fn()
    };

    mockSimplePromptClient = {
      request: jest.fn()
    };

    resolver = new DependencyResolver({
      testMode: true,  // Enable test mode for unit tests
      toolRegistry: mockToolRegistry,
      resourceManager: mockResourceManager,
      llmClient: mockLlmClient,
      simplePromptClient: mockSimplePromptClient,
      maxDepth: 5,
      timeout: 10000
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize with default options', () => {
      const defaultResolver = new DependencyResolver();
      
      expect(defaultResolver.maxDepth).toBe(10);
      expect(defaultResolver.timeout).toBe(30000);
      expect(defaultResolver.circularDetection).toBe(true);
    });

    it('should initialize with custom options', () => {
      expect(resolver.maxDepth).toBe(5);
      expect(resolver.timeout).toBe(10000);
      expect(resolver.toolRegistry).toBe(mockToolRegistry);
      expect(resolver.resourceManager).toBe(mockResourceManager);
      expect(resolver.llmClient).toBe(mockLlmClient);
    });

    it('should generate unique task IDs', () => {
      const id1 = resolver.getTaskId({});
      const id2 = resolver.getTaskId({});
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^task-\d+-[a-z0-9]+$/);
    });

    it('should use provided task IDs', () => {
      const task = { id: 'custom-task-id' };
      expect(resolver.getTaskId(task)).toBe('custom-task-id');
    });
  });

  describe('Simple Dependency Resolution', () => {
    it('should resolve dependencies for single task', async () => {
      const task = {
        id: 'task1',
        description: 'Simple task',
        priority: 5
      };

      const result = await resolver.resolveDependencies(task);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1']);
      expect(result.dependencyGraph.size).toBe(1);
      expect(result.parallelGroups).toEqual([]);
    });

    it('should resolve dependencies for multiple independent tasks', async () => {
      const tasks = [
        { id: 'task1', description: 'First task' },
        { id: 'task2', description: 'Second task' },
        { id: 'task3', description: 'Third task' }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toHaveLength(3);
      expect(result.executionOrder).toContain('task1');
      expect(result.executionOrder).toContain('task2');
      expect(result.executionOrder).toContain('task3');
      expect(result.dependencyGraph.size).toBe(3);
    });

    it('should handle explicit dependencies', async () => {
      const tasks = [
        { id: 'task1', description: 'First task' },
        { id: 'task2', description: 'Second task', dependencies: ['task1'] },
        { id: 'task3', description: 'Third task', dependencies: ['task2'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1', 'task2', 'task3']);
      
      const graph = result.dependencyGraph;
      expect(graph.get('task2').dependencies.has('task1')).toBe(true);
      expect(graph.get('task3').dependencies.has('task2')).toBe(true);
      expect(graph.get('task1').dependents.has('task2')).toBe(true);
      expect(graph.get('task2').dependents.has('task3')).toBe(true);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependencies', async () => {
      const tasks = [
        { id: 'task1', dependencies: ['task2'] },
        { id: 'task2', dependencies: ['task1'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependencies detected');
    });

    it('should detect complex circular dependencies', async () => {
      const tasks = [
        { id: 'task1', dependencies: ['task2'] },
        { id: 'task2', dependencies: ['task3'] },
        { id: 'task3', dependencies: ['task1'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependencies detected');
    });

    it('should allow disabling circular dependency detection', async () => {
      const customResolver = new DependencyResolver({ circularDetection: false });
      
      const tasks = [
        { id: 'task1', dependencies: ['task2'] },
        { id: 'task2', dependencies: ['task1'] }
      ];

      // This should not throw an error but topological sort will fail
      const result = await customResolver.resolveDependencies(tasks);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependency detected during topological sort');
    });
  });

  describe('Resource Dependency Analysis', () => {
    it('should analyze resource-based dependencies', async () => {
      const tasks = [
        {
          id: 'task1',
          description: 'Producer task',
          resources: { outputs: ['file1.txt'] }
        },
        {
          id: 'task2',
          description: 'Consumer task',
          resources: { inputs: ['file1.txt'] }
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1', 'task2']);
      expect(result.dependencyGraph.get('task2').dependencies.has('task1')).toBe(true);
    });

    it('should handle exclusive resource conflicts', async () => {
      const tasks = [
        {
          id: 'task1',
          description: 'First exclusive task',
          priority: 10,
          resources: { exclusive: ['database'] }
        },
        {
          id: 'task2',
          description: 'Second exclusive task',
          priority: 5,
          resources: { exclusive: ['database'] }
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1', 'task2']); // Higher priority first
      expect(result.resourceDependencies.conflicts).toHaveLength(1);
    });

    it('should extract tool-based resource requirements', async () => {
      const task = {
        id: 'task1',
        tool: 'file_write',
        params: { path: 'test.txt', content: 'test' }
      };

      const requirements = resolver.extractResourceRequirements(task);

      expect(requirements.inputs).toContain('tool:file_write');
      expect(requirements.exclusive).toContain('tool:file_write');
    });
  });

  describe('Data Flow Analysis', () => {
    it('should analyze data flow dependencies', async () => {
      const tasks = [
        {
          id: 'task1',
          description: 'Generate data',
          outputs: { result: 'string' }
        },
        {
          id: 'task2',
          description: 'Process data',
          inputs: { result: 'string' }
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1', 'task2']);
      expect(result.dependencyGraph.get('task2').dependencies.has('task1')).toBe(true);
    });

    it('should extract data inputs from task parameters', () => {
      const task = {
        id: 'task1',
        description: 'Use ${inputData} and ${configValue}',
        params: { param1: 'value1' },
        inputs: { input1: 'data' }
      };

      const inputs = resolver.extractDataInputs(task);

      expect(inputs).toContain('inputData');
      expect(inputs).toContain('configValue');
      expect(inputs).toContain('param1');
      expect(inputs).toContain('input1');
    });

    it('should extract data outputs from task configuration', () => {
      const task = {
        id: 'task1',
        outputs: { result: 'data', status: 'string' },
        produces: ['artifact1', 'artifact2']
      };

      const outputs = resolver.extractDataOutputs(task);

      expect(outputs).toContain('result');
      expect(outputs).toContain('status');
      expect(outputs).toContain('artifact1');
      expect(outputs).toContain('artifact2');
      expect(outputs).toContain('task1'); // Default task ID output
    });
  });

  describe('Tool Dependency Analysis', () => {
    it('should analyze tool dependencies', async () => {
      const mockTool = {
        name: 'dependent-tool',
        dependencies: ['prerequisite-tool']
      };

      mockToolRegistry.getTool.mockResolvedValue(mockTool);

      const tasks = [
        {
          id: 'task1',
          tool: 'prerequisite-tool'
        },
        {
          id: 'task2',
          tool: 'dependent-tool'
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1', 'task2']);
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('dependent-tool');
    });

    it('should handle tool registry errors gracefully', async () => {
      mockToolRegistry.getTool.mockRejectedValue(new Error('Tool not found'));

      const tasks = [
        {
          id: 'task1',
          tool: 'nonexistent-tool'
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true); // Should continue despite tool error
      expect(result.executionOrder).toEqual(['task1']);
    });
  });

  describe('Semantic Dependency Analysis', () => {
    it('should analyze semantic dependencies with LLM', async () => {
      // Mock SimplePromptClient to respond differently based on task being analyzed
      mockSimplePromptClient.request.mockImplementation(({ prompt }) => {
        // Look for Target Task specifically to differentiate between tasks
        if (prompt.includes('Target Task: "Setup database"')) {
          // Task1 (setup) has no dependencies
          console.log('LLM returning empty array for Setup database task');
          return Promise.resolve({ content: '[]' });
        } else if (prompt.includes('Target Task: "Query database for user data"')) {
          // Task2 (query) depends on task1 (setup)
          console.log('LLM returning ["task1"] for Query database task');
          return Promise.resolve({ content: '["task1"]' });
        }
        console.log('LLM returning empty array for unknown task:', prompt.substring(0, 100));
        return Promise.resolve({ content: '[]' });
      });

      const tasks = [
        { id: 'task1', description: 'Setup database' },
        { id: 'task2', description: 'Query database for user data' }
      ];

      const context = { analyzeSemanticDependencies: true };
      const result = await resolver.resolveDependencies(tasks, context);

      // Debug output
      console.log('Result success:', result.success);
      if (!result.success) {
        console.log('Error:', result.error);
      }
      console.log('Execution order:', result.executionOrder);
      console.log('Dependency graph for task2:', result.dependencyGraph?.get('task2'));
      console.log('SimplePromptClient calls:', mockSimplePromptClient.request.mock.calls.length);
      console.log('All SimplePromptClient call arguments:', mockSimplePromptClient.request.mock.calls.map(call => ({
        prompt: call[0].prompt.substring(0, 100)
      })));

      expect(result.success).toBe(true);
      expect(mockSimplePromptClient.request).toHaveBeenCalled();
      expect(result.executionOrder).toEqual(['task1', 'task2']);
      expect(result.dependencyGraph.get('task2').dependencies.has('task1')).toBe(true);
      
      const calls = mockSimplePromptClient.request.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.some(call => call[0].prompt.includes('Query database for user data'))).toBe(true);
    });

    it('should handle LLM errors gracefully', async () => {
      mockSimplePromptClient.request.mockRejectedValue(new Error('LLM service unavailable'));

      const tasks = [
        { id: 'task1', description: 'Setup database' },
        { id: 'task2', description: 'Query database for user data' }
      ];

      const context = { analyzeSemanticDependencies: true };
      const result = await resolver.resolveDependencies(tasks, context);

      expect(result.success).toBe(true); // Should continue despite LLM error
    });

    it('should parse semantic dependencies correctly', () => {
      const response = 'Based on analysis: ["task1", "task3"] are dependencies.';
      const taskMap = new Map([
        ['task1', {}],
        ['task2', {}],
        ['task3', {}],
        ['task4', {}]
      ]);

      const dependencies = resolver.parseSemanticDependencies(response, taskMap);

      expect(dependencies).toEqual(['task1', 'task3']);
    });

    it('should handle malformed LLM responses', () => {
      const response = 'Invalid JSON response without array';
      const taskMap = new Map([['task1', {}]]);

      const dependencies = resolver.parseSemanticDependencies(response, taskMap);

      expect(dependencies).toEqual([]);
    });
  });

  describe('Parallel Execution Optimization', () => {
    it('should identify parallel execution opportunities', async () => {
      const tasks = [
        { id: 'task1', description: 'Independent task 1' },
        { id: 'task2', description: 'Independent task 2' },
        { id: 'task3', description: 'Independent task 3' },
        { id: 'task4', description: 'Dependent task', dependencies: ['task1'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.parallelGroups.length).toBeGreaterThan(0);
      
      // Should find that task1, task2, task3 can run in parallel
      const firstGroup = result.parallelGroups.find(g => g.tasks.length > 1);
      expect(firstGroup).toBeDefined();
      expect(firstGroup.tasks).toContain('task1');
      expect(firstGroup.tasks).toContain('task2');
      expect(firstGroup.tasks).toContain('task3');
    });

    it('should respect resource conflicts in parallel optimization', async () => {
      const tasks = [
        {
          id: 'task1',
          description: 'Exclusive task 1',
          resources: { exclusive: ['resource1'] }
        },
        {
          id: 'task2',
          description: 'Exclusive task 2',
          resources: { exclusive: ['resource1'] }
        }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      // Tasks with exclusive resource conflicts should not be in same parallel group
      const parallelGroup = result.parallelGroups.find(g => 
        g.tasks.includes('task1') && g.tasks.includes('task2')
      );
      expect(parallelGroup).toBeUndefined();
    });

    it('should check transitive dependencies correctly', () => {
      const graph = new Map([
        ['task1', { dependencies: new Set(['task2']), dependents: new Set() }],
        ['task2', { dependencies: new Set(['task3']), dependents: new Set(['task1']) }],
        ['task3', { dependencies: new Set(), dependents: new Set(['task2']) }]
      ]);

      const hasTransitive = resolver.hasTransitiveDependency('task1', 'task3', graph);
      expect(hasTransitive).toBe(true);

      const noTransitive = resolver.hasTransitiveDependency('task3', 'task1', graph);
      expect(noTransitive).toBe(false);
    });
  });

  describe('Critical Path Analysis', () => {
    it('should calculate critical path correctly', async () => {
      const tasks = [
        { id: 'task1', description: 'Fast task', estimatedTime: 1000 },
        { id: 'task2', description: 'Slow task', estimatedTime: 5000, dependencies: ['task1'] },
        { id: 'task3', description: 'Final task', estimatedTime: 2000, dependencies: ['task2'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.criticalPath).toEqual(['task1', 'task2', 'task3']);
      expect(result.estimatedTime).toBe(8000); // 1000 + 5000 + 2000
    });

    it('should handle parallel paths in critical path calculation', async () => {
      const tasks = [
        { id: 'task1', description: 'Start', estimatedTime: 1000 },
        { id: 'task2', description: 'Fast branch', estimatedTime: 2000, dependencies: ['task1'] },
        { id: 'task3', description: 'Slow branch', estimatedTime: 5000, dependencies: ['task1'] },
        { id: 'task4', description: 'Join', estimatedTime: 1000, dependencies: ['task2', 'task3'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.criticalPath).toContain('task1');
      expect(result.criticalPath).toContain('task3'); // Slower branch
      expect(result.criticalPath).toContain('task4');
      expect(result.criticalPath).not.toContain('task2'); // Faster branch not critical
    });
  });

  describe('Time Estimation', () => {
    it('should estimate task time based on different criteria', () => {
      // Explicit time
      const task1 = { id: 'task1', estimatedTime: 3000 };
      expect(resolver.estimateTaskTime(task1)).toBe(3000);

      // Tool-based time
      const task2 = { id: 'task2', tool: 'calculator' };
      expect(resolver.estimateTaskTime(task2)).toBe(2000);

      // Composite task time
      const task3 = { id: 'task3', subtasks: [{}, {}, {}] };
      expect(resolver.estimateTaskTime(task3)).toBe(3000);

      // Description-based time
      const task4 = { id: 'task4', description: 'A'.repeat(1000) };
      expect(resolver.estimateTaskTime(task4)).toBe(10000);

      // Default time
      const task5 = { id: 'task5' };
      expect(resolver.estimateTaskTime(task5)).toBe(1000);
    });

    it('should estimate total execution time with parallelization', async () => {
      const tasks = [
        { id: 'task1', estimatedTime: 2000 },
        { id: 'task2', estimatedTime: 3000 },
        { id: 'task3', estimatedTime: 1000, dependencies: ['task1', 'task2'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      // task1 and task2 can run in parallel (3000ms), then task3 (1000ms) = 4000ms total
      expect(result.estimatedTime).toBeLessThan(6000); // Less than sequential execution
    });
  });

  describe('Graph Construction and Analysis', () => {
    it('should build dependency graph correctly', async () => {
      const tasks = [
        { id: 'task1', priority: 10 },
        { id: 'task2', dependencies: ['task1'], priority: 5 }
      ];

      const graph = await resolver.buildDependencyGraph(tasks, {});

      expect(graph.size).toBe(2);
      expect(graph.get('task1').priority).toBe(10);
      expect(graph.get('task2').priority).toBe(5);
      expect(graph.get('task2').dependencies.has('task1')).toBe(true);
      expect(graph.get('task1').dependents.has('task2')).toBe(true);
    });

    it('should calculate graph complexity', () => {
      const graph = new Map([
        ['task1', { dependencies: new Set(), dependents: new Set(['task2', 'task3']) }],
        ['task2', { dependencies: new Set(['task1']), dependents: new Set(['task4']) }],
        ['task3', { dependencies: new Set(['task1']), dependents: new Set(['task4']) }],
        ['task4', { dependencies: new Set(['task2', 'task3']), dependents: new Set() }]
      ]);

      const complexity = resolver.calculateComplexity(graph);

      expect(complexity).toBeGreaterThan(0);
      expect(typeof complexity).toBe('number');
    });

    it('should count dependencies correctly', () => {
      const graph = new Map([
        ['task1', { dependencies: new Set() }],
        ['task2', { dependencies: new Set(['task1']) }],
        ['task3', { dependencies: new Set(['task1', 'task2']) }]
      ]);

      const count = resolver.countDependencies(graph);
      expect(count).toBe(3); // 0 + 1 + 2
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty task list', async () => {
      const result = await resolver.resolveDependencies([]);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual([]);
      expect(result.dependencyGraph.size).toBe(0);
    });

    it('should handle tasks with missing dependencies', async () => {
      const tasks = [
        { id: 'task1', dependencies: ['nonexistent-task'] }
      ];

      const result = await resolver.resolveDependencies(tasks);

      expect(result.success).toBe(true);
      expect(result.executionOrder).toEqual(['task1']);
      // Missing dependencies should be ignored
      expect(result.dependencyGraph.get('task1').dependencies.size).toBe(0);
    });

    it('should handle malformed tasks gracefully', async () => {
      const tasks = [
        null,
        undefined,
        { id: 'valid-task' },
        { /* no id */ description: 'task without id' }
      ];

      const result = await resolver.resolveDependencies(tasks);

      // Debug output
      console.log('Malformed tasks test result:', {
        success: result.success,
        error: result.error,
        executionOrder: result.executionOrder,
        dependencyGraphSize: result.dependencyGraph?.size
      });

      expect(result.success).toBe(true);
      // Should process valid tasks and handle invalid ones
      expect(result.executionOrder.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = resolver.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('enabled');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
    });

    it('should support cache clearing', () => {
      resolver.clearCache();
      const stats = resolver.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should work without cache when disabled', () => {
      const noCacheResolver = new DependencyResolver({ useCache: false });
      const stats = noCacheResolver.getCacheStats();
      
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });
  });

  describe('Resource Availability', () => {
    it('should check resource availability correctly', () => {
      const context = {
        availableResources: ['resource1', 'resource2']
      };

      expect(resolver.isResourceAvailable('resource1', context)).toBe(true);
      expect(resolver.isResourceAvailable('nonexistent', context)).toBe(false);
    });

    it('should get available resources from context', () => {
      const context = {
        availableResources: ['custom1', 'custom2'],
        includeToolResources: false
      };

      const resources = resolver.getAvailableResources(context);

      expect(resources).toContain('custom1');
      expect(resources).toContain('custom2');
      expect(resources).toContain('cpu'); // Default system resources
      expect(resources).toContain('memory');
    });
  });
});