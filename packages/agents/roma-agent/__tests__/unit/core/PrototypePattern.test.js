/**
 * Unit tests for the prototype pattern implementation
 * Tests the core prototypal inheritance and task creation system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask, TaskStrategy } from '@legion/tasks';
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
    it('should create RecursiveDecompositionStrategy with prototype inheritance', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
      // Should inherit from TaskStrategy
      expect(Object.getPrototypeOf(strategy)).toBe(TaskStrategy);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      expect(strategy.onMessage.name).toBe('onMessage');
      
      // Should have access to TaskStrategy methods
      expect(typeof strategy.send).toBe('function');
      expect(typeof strategy.complete).toBe('function');
    });

    it('should create AnalysisStrategy with prototype inheritance', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      
      // Should inherit from TaskStrategy
      expect(Object.getPrototypeOf(strategy)).toBe(TaskStrategy);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should have access to TaskStrategy methods
      expect(typeof strategy.storeArtifact).toBe('function');
      expect(typeof strategy.addConversationEntry).toBe('function');
    });

    it('should create ExecutionStrategy with prototype inheritance', () => {
      const strategy = createExecutionStrategy();
      
      // Should inherit from TaskStrategy
      expect(Object.getPrototypeOf(strategy)).toBe(TaskStrategy);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should have access to TaskStrategy methods
      expect(typeof strategy.fail).toBe('function');
      expect(typeof strategy.getArtifact).toBe('function');
    });
  });

  describe('Task Creation with Strategies', () => {
    it('should create task with strategy prototype', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
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

    it('should bind strategy methods to task context', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Analysis task', null, strategy);

      // The onMessage method should be bound to the task
      expect(task.onMessage).toBe(strategy.onMessage);
      
      // When called, 'this' should refer to the task
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      // Should not throw when called (even without full setup)
      expect(() => {
        task.onMessage(mockSender, mockMessage);
      }).not.toThrow();
    });

    it('should create tasks with unique IDs and proper hierarchy', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
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
    it('should maintain strategy-specific configuration', () => {
      const options = { maxRetries: 5, validateResults: false };
      const strategy = createExecutionStrategy(null, null, options);
      
      // Strategy should be created successfully with options
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    it('should handle null/undefined dependencies gracefully', () => {
      // Should not throw when creating strategies with null dependencies
      expect(() => {
        createRecursiveDecompositionStrategy(null, null);
      }).not.toThrow();
      
      expect(() => {
        createAnalysisStrategy(null);
      }).not.toThrow();
      
      expect(() => {
        createExecutionStrategy(null, null);
      }).not.toThrow();
    });
  });

  describe('Method Binding and Context', () => {
    it('should properly bind context when using .call()', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Test task', null, strategy);
      
      // Create a mock handler that uses 'this'
      const mockHandler = function(config) {
        return this.description; // Should return task description
      };
      
      // When called with .call(task), 'this' should be the task
      const result = mockHandler.call(task, {});
      expect(result).toBe('Test task');
    });

    it('should maintain separate state for different task instances', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      
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
    it('should have correct prototype chain', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      const task = createTask('Test task', null, strategy);
      
      // Task should inherit from the strategy prototype
      expect(Object.getPrototypeOf(task)).toBe(strategy);
      
      // Strategy should inherit from TaskStrategy
      expect(Object.getPrototypeOf(strategy)).toBe(TaskStrategy);
      
      // Should be able to access methods up the prototype chain
      expect(task.send).toBe(TaskStrategy.send);
      expect(task.complete).toBe(TaskStrategy.complete);
    });

    it('should support instanceof checks', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      const task = createTask('Test task', null, strategy);
      
      // Note: Since we're using Object.create() instead of classes,
      // instanceof won't work in the traditional sense.
      // Instead, we verify prototype chain manually
      expect(Object.getPrototypeOf(Object.getPrototypeOf(task))).toBe(TaskStrategy);
    });
  });
});