/**
 * Test suite for ExecutionStrategyResolver
 * Tests strategy registration, selection, priority handling, and error cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionStrategyResolver } from '../../../../src/core/strategies/ExecutionStrategyResolver.js';
import { AtomicExecutionStrategy } from '../../../../src/core/strategies/AtomicExecutionStrategy.js';
import { ParallelExecutionStrategy } from '../../../../src/core/strategies/ParallelExecutionStrategy.js';
import { SequentialExecutionStrategy } from '../../../../src/core/strategies/SequentialExecutionStrategy.js';
import { RecursiveExecutionStrategy } from '../../../../src/core/strategies/RecursiveExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('ExecutionStrategyResolver', () => {
  let resolver;
  let context;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      testMode: true,  // Enable test mode for unit tests
      toolRegistry: { getTool: jest.fn() },
      llmClient: { complete: jest.fn() },
      progressStream: { createTaskEmitter: jest.fn(() => ({ custom: jest.fn() })) },
      executionLog: { append: jest.fn() }
    };

    resolver = new ExecutionStrategyResolver(mockDependencies);
    
    context = new ExecutionContext(null, {
      taskId: 'test-task',
      sessionId: 'test-session',
      maxDepth: 3,
      depth: 0
    });
  });

  describe('Initialization', () => {
    it('should initialize with default strategies', () => {
      const strategies = resolver.getAllStrategies();
      const strategyNames = resolver.getStrategyNames();
      
      expect(strategies).toHaveLength(4);
      expect(strategyNames).toContain('AtomicExecutionStrategy');
      expect(strategyNames).toContain('ParallelExecutionStrategy');
      expect(strategyNames).toContain('SequentialExecutionStrategy');
      expect(strategyNames).toContain('RecursiveExecutionStrategy');
    });

    it('should order strategies by priority', () => {
      const strategyNames = resolver.getStrategyNames();
      
      // RecursiveExecutionStrategy should be first (highest priority)
      expect(strategyNames[0]).toBe('RecursiveExecutionStrategy');
      // AtomicExecutionStrategy should be last (lowest priority)
      expect(strategyNames[strategyNames.length - 1]).toBe('AtomicExecutionStrategy');
    });

    it('should initialize with provided dependencies', () => {
      const customDeps = { customTool: { test: true } };
      const customResolver = new ExecutionStrategyResolver(customDeps);
      
      expect(customResolver.dependencies).toEqual(customDeps);
    });
  });

  describe('Strategy Registration', () => {
    // Create a mock strategy class for testing
    class MockStrategy {
      constructor(dependencies) {
        this.dependencies = dependencies;
      }
      
      canHandle(task, context) {
        return task.type === 'mock';
      }
      
      async execute(task, context) {
        return { success: true, result: 'mock result' };
      }
    }

    it('should register new strategies', () => {
      resolver.registerStrategy(MockStrategy, 15);
      
      expect(resolver.hasStrategy('MockStrategy')).toBe(true);
      expect(resolver.getStrategy('MockStrategy')).toBeInstanceOf(MockStrategy);
    });

    it('should maintain priority order when registering new strategies', () => {
      resolver.registerStrategy(MockStrategy, 15); // Higher than all defaults
      
      const strategyNames = resolver.getStrategyNames();
      expect(strategyNames[0]).toBe('MockStrategy');
    });

    it('should prevent duplicate strategy registration', () => {
      resolver.registerStrategy(MockStrategy, 10);
      
      expect(() => {
        resolver.registerStrategy(MockStrategy, 5);
      }).toThrow('Strategy MockStrategy is already registered');
    });

    it('should unregister strategies', () => {
      resolver.registerStrategy(MockStrategy, 10);
      expect(resolver.hasStrategy('MockStrategy')).toBe(true);
      
      resolver.unregisterStrategy('MockStrategy');
      expect(resolver.hasStrategy('MockStrategy')).toBe(false);
    });

    it('should throw error when unregistering non-existent strategy', () => {
      expect(() => {
        resolver.unregisterStrategy('NonExistentStrategy');
      }).toThrow('Strategy NonExistentStrategy is not registered');
    });

    it('should validate strategy interface', () => {
      class InvalidStrategy {} // Missing required methods
      
      expect(() => {
        resolver.registerStrategy(InvalidStrategy, 5);
      }).toThrow('Strategy InvalidStrategy must implement canHandle method');
    });
  });

  describe('Strategy Selection', () => {
    it('should select appropriate strategy for atomic tasks', async () => {
      const atomicTask = {
        id: 'atomic-task',
        tool: 'calculator',
        params: { expression: '2+2' }
      };
      
      const strategy = await resolver.selectStrategy(atomicTask, context);
      expect(strategy).toBeInstanceOf(AtomicExecutionStrategy);
    });

    it('should select recursive strategy for complex tasks', async () => {
      const recursiveTask = {
        id: 'recursive-task',
        recursive: true,
        description: 'Complex task requiring decomposition'
      };
      
      const strategy = await resolver.selectStrategy(recursiveTask, context);
      expect(strategy).toBeInstanceOf(RecursiveExecutionStrategy);
    });

    it('should select parallel strategy for parallel tasks', async () => {
      const parallelTask = {
        id: 'parallel-task',
        parallel: true,
        subtasks: [
          { id: 'sub1', tool: 'tool1' },
          { id: 'sub2', tool: 'tool2' }
        ]
      };
      
      const strategy = await resolver.selectStrategy(parallelTask, context);
      expect(strategy).toBeInstanceOf(ParallelExecutionStrategy);
    });

    it('should select sequential strategy for sequential tasks', async () => {
      const sequentialTask = {
        id: 'sequential-task',
        sequential: true,
        steps: [
          { id: 'step1', tool: 'tool1' },
          { id: 'step2', tool: 'tool2' }
        ]
      };
      
      const strategy = await resolver.selectStrategy(sequentialTask, context);
      expect(strategy).toBeInstanceOf(SequentialExecutionStrategy);
    });

    it('should fallback to atomic strategy when no strategy matches', async () => {
      const unknownTask = {
        id: 'unknown-task',
        unknownProperty: 'some value'
      };
      
      const strategy = await resolver.selectStrategy(unknownTask, context);
      expect(strategy).toBeInstanceOf(AtomicExecutionStrategy);
    });

    it('should require task parameter', async () => {
      await expect(resolver.selectStrategy(null, context)).rejects.toThrow('Task is required for strategy selection');
    });

    it('should require context parameter', async () => {
      const task = { id: 'test', tool: 'test-tool' };
      
      await expect(resolver.selectStrategy(task, null)).rejects.toThrow('ExecutionContext is required for strategy selection');
    });

    it('should handle strategy evaluation errors gracefully', async () => {
      // Create a strategy that throws during canHandle
      class ErrorStrategy {
        canHandle(task, context) {
          throw new Error('Strategy evaluation error');
        }
        
        async execute(task, context) {
          return { success: true };
        }
      }
      
      resolver.registerStrategy(ErrorStrategy, 20); // Highest priority
      
      const task = { id: 'test', tool: 'test-tool' };
      const strategy = await resolver.selectStrategy(task, context);
      
      // Should fallback to atomic strategy
      expect(strategy).toBeInstanceOf(AtomicExecutionStrategy);
    });
  });

  describe('Strategy Evaluation', () => {
    it('should evaluate all strategies for a task', () => {
      const task = {
        id: 'test-task',
        recursive: true,
        description: 'Test task'
      };
      
      const evaluations = resolver.evaluateStrategies(task, context);
      
      expect(evaluations).toHaveLength(4);
      expect(evaluations.every(e => e.hasOwnProperty('strategyName'))).toBe(true);
      expect(evaluations.every(e => e.hasOwnProperty('canHandle'))).toBe(true);
      expect(evaluations.every(e => e.hasOwnProperty('priority'))).toBe(true);
      expect(evaluations.every(e => e.hasOwnProperty('reason'))).toBe(true);
    });

    it('should identify which strategies can handle a task', () => {
      const recursiveTask = {
        id: 'recursive-task',
        recursive: true,
        description: 'Complex task'
      };
      
      const evaluations = resolver.evaluateStrategies(recursiveTask, context);
      const recursiveEval = evaluations.find(e => e.strategyName === 'RecursiveExecutionStrategy');
      
      expect(recursiveEval.canHandle).toBe(true);
      expect(recursiveEval.reason).toBe('Can handle task');
    });

    it('should handle evaluation errors in strategy assessment', () => {
      class ErrorStrategy {
        canHandle(task, context) {
          throw new Error('Evaluation error');
        }
        
        async execute(task, context) {
          return { success: true };
        }
      }
      
      resolver.registerStrategy(ErrorStrategy, 15);
      
      const task = { id: 'test', tool: 'test-tool' };
      const evaluations = resolver.evaluateStrategies(task, context);
      
      const errorEval = evaluations.find(e => e.strategyName === 'ErrorStrategy');
      expect(errorEval.canHandle).toBe(false);
      expect(errorEval.reason).toContain('Evaluation error');
    });
  });

  describe('Statistics and Information', () => {
    it('should provide comprehensive statistics', () => {
      const stats = resolver.getStatistics();
      
      expect(stats).toHaveProperty('totalStrategies');
      expect(stats).toHaveProperty('strategies');
      expect(stats).toHaveProperty('dependenciesProvided');
      
      expect(stats.totalStrategies).toBe(4);
      expect(stats.strategies).toHaveLength(4);
      expect(Array.isArray(stats.dependenciesProvided)).toBe(true);
    });

    it('should sort strategies by priority in statistics', () => {
      const stats = resolver.getStatistics();
      
      // Should be sorted by priority (highest first)
      for (let i = 0; i < stats.strategies.length - 1; i++) {
        expect(stats.strategies[i].priority).toBeGreaterThanOrEqual(stats.strategies[i + 1].priority);
      }
    });

    it('should list all strategy names', () => {
      const names = resolver.getStrategyNames();
      
      expect(names).toContain('AtomicExecutionStrategy');
      expect(names).toContain('ParallelExecutionStrategy');
      expect(names).toContain('SequentialExecutionStrategy');
      expect(names).toContain('RecursiveExecutionStrategy');
    });

    it('should check strategy existence', () => {
      expect(resolver.hasStrategy('AtomicExecutionStrategy')).toBe(true);
      expect(resolver.hasStrategy('NonExistentStrategy')).toBe(false);
    });

    it('should retrieve specific strategies', () => {
      const atomicStrategy = resolver.getStrategy('AtomicExecutionStrategy');
      expect(atomicStrategy).toBeInstanceOf(AtomicExecutionStrategy);
      
      const nonExistent = resolver.getStrategy('NonExistentStrategy');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Dependency Management', () => {
    it('should update dependencies for all strategies', () => {
      const newDependencies = { newTool: { test: true } };
      
      resolver.updateDependencies(newDependencies);
      
      expect(resolver.dependencies).toMatchObject(newDependencies);
      expect(resolver.dependencies).toMatchObject(mockDependencies);
    });

    it('should maintain existing dependencies when updating', () => {
      const originalDeps = resolver.dependencies;
      const additionalDeps = { additionalTool: { test: true } };
      
      resolver.updateDependencies(additionalDeps);
      
      expect(resolver.dependencies).toMatchObject(originalDeps);
      expect(resolver.dependencies).toMatchObject(additionalDeps);
    });
  });

  describe('Lifecycle Management', () => {
    it('should clear all strategies', () => {
      expect(resolver.getAllStrategies()).toHaveLength(4);
      
      resolver.clear();
      
      expect(resolver.getAllStrategies()).toHaveLength(0);
      expect(resolver.getStatistics().totalStrategies).toBe(0);
    });

    it('should initialize all strategies that support initialization', async () => {
      // Mock strategy with initialize method
      class InitializableStrategy {
        constructor() {
          this.initialized = false;
        }
        
        async initialize() {
          this.initialized = true;
        }
        
        canHandle() { return false; }
        async execute() { return { success: true }; }
      }
      
      resolver.registerStrategy(InitializableStrategy, 5);
      
      await resolver.initializeAllStrategies();
      
      const strategy = resolver.getStrategy('InitializableStrategy');
      expect(strategy.initialized).toBe(true);
    });

    it('should handle strategies without initialize method', async () => {
      // Default strategies don't have initialize method
      await expect(resolver.initializeAllStrategies()).resolves.not.toThrow();
    });
  });

  describe('Cloning', () => {
    it('should clone resolver with same configuration', () => {
      const cloned = resolver.clone();
      
      expect(cloned).toBeInstanceOf(ExecutionStrategyResolver);
      expect(cloned.getStrategyNames()).toEqual(resolver.getStrategyNames());
      expect(cloned.dependencies).toEqual(resolver.dependencies);
    });

    it('should clone with override dependencies', () => {
      const overrides = { newDep: 'test' };
      const cloned = resolver.clone(overrides);
      
      expect(cloned.dependencies).toMatchObject(overrides);
      expect(cloned.dependencies).toMatchObject(mockDependencies);
    });

    it('should skip default strategies when requested', () => {
      const cloned = resolver.clone({ skipDefaults: true });
      
      expect(cloned.getAllStrategies()).toHaveLength(0);
    });

    // Add a custom strategy first
    class CustomStrategy {
      canHandle() { return false; }
      async execute() { return { success: true }; }
    }

    it('should copy custom strategies when cloning', () => {
      resolver.registerStrategy(CustomStrategy, 12);
      
      const cloned = resolver.clone();
      
      expect(cloned.hasStrategy('CustomStrategy')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no strategies can handle task and no fallback', async () => {
      resolver.clear(); // Remove all strategies
      
      const task = { id: 'test', unknownType: true };

      await expect(resolver.selectStrategy(task, context)).rejects.toThrow('No suitable execution strategy found for task');
    });

    it('should validate strategy interface during registration', () => {
      class InvalidStrategy {
        // Missing canHandle method
        async execute() { return { success: true }; }
      }
      
      expect(() => {
        resolver.registerStrategy(InvalidStrategy, 5);
      }).toThrow('Strategy InvalidStrategy must implement canHandle method');
    });

    it('should validate strategy has proper name', () => {
      const anonymousFunction = function() {};
      Object.defineProperty(anonymousFunction, 'name', { value: '' });
      
      expect(() => {
        resolver.registerStrategy(anonymousFunction, 5);
      }).toThrow('Strategy must have a proper constructor name');
    });
  });
});
