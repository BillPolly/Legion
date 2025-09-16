/**
 * Test suite for RecursiveExecutionStrategy
 * Tests recursive decomposition, depth control, cycle detection, and result composition
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RecursiveExecutionStrategy } from '../../../../src/core/strategies/RecursiveExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('RecursiveExecutionStrategy', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockLLMClient;
  let mockProgressStream;

  beforeEach(() => {
    // Mock tool registry
    mockToolRegistry = {
      getTool: jest.fn()
    };

    // Mock LLM client
    mockLLMClient = {
      complete: jest.fn()
    };

    // Mock progress stream
    mockProgressStream = {
      createTaskEmitter: jest.fn(() => ({
        emit: jest.fn(),
        progress: jest.fn(),
        started: jest.fn(),
        evaluating: jest.fn(),
        decomposing: jest.fn(),
        executing: jest.fn(),
        aggregating: jest.fn(),
        completed: jest.fn(),
        failed: jest.fn(),
        retrying: jest.fn(),
        custom: jest.fn()
      }))
    };

    strategy = new RecursiveExecutionStrategy({
      testMode: true,  // Enable test mode for unit tests
      toolRegistry: mockToolRegistry,
      llmClient: mockLLMClient,
      progressStream: mockProgressStream,
      maxDepth: 3,
      decomposeThreshold: 0.7,
      useCache: true
    });

    context = new ExecutionContext(null, {
      taskId: 'test-task',
      sessionId: 'test-session',
      maxDepth: 3,
      depth: 0
    });

    // Mock context methods that might not exist
    if (!context.createParallelContexts) {
      context.createParallelContexts = jest.fn(taskIds => 
        taskIds.map(taskId => new ExecutionContext(context, { taskId }))
      );
    }
    if (!context.mergeParallelResults) {
      context.mergeParallelResults = jest.fn(contexts => context);
    }
    if (!context.getAncestors) {
      context.getAncestors = jest.fn(() => []);
    }
  });

  describe('Task Handling Detection', () => {
    it('should handle recursive tasks', () => {
      const recursiveTask = {
        id: 'task-1',
        recursive: true,
        description: 'Complex task that needs breakdown'
      };
      
      expect(strategy.canHandle(recursiveTask, context)).toBe(true);
    });

    it('should handle tasks with strategy=recursive', () => {
      const task = {
        id: 'task-1',
        strategy: 'recursive',
        description: 'Task with recursive strategy'
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tasks marked for decomposition', () => {
      const decomposeTask = {
        id: 'task-1',
        decompose: true,
        description: 'Task that should be decomposed'
      };
      
      const breakdownTask = {
        id: 'task-2',
        breakdown: true,
        description: 'Task that should be broken down'
      };
      
      expect(strategy.canHandle(decomposeTask, context)).toBe(true);
      expect(strategy.canHandle(breakdownTask, context)).toBe(true);
    });

    it('should handle hierarchical tasks', () => {
      const hierarchicalTask = {
        id: 'task-1',
        hierarchy: true,
        description: 'Hierarchical task structure'
      };
      
      const nestedTask = {
        id: 'task-2',
        nested: true,
        description: 'Nested task structure'
      };
      
      expect(strategy.canHandle(hierarchicalTask, context)).toBe(true);
      expect(strategy.canHandle(nestedTask, context)).toBe(true);
    });

    it('should handle complex tasks requiring decomposition', () => {
      const complexTask = {
        id: 'task-1',
        description: 'This is a complex task with multiple steps that requires breaking down into smaller components'
      };
      
      // Mock requiresDecomposition to return true
      jest.spyOn(strategy, 'requiresDecomposition').mockReturnValue(true);
      
      expect(strategy.canHandle(complexTask, context)).toBe(true);
    });

    it('should handle tasks with recursive subtasks', () => {
      const taskWithRecursiveSubtasks = {
        id: 'task-1',
        description: 'Parent task',
        subtasks: [
          { id: 'sub-1', description: 'Normal subtask' },
          { id: 'sub-2', recursive: true, description: 'Recursive subtask' }
        ]
      };
      
      expect(strategy.canHandle(taskWithRecursiveSubtasks, context)).toBe(true);
    });

    it('should not handle simple atomic tasks', () => {
      const atomicTask = {
        id: 'task-1',
        tool: 'calculator',
        params: { expression: '2+2' }
      };
      
      // Mock requiresDecomposition to return false
      jest.spyOn(strategy, 'requiresDecomposition').mockReturnValue(false);
      
      expect(strategy.canHandle(atomicTask, context)).toBe(false);
    });
  });

  describe('Task Complexity Estimation', () => {
    it('should estimate complexity based on description length', () => {
      const shortTask = {
        id: 'short',
        description: 'Short task'
      };
      
      const longTask = {
        id: 'long',
        description: 'This is a very long and detailed description of a complex task that requires multiple steps and careful analysis to complete successfully'
      };
      
      const shortComplexity = strategy.estimateTaskComplexity(shortTask, context);
      const longComplexity = strategy.estimateTaskComplexity(longTask, context);
      
      expect(longComplexity.score).toBeGreaterThan(shortComplexity.score);
    });

    it('should increase complexity for complexity keywords', () => {
      const simpleTask = {
        id: 'simple',
        description: 'Do something'
      };
      
      const complexTask = {
        id: 'complex',
        description: 'Analyze multiple complex scenarios with detailed step by step breakdown'
      };
      
      const simpleComplexity = strategy.estimateTaskComplexity(simpleTask, context);
      const complexComplexity = strategy.estimateTaskComplexity(complexTask, context);
      
      expect(complexComplexity.score).toBeGreaterThan(simpleComplexity.score);
      expect(complexComplexity.factors.keywords).toBeGreaterThan(0);
    });

    it('should increase complexity for tasks with subtasks', () => {
      const taskWithSubtasks = {
        id: 'with-subtasks',
        description: 'Parent task',
        subtasks: [
          { id: 'sub-1', description: 'Subtask 1' },
          { id: 'sub-2', description: 'Subtask 2' }
        ]
      };
      
      const taskWithoutSubtasks = {
        id: 'without-subtasks',
        description: 'Standalone task'
      };
      
      const withComplexity = strategy.estimateTaskComplexity(taskWithSubtasks, context);
      const withoutComplexity = strategy.estimateTaskComplexity(taskWithoutSubtasks, context);
      
      expect(withComplexity.score).toBeGreaterThan(withoutComplexity.score);
    });
  });

  describe('Decomposition Decision', () => {
    it('should decompose when explicitly requested', () => {
      const task = {
        id: 'explicit',
        decompose: true,
        description: 'Simple task but explicitly marked for decomposition'
      };
      
      expect(strategy.shouldDecompose(task, context)).toBe(true);
    });

    it('should decompose based on complexity threshold', () => {
      const complexTask = {
        id: 'complex',
        description: 'Complex task with multiple steps requiring detailed analysis'
      };
      
      // Mock complexity estimation to return high score
      jest.spyOn(strategy, 'estimateTaskComplexity').mockReturnValue({ score: 0.8 });
      
      expect(strategy.shouldDecompose(complexTask, context)).toBe(true);
    });

    it('should not decompose at max depth', () => {
      const maxDepthContext = new ExecutionContext(null, { depth: 3, maxDepth: 3 });
      
      const task = {
        id: 'max-depth',
        decompose: true,
        description: 'Task at max depth'
      };
      
      expect(strategy.shouldDecompose(task, maxDepthContext)).toBe(false);
    });

    it('should not decompose simple tasks', () => {
      const simpleTask = {
        id: 'simple',
        description: 'Simple task'
      };
      
      // Mock complexity estimation to return low score
      jest.spyOn(strategy, 'estimateTaskComplexity').mockReturnValue({ score: 0.3 });
      jest.spyOn(strategy, 'requiresDecomposition').mockReturnValue(false);
      
      expect(strategy.shouldDecompose(simpleTask, context)).toBe(false);
    });
  });

  describe('LLM Decomposition', () => {
    it('should decompose tasks using LLM', async () => {
      const task = {
        id: 'llm-task',
        description: 'Create a web application with user authentication'
      };
      
      const mockResponse = {
        content: JSON.stringify({
          subtasks: [
            {
              id: 'setup-project',
              description: 'Set up project structure',
              priority: 1
            },
            {
              id: 'implement-auth',
              description: 'Implement user authentication',
              priority: 2,
              dependencies: ['setup-project']
            }
          ],
          strategy: 'sequential',
          reasoning: 'Authentication requires project setup first'
        })
      };
      
      mockLLMClient.complete.mockResolvedValue(mockResponse);
      
      const emitter = { custom: jest.fn() };
      const decomposition = await strategy.llmDecompose(task, context, emitter);
      
      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks).toHaveLength(2);
      expect(decomposition.strategy).toBe('sequential');
      expect(decomposition.subtasks[0].id).toBe('setup-project');
      expect(decomposition.subtasks[1].dependencies).toContain('setup-project');
    });

    it('should handle malformed LLM responses', async () => {
      const task = {
        id: 'malformed-task',
        description: 'Task with malformed response'
      };
      
      mockLLMClient.complete.mockResolvedValue({
        content: 'Invalid JSON response'
      });
      
      const emitter = { custom: jest.fn() };
      const decomposition = await strategy.llmDecompose(task, context, emitter);
      
      // Should return fallback decomposition
      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.subtasks[0].id).toContain('fallback');
    });

    it('should handle LLM errors gracefully', async () => {
      const task = {
        id: 'error-task',
        description: 'Task that causes LLM error'
      };
      
      mockLLMClient.complete.mockRejectedValue(new Error('LLM error'));
      
      const emitter = { custom: jest.fn() };
      const decomposition = await strategy.llmDecompose(task, context, emitter);
      
      expect(decomposition).toBeNull();
      expect(emitter.custom).toHaveBeenCalledWith('llm_decomposition_failed', expect.anything());
    });
  });

  describe('Template Decomposition', () => {
    it('should decompose using predefined templates', async () => {
      const task = {
        id: 'template-task',
        description: 'Task with template',
        template: {
          steps: [
            { id: 'step-1', description: 'First step', operation: 'initialize' },
            { id: 'step-2', description: 'Second step', operation: 'process' },
            { id: 'step-3', description: 'Third step', operation: 'finalize' }
          ],
          strategy: 'sequential'
        }
      };
      
      const decomposition = await strategy.templateDecompose(task, context);
      
      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks).toHaveLength(3);
      expect(decomposition.strategy).toBe('sequential');
      expect(decomposition.metadata.source).toBe('template');
    });

    it('should return null for invalid templates', async () => {
      const task = {
        id: 'invalid-template',
        template: 'invalid template format'
      };
      
      const decomposition = await strategy.templateDecompose(task, context);
      
      expect(decomposition).toBeNull();
    });
  });

  describe('Heuristic Decomposition', () => {
    it('should decompose based on step patterns', async () => {
      const task = {
        id: 'steps-task',
        description: 'Step 1: Initialize project. Step 2: Add features. Step 3: Test application.'
      };
      
      const decomposition = await strategy.heuristicDecompose(task, context);
      
      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks.length).toBeGreaterThan(1);
      expect(decomposition.metadata.source).toBe('heuristic');
    });

    it('should create planning phases for non-step tasks', async () => {
      const task = {
        id: 'general-task',
        description: 'Create a complex application'
      };
      
      const decomposition = await strategy.heuristicDecompose(task, context);
      
      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks).toHaveLength(2);
      expect(decomposition.subtasks[0].operation).toBe('analyze_and_plan');
      expect(decomposition.subtasks[1].operation).toBe('execute_plan');
    });

    it('should handle tool-based tasks', async () => {
      const task = {
        id: 'tool-task',
        tool: 'calculator',
        params: { expression: '2+2' }
      };
      
      const decomposition = await strategy.heuristicDecompose(task, context);
      
      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.subtasks[0].tool).toBe('calculator');
    });
  });

  describe('Subtask Execution Strategies', () => {
    it('should execute subtasks sequentially', async () => {
      const subtasks = [
        { id: 'sub-1', data: 'result1' },
        { id: 'sub-2', data: 'result2' },
        { id: 'sub-3', data: 'result3' }
      ];
      
      const emitter = { custom: jest.fn() };
      const results = await strategy.executeSubtasksSequential(subtasks, context, emitter);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should execute subtasks in parallel', async () => {
      const subtasks = [
        { id: 'sub-1', data: 'result1' },
        { id: 'sub-2', data: 'result2' },
        { id: 'sub-3', data: 'result3' }
      ];
      
      const emitter = { custom: jest.fn() };
      const results = await strategy.executeSubtasksParallel(subtasks, context, emitter);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should execute subtasks with mixed strategy', async () => {
      const subtasks = [
        { id: 'sub-1', data: 'result1' },
        { id: 'sub-2', data: 'result2', dependencies: ['sub-1'] },
        { id: 'sub-3', data: 'result3' }
      ];
      
      const emitter = { custom: jest.fn() };
      const results = await strategy.executeSubtasksMixed(subtasks, context, emitter);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const subtasks = [
        { id: 'sub-1', dependencies: ['sub-2'] },
        { id: 'sub-2', dependencies: ['sub-1'] }
      ];
      
      const emitter = { custom: jest.fn() };
      
      await expect(strategy.executeSubtasksMixed(subtasks, context, emitter))
        .rejects.toThrow('Circular dependency detected');
    });
  });

  describe('Cycle Detection', () => {
    it('should detect cycles in task execution', () => {
      const task = {
        id: 'cyclic-task',
        description: 'Task that creates a cycle'
      };
      
      const cyclicContext = {
        ...context,
        getAncestors: () => [
          { id: 'ancestor-1', description: 'First ancestor' },
          { id: 'cyclic-task', description: 'Task that creates a cycle' }
        ]
      };
      
      expect(strategy.detectCycle(task, cyclicContext)).toBe(true);
    });

    it('should not detect cycles for unique tasks', () => {
      const task = {
        id: 'unique-task',
        description: 'Unique task'
      };
      
      const nonCyclicContext = {
        ...context,
        getAncestors: () => [
          { id: 'ancestor-1', description: 'First ancestor' },
          { id: 'ancestor-2', description: 'Second ancestor' }
        ]
      };
      
      expect(strategy.detectCycle(task, nonCyclicContext)).toBe(false);
    });

    it('should handle disabled cycle detection', () => {
      strategy.cycleDetection = false;
      
      const task = {
        id: 'any-task',
        description: 'Any task'
      };
      
      expect(strategy.detectCycle(task, context)).toBe(false);
    });
  });

  describe('Result Composition', () => {
    it('should aggregate results by default', async () => {
      const originalTask = { id: 'parent', compositionType: 'aggregate' };
      const subtaskResults = [
        { success: true, result: 'result1' },
        { success: true, result: 'result2' },
        { success: false, error: 'Error in subtask' }
      ];
      const decomposition = { metadata: { source: 'test' } };
      
      const composed = await strategy.composeResult(originalTask, subtaskResults, decomposition, context);
      
      expect(composed.result).toEqual(['result1', 'result2']);
      expect(composed.metadata.successful).toBe(2);
      expect(composed.metadata.failed).toBe(1);
    });

    it('should merge results when specified', async () => {
      const originalTask = { id: 'parent', compositionType: 'merge' };
      const subtaskResults = [
        { success: true, result: { key1: 'value1' } },
        { success: true, result: { key2: 'value2' } },
        { success: true, result: { key3: 'value3' } }
      ];
      const decomposition = { metadata: { source: 'test' } };
      
      const composed = await strategy.composeResult(originalTask, subtaskResults, decomposition, context);
      
      expect(composed.result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
    });

    it('should return first successful result', async () => {
      const originalTask = { id: 'parent', compositionType: 'first' };
      const subtaskResults = [
        { success: true, result: 'first' },
        { success: true, result: 'second' },
        { success: true, result: 'third' }
      ];
      const decomposition = { metadata: { source: 'test' } };
      
      const composed = await strategy.composeResult(originalTask, subtaskResults, decomposition, context);
      
      expect(composed).toBe('first');
    });

    it('should return last successful result', async () => {
      const originalTask = { id: 'parent', compositionType: 'last' };
      const subtaskResults = [
        { success: true, result: 'first' },
        { success: true, result: 'second' },
        { success: true, result: 'last' }
      ];
      const decomposition = { metadata: { source: 'test' } };
      
      const composed = await strategy.composeResult(originalTask, subtaskResults, decomposition, context);
      
      expect(composed).toBe('last');
    });

    it('should use custom composition function', async () => {
      const originalTask = {
        id: 'parent',
        compose: (results) => results.filter(r => r.success).map(r => r.result).join('-')
      };
      const subtaskResults = [
        { success: true, result: 'a' },
        { success: true, result: 'b' },
        { success: false, error: 'failed' }
      ];
      const decomposition = { metadata: { source: 'test' } };
      
      const composed = await strategy.composeResult(originalTask, subtaskResults, decomposition, context);
      
      expect(composed).toBe('a-b');
    });
  });

  describe('Recursive Execution', () => {
    it('should execute simple recursive task', async () => {
      const task = {
        id: 'recursive-task',
        description: 'Simple task that should be executed directly',
        data: 'simple-result'
      };
      
      // Mock shouldDecompose to return false for direct execution
      jest.spyOn(strategy, 'shouldDecompose').mockReturnValue(false);
      
      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('simple-result');
    });

    it('should decompose and execute complex task', async () => {
      const task = {
        id: 'complex-task',
        recursive: true,
        description: 'Complex task that needs decomposition',
        subtasks: [
          { id: 'sub-1', data: 'result1' },
          { id: 'sub-2', data: 'result2' }
        ]
      };
      
      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(['result1', 'result2']);
    });

    it('should fail when exceeding max depth', async () => {
      const deepContext = new ExecutionContext(null, { depth: 5, maxDepth: 3 });
      
      const task = {
        id: 'deep-task',
        recursive: true,
        description: 'Task at excessive depth'
      };
      
      await expect(strategy.execute(task, deepContext))
        .rejects.toThrow('Maximum recursion depth exceeded');
    });

    it('should fail when cycle is detected', async () => {
      const task = {
        id: 'cyclic-task',
        recursive: true,
        description: 'Cyclic task'
      };
      
      const cyclicContext = {
        ...context,
        getAncestors: () => [{ id: 'cyclic-task', description: 'Cyclic task' }]
      };
      
      await expect(strategy.execute(task, cyclicContext))
        .rejects.toThrow('Cycle detected');
    });

    it('should handle decomposition failure gracefully', async () => {
      const task = {
        id: 'decompose-fail',
        recursive: true,
        description: 'Task that fails to decompose'
      };
      
      // Mock decomposeTask to return null
      jest.spyOn(strategy, 'decomposeTask').mockResolvedValue(null);
      jest.spyOn(strategy, 'shouldDecompose').mockReturnValue(true);
      
      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      // Should fallback to direct execution
    });
  });

  describe('Cache Management', () => {
    it('should cache decomposition results', async () => {
      const task = {
        id: 'cache-task',
        description: 'Task for caching test',
        subtasks: [{ id: 'sub-1', data: 'result' }]
      };
      
      const emitter = { custom: jest.fn() };
      
      // First call should decompose
      const decomposition1 = await strategy.decomposeTask(task, context, emitter);
      
      // Second call should use cache
      const decomposition2 = await strategy.decomposeTask(task, context, emitter);
      
      expect(decomposition1).toEqual(decomposition2);
      expect(emitter.custom).toHaveBeenCalledWith('cache_hit', expect.anything());
    });

    it('should clear cache when requested', () => {
      strategy.decompositionCache.set('test-key', { test: 'data' });
      expect(strategy.getCacheStats().size).toBe(1);
      
      strategy.clearCache();
      expect(strategy.getCacheStats().size).toBe(0);
    });

    it('should provide cache statistics', () => {
      strategy.decompositionCache.set('key1', { data: 'test1' });
      strategy.decompositionCache.set('key2', { data: 'test2' });
      
      const stats = strategy.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.enabled).toBe(true);
    });
  });

  describe('Complexity Estimation', () => {
    it('should estimate complexity for recursive tasks', async () => {
      const task = {
        id: 'estimate-task',
        description: 'Complex task with multiple steps and detailed analysis',
        recursive: true
      };
      
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBeGreaterThan(0);
      expect(complexity.estimatedCost).toBeGreaterThan(0);
      expect(complexity.confidence).toBeGreaterThan(0);
      expect(complexity.reasoning).toContain('Recursive execution');
    });

    it('should estimate complexity for direct execution', async () => {
      const task = {
        id: 'simple-task',
        description: 'Simple task'
      };
      
      // Mock complexity estimation to return low score
      jest.spyOn(strategy, 'estimateTaskComplexity').mockReturnValue({ score: 0.3 });
      
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.reasoning).toContain('Direct execution');
    });
  });

  describe('Error Handling', () => {
    it('should handle tasks that cannot be handled', async () => {
      const task = {
        id: 'unhandleable',
        tool: 'calculator'  // Simple atomic task
      };
      
      jest.spyOn(strategy, 'canHandle').mockReturnValue(false);
      
      await expect(strategy.execute(task, context))
        .rejects.toThrow('RecursiveExecutionStrategy cannot handle task');
    });

    it('should handle missing LLM client for direct execution', async () => {
      const task = {
        id: 'no-llm',
        description: 'Task requiring LLM'
      };
      
      strategy = new RecursiveExecutionStrategy(); // No LLM client
      jest.spyOn(strategy, 'shouldDecompose').mockReturnValue(false);
      
      await expect(strategy.executeDirectly(task, context, { custom: jest.fn() }))
        .rejects.toThrow('LLM client not configured');
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customStrategy = new RecursiveExecutionStrategy({
        maxDepth: 10,
        decomposeThreshold: 0.5,
        useCache: false,
        cycleDetection: false
      });

      expect(customStrategy.maxDepth).toBe(10);
      expect(customStrategy.decomposeThreshold).toBe(0.5);
      expect(customStrategy.useCache).toBe(false);
      expect(customStrategy.cycleDetection).toBe(false);
    });

    it('should use default configuration', () => {
      const defaultStrategy = new RecursiveExecutionStrategy();

      expect(defaultStrategy.maxDepth).toBe(5);
      expect(defaultStrategy.decomposeThreshold).toBe(0.7);
      expect(defaultStrategy.useCache).toBe(true);
      expect(defaultStrategy.cycleDetection).toBe(true);
    });

    it('should validate configuration', () => {
      expect(() => {
        strategy.validateRecursiveTask({
          id: 'test',
          description: 'Valid task'
        });
      }).not.toThrow();
    });
  });
});