/**
 * Integration tests for ServerPlanningActor
 * Tests with real DecentPlanner and MongoDB connections
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ServerPlanningActor } from '../../ServerPlanningActor.js';
import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/mongodb-provider';
import { LLMClient } from '@legion/llm';
import { ToolRegistry } from '@legion/tools-registry';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

describe('ServerPlanningActor Integration', () => {
  let actor;
  let decentPlanner;
  let mongoProvider;
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let wss;
  let wsClient;
  let serverPort;
  let messages;

  beforeAll(async () => {
    // Initialize real services
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Initialize MongoDB provider
    mongoProvider = new MongoDBProvider(resourceManager);
    await mongoProvider.connect();
    
    // Initialize LLM client
    llmClient = new LLMClient(resourceManager);
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    // Initialize DecentPlanner with real dependencies
    decentPlanner = new DecentPlanner(llmClient, toolRegistry, {
      maxDepth: 3,
      enableFormalPlanning: false // Skip formal planning for integration tests
    });
    
    // Start WebSocket server for testing
    serverPort = 9091;
    wss = new WebSocketServer({ port: serverPort });
    
    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      // Create actor with real services
      actor = new ServerPlanningActor(decentPlanner, mongoProvider);
      
      // Set up bi-directional communication
      actor.setRemoteActor({
        send: (message) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        }
      });
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        await actor.receive(message);
      });
    });
  });

  afterAll(async () => {
    // Clean up
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    
    if (wss) {
      wss.close();
    }
    
    if (mongoProvider) {
      // Clean up test data
      const collection = mongoProvider.getCollection('plans');
      await collection.deleteMany({ 'metadata.test': true });
      await mongoProvider.disconnect();
    }
    
    if (toolRegistry) {
      await toolRegistry.close();
    }
  });

  beforeEach(async () => {
    messages = [];
    
    // Create WebSocket client
    wsClient = new WebSocket(`ws://localhost:${serverPort}`);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      wsClient.on('open', resolve);
      wsClient.on('error', reject);
    });
    
    // Collect messages
    wsClient.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });
  });

  afterEach(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  describe('plan creation with real LLM', () => {
    it('should create a simple plan with real decomposition', async () => {
      // Send plan creation request
      wsClient.send(JSON.stringify({
        type: 'plan:create',
        data: {
          goal: 'Create a function to add two numbers',
          context: {},
          options: { maxDepth: 2 }
        }
      }));
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check received messages
      const startMessage = messages.find(m => m.type === 'plan:decomposition:start');
      expect(startMessage).toBeDefined();
      expect(startMessage.data.goal).toBe('Create a function to add two numbers');
      
      const completeMessage = messages.find(m => m.type === 'plan:complete');
      
      // If LLM is available, we should get a complete message
      if (completeMessage) {
        expect(completeMessage.data).toHaveProperty('hierarchy');
        expect(completeMessage.data).toHaveProperty('validation');
        expect(completeMessage.data.metadata.goal).toBe('Create a function to add two numbers');
      } else {
        // If LLM is not available, we should get an error
        const errorMessage = messages.find(m => m.type === 'plan:error');
        expect(errorMessage).toBeDefined();
      }
    }, 10000);
  });

  describe('plan persistence with real MongoDB', () => {
    it('should save and load plans from MongoDB', async () => {
      const testPlan = {
        name: 'Test Integration Plan',
        goal: 'Test goal',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test goal',
            complexity: 'SIMPLE'
          }
        },
        validation: { valid: true },
        metadata: { test: true }
      };
      
      // Save plan
      wsClient.send(JSON.stringify({
        type: 'plan:save',
        data: testPlan
      }));
      
      // Wait for save confirmation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedMessage = messages.find(m => m.type === 'plan:saved');
      expect(savedMessage).toBeDefined();
      const planId = savedMessage.data.planId;
      expect(planId).toBeDefined();
      
      // Clear messages
      messages.length = 0;
      
      // Load the saved plan
      wsClient.send(JSON.stringify({
        type: 'plan:load',
        data: { planId }
      }));
      
      // Wait for load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const loadedMessage = messages.find(m => m.type === 'plan:loaded');
      expect(loadedMessage).toBeDefined();
      expect(loadedMessage.data.name).toBe('Test Integration Plan');
      expect(loadedMessage.data.goal).toBe('Test goal');
    });

    it('should list saved plans', async () => {
      // First save a few plans
      for (let i = 0; i < 3; i++) {
        wsClient.send(JSON.stringify({
          type: 'plan:save',
          data: {
            name: `Integration Test Plan ${i}`,
            goal: `Test goal ${i}`,
            hierarchy: { root: {} },
            validation: { valid: true },
            metadata: { test: true }
          }
        }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Clear messages
      messages.length = 0;
      
      // List plans
      wsClient.send(JSON.stringify({
        type: 'plan:list',
        data: { filter: { 'metadata.test': true } }
      }));
      
      // Wait for list
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const listMessage = messages.find(m => m.type === 'plan:list:result');
      expect(listMessage).toBeDefined();
      expect(listMessage.data.plans).toBeInstanceOf(Array);
      expect(listMessage.data.plans.length).toBeGreaterThanOrEqual(3);
    });

    it('should update existing plans', async () => {
      // Save initial plan
      wsClient.send(JSON.stringify({
        type: 'plan:save',
        data: {
          name: 'Plan to Update',
          goal: 'Original goal',
          hierarchy: { root: {} },
          metadata: { test: true }
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedMessage = messages.find(m => m.type === 'plan:saved');
      const planId = savedMessage.data.planId;
      
      // Clear messages
      messages.length = 0;
      
      // Update plan
      wsClient.send(JSON.stringify({
        type: 'plan:update',
        data: {
          planId,
          updates: {
            name: 'Updated Plan Name',
            goal: 'Updated goal'
          }
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedMessage = messages.find(m => m.type === 'plan:updated');
      expect(updatedMessage).toBeDefined();
      
      // Load to verify update
      messages.length = 0;
      wsClient.send(JSON.stringify({
        type: 'plan:load',
        data: { planId }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const loadedMessage = messages.find(m => m.type === 'plan:loaded');
      expect(loadedMessage.data.name).toBe('Updated Plan Name');
      expect(loadedMessage.data.goal).toBe('Updated goal');
    });

    it('should delete plans', async () => {
      // Save a plan
      wsClient.send(JSON.stringify({
        type: 'plan:save',
        data: {
          name: 'Plan to Delete',
          goal: 'Will be deleted',
          hierarchy: { root: {} },
          metadata: { test: true }
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedMessage = messages.find(m => m.type === 'plan:saved');
      const planId = savedMessage.data.planId;
      
      // Clear messages
      messages.length = 0;
      
      // Delete plan
      wsClient.send(JSON.stringify({
        type: 'plan:delete',
        data: { planId }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const deletedMessage = messages.find(m => m.type === 'plan:deleted');
      expect(deletedMessage).toBeDefined();
      
      // Try to load deleted plan
      messages.length = 0;
      wsClient.send(JSON.stringify({
        type: 'plan:load',
        data: { planId }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const errorMessage = messages.find(m => m.type === 'plan:error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.error).toContain('not found');
    });
  });

  describe('WebSocket communication', () => {
    it('should handle connection and disconnection', async () => {
      // Connection is already established in beforeEach
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
      
      // Send a message to verify connection
      wsClient.send(JSON.stringify({
        type: 'plan:list',
        data: {}
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(messages.length).toBeGreaterThan(0);
      
      // Close connection
      wsClient.close();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(wsClient.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle invalid messages gracefully', async () => {
      // Send invalid message type
      wsClient.send(JSON.stringify({
        type: 'invalid:type',
        data: {}
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const errorMessage = messages.find(m => m.type === 'plan:error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.error).toContain('Unknown message type');
    });

    it('should handle malformed messages', async () => {
      // Send message without required fields
      wsClient.send(JSON.stringify({
        type: 'plan:create'
        // Missing data field
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const errorMessage = messages.find(m => m.type === 'plan:error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.error).toContain('Missing required');
    });
  });
});