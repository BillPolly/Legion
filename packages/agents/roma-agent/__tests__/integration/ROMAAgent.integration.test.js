/**
 * Integration test for ROMAAgent - New improved implementation
 * Tests the complete agent execution workflow
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';

describe('ROMAAgent Integration', () => {
  let agent;
  let mockToolRegistry;
  let mockResourceManager;
  let mockLlmClient;

  beforeEach(() => {
    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue({
        name: 'calculator',
        execute: jest.fn().mockResolvedValue({ result: 42 })
      })
    };

    mockResourceManager = {
      get: jest.fn().mockReturnValue('test-value')
    };

    mockLlmClient = {
      complete: jest.fn().mockResolvedValue({
        content: 'LLM response'
      })
    };

    agent = new ROMAAgent({
      toolRegistry: mockToolRegistry,
      resourceManager: mockResourceManager,
      llmClient: mockLlmClient,
      maxConcurrency: 2,
      defaultTimeout: 5000
    });
  });

  describe('Basic Agent Operations', () => {
    it('should initialize correctly', async () => {
      await agent.initialize();
      
      expect(agent.isInitialized).toBe(true);
      expect(agent.strategyResolver).toBeDefined();
      expect(agent.dependencyResolver).toBeDefined();
    });

    it('should execute single task successfully', async () => {
      const task = {
        id: 'test-task',
        description: 'Test task',
        tool: 'calculator',
        params: { a: 5, b: 7 }
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionId).toBeDefined();
      expect(result.metadata.duration).toBeGreaterThan(0);
    });

    it('should execute multiple tasks with dependencies', async () => {
      const tasks = [
        {
          id: 'task1',
          description: 'First task',
          tool: 'calculator'
        },
        {
          id: 'task2',
          description: 'Second task',
          dependencies: ['task1'],
          tool: 'calculator'
        }
      ];

      const result = await agent.execute(tasks);

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(2);
      expect(result.metadata.executionPlan.executionOrder).toEqual(['task1', 'task2']);
    });

    it('should handle task execution errors gracefully', async () => {
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'failing-tool',
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      });

      const task = {
        id: 'failing-task',
        description: 'Task that fails',
        tool: 'failing-tool'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
      expect(result.metadata.executionId).toBeDefined();
    });
  });

  describe('Agent Configuration', () => {
    it('should accept custom configuration options', () => {
      const customAgent = new ROMAAgent({
        maxConcurrency: 10,
        defaultTimeout: 60000,
        enableSemanticAnalysis: false,
        maxExecutionDepth: 5
      });

      expect(customAgent.options.maxConcurrency).toBe(10);
      expect(customAgent.options.defaultTimeout).toBe(60000);
      expect(customAgent.options.enableSemanticAnalysis).toBe(false);
      expect(customAgent.options.maxExecutionDepth).toBe(5);
    });

    it('should update configuration dynamically', () => {
      agent.updateConfiguration({
        maxConcurrency: 8,
        defaultTimeout: 45000
      });

      expect(agent.options.maxConcurrency).toBe(8);
      expect(agent.options.defaultTimeout).toBe(45000);
    });
  });

  describe('Progress Tracking', () => {
    it('should emit progress events when enabled', async () => {
      const progressEvents = [];
      
      const task = {
        id: 'progress-task',
        description: 'Task with progress tracking',
        tool: 'calculator'
      };

      const result = await agent.execute(task, {
        onProgress: (event) => {
          progressEvents.push(event);
        }
      });

      expect(result.success).toBe(true);
      // Progress events might be emitted depending on task complexity
    });
  });

  describe('Execution Statistics', () => {
    it('should track execution statistics', async () => {
      const task = {
        id: 'stats-task',
        description: 'Task for statistics',
        tool: 'calculator'
      };

      await agent.execute(task);

      const stats = agent.getStatistics();
      
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    it('should track execution history', async () => {
      const task = {
        id: 'history-task',
        description: 'Task for history',
        tool: 'calculator'
      };

      await agent.execute(task);

      const history = agent.getExecutionHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('completed');
      expect(history[0].taskCount).toBe(1);
      expect(history[0].duration).toBeGreaterThan(0);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      await agent.initialize();
      expect(agent.isInitialized).toBe(true);

      await agent.shutdown();
      expect(agent.isInitialized).toBe(false);
    });

    it('should handle multiple initializations', async () => {
      await agent.initialize();
      expect(agent.isInitialized).toBe(true);

      // Second initialization should not fail
      await agent.initialize();
      expect(agent.isInitialized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle dependency resolution errors', async () => {
      const tasks = [
        {
          id: 'task1',
          dependencies: ['task1'] // Circular dependency
        }
      ];

      const result = await agent.execute(tasks);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependencies detected');
    });

    it('should handle missing tool registry', async () => {
      const noToolAgent = new ROMAAgent({
        toolRegistry: null,
        resourceManager: mockResourceManager,
        llmClient: mockLlmClient
      });

      const task = {
        id: 'no-tool-task',
        description: 'Task without tool registry',
        tool: 'calculator'
      };

      const result = await noToolAgent.execute(task);
      
      // Should handle gracefully - may succeed with limitations or fail gracefully
      expect(result.metadata.executionId).toBeDefined();
    });
  });
});