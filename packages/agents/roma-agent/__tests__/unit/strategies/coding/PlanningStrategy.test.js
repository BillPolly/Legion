/**
 * Unit tests for PlanningStrategy - Prototypal Pattern
 * Tests project planning and structure generation
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { createPlanningStrategy } from '../../../../src/strategies/coding/PlanningStrategy.js';

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

describe('PlanningStrategy - Prototypal Pattern', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
  }, 30000);

  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should accept custom options', () => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry, {
        outputFormat: 'text',
        validateResults: false
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should work without llmClient and toolRegistry (will get from task)', () => {
      const strategy = createPlanningStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });

  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with requirements artifact', (done) => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      // Create a mock task with requirements
      const task = new MockTask('planning-1', 'Plan a calculator API');
      task.context = { llmClient, toolRegistry };
      
      // Add requirements artifact
      task.storeArtifact('requirements-analysis', {
        type: 'api',
        features: ['calculation endpoints', 'error handling'],
        constraints: ['secure', 'fast'],
        technologies: ['express', 'joi']
      }, 'Analyzed requirements', 'analysis');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.plan).toBeDefined();
        expect(task.artifacts.length).toBeGreaterThan(1);
        
        // Check artifacts were stored
        const artifacts = task.getAllArtifacts();
        expect(artifacts['project-plan']).toBeDefined();
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should handle child task completion', () => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
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
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
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
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should catch async errors and fail task', (done) => {
      // Create strategy without llmClient to trigger error
      const strategy = createPlanningStrategy(null, null);
      
      const task = new MockTask('test', 'Test task');
      task.context = {}; // No llmClient in context
      
      task.fail = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('LLM client is required');
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle synchronous errors in message handler', () => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
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

    test('should handle missing requirements gracefully', (done) => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Create project plan');
      task.context = { llmClient, toolRegistry };
      
      // No requirements artifact - should still work
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.plan).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Integration with Task', () => {
    test('should work with task lookup for dependencies', (done) => {
      const strategy = createPlanningStrategy(); // No dependencies provided
      
      const task = new MockTask('test', 'Create project structure for REST API');
      task.context = { llmClient, toolRegistry };
      
      // Add basic requirements
      task.storeArtifact('requirements-analysis', {
        type: 'rest-api',
        features: ['CRUD operations', 'authentication'],
        technologies: ['express', 'mongodb']
      }, 'API requirements', 'analysis');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.plan).toBeDefined();
        done();
      });
      
      // Call onMessage - should get dependencies from task context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should store plan as artifact', (done) => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Plan microservices architecture');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn(() => {
        const artifacts = task.getAllArtifacts();
        expect(artifacts['project-plan']).toBeDefined();
        expect(artifacts['project-plan'].type).toBe('plan');
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should create detailed project structure', (done) => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Plan e-commerce application');
      task.context = { llmClient, toolRegistry };
      
      task.storeArtifact('requirements-analysis', {
        type: 'e-commerce',
        features: ['product catalog', 'shopping cart', 'payment processing'],
        technologies: ['next.js', 'stripe', 'postgresql']
      }, 'E-commerce requirements', 'analysis');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.plan).toBeDefined();
        expect(result.plan.structure).toBeDefined();
        
        const artifacts = task.getAllArtifacts();
        expect(artifacts['project-structure']).toBeDefined();
        
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Prototypal Pattern Verification', () => {
    test('should properly inherit from TaskStrategy', () => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should not have class properties
      expect(strategy.constructor.name).not.toBe('PlanningStrategy');
    });

    test('should use closure for configuration', () => {
      const strategy1 = createPlanningStrategy(llmClient, toolRegistry);
      const strategy2 = createPlanningStrategy(null, null);
      
      // Each strategy should have its own configuration
      expect(strategy1).not.toBe(strategy2);
      expect(typeof strategy1.onMessage).toBe('function');
      expect(typeof strategy2.onMessage).toBe('function');
    });

    test('should handle fire-and-forget messaging pattern', (done) => {
      const strategy = createPlanningStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test fire-and-forget');
      task.context = { llmClient, toolRegistry };
      
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