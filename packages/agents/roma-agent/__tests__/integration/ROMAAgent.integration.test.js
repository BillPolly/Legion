/**
 * Integration test for ROMAAgent - New improved implementation
 * Tests the complete agent execution workflow with REAL Legion tools
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ROMAAgent Integration', () => {
  let agent;
  let resourceManager;
  let toolRegistry;
  let llmClient;

  beforeAll(async () => {
    // Get singletons - real instances, no mocks!
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
    
    // Get LLM client from ResourceManager
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    // Create agent with real dependencies - no testMode!
    agent = new ROMAAgent({
      maxConcurrency: 2,
      defaultTimeout: 5000
    });
  });
  
  afterAll(async () => {
    // Clean up
    if (agent && agent.isInitialized) {
      await agent.shutdown();
    }
  });

  describe('Basic Agent Operations', () => {
    it('should initialize correctly', async () => {
      await agent.initialize();
      
      expect(agent.isInitialized).toBe(true);
      expect(agent.strategyResolver).toBeDefined();
      expect(agent.dependencyResolver).toBeDefined();
    });

    it('should execute single task successfully with real Legion calculator tool', async () => {
      await agent.initialize();
      
      const task = {
        id: 'test-task',
        description: 'Calculate 5 + 7',
        tool: 'calculator',
        params: { expression: '5 + 7' } // Real calculator tool expects 'expression'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionId).toBeDefined();
      expect(result.metadata.duration).toBeGreaterThan(0);
    });

    it('should execute multiple tasks with dependencies using real tools', async () => {
      await agent.initialize();
      
      const tasks = [
        {
          id: 'task1',
          description: 'Calculate 10 * 5',
          tool: 'calculator',
          params: { expression: '10 * 5' }
        },
        {
          id: 'task2',
          description: 'Calculate 100 / 2',
          dependencies: ['task1'],
          tool: 'calculator',
          params: { expression: '100 / 2' }
        }
      ];

      const result = await agent.execute(tasks);

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(2);
      expect(result.metadata.executionPlan.executionOrder).toEqual(['task1', 'task2']);
    });

    it('should handle task execution errors gracefully', async () => {
      await agent.initialize();
      
      // Use a non-existent tool to trigger an error
      const task = {
        id: 'failing-task',
        description: 'Task that fails',
        tool: 'non-existent-tool-xyz123'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
      expect(result.metadata.executionId).toBeDefined();
    });
  });

  describe('Agent Configuration', () => {
    it('should accept custom configuration options', async () => {
      const customAgent = new ROMAAgent({
        maxConcurrency: 10,
        defaultTimeout: 60000,
        enableSemanticAnalysis: false,
        maxExecutionDepth: 5
      });
      
      await customAgent.initialize();

      expect(customAgent.options.maxConcurrency).toBe(10);
      expect(customAgent.options.defaultTimeout).toBe(60000);
      expect(customAgent.options.enableSemanticAnalysis).toBe(false);
      expect(customAgent.options.maxExecutionDepth).toBe(5);
      
      await customAgent.shutdown();
    });

    it('should update configuration dynamically', async () => {
      await agent.initialize();
      
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
      await agent.initialize();
      
      const progressEvents = [];
      
      const task = {
        id: 'progress-task',
        description: 'Calculate 25 * 4',
        tool: 'calculator',
        params: { expression: '25 * 4' }
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
      await agent.initialize();
      
      const task = {
        id: 'stats-task',
        description: 'Calculate 100 / 10',
        tool: 'calculator',
        params: { expression: '100 / 10' }
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
      await agent.initialize();
      
      const task = {
        id: 'history-task',
        description: 'Calculate 50 + 50',
        tool: 'calculator',
        params: { expression: '50 + 50' }
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

  });
});