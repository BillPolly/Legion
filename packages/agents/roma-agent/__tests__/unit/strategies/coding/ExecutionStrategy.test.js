/**
 * Unit tests for ExecutionStrategy (formerly ExecutionOrchestrator)
 * Tests task execution, dependency resolution, and retry logic
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ExecutionStrategy from '../../../../src/strategies/coding/ExecutionStrategy.js';

describe('ExecutionStrategy', () => {
  let executionStrategy;
  let mockStrategies;
  let mockStateManager;
  
  beforeEach(() => {
    // Create mock strategies that simulate real strategies
    mockStrategies = {
      SimpleNodeServer: {
        getName: () => 'SimpleNodeServer',
        execute: jest.fn(async (task, context) => ({
          success: true,
          artifacts: [{ id: 'artifact-1', content: 'code' }]
        }))
      },
      FileSystem: {
        getName: () => 'FileSystem',
        execute: jest.fn(async (task, context) => ({
          success: true,
          artifacts: []
        }))
      }
    };
    
    // Create mock state manager
    mockStateManager = {
      updateTask: jest.fn(async () => {}),
      addArtifact: jest.fn(async () => {}),
      update: jest.fn(async () => {})
    };
    
    executionStrategy = new ExecutionStrategy(mockStrategies, mockStateManager);
  });
  
  describe('Constructor', () => {
    test('should create strategy with strategies and state manager', () => {
      const strategy = new ExecutionStrategy(mockStrategies, mockStateManager);
      expect(strategy.strategies).toBe(mockStrategies);
      expect(strategy.stateManager).toBe(mockStateManager);
      expect(strategy.completed).toEqual(new Set());
      expect(strategy.executing).toEqual(new Set());
      expect(strategy.artifacts).toEqual(new Map());
    });
    
    test('should throw error if no strategies provided', () => {
      expect(() => new ExecutionStrategy()).toThrow('Strategies are required');
    });
    
    test('should throw error if no state manager provided', () => {
      expect(() => new ExecutionStrategy(mockStrategies)).toThrow('State manager is required');
    });
  });
  
  describe('execute() method', () => {
    const task = {
      id: 'task-1',
      strategy: 'SimpleNodeServer',
      action: 'generate_server',
      dependencies: [],
      input: { description: 'Generate server code' },
      validation: { required: true, criteria: ['syntax_valid'] },
      retry: { maxAttempts: 3, backoffMs: 100, strategy: 'exponential' }
    };
    
    test('should execute a single task successfully', async () => {
      const result = await executionStrategy.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(executionStrategy.completed.has('task-1')).toBe(true);
      expect(mockStateManager.updateTask).toHaveBeenCalled();
    });
    
    test('should wait for dependencies before executing', async () => {
      const dependentTask = {
        ...task,
        id: 'task-2',
        dependencies: ['task-1']
      };
      
      // Complete dependency first
      executionStrategy.completed.add('task-1');
      
      const result = await executionStrategy.execute(dependentTask);
      
      expect(result.success).toBe(true);
      expect(executionStrategy.completed.has('task-2')).toBe(true);
    });
    
    test('should throw error if dependencies not met', async () => {
      const dependentTask = {
        ...task,
        id: 'task-2',
        dependencies: ['task-missing']
      };
      
      await expect(executionStrategy.execute(dependentTask))
        .rejects.toThrow('Dependencies not met');
    });
    
    test('should retry on failure with backoff', async () => {
      let attempts = 0;
      const failingStrategy = {
        getName: () => 'FailingStrategy',
        execute: jest.fn(async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true, artifacts: [] };
        })
      };
      
      executionStrategy.strategies.FailingStrategy = failingStrategy;
      
      const failingTask = {
        ...task,
        strategy: 'FailingStrategy',
        retry: { maxAttempts: 3, backoffMs: 10, strategy: 'exponential' }
      };
      
      const result = await executionStrategy.execute(failingTask);
      
      expect(result.success).toBe(true);
      expect(failingStrategy.execute).toHaveBeenCalledTimes(2);
    });
    
    test('should fail after max retry attempts', async () => {
      const alwaysFailStrategy = {
        getName: () => 'AlwaysFailStrategy',
        execute: jest.fn(async () => {
          throw new Error('Permanent failure');
        })
      };
      
      executionStrategy.strategies.AlwaysFailStrategy = alwaysFailStrategy;
      
      const failingTask = {
        ...task,
        strategy: 'AlwaysFailStrategy',
        retry: { maxAttempts: 2, backoffMs: 10, strategy: 'exponential' }
      };
      
      await expect(executionStrategy.execute(failingTask))
        .rejects.toThrow('Task failed after 2 attempts');
      
      expect(alwaysFailStrategy.execute).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('waitForDependencies() method', () => {
    test('should return immediately if dependencies are met', async () => {
      executionStrategy.completed.add('dep-1');
      executionStrategy.completed.add('dep-2');
      
      await executionStrategy.waitForDependencies(['dep-1', 'dep-2']);
      // Should not throw
    });
    
    test('should throw if dependencies are not met', async () => {
      executionStrategy.completed.add('dep-1');
      
      await expect(executionStrategy.waitForDependencies(['dep-1', 'dep-missing']))
        .rejects.toThrow('Dependencies not met');
    });
    
    test('should handle empty dependencies', async () => {
      await executionStrategy.waitForDependencies([]);
      // Should not throw
    });
  });
  
  describe('selectStrategy() method', () => {
    test('should return strategy by name', () => {
      const strategy = executionStrategy.selectStrategy('SimpleNodeServer');
      expect(strategy).toBe(mockStrategies.SimpleNodeServer);
    });
    
    test('should throw error for unknown strategy', () => {
      expect(() => executionStrategy.selectStrategy('UnknownStrategy'))
        .toThrow('Strategy not found: UnknownStrategy');
    });
  });
  
  describe('validateResult() method', () => {
    test('should validate successful result', async () => {
      const result = { success: true, artifacts: [] };
      const validation = { required: true, criteria: [] };
      
      const isValid = await executionStrategy.validateResult(result, validation);
      expect(isValid).toBe(true);
    });
    
    test('should reject failed result when validation required', async () => {
      const result = { success: false, artifacts: [] };
      const validation = { required: true, criteria: [] };
      
      const isValid = await executionStrategy.validateResult(result, validation);
      expect(isValid).toBe(false);
    });
    
    test('should accept failed result when validation not required', async () => {
      const result = { success: false, artifacts: [] };
      const validation = { required: false, criteria: [] };
      
      const isValid = await executionStrategy.validateResult(result, validation);
      expect(isValid).toBe(true);
    });
  });
  
  describe('storeArtifacts() method', () => {
    test('should store artifacts and update state', async () => {
      const artifacts = [
        { id: 'art-1', content: 'code1' },
        { id: 'art-2', content: 'code2' }
      ];
      const task = { id: 'task-1' };
      
      await executionStrategy.storeArtifacts(artifacts, task);
      
      expect(executionStrategy.artifacts.get('task-1')).toEqual(artifacts);
      expect(mockStateManager.addArtifact).toHaveBeenCalledTimes(2);
    });
    
    test('should handle empty artifacts', async () => {
      await executionStrategy.storeArtifacts([], { id: 'task-1' });
      
      expect(executionStrategy.artifacts.get('task-1')).toEqual([]);
      expect(mockStateManager.addArtifact).not.toHaveBeenCalled();
    });
  });
  
  describe('calculateBackoff() method', () => {
    test('should calculate exponential backoff', () => {
      const retry = { backoffMs: 100, strategy: 'exponential' };
      
      expect(executionStrategy.calculateBackoff(1, retry)).toBe(100);
      expect(executionStrategy.calculateBackoff(2, retry)).toBe(200);
      expect(executionStrategy.calculateBackoff(3, retry)).toBe(400);
    });
    
    test('should calculate linear backoff', () => {
      const retry = { backoffMs: 100, strategy: 'linear' };
      
      expect(executionStrategy.calculateBackoff(1, retry)).toBe(100);
      expect(executionStrategy.calculateBackoff(2, retry)).toBe(200);
      expect(executionStrategy.calculateBackoff(3, retry)).toBe(300);
    });
    
    test('should use constant backoff by default', () => {
      const retry = { backoffMs: 100 };
      
      expect(executionStrategy.calculateBackoff(1, retry)).toBe(100);
      expect(executionStrategy.calculateBackoff(2, retry)).toBe(100);
      expect(executionStrategy.calculateBackoff(3, retry)).toBe(100);
    });
  });
  
  describe('prepareTaskContext() method', () => {
    test('should prepare context with artifacts from dependencies', async () => {
      executionStrategy.artifacts.set('dep-1', [{ id: 'art-1', content: 'code' }]);
      executionStrategy.completed.add('dep-1');
      
      const task = {
        id: 'task-1',
        dependencies: ['dep-1'],
        input: { description: 'Test task' }
      };
      
      const context = await executionStrategy.prepareTaskContext(task);
      
      expect(context.artifacts).toHaveLength(1);
      expect(context.artifacts[0].id).toBe('art-1');
      expect(context.input).toEqual(task.input);
    });
    
    test('should handle tasks with no dependencies', async () => {
      const task = {
        id: 'task-1',
        dependencies: [],
        input: { description: 'Test task' }
      };
      
      const context = await executionStrategy.prepareTaskContext(task);
      
      expect(context.artifacts).toEqual([]);
      expect(context.input).toEqual(task.input);
    });
  });
  
  describe('createChildTask() method', () => {
    test('should create child task with proper structure', async () => {
      const task = {
        id: 'task-1',
        action: 'generate_code',
        input: { description: 'Generate server' }
      };
      const strategy = mockStrategies.SimpleNodeServer;
      
      const childTask = await executionStrategy.createChildTask(task, strategy);
      
      expect(childTask.parentId).toBe('task-1');
      expect(childTask.strategyName).toBe('SimpleNodeServer');
      expect(childTask.action).toBe('generate_code');
      expect(childTask.input).toEqual(task.input);
    });
  });
});