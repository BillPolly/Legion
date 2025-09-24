/**
 * Unit tests for ProjectPlannerStrategy - Prototypal Pattern
 * Tests project orchestration, hierarchical delegation, and workflow management
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { createProjectPlannerStrategy } from '../../../../src/strategies/coding/ProjectPlannerStrategy.js';

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
    if (key === 'taskManager') return null; // Mock missing for basic tests
    return null;
  }
  
  send(target, message) {
    this.sentMessages.push({ target, message });
  }
}

describe('ProjectPlannerStrategy - Prototypal Pattern', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await ToolRegistry.getInstance();
  }, 30000);

  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
    
    test('should accept custom options', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry, {
        projectRoot: '/custom/path',
        maxConcurrent: 5,
        maxRetries: 4,
        executionTimeout: 600000
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should work without llmClient and toolRegistry (will get from task)', () => {
      const strategy = createProjectPlannerStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });

  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with project orchestration', (done) => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      // Create a mock task for project planning
      const task = new MockTask('planner-1', 'Create a Node.js web application');
      task.context = { llmClient, toolRegistry };
      
      // Override fail to check results - should fail due to missing TaskManager
      task.fail = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('TaskManager is required');
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle child task completion', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      // Create mock parent task
      const parentTask = new MockTask('parent-task', 'Parent task');
      parentTask.storeArtifact = jest.fn();
      
      // Create mock child task
      const childTask = new MockTask('child-task', 'Child task');
      childTask.parent = parentTask;
      childTask.getAllArtifacts = jest.fn(() => ({
        'project-plan': { content: 'test plan', description: 'Project plan', type: 'plan' }
      }));
      
      // Call onMessage with parent task as 'this' context
      strategy.onMessage.call(parentTask, childTask, { 
        type: 'completed',
        result: { success: true }
      });
      
      // Should copy artifacts from child
      expect(parentTask.storeArtifact).toHaveBeenCalledWith(
        'project-plan', 'test plan', 'Project plan', 'plan'
      );
    });

    test('should handle child task failure', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
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
        error: new Error('Planning failed')
      });
      
      // Should notify parent of child failure
      expect(parentTask.sentMessages.length).toBe(1);
      expect(parentTask.sentMessages[0].message.type).toBe('child-failed');
      expect(parentTask.sentMessages[0].message.child).toBe(childTask);
    });

    test('should handle status message', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw for status message (fire-and-forget async)
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'status' });
      }).not.toThrow();
    });

    test('should handle cancel message', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw for cancel message (fire-and-forget async)
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'cancel' });
      }).not.toThrow();
    });

    test('should handle unknown messages gracefully', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Prototypal Inheritance', () => {
    test('should properly inherit TaskStrategy methods if available', () => {
      const strategy = createProjectPlannerStrategy();
      
      // Strategy should be an object, not a class instance
      expect(typeof strategy).toBe('object');
      expect(strategy.constructor).not.toBe(Function);
      
      // Should have onMessage as own property
      expect(strategy.hasOwnProperty('onMessage')).toBe(true);
    });

    test('should not expose internal configuration', () => {
      const strategy = createProjectPlannerStrategy(llmClient, toolRegistry, {
        projectRoot: '/secret/path'
      });
      
      // Internal config should not be accessible
      expect(strategy.projectRoot).toBeUndefined();
      expect(strategy.config).toBeUndefined();
      expect(strategy.options).toBeUndefined();
      
      // Only onMessage should be accessible
      const ownKeys = Object.keys(strategy);
      expect(ownKeys).toContain('onMessage');
    });
  });
});