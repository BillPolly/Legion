/**
 * Unit tests for QualityStrategy - Prototypal Pattern
 * Tests validation gates, quality metrics, and continuous validation
 * NO MOCKS - using real components
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { createQualityStrategy } from '../../../../src/strategies/coding/QualityStrategy.js';

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

describe('QualityStrategy - Prototypal Pattern', () => {
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
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
    
    test('should accept custom options', () => {
      const strategy = createQualityStrategy(llmClient, toolRegistry, {
        qualityGates: {
          custom: {
            checks: ['custom_check'],
            threshold: 75
          }
        }
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should work without llmClient and toolRegistry (will get from task)', () => {
      const strategy = createQualityStrategy();
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });
  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with project validation', (done) => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      // Create a mock task with project execution result
      const task = new MockTask('quality-1', 'Validate project quality');
      task.context = { llmClient, toolRegistry };
      
      // Add execution result artifact
      task.storeArtifact('execution-result', {
        project: {
          phases: {
            setup: { status: 'completed', artifacts: [] },
            core: { status: 'completed', artifacts: [] },
            features: { status: 'completed', artifacts: [] }
          },
          artifacts: [
            { type: 'code', path: 'server.js', content: 'const express = require("express");' }
          ]
        }
      }, 'Project execution result', 'result');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.validation).toBeDefined();
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should handle child task completion', () => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
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
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
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
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
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
      const strategy = createQualityStrategy(null, null);
      
      const task = new MockTask('test', 'Test task');
      task.context = {}; // No llmClient in context
      
      task.fail = jest.fn((error) => {
        try {
          expect(error).toBeDefined();
          expect(error.message).toContain('LLM client is required');
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle synchronous errors in message handler', () => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
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

    test('should handle missing execution result gracefully', (done) => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Validate quality without execution result');
      task.context = { llmClient, toolRegistry };
      
      // No execution result artifact - should still work with basic validation
      task.complete = jest.fn((result) => {
        try {
          expect(result.success).toBe(true);
          expect(result.validation).toBeDefined();
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Integration with Task', () => {
    test('should work with task lookup for dependencies', (done) => {
      const strategy = createQualityStrategy(); // No dependencies provided
      
      const task = new MockTask('test', 'Validate project quality');
      task.context = { llmClient, toolRegistry };
      
      // Add basic execution result
      task.storeArtifact('execution-result', {
        project: {
          phases: { setup: { status: 'completed', artifacts: [] } },
          artifacts: [
            { type: 'code', path: 'app.js', content: 'console.log("hello");' }
          ]
        }
      }, 'Project result', 'result');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        done();
      });
      
      // Call onMessage - should get dependencies from task context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should store validation results as artifacts', (done) => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Quality validation with artifacts');
      task.context = { llmClient, toolRegistry };
      
      task.complete = jest.fn(() => {
        try {
          const artifacts = task.getAllArtifacts();
          expect(artifacts['quality-validation']).toBeDefined();
          expect(artifacts['quality-validation'].type).toBe('validation');
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should validate comprehensive project structure', (done) => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Validate complete Node.js project');
      task.context = { llmClient, toolRegistry };
      
      task.storeArtifact('execution-result', {
        project: {
          phases: {
            setup: { status: 'completed', artifacts: [] },
            core: { status: 'completed', artifacts: [] },
            features: { status: 'completed', artifacts: [] },
            testing: { status: 'completed', artifacts: [] }
          },
          artifacts: [
            { type: 'code', path: 'server.js', content: 'const express = require("express"); const app = express();' },
            { type: 'test', path: 'test.js', content: 'describe("server", () => { it("works", () => {}); });' },
            { type: 'config', path: 'package.json', content: '{"name": "test-app", "scripts": {"test": "jest"}}' }
          ],
          quality: {
            testResults: { passed: 10, failed: 0, coverage: 85 }
          }
        }
      }, 'Complete project result', 'result');
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.validation).toBeDefined();
        expect(result.validation.phases).toBeDefined();
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });

  describe('Prototypal Pattern Verification', () => {
    test('should properly inherit from TaskStrategy', () => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      // Should have onMessage method
      expect(typeof strategy.onMessage).toBe('function');
      
      // Should not have class properties
      expect(strategy.constructor.name).not.toBe('QualityStrategy');
    });

    test('should use closure for configuration', () => {
      const strategy1 = createQualityStrategy(llmClient, toolRegistry);
      const strategy2 = createQualityStrategy(null, null);
      
      // Each strategy should have its own configuration
      expect(strategy1).not.toBe(strategy2);
      expect(typeof strategy1.onMessage).toBe('function');
      expect(typeof strategy2.onMessage).toBe('function');
    });

    test('should handle fire-and-forget messaging pattern', (done) => {
      const strategy = createQualityStrategy(llmClient, toolRegistry);
      
      const task = new MockTask('test', 'Test fire-and-forget');
      task.context = { llmClient, toolRegistry };
      
      // Add minimal project data to trigger completion  
      task.storeArtifact('execution-result', {
        success: true,
        phases: { setup: { passed: true } },
        artifacts: []
      }, 'Test execution result', 'result');
      
      // onMessage should not return a promise that needs await
      const result = strategy.onMessage.call(task, task, { type: 'start' });
      
      // Result should be undefined (fire-and-forget)
      expect(result).toBeUndefined();
      
      // Task should eventually complete
      task.complete = jest.fn(() => {
        try {
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
      
      // Give async operation time to complete
      setTimeout(() => {
        if (!task.complete.mock.calls.length) {
          done(new Error('Task did not complete'));
        }
      }, 3000);
    });
  });
});