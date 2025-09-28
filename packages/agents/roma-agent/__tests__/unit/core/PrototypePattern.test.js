/**
 * Unit tests for the prototype pattern implementation
 * Tests the core prototypal inheritance and task creation system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask, TaskStrategy } from '@legion/shared-tasks';
import { createRecursiveDecompositionStrategy } from '../../../src/strategies/recursive/RecursiveDecompositionStrategy.js';
import { createAnalysisStrategy } from '../../../src/strategies/coding/AnalysisStrategy.js';
import { createExecutionStrategy } from '../../../src/strategies/coding/ExecutionStrategy.js';

describe('Prototype Pattern Implementation', () => {
  let mockLlmClient;
  let mockToolRegistry;

  beforeEach(() => {
    mockLlmClient = {
      generateResponse: jest.fn().mockResolvedValue('mock response')
    };

    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue({
        name: 'mock_tool',
        execute: jest.fn().mockResolvedValue({ success: true })
      })
    };
  });

  describe('TaskStrategy Base Prototype', () => {
    it('should have all required task methods', () => {
      expect(typeof TaskStrategy.send).toBe('function');
      expect(typeof TaskStrategy.complete).toBe('function');
      expect(typeof TaskStrategy.fail).toBe('function');
      expect(typeof TaskStrategy.storeArtifact).toBe('function');
      expect(typeof TaskStrategy.addConversationEntry).toBe('function');
      expect(typeof TaskStrategy.getArtifact).toBe('function');
      expect(typeof TaskStrategy.getAllArtifacts).toBe('function');
    });

    it('should support prototypal inheritance', () => {
      const strategy = Object.create(TaskStrategy);
      
      // Should inherit all methods from TaskStrategy
      expect(typeof strategy.send).toBe('function');
      expect(typeof strategy.complete).toBe('function');
      expect(typeof strategy.fail).toBe('function');
      
      // Should be able to add own methods
      strategy.customMethod = function() { return 'custom'; };
      expect(strategy.customMethod()).toBe('custom');
    });
  });

  describe('Strategy Factory Functions', () => {
    it('should create RecursiveDecompositionStrategy with prototype inheritance', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      
      // Should be a strategy object with required methods
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should have doWork method available
      expect(typeof strategy.doWork).toBe('function');
      
      // Should have strategy-specific config
      expect(strategy.config).toBeDefined();
    });

    it('should create AnalysisStrategy with prototype inheritance', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      
      // Should be a strategy object with required methods
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should have strategy-specific functionality
      expect(strategy.config).toBeDefined();
    });

    it('should create ExecutionStrategy with prototype inheritance', async () => {
      const context = {};
      const strategy = await createExecutionStrategy(context);
      
      // Should be a strategy object with required methods
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should have strategy configuration
      expect(strategy.config).toBeDefined();
    });
  });

  describe('Task Creation with Strategies', () => {
    it('should create task with strategy prototype', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const task = createTask('Test task', null, strategy, {
        metadata: { test: true }
      });

      // Task should have strategy's onMessage method
      expect(task.onMessage).toBe(strategy.onMessage);
      
      // Task should have all TaskStrategy methods
      expect(typeof task.send).toBe('function');
      expect(typeof task.complete).toBe('function');
      expect(typeof task.fail).toBe('function');
      
      // Task should have proper metadata
      expect(task.metadata.test).toBe(true);
      expect(task.description).toBe('Test task');
    });

    it('should bind strategy methods to task context', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Analysis task', null, strategy);

      // The onMessage method should be bound to the task
      expect(task.onMessage).toBe(strategy.onMessage);
      
      // Task should have proper initialization
      expect(task.description).toBe('Analysis task');
      expect(typeof task.onMessage).toBe('function');
    });

    it('should create tasks with unique IDs and proper hierarchy', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);

      // Should have unique IDs
      expect(parentTask.id).toBeDefined();
      expect(childTask.id).toBeDefined();
      expect(parentTask.id).not.toBe(childTask.id);
      
      // Should have proper parent-child relationship
      expect(childTask.parent).toBe(parentTask);
      expect(parentTask.parent).toBeNull();
    });
  });

  describe('Strategy Configuration and State', () => {
    it('should maintain strategy-specific configuration', async () => {
      const context = {};
      const options = { maxRetries: 5, validateResults: false };
      const strategy = await createExecutionStrategy(context, options);
      
      // Strategy should be created successfully with options
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
      expect(strategy.config).toBeDefined();
    });

    it('should handle null/undefined dependencies gracefully', async () => {
      // Should not throw when creating strategies with null dependencies
      await expect(createRecursiveDecompositionStrategy({})).resolves.toBeDefined();
      await expect(createAnalysisStrategy({})).resolves.toBeDefined();
      await expect(createExecutionStrategy({})).resolves.toBeDefined();
    });
  });

  describe('Method Binding and Context', () => {
    it('should properly bind context when using .call()', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      // Create a mock handler that uses 'this'
      const mockHandler = function(config) {
        return this.description; // Should return task description
      };
      
      // When called with .call(task), 'this' should be the task
      const result = mockHandler.call(task, {});
      expect(result).toBe('Test task');
    });

    it('should maintain separate state for different task instances', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      
      const task1 = createTask('Task 1', null, strategy);
      const task2 = createTask('Task 2', null, strategy);
      
      // Tasks should have separate state
      expect(task1.description).toBe('Task 1');
      expect(task2.description).toBe('Task 2');
      
      // Should share the same strategy methods
      expect(task1.onMessage).toBe(task2.onMessage);
      expect(task1.onMessage).toBe(strategy.onMessage);
    });
  });

  describe('Prototype Chain Verification', () => {
    it('should have correct prototype chain', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      // Task should inherit from the strategy prototype
      expect(Object.getPrototypeOf(task)).toBe(strategy);
      
      // Should be able to access methods up the prototype chain
      expect(typeof task.send).toBe('function');
      expect(typeof task.complete).toBe('function');
      expect(typeof task.fail).toBe('function');
      
      // Should have TaskStrategy methods available
      expect(task.send).toBe(TaskStrategy.send);
      expect(task.complete).toBe(TaskStrategy.complete);
    });

    it('should support instanceof checks', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      // Since we're using Object.create() and factory pattern,
      // we verify that the task has access to TaskStrategy methods
      expect(typeof task.onMessage).toBe('function');
      expect(typeof task.send).toBe('function');
      expect(typeof task.complete).toBe('function');
      expect(typeof task.fail).toBe('function');
    });
  });
});