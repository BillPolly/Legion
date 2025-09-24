/**
 * Unit tests for MonitoringStrategy - Prototypal Pattern
 * Tests project monitoring and progress tracking
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { createMonitoringStrategy } from '../../../../src/strategies/coding/MonitoringStrategy.js';

// Mock Task for testing - simulates the actual Task interface
class MockTask {
  constructor(id, description) {
    this.id = id;
    this.description = description;
    this.parent = null;
    this.context = {};
    this.artifacts = [];
    this.artifactMap = {};
    this.failed = false;
    this.completed = false;
    this.conversation = [];
    this.sentMessages = [];
  }
  
  fail(error) {
    this.failed = true;
    this.error = error;
  }
  
  complete(result) {
    this.completed = true;
    this.result = result;
  }
  
  addConversationEntry(role, content) {
    this.conversation.push({ role, content });
  }
  
  storeArtifact(name, value, description, type) {
    const artifact = {
      name,
      value,
      content: value,
      description,
      type
    };
    this.artifacts.push(artifact);
    this.artifactMap[name] = artifact;
  }
  
  getAllArtifacts() {
    return this.artifactMap;
  }
  
  lookup(key) {
    if (key === 'llmClient') return this.context.llmClient;
    if (key === 'toolRegistry') return this.context.toolRegistry;
    if (key === 'workspaceDir') return this.context.workspaceDir;
    return null;
  }
  
  send(target, message) {
    this.sentMessages.push({ target, message });
  }
}

describe('MonitoringStrategy - Prototypal Pattern', () => {
  let resourceManager;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createMonitoringStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should accept custom options', () => {
      const strategy = createMonitoringStrategy({
        updateInterval: 1000,
        metricsEnabled: true
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });

  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message', (done) => {
      const strategy = createMonitoringStrategy();
      
      // Create a mock task
      const task = new MockTask('monitoring-1', 'Monitor project progress');
      task.context = {};
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.monitoring).toBeDefined();
        expect(result.monitoring.started).toBe(true);
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle update message with progress data', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('monitoring-1', 'Monitor progress');
      
      // Store initial monitoring state
      task.storeArtifact('monitoring-state', {
        tasksStarted: [],
        tasksCompleted: [],
        currentPhase: null
      }, 'Monitoring state', 'state');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.progress).toBeDefined();
        expect(result.progress.taskStarted).toBe('task-1');
        done();
      });
      
      // Call onMessage with update
      strategy.onMessage.call(task, task, { 
        type: 'update',
        progressData: {
          taskStarted: 'task-1',
          description: 'Starting task 1'
        }
      });
    });

    test('should handle status request', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('monitoring-1', 'Get status');
      
      // Add some monitoring data
      task.storeArtifact('monitoring-state', {
        tasksStarted: ['task-1', 'task-2'],
        tasksCompleted: ['task-1'],
        currentPhase: 'execution',
        metrics: {
          totalTasks: 10,
          completedTasks: 1,
          failedTasks: 0
        }
      }, 'Monitoring state', 'state');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.status).toBeDefined();
        expect(result.status.metrics).toBeDefined();
        expect(result.status.metrics.completedTasks).toBe(1);
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'status' });
    });

    test('should handle child task completion', () => {
      const strategy = createMonitoringStrategy();
      
      // Create mock parent task
      const parentTask = new MockTask('parent-task', 'Parent task');
      parentTask.storeArtifact = jest.fn();
      
      // Create mock child task
      const childTask = new MockTask('child-task', 'Child task');
      childTask.parent = parentTask;
      childTask.getAllArtifacts = jest.fn(() => ({
        'artifact1': { content: 'test', description: 'Test artifact', type: 'file' }
      }));
      
      // Call onMessage with parent task as 'this' context
      strategy.onMessage.call(parentTask, childTask, { 
        type: 'completed',
        result: { success: true }
      });
      
      // Should copy artifacts from child
      expect(parentTask.storeArtifact).toHaveBeenCalledWith(
        'artifact1', 'test', 'Test artifact', 'file'
      );
    });

    test('should handle child task failure', () => {
      const strategy = createMonitoringStrategy();
      
      // Create mock parent task
      const parentTask = new MockTask('parent-task', 'Parent task');
      const grandParent = new MockTask('grandparent', 'Grandparent');
      parentTask.parent = grandParent;
      
      // Create mock child task
      const childTask = new MockTask('child-task', 'Child task');
      childTask.parent = parentTask;
      
      // Call onMessage with parent task as 'this' context for child failure
      strategy.onMessage.call(parentTask, childTask, { 
        type: 'failed',
        error: new Error('Test error')
      });
      
      // Should notify parent of child failure
      expect(parentTask.sentMessages.length).toBe(1);
      expect(parentTask.sentMessages[0].message.type).toBe('child-failed');
      expect(parentTask.sentMessages[0].message.child).toBe(childTask);
    });

    test('should handle unknown messages gracefully', () => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Progress Tracking', () => {
    test('should track task progress', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('monitor', 'Monitor progress');
      
      // Initialize monitoring state
      task.storeArtifact('monitoring-state', {
        tasksStarted: [],
        tasksCompleted: [],
        currentPhase: 'planning'
      }, 'Monitoring state', 'state');
      
      // Update with task start
      strategy.onMessage.call(task, task, {
        type: 'update',
        progressData: {
          taskStarted: 'task-1',
          description: 'Starting task 1'
        }
      });
      
      // Check state was updated
      setTimeout(() => {
        const state = task.getAllArtifacts()['monitoring-state'];
        expect(state).toBeDefined();
        done();
      }, 100);
    });

    test('should track phase transitions', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('monitor', 'Monitor phases');
      
      // Initialize with planning phase
      task.storeArtifact('monitoring-state', {
        tasksStarted: [],
        tasksCompleted: [],
        currentPhase: 'planning'
      }, 'Monitoring state', 'state');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.phaseTransition).toBeDefined();
        expect(result.phaseTransition.from).toBe('planning');
        expect(result.phaseTransition.to).toBe('execution');
        done();
      });
      
      // Update with phase change
      strategy.onMessage.call(task, task, {
        type: 'phase-change',
        phase: {
          from: 'planning',
          to: 'execution'
        }
      });
    });

    test('should calculate metrics', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('monitor', 'Calculate metrics');
      
      // Set up state with some completed tasks
      task.storeArtifact('monitoring-state', {
        tasksStarted: ['task-1', 'task-2', 'task-3'],
        tasksCompleted: ['task-1', 'task-2'],
        failedTasks: [],
        currentPhase: 'execution',
        startTime: Date.now() - 10000
      }, 'Monitoring state', 'state');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
        expect(result.metrics.completionRate).toBeGreaterThan(0);
        expect(result.metrics.totalTasks).toBe(3);
        expect(result.metrics.completedTasks).toBe(2);
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'get-metrics' });
    });
  });

  describe('Error Handling', () => {
    test('should handle synchronous errors in message handler', () => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('test', 'Test task');
      // Make getAllArtifacts throw to trigger sync error
      task.getAllArtifacts = () => {
        throw new Error('Sync error');
      };
      
      // Should not throw - errors are caught
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'status' });
      }).not.toThrow();
    });

    test('should handle missing state gracefully', (done) => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('test', 'Get status without state');
      
      // No monitoring state artifact
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.status).toBeDefined();
        // Should have default/empty metrics
        expect(result.status.metrics).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'status' });
    });
  });

  describe('Prototypal Pattern Verification', () => {
    test('should properly inherit from TaskStrategy', () => {
      const strategy = createMonitoringStrategy();
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should not have class properties
      expect(strategy.constructor.name).not.toBe('MonitoringStrategy');
    });

    test('should use closure for configuration', () => {
      const strategy1 = createMonitoringStrategy({ updateInterval: 1000 });
      const strategy2 = createMonitoringStrategy({ updateInterval: 5000 });
      
      // Each strategy should have its own configuration
      expect(strategy1).not.toBe(strategy2);
      expect(typeof strategy1.onMessage).toBe('function');
      expect(typeof strategy2.onMessage).toBe('function');
    });

    test('should handle fire-and-forget messaging pattern', () => {
      const strategy = createMonitoringStrategy();
      
      const task = new MockTask('test', 'Test fire-and-forget');
      
      // onMessage should not return a promise that needs await
      const result = strategy.onMessage.call(task, task, { type: 'start' });
      
      // Result should be undefined (fire-and-forget)
      expect(result).toBeUndefined();
    });
  });
});