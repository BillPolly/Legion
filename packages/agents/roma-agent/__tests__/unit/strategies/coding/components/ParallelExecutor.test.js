/**
 * Unit tests for ParallelExecutor
 * Tests concurrent execution, dependency scheduling, and queue management
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import ParallelExecutor from '../../../../../src/strategies/coding/components/ParallelExecutor.js';

describe('ParallelExecutor', () => {
  let executor;
  let executedTasks;
  let executionOrder;
  
  // Create a mock task executor that records execution
  const createTaskExecutor = (duration = 10) => {
    return async (task) => {
      executionOrder.push(task.id);
      executedTasks.add(task.id);
      
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, duration));
      
      return {
        success: true,
        taskId: task.id,
        artifacts: []
      };
    };
  };
  
  beforeEach(() => {
    executor = new ParallelExecutor();
    executedTasks = new Set();
    executionOrder = [];
  });
  
  describe('Constructor', () => {
    test('should create executor with default options', () => {
      const exec = new ParallelExecutor();
      expect(exec.maxConcurrent).toBe(3);
      expect(exec.executing).toEqual(new Set());
      expect(exec.completed).toEqual(new Map());
      expect(exec.failed).toEqual(new Map());
    });
    
    test('should accept custom options', () => {
      const exec = new ParallelExecutor({ 
        maxConcurrent: 5,
        taskTimeout: 5000 
      });
      expect(exec.maxConcurrent).toBe(5);
      expect(exec.taskTimeout).toBe(5000);
    });
  });
  
  describe('executeTasks() method', () => {
    test('should execute single task', async () => {
      const tasks = [{
        id: 'task-1',
        dependencies: [],
        execute: createTaskExecutor()
      }];
      
      const results = await executor.executeTasks(tasks);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(executedTasks.has('task-1')).toBe(true);
    });
    
    test('should execute independent tasks concurrently', async () => {
      const startTime = Date.now();
      const taskDuration = 50;
      
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor(taskDuration) },
        { id: 'task-2', dependencies: [], execute: createTaskExecutor(taskDuration) },
        { id: 'task-3', dependencies: [], execute: createTaskExecutor(taskDuration) }
      ];
      
      const results = await executor.executeTasks(tasks);
      const totalTime = Date.now() - startTime;
      
      // Should complete faster than sequential (3 * 50 = 150ms)
      expect(totalTime).toBeLessThan(taskDuration * 2);
      expect(results).toHaveLength(3);
      expect(executedTasks.size).toBe(3);
    });
    
    test('should respect maxConcurrent limit', async () => {
      executor.maxConcurrent = 2;
      
      let concurrentCount = 0;
      let maxConcurrentSeen = 0;
      
      const trackingExecutor = async (task) => {
        concurrentCount++;
        maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrentCount);
        executedTasks.add(task.id); // Add to executed tasks
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        concurrentCount--;
        return { success: true, taskId: task.id };
      };
      
      const tasks = [
        { id: 'task-1', dependencies: [], execute: trackingExecutor },
        { id: 'task-2', dependencies: [], execute: trackingExecutor },
        { id: 'task-3', dependencies: [], execute: trackingExecutor },
        { id: 'task-4', dependencies: [], execute: trackingExecutor }
      ];
      
      await executor.executeTasks(tasks);
      
      expect(maxConcurrentSeen).toBeLessThanOrEqual(2);
      expect(executedTasks.size).toBe(4);
    });
    
    test('should handle task dependencies correctly', async () => {
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor(10) },
        { id: 'task-2', dependencies: ['task-1'], execute: createTaskExecutor(10) },
        { id: 'task-3', dependencies: ['task-2'], execute: createTaskExecutor(10) },
        { id: 'task-4', dependencies: [], execute: createTaskExecutor(10) }
      ];
      
      await executor.executeTasks(tasks);
      
      // Check execution order
      const task1Index = executionOrder.indexOf('task-1');
      const task2Index = executionOrder.indexOf('task-2');
      const task3Index = executionOrder.indexOf('task-3');
      
      expect(task1Index).toBeLessThan(task2Index);
      expect(task2Index).toBeLessThan(task3Index);
      expect(executedTasks.size).toBe(4);
    });
    
    test('should handle complex dependency graph', async () => {
      const tasks = [
        { id: 'setup', dependencies: [], execute: createTaskExecutor() },
        { id: 'core-1', dependencies: ['setup'], execute: createTaskExecutor() },
        { id: 'core-2', dependencies: ['setup'], execute: createTaskExecutor() },
        { id: 'feature-1', dependencies: ['core-1'], execute: createTaskExecutor() },
        { id: 'feature-2', dependencies: ['core-2'], execute: createTaskExecutor() },
        { id: 'test', dependencies: ['feature-1', 'feature-2'], execute: createTaskExecutor() },
        { id: 'deploy', dependencies: ['test'], execute: createTaskExecutor() }
      ];
      
      await executor.executeTasks(tasks);
      
      // Verify all executed
      expect(executedTasks.size).toBe(7);
      
      // Verify dependency order
      const setupIndex = executionOrder.indexOf('setup');
      const testIndex = executionOrder.indexOf('test');
      const deployIndex = executionOrder.indexOf('deploy');
      
      expect(setupIndex).toBeLessThan(testIndex);
      expect(testIndex).toBeLessThan(deployIndex);
    });
  });
  
  describe('canExecute() method', () => {
    test('should return true for task with no dependencies', () => {
      const task = { id: 'task-1', dependencies: [] };
      expect(executor.canExecute(task)).toBe(true);
    });
    
    test('should return true when all dependencies are completed', () => {
      executor.completed.set('dep-1', { success: true });
      executor.completed.set('dep-2', { success: true });
      
      const task = { id: 'task-1', dependencies: ['dep-1', 'dep-2'] };
      expect(executor.canExecute(task)).toBe(true);
    });
    
    test('should return false when dependencies are not met', () => {
      executor.completed.set('dep-1', { success: true });
      
      const task = { id: 'task-1', dependencies: ['dep-1', 'dep-missing'] };
      expect(executor.canExecute(task)).toBe(false);
    });
  });
  
  describe('selectNextTask() method', () => {
    test('should select task with satisfied dependencies', () => {
      executor.completed.set('dep-1', { success: true });
      
      const queue = [
        { id: 'task-1', dependencies: ['dep-missing'] },
        { id: 'task-2', dependencies: ['dep-1'] },
        { id: 'task-3', dependencies: ['dep-missing'] }
      ];
      
      const selected = executor.selectNextTask(queue);
      expect(selected.id).toBe('task-2');
    });
    
    test('should return null when no tasks can execute', () => {
      const queue = [
        { id: 'task-1', dependencies: ['dep-missing'] },
        { id: 'task-2', dependencies: ['dep-missing'] }
      ];
      
      const selected = executor.selectNextTask(queue);
      expect(selected).toBeNull();
    });
    
    test('should prioritize tasks by priority field', () => {
      const queue = [
        { id: 'task-1', dependencies: [], priority: 1 },
        { id: 'task-2', dependencies: [], priority: 3 },
        { id: 'task-3', dependencies: [], priority: 2 }
      ];
      
      const selected = executor.selectNextTask(queue);
      expect(selected.id).toBe('task-2');
    });
  });
  
  describe('error handling', () => {
    test('should handle task failures', async () => {
      const failingTask = {
        id: 'failing-task',
        dependencies: [],
        execute: async () => {
          throw new Error('Task failed');
        }
      };
      
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor() },
        failingTask,
        { id: 'task-2', dependencies: [], execute: createTaskExecutor() }
      ];
      
      const results = await executor.executeTasks(tasks);
      
      // Other tasks should still complete
      expect(executedTasks.has('task-1')).toBe(true);
      expect(executedTasks.has('task-2')).toBe(true);
      
      // Failed task should be recorded
      expect(executor.failed.has('failing-task')).toBe(true);
      
      // Results should include failure
      const failedResult = results.find(r => r.taskId === 'failing-task');
      expect(failedResult.success).toBe(false);
    });
    
    test('should not execute tasks dependent on failed tasks', async () => {
      const tasks = [
        { 
          id: 'failing-task', 
          dependencies: [], 
          execute: async () => { throw new Error('Failed'); }
        },
        { 
          id: 'dependent-task', 
          dependencies: ['failing-task'], 
          execute: createTaskExecutor() 
        }
      ];
      
      await executor.executeTasks(tasks);
      
      expect(executor.failed.has('failing-task')).toBe(true);
      expect(executedTasks.has('dependent-task')).toBe(false);
      expect(executor.skipped.has('dependent-task')).toBe(true);
    });
    
    test('should handle task timeouts', async () => {
      executor.taskTimeout = 50;
      
      const slowTask = {
        id: 'slow-task',
        dependencies: [],
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true };
        }
      };
      
      const tasks = [slowTask];
      const results = await executor.executeTasks(tasks);
      
      const result = results[0];
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
  
  describe('progress tracking', () => {
    test('should track execution progress', async () => {
      const progressUpdates = [];
      
      executor.onProgress = (progress) => {
        progressUpdates.push(progress);
      };
      
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor() },
        { id: 'task-2', dependencies: [], execute: createTaskExecutor() },
        { id: 'task-3', dependencies: [], execute: createTaskExecutor() }
      ];
      
      await executor.executeTasks(tasks);
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.completed).toBe(3);
      expect(lastProgress.total).toBe(3);
      expect(lastProgress.percentage).toBe(100);
    });
  });
  
  describe('getExecutionStats() method', () => {
    test('should return execution statistics', async () => {
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor() },
        { 
          id: 'task-2', 
          dependencies: [], 
          execute: async () => { throw new Error('Failed'); }
        },
        { id: 'task-3', dependencies: ['task-1'], execute: createTaskExecutor() }
      ];
      
      await executor.executeTasks(tasks);
      
      const stats = executor.getExecutionStats();
      
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(0);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });
  
  describe('reset() method', () => {
    test('should reset executor state', async () => {
      const tasks = [
        { id: 'task-1', dependencies: [], execute: createTaskExecutor() }
      ];
      
      await executor.executeTasks(tasks);
      expect(executor.completed.size).toBe(1);
      
      executor.reset();
      
      expect(executor.completed.size).toBe(0);
      expect(executor.failed.size).toBe(0);
      expect(executor.executing.size).toBe(0);
      expect(executor.skipped.size).toBe(0);
    });
  });
});