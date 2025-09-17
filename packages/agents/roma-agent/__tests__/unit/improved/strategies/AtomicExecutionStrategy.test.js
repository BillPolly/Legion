/**
 * Test suite for AtomicExecutionStrategy
 * Tests direct execution without decomposition
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AtomicExecutionStrategy } from '../../../../src/core/strategies/AtomicExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('AtomicExecutionStrategy', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockLLMClient;
  let mockSimplePromptClient;
  let mockProgressStream;

  beforeEach(() => {
    // Mock tool registry for unit tests
    mockToolRegistry = {
      getTool: jest.fn()
    };

    // Mock LLM client for unit tests
    mockLLMClient = {
      complete: jest.fn()
    };

    // Mock SimplePromptClient for unit tests
    mockSimplePromptClient = {
      request: jest.fn()
    };

    // Mock progress stream for unit tests
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

    // Create strategy with testMode flag for unit tests
    strategy = new AtomicExecutionStrategy({
      testMode: true,  // Enable test mode to allow mocks
      toolRegistry: mockToolRegistry,
      llmClient: mockLLMClient,
      simplePromptClient: mockSimplePromptClient,
      progressStream: mockProgressStream,
      maxRetries: 2,
      retryDelay: 10
    });

    strategy.retryHandler = {
      config: { maxAttempts: 2 },
      updateConfiguration: jest.fn(),
      reset: jest.fn(),
      executeWithRetry: jest.fn(async (handlerFn) => handlerFn(1, null)),
      generateErrorFeedback: jest.fn((errors, prompt) => prompt)
    };

    strategy.retryManager = {
      maxAttempts: 2,
      baseDelay: 10,
      backoffFactor: 2,
      retryPolicies: new Map([
        ['unknown', { baseDelay: 10 }]
      ]),
      classifyError: jest.fn(() => 'unknown'),
      calculateDelay: jest.fn(() => 10),
      shouldRetry: jest.fn(() => true),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      isCircuitOpen: jest.fn(async () => false)
    };

    context = new ExecutionContext(null, {
      taskId: 'test-task',
      sessionId: 'test-session',
      maxDepth: 3
    });
  });

  describe('Task Handling Detection', () => {
    it('should handle atomic tasks', () => {
      const atomicTask = {
        id: 'task-1',
        description: 'Simple task',
        atomic: true
      };
      
      expect(strategy.canHandle(atomicTask, context)).toBe(true);
    });

    it('should handle tasks with strategy=atomic', () => {
      const task = {
        id: 'task-1',
        description: 'Simple task',
        strategy: 'atomic'
      };
      
      expect(strategy.canHandle(task, context)).toBe(true);
    });

    it('should handle tool tasks', () => {
      const toolTask = {
        id: 'task-1',
        tool: 'calculator',
        params: { expression: '2 + 2' }
      };
      
      expect(strategy.canHandle(toolTask, context)).toBe(true);
    });

    it('should handle function tasks', () => {
      const functionTask = {
        id: 'task-1',
        execute: async () => 'result'
      };
      
      expect(strategy.canHandle(functionTask, context)).toBe(true);
    });

    it('should handle simple prompt tasks', () => {
      const promptTask = {
        id: 'task-1',
        prompt: 'What is 2 + 2?'
      };
      
      expect(strategy.canHandle(promptTask, context)).toBe(true);
    });

    it('should not handle complex tasks requiring decomposition', () => {
      const complexTask = {
        id: 'task-1',
        description: 'First do this, then do that, and finally combine the results step by step'
      };
      
      expect(strategy.canHandle(complexTask, context)).toBe(false);
    });
  });

  describe('Execution Type Determination', () => {
    it('should determine tool execution type', () => {
      const toolTask = { tool: 'calculator' };
      expect(strategy.determineExecutionType(toolTask)).toBe('tool');
      
      const toolNameTask = { toolName: 'calculator' };
      expect(strategy.determineExecutionType(toolNameTask)).toBe('tool');
    });

    it('should determine function execution type', () => {
      const executeTask = { execute: () => {} };
      expect(strategy.determineExecutionType(executeTask)).toBe('function');
      
      const fnTask = { fn: () => {} };
      expect(strategy.determineExecutionType(fnTask)).toBe('function');
    });

    it('should determine LLM execution type', () => {
      const promptTask = { prompt: 'test prompt' };
      expect(strategy.determineExecutionType(promptTask)).toBe('llm');
      
      const descriptionTask = { description: 'test description' };
      expect(strategy.determineExecutionType(descriptionTask)).toBe('llm');
      
      const operationTask = { operation: 'test operation' };
      expect(strategy.determineExecutionType(operationTask)).toBe('llm');
    });

    it('should throw for unknown execution type', () => {
      const unknownTask = { id: 'task-1' };
      expect(() => strategy.determineExecutionType(unknownTask)).toThrow('Cannot determine execution type');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool successfully', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          result: { calculated: 4 }
        })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'calculator',
        params: { expression: '2 + 2' }
      };
      
      const result = await strategy.execute(task, context);
      
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('calculator');
      expect(mockTool.execute).toHaveBeenCalledWith({ expression: '2 + 2' });
      expect(result.result).toEqual({ calculated: 4 });
    });

    it('should handle tool not found', async () => {
      mockToolRegistry.getTool.mockResolvedValue(null);
      
      const task = {
        id: 'task-1',
        tool: 'non-existent'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Tool not found: non-existent');
    });

    it('should handle tool execution failure', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({
          success: false,
          error: 'Tool failed'
        })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'calculator'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Tool failed');
    });

    it('should pass context data when includeContext is true', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: { value: 'test' },
        includeContext: true
      };
      
      await strategy.execute(task, context);
      
      expect(mockTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test',
          context: expect.objectContaining({
            taskId: 'test-task',
            sessionId: 'test-session',
            depth: 0
          })
        })
      );
    });
  });

  describe('Function Execution', () => {
    it('should execute function successfully', async () => {
      const mockFunction = jest.fn().mockResolvedValue('function result');
      
      const task = {
        id: 'task-1',
        execute: mockFunction,
        params: { input: 'test' }
      };
      
      const result = await strategy.execute(task, context);
      
      expect(mockFunction).toHaveBeenCalledWith({ input: 'test' });
      expect(result.result).toBe('function result');
    });

    it('should execute fn property', async () => {
      const mockFunction = jest.fn().mockResolvedValue('fn result');
      
      const task = {
        id: 'task-1',
        fn: mockFunction,
        args: 'test-arg'
      };
      
      const result = await strategy.execute(task, context);
      
      expect(mockFunction).toHaveBeenCalledWith('test-arg');
      expect(result.result).toBe('fn result');
    });

    it('should pass context when requiresContext is true', async () => {
      const mockFunction = jest.fn().mockResolvedValue('result');
      
      const task = {
        id: 'task-1',
        execute: mockFunction,
        params: { value: 'test' },
        requiresContext: true
      };
      
      await strategy.execute(task, context);
      
      expect(mockFunction).toHaveBeenCalledWith(
        { value: 'test' },
        expect.objectContaining({
          ...context,
          metadata: expect.objectContaining({
            strategy: 'atomic'
          })
        })
      );
    });

    it('should handle synchronous functions', async () => {
      const mockFunction = jest.fn(() => 'sync result');
      
      const task = {
        id: 'task-1',
        execute: mockFunction
      };
      
      const result = await strategy.execute(task, context);
      
      expect(result.result).toBe('sync result');
    });

    it('should extract args from task properties', async () => {
      const mockFunction = jest.fn().mockResolvedValue('result');
      
      const task = {
        id: 'task-1',
        execute: mockFunction,
        prop1: 'value1',
        prop2: 'value2'
      };
      
      await strategy.execute(task, context);
      
      expect(mockFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-1',
          prop1: 'value1',
          prop2: 'value2'
        })
      );
    });
  });

  describe('LLM Execution', () => {
    it('should execute LLM prompt successfully', async () => {
      mockSimplePromptClient.request.mockResolvedValue({
        content: 'LLM response'
      });
      
      const task = {
        id: 'task-1',
        prompt: 'What is 2 + 2?'
      };
      
      const result = await strategy.execute(task, context);
      
      expect(mockSimplePromptClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'What is 2 + 2?',
          maxTokens: 1000
        })
      );
      expect(result.result).toBe('LLM response');
    });

    it('should include system prompt', async () => {
      mockSimplePromptClient.request.mockResolvedValue({ content: 'response' });
      
      const task = {
        id: 'task-1',
        prompt: 'test',
        systemPrompt: 'You are a helpful assistant'
      };
      
      await strategy.execute(task, context);
      
      expect(mockSimplePromptClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test',
          systemPrompt: expect.stringContaining('You are a helpful assistant'),
          maxTokens: 1000
        })
      );
    });

    it('should include conversation history', async () => {
      mockSimplePromptClient.request.mockResolvedValue({ content: 'response' });
      
      const task = {
        id: 'task-1',
        prompt: 'continue',
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there' }
        ]
      };
      
      await strategy.execute(task, context);
      
      expect(mockSimplePromptClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'continue',
          chatHistory: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'hi there' }
          ],
          maxTokens: 1000
        })
      );
    });

    it('should delegate retry logic to configured RetryHandler', async () => {
      strategy.retryHandler.executeWithRetry.mockImplementation(async (handlerFn, options) => {
        const attemptResult = await handlerFn(1, null);
        return { success: true, data: attemptResult, metadata: { attempts: 1 } };
      });
      mockSimplePromptClient.request.mockResolvedValue({ content: 'handled by retry handler' });

      const task = {
        id: 'retry-handler-task',
        prompt: 'Explain retry logic'
      };

      await strategy.execute(task, context);

      expect(strategy.retryHandler.updateConfiguration).toHaveBeenCalledWith({ maxAttempts: expect.any(Number) });
      expect(strategy.retryHandler.executeWithRetry).toHaveBeenCalledTimes(1);
    });

    it('should parse JSON response when expected', async () => {
      mockSimplePromptClient.request.mockResolvedValue({
        content: '{"answer": 42}'
      });
      
      const task = {
        id: 'task-1',
        prompt: 'Return JSON',
        expectJSON: true
      };
      
      const result = await strategy.execute(task, context);
      
      expect(result.result).toEqual({ answer: 42 });
    });

    it('should handle JSON parse errors', async () => {
      mockSimplePromptClient.request.mockResolvedValue({
        content: 'not valid json'
      });
      
      const task = {
        id: 'task-1',
        prompt: 'Return JSON',
        parseJSON: true
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Failed to parse JSON');
    });

    it('should enrich prompt with context variables', async () => {
      mockSimplePromptClient.request.mockResolvedValue({ content: 'response' });
      
      const enrichedContext = context.withSharedState('userName', 'Alice');
      
      const task = {
        id: 'task-1',
        prompt: 'Hello {{userName}}, your session is {{sessionId}}'
      };
      
      await strategy.execute(task, enrichedContext);
      
      expect(mockSimplePromptClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Hello Alice, your session is test-session',
          maxTokens: 1000
        })
      );
    });

    it('should handle different response formats', async () => {
      // OpenAI format
      mockSimplePromptClient.request.mockResolvedValue({
        choices: [{
          message: { content: 'openai response' }
        }]
      });
      
      let result = await strategy.execute({ id: '1', prompt: 'test' }, context);
      expect(result.result).toBe('openai response');
      
      // Direct string
      mockSimplePromptClient.request.mockResolvedValue('direct response');
      
      result = await strategy.execute({ id: '2', prompt: 'test' }, context);
      expect(result.result).toBe('direct response');
      
      // Text property
      mockSimplePromptClient.request.mockResolvedValue({
        text: 'text response'
      });
      
      result = await strategy.execute({ id: '3', prompt: 'test' }, context);
      expect(result.result).toBe('text response');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure', async () => {
      const mockTool = {
        execute: jest.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({ success: true, result: 'success' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool'
      };
      
      const result = await strategy.execute(task, context);
      
      expect(mockTool.execute).toHaveBeenCalledTimes(2);
      expect(result.result).toBe('success');
    });

    it('should fail after max retries', async () => {
      const mockTool = {
        execute: jest.fn().mockRejectedValue(new Error('Persistent failure'))
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Persistent failure');
      expect(mockTool.execute).toHaveBeenCalledTimes(2); // maxRetries = 2
    });

    it('should apply exponential backoff', async () => {
      const startTime = Date.now();
      
      const mockTool = {
        execute: jest.fn()
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'))
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Error 2');
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(5); // Some delay should have occurred
    });
  });

  describe('Parameter Resolution', () => {
    it('should resolve context references', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: {
          sessionId: '$context.sessionId',
          depth: '$context.depth'
        }
      };
      
      await strategy.execute(task, context);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        sessionId: 'test-session',
        depth: 0
      });
    });

    it('should resolve previous result references', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const contextWithResults = context.withResult({ value: 'previous-value' });
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: {
          input: '$previous.0.value'
        }
      };
      
      await strategy.execute(task, contextWithResults);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        input: 'previous-value'
      });
    });

    it('should resolve shared state references', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const contextWithState = context.withSharedState('apiKey', 'secret-key');
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: {
          auth: '$shared.apiKey'
        }
      };
      
      await strategy.execute(task, contextWithState);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        auth: 'secret-key'
      });
    });

    it('should resolve dependency references', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const contextWithDep = context.withDependency('dep-1', { data: 'dep-value' });
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: {
          input: '$dep-1.data'
        }
      };
      
      await strategy.execute(task, contextWithDep);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        input: 'dep-value'
      });
    });

    it('should handle nested parameter resolution', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'ok' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        params: {
          config: {
            sessionId: '$context.sessionId',
            nested: {
              depth: '$context.depth'
            }
          }
        }
      };
      
      await strategy.execute(task, context);
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        config: {
          sessionId: 'test-session',
          nested: {
            depth: 0
          }
        }
      });
    });
  });

  describe('Result Validation', () => {
    it('should validate required results', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: null })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        outputSchema: { required: true }
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Result is required');
    });

    it('should validate result type', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'string-result' })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        outputSchema: { type: 'number' }
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Result type mismatch');
    });

    it('should validate object properties', async () => {
      const mockTool = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          result: { prop1: 'value' }
        })
      };
      
      mockToolRegistry.getTool.mockResolvedValue(mockTool);
      
      const task = {
        id: 'task-1',
        tool: 'test-tool',
        outputSchema: {
          type: 'object',
          properties: {
            prop1: { required: false },
            prop2: { required: true }
          }
        }
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Required property missing: prop2');
    });
  });

  describe('Format Parsing', () => {
    it('should parse lines format', () => {
      const content = 'line1\nline2\n\nline3';
      const result = strategy.parseFormat(content, 'lines');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should parse CSV format', () => {
      const content = 'a,b,c\n1,2,3';
      const result = strategy.parseFormat(content, 'csv');
      expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    });

    it('should parse list format', () => {
      const content = '- item1\n- item2\n* item3';
      const result = strategy.parseFormat(content, 'list');
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should parse number format', () => {
      expect(strategy.parseFormat('42', 'number')).toBe(42);
      expect(strategy.parseFormat('3.14', 'number')).toBe(3.14);
    });

    it('should parse boolean format', () => {
      expect(strategy.parseFormat('true', 'boolean')).toBe(true);
      expect(strategy.parseFormat('True', 'boolean')).toBe(true);
      expect(strategy.parseFormat('yes', 'boolean')).toBe(true);
      expect(strategy.parseFormat('Yes', 'boolean')).toBe(true);
      expect(strategy.parseFormat('false', 'boolean')).toBe(false);
      expect(strategy.parseFormat('no', 'boolean')).toBe(false);
    });
  });

  describe('Complexity Estimation', () => {
    it('should estimate tool complexity', async () => {
      const task = { id: 'task-1', tool: 'calculator' };
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(150); // 100 * 1.5 for retries
      expect(complexity.confidence).toBeCloseTo(0.81, 2); // 0.9 * 0.9
      expect(complexity.reasoning).toContain('tool');
    });

    it('should estimate network tool complexity', async () => {
      const task = { id: 'task-1', tool: 'http_api_call' };
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(750); // 500 * 1.5 for retries
    });

    it('should estimate function complexity', async () => {
      const task = { id: 'task-1', execute: () => {} };
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(75); // 50 * 1.5 for retries
      expect(complexity.confidence).toBeCloseTo(0.855, 3); // 0.95 * 0.9
    });

    it('should estimate LLM complexity', async () => {
      const task = { id: 'task-1', prompt: 'test' };
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedTime).toBe(3000); // 2000 * 1.5 for retries
      expect(complexity.estimatedCost).toBe(0.001);
      expect(complexity.confidence).toBeCloseTo(0.63, 2); // 0.7 * 0.9
    });

    it('should estimate GPT-4 complexity', async () => {
      const task = { id: 'task-1', prompt: 'test', model: 'gpt-4' };
      const complexity = await strategy.estimateComplexity(task, context);
      
      expect(complexity.estimatedCost).toBe(0.01);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool registry', async () => {
      strategy = new AtomicExecutionStrategy({ progressStream: mockProgressStream });
      
      const task = { id: 'task-1', tool: 'test' };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Tool registry not configured');
    });

    it('should handle missing LLM client', async () => {
      strategy = new AtomicExecutionStrategy({ 
        testMode: true,
        progressStream: mockProgressStream 
      });
      
      const task = { id: 'task-1', prompt: 'test' };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('SimplePromptClient not configured');
    });

    it('should handle non-callable function', async () => {
      const task = {
        id: 'task-1',
        execute: 'not-a-function'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Task function is not callable');
    });

    it('should handle unknown LLM response format', async () => {
      mockSimplePromptClient.request.mockResolvedValue({
        unknownFormat: 'test'
      });
      
      const task = { id: 'task-1', prompt: 'test' };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('Cannot extract content from LLM response');
    });

    it('should handle task that cannot be executed', async () => {
      const task = {
        id: 'task-1',
        description: 'Break this down into multiple steps and execute them'
      };
      
      await expect(strategy.execute(task, context)).rejects.toThrow('AtomicExecutionStrategy cannot handle task');
    });
  });
});
