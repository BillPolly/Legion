/**
 * Test suite for ParallelExecutionStrategy
 * Tests parallel execution, concurrency control, result aggregation, and failure handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ParallelExecutionStrategy } from '../../../../src/core/strategies/ParallelExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('ParallelExecutionStrategy', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockLLMClient;
  let mockSimplePromptClient;
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

    // Mock SimplePromptClient
    mockSimplePromptClient = {
      request: jest.fn()
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

    strategy = new ParallelExecutionStrategy({
      testMode: true,  // Enable test mode for unit tests
      toolRegistry: mockToolRegistry,
      llmClient: mockLLMClient,
      simplePromptClient: mockSimplePromptClient,
      progressStream: mockProgressStream,
      maxConcurrency: 3,
      failFast: false,
      timeoutPerTask: 5000
    });

    context = new ExecutionContext(null, {
      taskId: 'test-task',
      sessionId: 'test-session',
      maxDepth: 3
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
  });

  describe('Task Handling Detection', () => {
    it('should handle parallel tasks', () => {
      const parallelTask = {
        id: 'task-1',
        parallel: true,
        subtasks: [
          { id: 'sub-1', operation: 'op1' },
          { id: 'sub-2', operation: 'op2' }
        ]
      };
      
      expect(strategy.canHandle(parallelTask, context)).toBe(true);
    });

    it('should handle tasks with strategy=parallel', () => {
      const task = {
        id: 'task-1',
        strategy: 'parallel',
        subtasks: [{ id: 'sub-1', operation: 'op1' }]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tasks with subtasks array', () => {
      const task = {
        id: 'task-1',
        subtasks: [
          { id: 'sub-1', tool: 'calculator' },
          { id: 'sub-2', prompt: 'analyze data' }
        ]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tasks with operations array', () => {
      const task = {
        id: 'task-1',
        operations: [
          { tool: 'fetch_data', params: { url: 'api/users' } },
          { tool: 'fetch_data', params: { url: 'api/posts' } }
        ]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle concurrent/batch tasks', () => {
      const concurrentTask = {
        id: 'task-1',
        concurrent: true,
        operations: [{ tool: 'process_item' }]
      };
      
      const batchTask = {
        id: 'task-2',
        batch: true,
        items: ['item1', 'item2']
      };
      
      expect(strategy.canHandle(concurrentTask, context)).toBe(true);
      expect(strategy.canHandle(batchTask, context)).toBe(true);
    });

    it('should not handle non-parallel tasks', () => {
      const atomicTask = {
        id: 'task-1',
        tool: 'calculator'
      };
      
      expect(strategy.canHandle(atomicTask, context)).toBe(false);
    });
  });

  describe('Subtask Extraction', () => {
    it('should extract direct subtasks', () => {
      const task = {
        id: 'parent',
        subtasks: [
          { id: 'sub-1', tool: 'calculator' },
          { id: 'sub-2', prompt: 'analyze' }
        ]
      };
      
      const subtasks = strategy.extractSubtasks(task);
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].id).toBe('sub-1');
      expect(subtasks[1].id).toBe('sub-2');
    });

    it('should extract operations as subtasks', () => {
      const task = {
        id: 'parent',
        operations: [
          { tool: 'fetch', url: 'api/users' },
          { tool: 'fetch', url: 'api/posts' }
        ]
      };
      
      const subtasks = strategy.extractSubtasks(task);
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].id).toBe('parent-op-0');
      expect(subtasks[0].tool).toBe('fetch');
      expect(subtasks[1].id).toBe('parent-op-1');
    });

    it('should extract batch items as subtasks', () => {
      const task = {
        id: 'batch-task',
        batch: true,
        items: ['item1', 'item2', 'item3'],
        template: {
          tool: 'process_item'
        }
      };
      
      const subtasks = strategy.extractSubtasks(task);
      expect(subtasks).toHaveLength(3);
      expect(subtasks[0].id).toBe('batch-task-item-0');
      expect(subtasks[0].tool).toBe('process_item');
      expect(subtasks[0].input).toBe('item1');
    });

    it('should extract map operations as subtasks', () => {
      const task = {
        id: 'map-task',
        map: 'transform_data',
        collection: [{ data: 'a' }, { data: 'b' }]
      };
      
      const subtasks = strategy.extractSubtasks(task);
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].id).toBe('map-task-map-0');
      expect(subtasks[0].operation).toBe('transform_data');
      expect(subtasks[0].input).toEqual({ data: 'a' });
    });

    it('should return empty array for no subtasks', () => {
      const task = { id: 'simple', tool: 'calculator' };
      
      const subtasks = strategy.extractSubtasks(task);
      expect(subtasks).toEqual([]);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute subtasks in parallel', async () => {
      const task = {
        id: 'parallel-task',
        subtasks: [
          { id: 'sub-1', data: 'result1' },
          { id: 'sub-2', data: 'result2' },
          { id: 'sub-3', data: 'result3' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(['result1', 'result2', 'result3']);
    });

    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const task = {
        id: 'concurrent-task',
        subtasks: Array.from({ length: 6 }, (_, i) => ({
          id: `sub-${i}`,
          execute: async () => {
            concurrentCount++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCount);
            await new Promise(resolve => setTimeout(resolve, 50));
            concurrentCount--;
            return `result-${i}`;
          }
        }))
      };

      await strategy.execute(task, context);
      
      expect(maxConcurrent).toBeLessThanOrEqual(3); // maxConcurrency = 3
    });

    it('should handle tool execution in parallel', async () => {
      const mockTool = {
        execute: jest.fn()
          .mockResolvedValueOnce({ success: true, result: 'calc1' })
          .mockResolvedValueOnce({ success: true, result: 'calc2' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'tool-parallel',
        subtasks: [
          { id: 'sub-1', tool: 'calculator', params: { expression: '2+2' } },
          { id: 'sub-2', tool: 'calculator', params: { expression: '3+3' } }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
      expect(result.result).toEqual(['calc1', 'calc2']);
    });

    it('should handle LLM prompts in parallel', async () => {
      mockSimplePromptClient.request
        .mockResolvedValueOnce({ content: 'response1' })
        .mockResolvedValueOnce({ content: 'response2' });
      
      const task = {
        id: 'llm-parallel',
        subtasks: [
          { id: 'sub-1', prompt: 'What is 2+2?' },
          { id: 'sub-2', prompt: 'What is 3+3?' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(mockSimplePromptClient.request).toHaveBeenCalledTimes(2);
      expect(result.result).toEqual(['response1', 'response2']);
    });

    it('should track progress during execution', async () => {
      // Create a fixed emitter instance that will be returned by all calls
      const emitter = {
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
      };
      
      // Make the mock always return the same emitter instance
      mockProgressStream.createTaskEmitter.mockReturnValue(emitter);
      
      const task = {
        id: 'progress-task',
        subtasks: [
          { id: 'sub-1', data: 'result1' },
          { id: 'sub-2', data: 'result2' }
        ]
      };

      await strategy.execute(task, context);
      
      expect(mockProgressStream.createTaskEmitter).toHaveBeenCalled();
      expect(emitter.custom).toHaveBeenCalledWith('parallel_start', expect.objectContaining({
        totalTasks: 2,
        maxConcurrency: 3
      }));
      expect(emitter.custom).toHaveBeenCalledWith('parallel_complete', expect.objectContaining({
        totalTasks: 2,
        successful: 2,
        failed: 0
      }));
    });
  });

  describe('Failure Handling', () => {
    it('should continue execution when failFast is false', async () => {
      const task = {
        id: 'fail-continue',
        subtasks: [
          { id: 'sub-1', data: 'success' },
          { id: 'sub-2', execute: async () => { throw new Error('failure'); } },
          { id: 'sub-3', data: 'success2' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result.result).toEqual(['success', 'success2']);
      expect(result.result.details.successful).toBe(2);
      expect(result.result.details.failed).toBe(1);
    });

    it('should fail fast when failFast is true', async () => {
      strategy = new ParallelExecutionStrategy({
        failFast: true,
        maxConcurrency: 3
      });

      const task = {
        id: 'fail-fast',
        subtasks: [
          { id: 'sub-1', execute: async () => { 
            await new Promise(resolve => setTimeout(resolve, 100));
            return 'slow-success';
          }},
          { id: 'sub-2', execute: async () => { throw new Error('quick-failure'); } },
          { id: 'sub-3', data: 'success' }
        ]
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('Subtask failed');
    });

    it('should handle task timeouts', async () => {
      strategy = new ParallelExecutionStrategy({
        timeoutPerTask: 100,
        maxConcurrency: 2
      });

      const task = {
        id: 'timeout-task',
        subtasks: [
          { id: 'sub-1', data: 'quick' },
          { id: 'sub-2', execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return 'slow';
          }}
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result.details.successful).toBe(1);
      expect(result.result.details.failed).toBe(1);
    });

    it('should handle errors in subtask execution', async () => {
      const workingTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      const failingTool = {
        execute: jest.fn().mockRejectedValue(new Error('Tool error'))
      };
      
      mockToolRegistry.getTool
        .mockResolvedValueOnce(workingTool)
        .mockResolvedValueOnce(failingTool);
      
      const task = {
        id: 'error-task',
        includeDetails: true, // Force details to be included
        subtasks: [
          { id: 'sub-1', tool: 'working-tool' },
          { id: 'sub-2', tool: 'failing-tool' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result.details.successful).toBe(1);
      expect(result.result.details.failed).toBe(1);
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate results as array by default', async () => {
      const task = {
        id: 'array-task',
        subtasks: [
          { id: 'sub-1', data: 'a' },
          { id: 'sub-2', data: 'b' },
          { id: 'sub-3', data: 'c' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual(['a', 'b', 'c']);
    });

    it('should aggregate as object when specified', async () => {
      const task = {
        id: 'object-task',
        aggregationType: 'object',
        subtasks: [
          { id: 'sub-1', data: { key1: 'value1' } },
          { id: 'sub-2', data: { key2: 'value2' } }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should sum numeric results', async () => {
      const task = {
        id: 'sum-task',
        aggregationType: 'sum',
        subtasks: [
          { id: 'sub-1', data: 10 },
          { id: 'sub-2', data: 20 },
          { id: 'sub-3', data: 30 }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe(60);
    });

    it('should concatenate arrays', async () => {
      const task = {
        id: 'concat-task',
        aggregationType: 'concat',
        subtasks: [
          { id: 'sub-1', data: [1, 2] },
          { id: 'sub-2', data: [3, 4] },
          { id: 'sub-3', data: [5, 6] }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should return first result', async () => {
      const task = {
        id: 'first-task',
        aggregationType: 'first',
        subtasks: [
          { id: 'sub-1', data: 'first' },
          { id: 'sub-2', data: 'second' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('first');
    });

    it('should return last result', async () => {
      const task = {
        id: 'last-task',
        aggregationType: 'last',
        subtasks: [
          { id: 'sub-1', data: 'first' },
          { id: 'sub-2', data: 'last' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('last');
    });

    it('should use custom aggregation function', async () => {
      const task = {
        id: 'custom-task',
        aggregate: (results) => results.join('-'),
        subtasks: [
          { id: 'sub-1', data: 'a' },
          { id: 'sub-2', data: 'b' },
          { id: 'sub-3', data: 'c' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('a-b-c');
    });

    it('should include failures when aggregationType is "all"', async () => {
      const task = {
        id: 'all-task',
        aggregationType: 'all',
        subtasks: [
          { id: 'sub-1', data: 'success' },
          { id: 'sub-2', execute: async () => { throw new Error('failed'); } }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toHaveLength(2);
      expect(result.result[0]).toBe('success');
      expect(result.result[1]).toHaveProperty('error');
    });
  });

  describe('Complexity Estimation', () => {
    it('should estimate complexity for parallel tasks', async () => {
      const task = {
        id: 'estimate-task',
        subtasks: [
          { id: 'sub-1', tool: 'calculator' },
          { id: 'sub-2', prompt: 'analyze data' },
          { id: 'sub-3', execute: () => 'function' }
        ]
      };

      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBeGreaterThan(0);
      expect(complexity.estimatedCost).toBeGreaterThan(0);
      expect(complexity.confidence).toBeGreaterThan(0);
      expect(complexity.reasoning).toContain('Parallel execution of 3 tasks');
    });

    it('should account for concurrency in time estimation', async () => {
      strategy = new ParallelExecutionStrategy({ maxConcurrency: 2 });
      
      const task = {
        id: 'concurrency-estimate',
        subtasks: Array.from({ length: 6 }, (_, i) => ({
          id: `sub-${i}`,
          tool: 'calculator'
        }))
      };

      const complexity = await strategy.estimateComplexity(task, context);
      
      // With 6 tasks and concurrency 2, should have 3 batches
      expect(complexity.reasoning).toContain('3 batches');
    });

    it('should return zero complexity for empty subtasks', async () => {
      const task = {
        id: 'empty-task',
        subtasks: []
      };

      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(0);
      expect(complexity.estimatedCost).toBe(0);
      expect(complexity.confidence).toBe(0);
    });
  });

  describe('Context Management', () => {
    it('should create parallel contexts for subtasks', async () => {
      const task = {
        id: 'context-task',
        subtasks: [
          { id: 'sub-1', data: 'result1' },
          { id: 'sub-2', data: 'result2' }
        ]
      };

      // Mock context creation
      const mockChildContexts = [
        context.createChild('sub-1'),
        context.createChild('sub-2')
      ];
      
      jest.spyOn(context, 'createParallelContexts').mockReturnValue(mockChildContexts);
      jest.spyOn(context, 'mergeParallelResults').mockReturnValue(context);

      await strategy.execute(task, context);
      
      expect(context.createParallelContexts).toHaveBeenCalledWith(['sub-1', 'sub-2']);
      expect(context.mergeParallelResults).toHaveBeenCalled();
    });

    it('should preserve shared state across parallel tasks', async () => {
      // Add a shared artifact to simulate shared state
      context.addArtifact('global_data', {
        type: 'data',
        value: 'globalValue',
        description: 'Global data shared across tasks',
        purpose: 'Provide shared configuration for parallel execution',
        timestamp: Date.now()
      });
      
      const task = {
        id: 'shared-state-task',
        subtasks: [
          { id: 'sub-1', data: 'result1' },
          { id: 'sub-2', data: 'result2' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      // Shared artifact should be preserved through parallel execution
      expect(context.getArtifactValue('global_data')).toBe('globalValue');
    });
  });

  describe('Error Cases', () => {
    it('should fail when no subtasks found', async () => {
      const task = {
        id: 'no-subtasks',
        parallel: true
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('No subtasks found');
    });

    it('should fail when strategy cannot handle task', async () => {
      const task = {
        id: 'incompatible',
        tool: 'calculator'  // Not a parallel task
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('ParallelExecutionStrategy cannot handle task');
    });

    it('should handle missing LLM client for direct execution', async () => {
      strategy = new ParallelExecutionStrategy({ maxConcurrency: 2 });
      
      const task = {
        id: 'no-llm',
        subtasks: [
          { id: 'sub-1', prompt: 'need llm' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result.details.successful).toBe(0);
      expect(result.result.details.failed).toBe(1);
    });

    it('should handle tasks that cannot be executed directly', async () => {
      const task = {
        id: 'unexecutable',
        subtasks: [
          { id: 'sub-1', unknownProperty: 'value' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result.details.failed).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customStrategy = new ParallelExecutionStrategy({
        maxConcurrency: 10,
        failFast: true,
        aggregateResults: false,
        timeoutPerTask: 60000
      });

      expect(customStrategy.maxConcurrency).toBe(10);
      expect(customStrategy.failFast).toBe(true);
      expect(customStrategy.aggregateResults).toBe(false);
      expect(customStrategy.timeoutPerTask).toBe(60000);
    });

    it('should use default configuration', () => {
      const defaultStrategy = new ParallelExecutionStrategy();

      expect(defaultStrategy.maxConcurrency).toBe(5);
      expect(defaultStrategy.failFast).toBe(false);
      expect(defaultStrategy.aggregateResults).toBe(true);
      expect(defaultStrategy.timeoutPerTask).toBe(30000);
    });
  });
});