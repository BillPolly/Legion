/**
 * Test file for Simple Node.js Strategies
 * 
 * Tests the focused Node.js server development strategies.
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import { 
  SimpleNodeServerStrategy, 
  SimpleNodeTestStrategy, 
  SimpleNodeDebugStrategy 
} from '../../../src/strategies/simple-node/index.js';

// Simple Task mock class
class Task {
  constructor(id, description) {
    this.id = id;
    this.description = description;
    this.context = {};
    this.artifacts = [];
    this.artifactMap = {}; // Internal map for getAllArtifacts
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
    if (!this.conversation) {
      this.conversation = [];
    }
    this.conversation.push({ role, content });
  }
  
  storeArtifact(name, value, description, type) {
    const artifact = {
      name,
      value,
      description,
      type
    };
    this.artifacts.push(artifact);
    this.artifactMap[name] = artifact;
  }
  
  getAllArtifacts() {
    return this.artifactMap;
  }
}

describe('Simple Node.js Strategies', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get services
    toolRegistry = await getToolRegistry();
    llmClient = await resourceManager.get('llmClient');
  }, 30000);
  
  describe('SimpleNodeServerStrategy', () => {
    it('should create a simple Express server', async () => {
      const strategy = new SimpleNodeServerStrategy(llmClient, toolRegistry);
      
      // Create a test task
      const task = new Task('simple-server', 'Create a simple Express server with GET /hello endpoint');
      task.context = { llmClient, toolRegistry };
      
      // Execute strategy
      const result = await strategy.onParentMessage(task, { type: 'start' });
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.length).toBeGreaterThan(0);
      
      // Check for server.js artifact
      const serverArtifact = result.artifacts.find(a => a.name === 'server.js');
      expect(serverArtifact).toBeDefined();
      expect(serverArtifact.value).toContain('express');
      expect(serverArtifact.value).toContain('/hello');
      
      // Check for package.json artifact
      const packageArtifact = result.artifacts.find(a => a.name === 'package.json');
      expect(packageArtifact).toBeDefined();
      expect(packageArtifact.value.dependencies).toHaveProperty('express');
    }, 60000);
    
    it('should handle HTTP server requests', async () => {
      const strategy = new SimpleNodeServerStrategy(llmClient, toolRegistry);
      
      const task = new Task('http-server', 'Create a basic HTTP server without Express');
      task.context = { llmClient, toolRegistry };
      
      const result = await strategy.onParentMessage(task, { type: 'start' });
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      
      const serverArtifact = result.artifacts.find(a => a.name === 'server.js');
      expect(serverArtifact).toBeDefined();
      expect(serverArtifact.value).toContain('createServer');
    }, 60000);
  });
  
  describe('SimpleNodeTestStrategy', () => {
    it('should generate tests for provided code', async () => {
      const strategy = new SimpleNodeTestStrategy(llmClient, toolRegistry);
      
      // Create task with code artifact
      const task = new Task('test-generation', 'Write tests for the provided function');
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
      
      const result = await strategy.onParentMessage(task, { type: 'start' });
      
      expect(result.success).toBe(true);
      expect(result.testFiles).toBeDefined();
      expect(result.testFiles.length).toBeGreaterThan(0);
      
      // Check that test code was generated
      const testArtifact = result.artifacts.find(a => a.name.includes('.test.js'));
      expect(testArtifact).toBeDefined();
      expect(testArtifact.value).toContain('describe');
      expect(testArtifact.value).toContain('it(');
      expect(testArtifact.value).toContain('expect');
    }, 60000);
  });
  
  describe('SimpleNodeDebugStrategy', () => {
    it('should analyze and fix code errors', async () => {
      const strategy = new SimpleNodeDebugStrategy(llmClient, toolRegistry);
      
      // Create task with error
      const task = new Task('debug-error', 'Fix the TypeError in the code');
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
        stack: "at processData (buggy.js:3:19)"
      }, 'Error details', 'error');
      
      const result = await strategy.onParentMessage(task, { type: 'start' });
      
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.rootCause).toBeDefined();
      
      // Check that fixed code was generated
      const fixedArtifact = result.artifacts.find(a => a.name === 'fixed_code.js');
      expect(fixedArtifact).toBeDefined();
      expect(fixedArtifact.value).toContain('if');  // Should have null check
    }, 60000);
    
    it('should add debugging statements', async () => {
      const strategy = new SimpleNodeDebugStrategy(llmClient, toolRegistry);
      
      const task = new Task('add-debug', 'Add debugging to understand the flow');
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
      
      const result = await strategy.onParentMessage(task, { type: 'start' });
      
      expect(result.success).toBe(true);
      expect(result.debugPoints).toBeDefined();
      
      const debugArtifact = result.artifacts.find(a => a.name === 'debug_code.js');
      expect(debugArtifact).toBeDefined();
      expect(debugArtifact.value).toContain('console.log');
    }, 60000);
  });
  
  describe('Integration with SimpleROMAAgent', () => {
    it.skip('should work with SimpleROMAAgent for server creation', async () => {
      const { default: SimpleROMAAgent } = await import('../../../src/SimpleROMAAgent.js');
      const { default: SimpleNodeServerStrategy } = await import('../../../src/strategies/simple-node/SimpleNodeServerStrategy.js');
      
      const agent = new SimpleROMAAgent({
        taskStrategy: new SimpleNodeServerStrategy(),
        outputDir: '/tmp/roma-test'
      });
      
      await agent.initialize();
      
      const result = await agent.execute({
        description: 'Create a simple REST API server with GET /users endpoint'
      });
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.length).toBeGreaterThan(0);
    }, 60000);
  });
});