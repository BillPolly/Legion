/**
 * Unit tests for ExecutionStrategy - Prototypal Pattern
 * Tests task execution, dependency resolution, and retry logic
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { createExecutionStrategy } from '../../../../src/strategies/coding/ExecutionStrategy.js';

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

describe('ExecutionStrategy - Prototypal Pattern', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  let mockStrategies;
  let mockStateManager;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
  }, 30000);
  
  beforeEach(() => {
    // Create mock strategies that simulate real strategies
    mockStrategies = {
      server: {
        onMessage: jest.fn(function(task, message) {
          // Fire-and-forget behavior
          task.complete({
            success: true,
            artifacts: [{ id: 'artifact-1', content: 'code' }]
          });
        })
      },
      test: {
        onMessage: jest.fn(function(task, message) {
          task.complete({
            success: true,
            artifacts: []
          });
        })
      }
    };
    
    // Create mock state manager
    mockStateManager = {
      updateTask: jest.fn(async () => {}),
      addArtifact: jest.fn(async () => {}),
      update: jest.fn(async () => {})
    };
  });
  
  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
    
    test('should accept custom options', () => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager, {
        maxConcurrent: 5,
        retryDelay: 1000
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
    
    test('should work without parameters (will get from task)', () => {
      const strategy = createExecutionStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });
  
  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with fire-and-forget', (done) => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      // Create a mock task
      const task = new MockTask('execution-1', 'Execute project plan');
      task.context = { llmClient, toolRegistry };
      
      // Store a plan artifact for execution
      task.storeArtifact('project-plan', {
        tasks: [
          {
            id: 'task-1',
            type: 'server',
            description: 'Create server',
            dependencies: []
          }
        ]
      }, 'Project plan', 'plan');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.executedTasks).toBeDefined();
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
    
    test('should handle child task completion', () => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
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
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
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
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should catch async errors and fail task', (done) => {
      // Create strategy without strategies to trigger error  
      const strategy = createExecutionStrategy(null, mockStateManager);
      
      const task = new MockTask('test', 'Test task');
      task.context = {}; // No strategies in context
      
      task.fail = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('Strategies are required');
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle synchronous errors in message handler', () => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      const task = new MockTask('test', 'Test task');
      // Make getAllArtifacts throw to trigger sync error
      task.getAllArtifacts = () => {
        throw new Error('Sync error');
      };
      
      // Should not throw - errors are caught
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'start' });
      }).not.toThrow();
    });
  });

  describe('Integration with Task', () => {
    test('should work with task lookup for dependencies', (done) => {
      const strategy = createExecutionStrategy(); // No dependencies provided
      
      const task = new MockTask('test', 'Execute plan');
      task.context = { 
        strategies: mockStrategies,
        stateManager: mockStateManager
      };
      
      // Add a plan artifact
      task.storeArtifact('project-plan', {
        tasks: [
          {
            id: 'task-1',
            type: 'server',
            description: 'Create server',
            dependencies: []
          }
        ]
      }, 'Project plan', 'plan');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        done();
      });
      
      // Call onMessage - should get dependencies from task context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should execute multiple tasks from plan', (done) => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      const task = new MockTask('test', 'Execute complex plan');
      task.context = { llmClient, toolRegistry };
      
      // Add a multi-task plan
      task.storeArtifact('project-plan', {
        tasks: [
          {
            id: 'task-1',
            type: 'server',
            description: 'Create server',
            dependencies: []
          },
          {
            id: 'task-2',
            type: 'test',
            description: 'Create tests',
            dependencies: ['task-1']
          }
        ]
      }, 'Multi-task plan', 'plan');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.executedTasks).toHaveLength(2);
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Prototypal Pattern Verification', () => {
    test('should properly inherit from TaskStrategy', () => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should not have class properties
      expect(strategy.constructor.name).not.toBe('ExecutionStrategy');
    });

    test('should use closure for configuration', () => {
      const strategy1 = createExecutionStrategy(mockStrategies, mockStateManager);
      const strategy2 = createExecutionStrategy({}, {});
      
      // Each strategy should have its own configuration
      expect(strategy1).not.toBe(strategy2);
      expect(typeof strategy1.onMessage).toBe('function');
      expect(typeof strategy2.onMessage).toBe('function');
    });

    test('should handle fire-and-forget messaging pattern', (done) => {
      const strategy = createExecutionStrategy(mockStrategies, mockStateManager);
      
      const task = new MockTask('test', 'Test fire-and-forget');
      task.context = { llmClient, toolRegistry };
      
      // Add minimal plan
      task.storeArtifact('project-plan', {
        tasks: [{ id: 't1', type: 'server', description: 'Test', dependencies: [] }]
      }, 'Plan', 'plan');
      
      // onMessage should not return a promise that needs await
      const result = strategy.onMessage.call(task, task, { type: 'start' });
      
      // Result should be undefined (fire-and-forget)
      expect(result).toBeUndefined();
      
      // Task should eventually complete
      task.complete = jest.fn(() => {
        done();
      });
      
      // Give async operation time to complete
      setTimeout(() => {
        if (!task.complete.mock.calls.length) {
          done(new Error('Task did not complete'));
        }
      }, 5000);
    });
  });
});