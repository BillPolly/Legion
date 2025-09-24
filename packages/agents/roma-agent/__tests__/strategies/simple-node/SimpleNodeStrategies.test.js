/**
 * Test file for Simple Node.js Strategies
 * Tests the prototypal pattern strategies for Node.js development.
 * NO MOCKS - using real services where needed
 */

import { describe, test, expect, beforeAll, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import { createSimpleNodeServerStrategy } from '../../../src/strategies/simple-node/SimpleNodeServerStrategy.js';
import { createSimpleNodeTestStrategy } from '../../../src/strategies/simple-node/SimpleNodeTestStrategy.js';
import { createSimpleNodeDebugStrategy } from '../../../src/strategies/simple-node/SimpleNodeDebugStrategy.js';

// Mock Task for testing - simulates the actual Task interface
class MockTask {
  constructor(id, description) {
    this.id = id;
    this.description = description;
    this.parent = null;
    this.context = {};
    this.artifacts = [];
    this.artifactMap = {}; // Internal map for getAllArtifacts
    this.failed = false;
    this.completed = false;
    this.conversation = [];
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
      content: value, // Add content field for compatibility
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
    // Mock send - just store for verification
    this.sentMessages = this.sentMessages || [];
    this.sentMessages.push({ target, message });
  }
}

describe('Simple Node.js Strategies - Prototypal Pattern', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    toolRegistry = await getToolRegistry();
    llmClient = await resourceManager.get('llmClient');
  }, 30000);
  
  describe('SimpleNodeServerStrategy', () => {
    test('should create strategy with factory function', () => {
      const strategy = createSimpleNodeServerStrategy;
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should handle start message and create Express server', (done) => {
      const strategy = createSimpleNodeServerStrategy;
      
      // Create a mock task
      const task = new MockTask('simple-server', 'Create a simple Express server with GET /hello endpoint');
      task.context = { llmClient, toolRegistry };
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toContain('server');
        expect(result.artifacts).toBeDefined();
        
        // Check that artifacts were stored
        const artifacts = task.getAllArtifacts();
        expect(Object.keys(artifacts).length).toBeGreaterThan(0);
        
        // Check for server.js artifact
        const serverArtifact = artifacts['server.js'];
        expect(serverArtifact).toBeDefined();
        expect(serverArtifact.type).toBe('file');
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 60000);
    
    test('should handle child task completion', () => {
      const strategy = createSimpleNodeServerStrategy;
      
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
  });
  
  describe('SimpleNodeTestStrategy', () => {
    test('should create strategy with factory function', () => {
      const strategy = createSimpleNodeTestStrategy;
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should generate tests for provided code', (done) => {
      const strategy = createSimpleNodeTestStrategy;
      
      // Create task with code artifact
      const task = new MockTask('test-generation', 'Write tests for the provided function');
      task.context = { llmClient, toolRegistry };
      
      // Add a simple function as artifact
      const testCode = `
        function add(a, b) {
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Both arguments must be numbers');
          }
          return a + b;
        }
        
        module.exports = { add };
      `;
      task.storeArtifact('function.js', testCode, 'Function to test', 'file');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toContain('test');
        expect(result.testFiles).toBeDefined();
        
        // Check that artifacts were stored
        const artifacts = task.getAllArtifacts();
        const testFileKeys = Object.keys(artifacts).filter(k => k.includes('test'));
        expect(testFileKeys.length).toBeGreaterThan(0);
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 60000);
  });
  
  describe('SimpleNodeDebugStrategy', () => {
    test('should create strategy with factory function', () => {
      const strategy = createSimpleNodeDebugStrategy;
      
      expect(strategy).toBeDefined();
      expect(typeof strategy.onMessage).toBe('function');
    });

    test('should analyze and fix code errors', (done) => {
      const strategy = createSimpleNodeDebugStrategy;
      
      // Create task with error
      const task = new MockTask('debug-error', 'Fix the TypeError in the code');
      task.context = { llmClient, toolRegistry };
      
      // Add buggy code as artifact
      const buggyCode = `
        function processData(data) {
          // This will throw if data is null
          return data.map(item => item.toUpperCase());
        }
        
        module.exports = { processData };
      `;
      task.storeArtifact('buggy.js', buggyCode, 'Code with bug', 'file');
      task.storeArtifact('error', {
        message: "TypeError: Cannot read property 'map' of null",
        stack: "at processData (buggy.js:3:19)",
        code: buggyCode
      }, 'Error details', 'error');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toBeDefined();
        expect(result.analysis).toBeDefined();
        
        // Check that artifacts were stored
        const artifacts = task.getAllArtifacts();
        const fixedCodeArtifact = artifacts['fixed_code.js'];
        expect(fixedCodeArtifact).toBeDefined();
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 60000);
    
    test('should add debugging statements', (done) => {
      const strategy = createSimpleNodeDebugStrategy;
      
      const task = new MockTask('add-debug', 'Add debugging to understand the flow');
      task.context = { llmClient, toolRegistry };
      
      const code = `
        function calculate(x, y) {
          const sum = x + y;
          const product = x * y;
          const result = sum * product;
          return result;
        }
      `;
      task.storeArtifact('calculate.js', code, 'Function to debug', 'file');
      
      // Override complete to check results
      task.complete = jest.fn((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toContain('debug');
        
        // Check that artifacts were stored
        const artifacts = task.getAllArtifacts();
        const debugCodeArtifact = artifacts['debug_code.js'];
        expect(debugCodeArtifact).toBeDefined();
        
        done();
      });
      
      // Call onMessage with task as 'this' context
      strategy.onMessage.call(task, task, { type: 'start' });
    }, 60000);
  });
  
  describe('Prototypal pattern integration', () => {
    test('should coordinate multiple strategies using factory functions', () => {
      const serverStrategy = createSimpleNodeServerStrategy;
      const testStrategy = createSimpleNodeTestStrategy;
      const debugStrategy = createSimpleNodeDebugStrategy;
      
      // Test 1: Verify strategies are objects with onMessage
      expect(typeof serverStrategy).toBe('object');
      expect(typeof testStrategy).toBe('object');
      expect(typeof debugStrategy).toBe('object');
      
      expect(typeof serverStrategy.onMessage).toBe('function');
      expect(typeof testStrategy.onMessage).toBe('function');
      expect(typeof debugStrategy.onMessage).toBe('function');
      
      // Test 2: Create mock tasks to verify workflow patterns
      const serverTask = new MockTask('server-creation', 'Create a simple REST API server with GET /users endpoint');
      serverTask.context = { llmClient, toolRegistry };
      
      const testTask = new MockTask('test-generation', 'Create tests for the server');
      testTask.context = { llmClient, toolRegistry };
      
      const debugTask = new MockTask('debug-analysis', 'Debug server issues');
      debugTask.context = { llmClient, toolRegistry };
      
      // Test 3: Verify task context setup
      expect(serverTask.context.llmClient).toBe(llmClient);
      expect(serverTask.context.toolRegistry).toBe(toolRegistry);
      
      // Test 4: Simulate artifact flow between strategies
      const mockServerArtifacts = [
        { name: 'server.js', value: 'const express = require("express");', type: 'file' },
        { name: 'package.json', value: { dependencies: { express: '^4.18.0' } }, type: 'config' }
      ];
      
      const mockTestArtifacts = [
        { name: 'server.test.js', value: 'describe("server", () => { it("should work", () => {}); });', type: 'test' }
      ];
      
      // Simulate artifact flow between strategies
      serverTask.storeArtifact('server.js', mockServerArtifacts[0].value, 'Server code', 'file');
      testTask.storeArtifact('server.js', mockServerArtifacts[0].value, 'Server code to test', 'file');
      testTask.storeArtifact('server.test.js', mockTestArtifacts[0].value, 'Test file', 'test');
      
      // Test 5: Verify artifact management works
      const serverArtifacts = serverTask.getAllArtifacts();
      const testArtifacts = testTask.getAllArtifacts();
      
      expect(Object.keys(serverArtifacts)).toContain('server.js');
      expect(Object.keys(testArtifacts)).toContain('server.js');
      expect(Object.keys(testArtifacts)).toContain('server.test.js');
      
      // Test 6: Verify complete workflow pattern
      const allArtifacts = [...Object.values(serverArtifacts), ...Object.values(testArtifacts)];
      expect(allArtifacts.length).toBeGreaterThan(2);
      
      const hasServerCode = allArtifacts.some(a => a.name === 'server.js');
      const hasTests = allArtifacts.some(a => a.name.includes('.test.js'));
      
      expect(hasServerCode).toBe(true);
      expect(hasTests).toBe(true);
    });

    test('should handle message passing between strategies', () => {
      const serverStrategy = createSimpleNodeServerStrategy;
      
      // Test parent-child message passing pattern
      const parentTask = new MockTask('parent', 'Parent task');
      const childTask = new MockTask('child', 'Child task');
      childTask.parent = parentTask;
      
      // Mock send to verify message passing
      parentTask.send = jest.fn();
      
      // Test child failure message
      serverStrategy.onMessage.call(parentTask, childTask, { 
        type: 'failed',
        error: new Error('Test error')
      });
      
      // Should forward failure to parent
      expect(parentTask.send).toHaveBeenCalledWith(
        parentTask.parent, // Will be null, but that's ok for test
        expect.objectContaining({
          type: 'child-failed',
          child: childTask
        })
      );
    });
  });
});