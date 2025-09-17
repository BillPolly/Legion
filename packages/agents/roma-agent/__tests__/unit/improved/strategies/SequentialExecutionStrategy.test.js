/**
 * Test suite for SequentialExecutionStrategy
 * Tests sequential execution, dependency management, result passing, and failure handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SequentialExecutionStrategy } from '../../../../src/core/strategies/SequentialExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('SequentialExecutionStrategy', () => {
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

    strategy = new SequentialExecutionStrategy({
      testMode: true,  // Enable test mode for unit tests
      toolRegistry: mockToolRegistry,
      llmClient: mockLLMClient,
      simplePromptClient: mockSimplePromptClient,
      progressStream: mockProgressStream,
      stopOnFailure: true,
      passResults: true,
      accumulateResults: true
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
    it('should handle sequential tasks', () => {
      const sequentialTask = {
        id: 'task-1',
        sequential: true,
        steps: [
          { id: 'step-1', operation: 'op1' },
          { id: 'step-2', operation: 'op2' }
        ]
      };
      
      expect(strategy.canHandle(sequentialTask, context)).toBe(true);
    });

    it('should handle tasks with strategy=sequential', () => {
      const task = {
        id: 'task-1',
        strategy: 'sequential',
        steps: [{ id: 'step-1', operation: 'op1' }]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tasks with steps array', () => {
      const task = {
        id: 'task-1',
        steps: [
          { id: 'step-1', tool: 'calculator' },
          { id: 'step-2', prompt: 'analyze data' }
        ]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tasks with sequence array', () => {
      const task = {
        id: 'task-1',
        sequence: [
          { tool: 'fetch_data', params: { url: 'api/users' } },
          { tool: 'process_data', params: { format: 'json' } }
        ]
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle pipeline/workflow tasks', () => {
      const pipelineTask = {
        id: 'task-1',
        pipeline: true,
        steps: [{ tool: 'process_step' }]
      };
      
      const workflowTask = {
        id: 'task-2',
        workflow: true,
        steps: [{ tool: 'workflow_step' }]
      };
      
      expect(strategy.canHandle(pipelineTask, context)).toBe(true);
      expect(strategy.canHandle(workflowTask, context)).toBe(true);
    });

    it('should handle ordered subtasks', () => {
      const orderedTask = {
        id: 'task-1',
        ordered: true,
        subtasks: [
          { id: 'sub-1', tool: 'step1' },
          { id: 'sub-2', tool: 'step2' }
        ]
      };
      
      expect(strategy.canHandle(orderedTask, context)).toBe(true);
    });

    it('should not handle non-sequential tasks', () => {
      const atomicTask = {
        id: 'task-1',
        tool: 'calculator'
      };
      
      expect(strategy.canHandle(atomicTask, context)).toBe(false);
    });
  });

  describe('Step Extraction', () => {
    it('should extract direct steps', () => {
      const task = {
        id: 'parent',
        steps: [
          { id: 'step-1', tool: 'calculator' },
          { id: 'step-2', prompt: 'analyze' }
        ]
      };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toHaveLength(2);
      expect(steps[0].id).toBe('step-1');
      expect(steps[1].id).toBe('step-2');
    });

    it('should extract sequence as steps', () => {
      const task = {
        id: 'parent',
        sequence: [
          { tool: 'fetch', url: 'api/users' },
          { tool: 'process', format: 'json' }
        ]
      };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toHaveLength(2);
      expect(steps[0].tool).toBe('fetch');
      expect(steps[1].tool).toBe('process');
    });

    it('should extract ordered subtasks as steps', () => {
      const task = {
        id: 'ordered-task',
        ordered: true,
        subtasks: [
          { id: 'sub-1', tool: 'step1' },
          { id: 'sub-2', tool: 'step2' },
          { id: 'sub-3', tool: 'step3' }
        ]
      };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toHaveLength(3);
      expect(steps[0].id).toBe('sub-1');
      expect(steps[1].id).toBe('sub-2');
      expect(steps[2].id).toBe('sub-3');
    });

    it('should extract pipeline steps', () => {
      const task = {
        id: 'pipeline-task',
        pipeline: {
          steps: [
            { tool: 'input_validation' },
            { tool: 'data_processing' },
            { tool: 'output_formatting' }
          ]
        }
      };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toHaveLength(3);
      expect(steps[0].tool).toBe('input_validation');
      expect(steps[1].tool).toBe('data_processing');
      expect(steps[2].tool).toBe('output_formatting');
    });

    it('should extract workflow tasks', () => {
      const task = {
        id: 'workflow-task',
        workflow: {
          tasks: [
            { operation: 'authenticate' },
            { operation: 'authorize' },
            { operation: 'execute' }
          ]
        }
      };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toHaveLength(3);
      expect(steps[0].operation).toBe('authenticate');
      expect(steps[1].operation).toBe('authorize');
      expect(steps[2].operation).toBe('execute');
    });

    it('should return empty array for no steps', () => {
      const task = { id: 'simple', tool: 'calculator' };
      
      const steps = strategy.extractSteps(task);
      expect(steps).toEqual([]);
    });
  });

  describe('Sequential Execution', () => {
    it('should execute steps in order', async () => {
      const executionOrder = [];
      const task = {
        id: 'sequential-task',
        steps: [
          { id: 'step-1', data: 'result1', execute: async () => { executionOrder.push(1); return 'result1'; } },
          { id: 'step-2', data: 'result2', execute: async () => { executionOrder.push(2); return 'result2'; } },
          { id: 'step-3', data: 'result3', execute: async () => { executionOrder.push(3); return 'result3'; } }
        ]
      };

      await strategy.execute(task, context);
      
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should execute steps with data returns', async () => {
      const task = {
        id: 'data-task',
        steps: [
          { id: 'step-1', data: 'first' },
          { id: 'step-2', data: 'second' },
          { id: 'step-3', data: 'third' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(['first', 'second', 'third']);
    });

    it('should handle tool execution in sequence', async () => {
      const mockTool = {
        execute: jest.fn()
          .mockResolvedValueOnce({ success: true, result: 'calc1' })
          .mockResolvedValueOnce({ success: true, result: 'calc2' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'tool-sequential',
        steps: [
          { id: 'step-1', tool: 'calculator', params: { expression: '2+2' } },
          { id: 'step-2', tool: 'calculator', params: { expression: '3+3' } }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
      expect(result.result).toEqual(['calc1', 'calc2']);
    });

    it('should handle LLM prompts in sequence', async () => {
      mockSimplePromptClient.request
        .mockResolvedValueOnce({ content: 'response1' })
        .mockResolvedValueOnce({ content: 'response2' });
      
      const task = {
        id: 'llm-sequential',
        steps: [
          { id: 'step-1', prompt: 'What is 2+2?' },
          { id: 'step-2', prompt: 'What is 3+3?' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(mockSimplePromptClient.request).toHaveBeenCalledTimes(2);
      expect(result.result).toEqual(['response1', 'response2']);
    });

    it('should track progress during execution', async () => {
      // Create a fixed emitter instance
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
      
      mockProgressStream.createTaskEmitter.mockReturnValue(emitter);
      
      const task = {
        id: 'progress-task',
        steps: [
          { id: 'step-1', data: 'result1' },
          { id: 'step-2', data: 'result2' }
        ]
      };

      await strategy.execute(task, context);
      
      expect(mockProgressStream.createTaskEmitter).toHaveBeenCalled();
      expect(emitter.custom).toHaveBeenCalledWith('sequential_start', expect.objectContaining({
        totalSteps: 2,
        stopOnFailure: true,
        passResults: true
      }));
      expect(emitter.custom).toHaveBeenCalledWith('sequential_complete', expect.objectContaining({
        totalSteps: 2,
        successful: 2,
        failed: 0
      }));
    });
  });

  describe('Failure Handling', () => {
    it('should stop on failure when stopOnFailure is true', async () => {
      const task = {
        id: 'fail-stop',
        steps: [
          { id: 'step-1', data: 'success' },
          { id: 'step-2', execute: async () => { throw new Error('failure'); } },
          { id: 'step-3', data: 'should not reach' }
        ]
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('Sequential execution failed at step 1: failure');
    });

    it('should continue on failure when stopOnFailure is false', async () => {
      strategy = new SequentialExecutionStrategy({
        stopOnFailure: false,
        passResults: true,
        accumulateResults: true
      });

      const task = {
        id: 'fail-continue',
        steps: [
          { id: 'step-1', data: 'success1' },
          { id: 'step-2', execute: async () => { throw new Error('failure'); } },
          { id: 'step-3', data: 'success2' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result).toEqual(['success1', { error: 'failure' }, 'success2']);
    });

    it('should handle missing LLM client', async () => {
      strategy = new SequentialExecutionStrategy({ stopOnFailure: false });
      
      const task = {
        id: 'no-llm',
        steps: [
          { id: 'step-1', prompt: 'need llm' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result[0]).toHaveProperty('error');
    });
  });

  describe('Result Passing', () => {
    it('should pass results between steps when enabled', async () => {
      let step2Input = null;
      
      const task = {
        id: 'result-passing',
        steps: [
          { id: 'step-1', data: 'initial-data' },
          { 
            id: 'step-2', 
            execute: async (step) => {
              step2Input = step.context?.previousResult;
              return 'final-result';
            }
          }
        ]
      };

      await strategy.execute(task, context);
      
      expect(step2Input).toBe('initial-data');
    });

    it('should inject results into prompts', async () => {
      mockSimplePromptClient.request.mockResolvedValue({ content: 'processed' });
      
      const task = {
        id: 'prompt-injection',
        steps: [
          { id: 'step-1', data: { value: 42 } },
          { 
            id: 'step-2', 
            prompt: 'Process this data: {previousResult}'
          }
        ]
      };

      await strategy.execute(task, context);
      
      expect(mockSimplePromptClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Process this data: {"value":42}',
          maxTokens: 1000
        })
      );
    });

    it('should inject results into parameters', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'processed' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'param-injection',
        steps: [
          { id: 'step-1', data: 'test-input' },
          { 
            id: 'step-2',
            tool: 'processor',
            params: {
              input: '{previousResult}',
              mode: 'process'
            }
          }
        ]
      };

      await strategy.execute(task, context);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        input: 'test-input',
        mode: 'process'
      });
    });
  });

  describe('Result Accumulation', () => {
    it('should accumulate results as array by default', async () => {
      const task = {
        id: 'array-accumulation',
        steps: [
          { id: 'step-1', data: 'a' },
          { id: 'step-2', data: 'b' },
          { id: 'step-3', data: 'c' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual(['a', 'b', 'c']);
    });

    it('should accumulate as object when specified', async () => {
      const task = {
        id: 'object-accumulation',
        accumulationType: 'object',
        steps: [
          { id: 'step-1', data: { key1: 'value1' } },
          { id: 'step-2', data: { key2: 'value2' } }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should sum numeric results', async () => {
      const task = {
        id: 'sum-accumulation',
        accumulationType: 'sum',
        steps: [
          { id: 'step-1', data: 10 },
          { id: 'step-2', data: 20 },
          { id: 'step-3', data: 30 }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe(60);
    });

    it('should concatenate arrays', async () => {
      const task = {
        id: 'concat-accumulation',
        accumulationType: 'concat',
        steps: [
          { id: 'step-1', data: [1, 2] },
          { id: 'step-2', data: [3, 4] },
          { id: 'step-3', data: [5, 6] }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should return last result when specified', async () => {
      const task = {
        id: 'last-accumulation',
        accumulationType: 'last',
        steps: [
          { id: 'step-1', data: 'first' },
          { id: 'step-2', data: 'middle' },
          { id: 'step-3', data: 'last' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('last');
    });

    it('should return first result when specified', async () => {
      const task = {
        id: 'first-accumulation',
        accumulationType: 'first',
        steps: [
          { id: 'step-1', data: 'first' },
          { id: 'step-2', data: 'middle' },
          { id: 'step-3', data: 'last' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('first');
    });

    it('should use pipeline accumulation', async () => {
      const task = {
        id: 'pipeline-accumulation',
        accumulationType: 'pipeline',
        steps: [
          { id: 'step-1', data: 'input' },
          { id: 'step-2', data: 'processed' },
          { id: 'step-3', data: 'output' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('output'); // Each step operates on previous result
    });

    it('should use custom accumulation function', async () => {
      const task = {
        id: 'custom-accumulation',
        accumulate: (acc, result) => (acc || '') + result + '-',
        steps: [
          { id: 'step-1', data: 'a' },
          { id: 'step-2', data: 'b' },
          { id: 'step-3', data: 'c' }
        ]
      };

      const result = await strategy.execute(task, context);
      expect(result.result).toBe('a-b-c-');
    });
  });

  describe('Complexity Estimation', () => {
    it('should estimate complexity for sequential tasks', async () => {
      const task = {
        id: 'estimate-task',
        steps: [
          { id: 'step-1', tool: 'calculator' },
          { id: 'step-2', prompt: 'analyze data' },
          { id: 'step-3', execute: () => 'function' }
        ]
      };

      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBeGreaterThan(0);
      expect(complexity.estimatedCost).toBeGreaterThan(0);
      expect(complexity.confidence).toBeGreaterThan(0);
      expect(complexity.reasoning).toContain('Sequential execution of 3 steps');
    });

    it('should return zero complexity for empty steps', async () => {
      const task = {
        id: 'empty-task',
        steps: []
      };

      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(0);
      expect(complexity.estimatedCost).toBe(0);
      expect(complexity.confidence).toBe(0);
    });
  });

  describe('Error Cases', () => {
    it('should fail when no steps found', async () => {
      const task = {
        id: 'no-steps',
        sequential: true
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('No steps found');
    });

    it('should fail when strategy cannot handle task', async () => {
      const task = {
        id: 'incompatible',
        tool: 'calculator'  // Not a sequential task
      };

      await expect(strategy.execute(task, context)).rejects.toThrow('SequentialExecutionStrategy cannot handle task');
    });

    it('should handle steps that cannot be executed directly', async () => {
      strategy = new SequentialExecutionStrategy({ stopOnFailure: false });
      
      const task = {
        id: 'unexecutable',
        steps: [
          { id: 'step-1', unknownProperty: 'value' }
        ]
      };

      const result = await strategy.execute(task, context);
      
      expect(result.success).toBe(true);
      expect(result.result[0]).toHaveProperty('error');
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customStrategy = new SequentialExecutionStrategy({
        stopOnFailure: false,
        passResults: false,
        accumulateResults: false
      });

      expect(customStrategy.stopOnFailure).toBe(false);
      expect(customStrategy.passResults).toBe(false);
      expect(customStrategy.accumulateResults).toBe(false);
    });

    it('should use default configuration', () => {
      const defaultStrategy = new SequentialExecutionStrategy();

      expect(defaultStrategy.stopOnFailure).toBe(true);
      expect(defaultStrategy.passResults).toBe(true);
      expect(defaultStrategy.accumulateResults).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    it('should validate step dependencies', () => {
      const steps = [
        { id: 'step-1' },
        { id: 'step-2' },
        { id: 'step-3' }
      ];
      
      const validDependencies = {
        'step-2': ['step-1'],
        'step-3': ['step-1', 'step-2']
      };

      expect(() => {
        strategy.validateStepDependencies(steps, validDependencies);
      }).not.toThrow();
    });

    it('should fail for invalid step dependencies', () => {
      const steps = [
        { id: 'step-1' },
        { id: 'step-2' }
      ];
      
      const invalidDependencies = {
        'step-2': ['nonexistent-step']
      };

      expect(() => {
        strategy.validateStepDependencies(steps, invalidDependencies);
      }).toThrow('Unknown dependency step ID: nonexistent-step');
    });
  });
});