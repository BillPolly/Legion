/**
 * Unit tests for AnalysisStrategy - Prototypal Pattern
 * Tests the converted AnalysisStrategy using factory functions
 */

import { describe, test, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { createAnalysisStrategy } from '../../../../src/strategies/coding/AnalysisStrategy.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('AnalysisStrategy - Prototypal Pattern', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  let promptRegistry;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    toolRegistry = await ToolRegistry.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    // Create prompt registry for tests
    const promptsPath = path.resolve(__dirname, '../../../../prompts');
    promptRegistry = new EnhancedPromptRegistry(promptsPath);
  }, 30000);

  describe('Factory Function', () => {
    test('should create strategy with factory function', () => {
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should accept custom options', () => {
      const strategy = createAnalysisStrategy(llmClient, {
        outputFormat: 'text',
        validateResults: false,
        promptRegistry: promptRegistry
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should work without llmClient (will get from task)', () => {
      const strategy = createAnalysisStrategy(null, {
        promptRegistry: promptRegistry
      });
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });
  });

  describe('Message Handling with Prototypal Pattern', () => {
    test('should handle start message with fire-and-forget', (done) => {
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
      // Create a mock task
      const task = new MockTask('analysis-1', 'Create a simple calculator API');
      task.context = { llmClient, toolRegistry, promptRegistry };
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(task.artifacts.length).toBeGreaterThan(0);
        
        // Check artifacts were stored
        const artifacts = task.getAllArtifacts();
        expect(artifacts['requirements-analysis']).toBeDefined();
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should handle child task completion', () => {
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
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
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
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
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
      const task = new MockTask('test', 'Test task');
      
      // Should not throw
      expect(() => {
        strategy.onMessage.call(task, task, { type: 'unknown' });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should catch async errors and fail task', (done) => {
      // Create strategy with promptRegistry but no llmClient to trigger error
      const strategy = createAnalysisStrategy(null, {
        promptRegistry: promptRegistry
      });
      
      const task = new MockTask('test', 'Test task');
      task.context = { promptRegistry }; // Has promptRegistry but no llmClient
      
      task.fail = jest.fn((error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('LLM client is required');
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    });

    test('should handle synchronous errors in message handler', () => {
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
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
      const strategy = createAnalysisStrategy(null, {
        promptRegistry: promptRegistry
      }); // No llmClient provided directly
      
      const task = new MockTask('test', 'Create an API endpoint');
      task.context = { llmClient, toolRegistry, promptRegistry };
      
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        done();
      });
      
      // Call onMessage - should get dependencies from task context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);

    test('should store analysis results as artifacts', (done) => {
      const strategy = createAnalysisStrategy(llmClient, {
        promptRegistry: promptRegistry
      });
      
      const task = new MockTask('test', 'Build a REST API');
      task.context = { llmClient, toolRegistry, promptRegistry };
      
      task.complete = jest.fn(() => {
        const artifacts = task.getAllArtifacts();
        expect(artifacts['requirements-analysis']).toBeDefined();
        expect(artifacts['requirements-analysis'].type).toBe('analysis');
        done();
      });
      
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 30000);
  });
});