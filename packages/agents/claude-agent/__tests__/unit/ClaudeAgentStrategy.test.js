/**
 * Unit Tests for ClaudeAgentStrategy
 *
 * Tests the TaskStrategy implementation that wraps Claude SDK
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ClaudeAgentStrategy } from '../../src/ClaudeAgentStrategy.js';

describe('ClaudeAgentStrategy', () => {
  describe('initialize()', () => {
    let strategy;
    let mockContext;
    let mockResourceManager;
    let mockToolRegistry;

    beforeEach(() => {
      // Create strategy instance
      strategy = Object.create(ClaudeAgentStrategy);

      // Mock ToolRegistry
      mockToolRegistry = {
        getTool: (name) => ({ name, description: 'Test tool', inputSchema: {} }),
        getAllTools: () => []
      };

      // Mock ResourceManager
      mockResourceManager = {
        get: (key) => {
          if (key === 'env.ANTHROPIC_API_KEY') return 'test-api-key-123';
          return null;
        }
      };

      // Mock context with ExecutionContext interface
      mockContext = {
        toolRegistry: mockToolRegistry,
        resourceManager: mockResourceManager
      };
    });

    test('should get ResourceManager from context', async () => {
      await strategy.initialize(mockContext);

      expect(strategy.resourceManager).toBe(mockResourceManager);
    });

    test('should extract ANTHROPIC_API_KEY from ResourceManager', async () => {
      await strategy.initialize(mockContext);

      expect(strategy.apiKey).toBe('test-api-key-123');
    });

    test('should throw error if API key missing (FAIL FAST)', async () => {
      mockResourceManager.get = () => null;

      await expect(strategy.initialize(mockContext)).rejects.toThrow('ANTHROPIC_API_KEY not found');
    });

    test('should initialize ClaudeToolBridge with toolRegistry', async () => {
      await strategy.initialize(mockContext);

      expect(strategy.toolBridge).toBeDefined();
      expect(strategy.toolBridge.toolRegistry).toBe(mockToolRegistry);
    });

    test('should initialize ClaudeContextAdapter', async () => {
      await strategy.initialize(mockContext);

      expect(strategy.contextAdapter).toBeDefined();
    });

    test('should initialize Claude SDK client with API key', async () => {
      await strategy.initialize(mockContext);

      // Verify client was created (we'll mock the actual SDK in implementation)
      expect(strategy.claudeClient).toBeDefined();
    });

    test('should store context reference', async () => {
      await strategy.initialize(mockContext);

      expect(strategy.context).toBe(mockContext);
    });

    test('should throw error if context is missing', async () => {
      await expect(strategy.initialize(null)).rejects.toThrow('ExecutionContext is required');
    });

    test('should throw error if context.toolRegistry is missing', async () => {
      delete mockContext.toolRegistry;

      await expect(strategy.initialize(mockContext)).rejects.toThrow('ExecutionContext must have toolRegistry');
    });

    test('should throw error if context.resourceManager is missing', async () => {
      delete mockContext.resourceManager;

      await expect(strategy.initialize(mockContext)).rejects.toThrow('ExecutionContext must have resourceManager');
    });
  });

  describe('onMessage()', () => {
    let strategy;
    let mockTask;
    let mockContext;
    let queryClaudeCalled;

    beforeEach(async () => {
      // Create strategy instance
      strategy = Object.create(ClaudeAgentStrategy);

      // Mock context
      mockContext = {
        toolRegistry: {
          getTool: () => ({ name: 'test', inputSchema: {} }),
          getAllTools: () => []
        },
        resourceManager: {
          get: (key) => (key === 'env.ANTHROPIC_API_KEY' ? 'test-key' : null)
        }
      };

      // Initialize strategy
      await strategy.initialize(mockContext);

      // Track if _queryClaudeAsync was called
      queryClaudeCalled = false;
      strategy._queryClaudeAsync = async (task) => {
        queryClaudeCalled = true;
      };

      // Mock task
      mockTask = {
        id: 'task_123',
        description: 'Test task',
        conversation: [],
        context: {}
      };
    });

    test('should handle "start" message - initiate Claude query', async () => {
      const message = { type: 'start', content: 'Begin task' };
      const senderTask = null;

      await strategy.onMessage(mockTask, senderTask, message);

      expect(queryClaudeCalled).toBe(true);
    });

    test('should handle "work" message - continue conversation', async () => {
      const message = { type: 'work', content: 'Continue' };
      const senderTask = null;

      await strategy.onMessage(mockTask, senderTask, message);

      expect(queryClaudeCalled).toBe(true);
    });

    test('should ignore unknown message types', async () => {
      const message = { type: 'unknown', content: 'Test' };
      const senderTask = null;

      await strategy.onMessage(mockTask, senderTask, message);

      expect(queryClaudeCalled).toBe(false);
    });

    test('should use fire-and-forget pattern (no return value)', async () => {
      const message = { type: 'start', content: 'Test' };
      const senderTask = null;

      const result = await strategy.onMessage(mockTask, senderTask, message);

      // Fire-and-forget should not return a value
      expect(result).toBeUndefined();
    });
  });

  describe('_queryClaudeAsync()', () => {
    let strategy;
    let mockTask;
    let mockContext;
    let claudeResponseCalls;
    let processResponseCalls;

    beforeEach(async () => {
      // Create strategy instance
      strategy = Object.create(ClaudeAgentStrategy);

      // Mock context
      mockContext = {
        toolRegistry: {
          getTool: () => ({ name: 'test', description: 'Test tool', inputSchema: {} }),
          getAllTools: () => [
            { name: 'test_tool', description: 'Test tool', inputSchema: {} }
          ]
        },
        resourceManager: {
          get: (key) => (key === 'env.ANTHROPIC_API_KEY' ? 'test-key' : null)
        }
      };

      // Initialize strategy
      await strategy.initialize(mockContext);

      // Track Claude SDK calls
      claudeResponseCalls = [];
      strategy.claudeClient = {
        messages: {
          create: async (request) => {
            claudeResponseCalls.push(request);
            return {
              id: 'msg_test123',
              content: [{ type: 'text', text: 'Mock response' }],
              model: 'claude-3-5-sonnet-20241022',
              stop_reason: 'end_turn'
            };
          }
        }
      };

      // Track _processClaudeResponse calls
      processResponseCalls = [];
      strategy._processClaudeResponse = async (task, response) => {
        processResponseCalls.push({ task, response });
      };

      // Mock task
      mockTask = {
        id: 'task_123',
        description: 'Test task',
        conversation: [{ role: 'user', content: 'Hello' }],
        context: { systemPrompt: 'Test prompt' },
        getAllArtifacts: () => ({})
      };
    });

    test('should build request using ContextAdapter', async () => {
      await strategy._queryClaudeAsync(mockTask);

      expect(claudeResponseCalls).toHaveLength(1);
      const request = claudeResponseCalls[0];

      // Should have system prompt
      expect(request.system).toBeDefined();
      // Should have messages
      expect(request.messages).toBeDefined();
      expect(request.messages.length).toBeGreaterThan(0);
    });

    test('should add tools using ToolBridge', async () => {
      await strategy._queryClaudeAsync(mockTask);

      expect(claudeResponseCalls).toHaveLength(1);
      const request = claudeResponseCalls[0];

      // Should have tools array
      expect(request.tools).toBeDefined();
      expect(Array.isArray(request.tools)).toBe(true);
    });

    test('should call Claude SDK query method', async () => {
      await strategy._queryClaudeAsync(mockTask);

      expect(claudeResponseCalls).toHaveLength(1);
    });

    test('should process response', async () => {
      await strategy._queryClaudeAsync(mockTask);

      expect(processResponseCalls).toHaveLength(1);
      expect(processResponseCalls[0].task).toBe(mockTask);
      expect(processResponseCalls[0].response).toBeDefined();
    });

    test('should use default model if not specified', async () => {
      await strategy._queryClaudeAsync(mockTask);

      const request = claudeResponseCalls[0];
      expect(request.model).toBe('claude-3-5-sonnet-20241022');
    });

    test('should use task model if specified', async () => {
      mockTask.context.model = 'claude-3-opus-20240229';

      await strategy._queryClaudeAsync(mockTask);

      const request = claudeResponseCalls[0];
      expect(request.model).toBe('claude-3-opus-20240229');
    });
  });
});
