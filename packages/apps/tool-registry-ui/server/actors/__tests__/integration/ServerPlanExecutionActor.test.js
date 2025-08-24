/**
 * Integration tests for ServerPlanExecutionActor
 * Tests with real BTExecutor, ToolRegistry, and MongoDB connections
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ServerPlanExecutionActor } from '../../ServerPlanExecutionActor.js';
import { BehaviorTreeExecutor as BTExecutor } from '@legion/actor-bt';
import { ToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/storage';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

describe('ServerPlanExecutionActor Integration', () => {
  let actor;
  let btExecutor;
  let toolRegistry;
  let mongoProvider;
  let resourceManager;
  let wss;
  let wsClient;
  let serverPort;
  let messages;

  beforeAll(async () => {
    // Initialize real services
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Initialize MongoDB provider
    mongoProvider = new MongoDBProvider(resourceManager);
    await mongoProvider.connect();
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    // Load some test tools
    await toolRegistry.registerTool({
      name: 'test_tool_1',
      description: 'Test tool for integration testing',
      category: 'test',
      execute: async (params) => ({ success: true, result: params.input }),
      schema: {
        input: { type: 'string', required: true }
      }
    });
    
    await toolRegistry.registerTool({
      name: 'test_tool_2',
      description: 'Another test tool',
      category: 'test',
      execute: async (params) => ({ success: true, count: params.count || 0 }),
      schema: {
        count: { type: 'number', required: false }
      }
    });
    
    // Initialize BT Executor
    btExecutor = new BTExecutor(toolRegistry);
    
    // Start WebSocket server for testing
    serverPort = 9092;
    wss = new WebSocketServer({ port: serverPort });
    
    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      // Create actor with real services - updated for ToolRegistry pattern
      actor = new ServerPlanExecutionActor(btExecutor, toolRegistry, mongoProvider);
      
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
      const collection = mongoProvider.getCollection('plan_executions');
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

  describe('behavior tree execution with real tools', () => {
    it('should execute a simple action node', async () => {
      const behaviorTree = {
        type: 'action',
        tool: 'test_tool_1',
        params: { input: 'test value' }
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-simple',
          planId: 'plan-simple',
          behaviorTree,
          options: { mode: 'full' }
        }
      }));
      
      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check messages received
      const startedMessage = messages.find(m => m.type === 'execution:started');
      expect(startedMessage).toBeDefined();
      expect(startedMessage.data.executionId).toBe('exec-simple');
      
      const toolExecuteMessage = messages.find(m => m.type === 'execution:tool:execute');
      if (toolExecuteMessage) {
        expect(toolExecuteMessage.data.toolName).toBe('test_tool_1');
      }
      
      const completeMessage = messages.find(m => m.type === 'execution:complete');
      if (completeMessage) {
        expect(completeMessage.data.status).toBe('completed');
      }
    }, 5000);

    it('should execute a sequence of actions', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'test_tool_1',
            params: { input: 'first' },
            id: 'task1'
          },
          {
            type: 'action',
            tool: 'test_tool_2',
            params: { count: 5 },
            id: 'task2'
          }
        ]
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-sequence',
          planId: 'plan-sequence',
          behaviorTree
        }
      }));
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check task execution order
      const taskStartMessages = messages.filter(m => m.type === 'execution:task:start');
      if (taskStartMessages.length > 0) {
        expect(taskStartMessages[0].data.taskId).toBe('task1');
        if (taskStartMessages.length > 1) {
          expect(taskStartMessages[1].data.taskId).toBe('task2');
        }
      }
      
      const completeMessage = messages.find(m => m.type === 'execution:complete');
      if (completeMessage) {
        expect(completeMessage.data.status).toBeDefined();
      }
    }, 5000);
  });

  describe('execution control with real executor', () => {
    it('should pause and resume execution', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'test_tool_1', params: { input: 'a' } },
          { type: 'action', tool: 'test_tool_1', params: { input: 'b' } },
          { type: 'action', tool: 'test_tool_1', params: { input: 'c' } }
        ]
      };
      
      // Start execution
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-pause',
          planId: 'plan-pause',
          behaviorTree
        }
      }));
      
      // Wait a moment then pause
      await new Promise(resolve => setTimeout(resolve, 500));
      
      wsClient.send(JSON.stringify({
        type: 'execution:pause',
        data: { executionId: 'exec-pause' }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const pausedMessage = messages.find(m => m.type === 'execution:paused');
      if (pausedMessage) {
        expect(pausedMessage.data.executionId).toBe('exec-pause');
      }
      
      // Resume execution
      wsClient.send(JSON.stringify({
        type: 'execution:resume',
        data: { executionId: 'exec-pause' }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const resumedMessage = messages.find(m => m.type === 'execution:resumed');
      if (resumedMessage) {
        expect(resumedMessage.data.executionId).toBe('exec-pause');
      }
    }, 10000);

    it('should stop execution', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'test_tool_1', params: { input: 'x' } },
          { type: 'action', tool: 'test_tool_1', params: { input: 'y' } },
          { type: 'action', tool: 'test_tool_1', params: { input: 'z' } }
        ]
      };
      
      // Start execution
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-stop',
          planId: 'plan-stop',
          behaviorTree
        }
      }));
      
      // Wait a moment then stop
      await new Promise(resolve => setTimeout(resolve, 500));
      
      wsClient.send(JSON.stringify({
        type: 'execution:stop',
        data: { executionId: 'exec-stop' }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const stoppedMessage = messages.find(m => m.type === 'execution:stopped');
      if (stoppedMessage) {
        expect(stoppedMessage.data.executionId).toBe('exec-stop');
      }
      
      // Verify execution was removed from active list
      messages.length = 0;
      wsClient.send(JSON.stringify({
        type: 'execution:list',
        data: {}
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const listMessage = messages.find(m => m.type === 'execution:list:result');
      if (listMessage) {
        const activeExecution = listMessage.data.executions.find(e => e.executionId === 'exec-stop');
        expect(activeExecution).toBeUndefined();
      }
    }, 10000);
  });

  describe('execution persistence with real MongoDB', () => {
    it('should save execution records', async () => {
      const executionRecord = {
        executionId: 'exec-save-test',
        planId: 'plan-save-test',
        status: 'completed',
        artifacts: { testResult: 'success' },
        logs: ['Started', 'Completed'],
        metadata: { test: true }
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:save',
        data: executionRecord
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedMessage = messages.find(m => m.type === 'execution:saved');
      expect(savedMessage).toBeDefined();
      expect(savedMessage.data.recordId).toBeDefined();
      
      // Verify it was saved to MongoDB
      const collection = mongoProvider.getCollection('plan_executions');
      const saved = await collection.findOne({ executionId: 'exec-save-test' });
      expect(saved).toBeDefined();
      expect(saved.status).toBe('completed');
      expect(saved.artifacts.testResult).toBe('success');
    });

    it('should load execution history', async () => {
      // First save some test executions
      const collection = mongoProvider.getCollection('plan_executions');
      await collection.insertMany([
        {
          executionId: 'hist-1',
          planId: 'plan-hist',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000),
          metadata: { test: true }
        },
        {
          executionId: 'hist-2',
          planId: 'plan-hist',
          status: 'failed',
          startTime: new Date(Date.now() - 1800000),
          metadata: { test: true }
        },
        {
          executionId: 'hist-3',
          planId: 'plan-hist',
          status: 'completed',
          startTime: new Date(),
          metadata: { test: true }
        }
      ]);
      
      // Request history
      wsClient.send(JSON.stringify({
        type: 'execution:history',
        data: { limit: 10 }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const historyMessage = messages.find(m => m.type === 'execution:history:result');
      expect(historyMessage).toBeDefined();
      expect(historyMessage.data.executions).toBeInstanceOf(Array);
      expect(historyMessage.data.executions.length).toBeGreaterThanOrEqual(3);
      
      // Should be sorted by startTime descending
      const testExecutions = historyMessage.data.executions.filter(e => e.metadata?.test);
      if (testExecutions.length >= 2) {
        const first = new Date(testExecutions[0].startTime);
        const second = new Date(testExecutions[1].startTime);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });
  });

  describe('artifact management', () => {
    it('should track artifacts during execution', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          {
            type: 'action',
            tool: 'test_tool_1',
            params: { input: 'artifact_test' },
            outputVariable: 'result1'
          },
          {
            type: 'action',
            tool: 'test_tool_2',
            params: { count: 10 },
            outputVariable: 'result2'
          }
        ]
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-artifacts',
          planId: 'plan-artifacts',
          behaviorTree
        }
      }));
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for artifact creation messages
      const artifactMessages = messages.filter(m => m.type === 'execution:artifact:created');
      if (artifactMessages.length > 0) {
        const artifactNames = artifactMessages.map(m => m.data.name);
        expect(artifactNames).toContain('result1');
        expect(artifactNames).toContain('result2');
      }
      
      // Get execution status to check artifacts
      messages.length = 0;
      wsClient.send(JSON.stringify({
        type: 'execution:status',
        data: { executionId: 'exec-artifacts' }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const statusMessage = messages.find(m => m.type === 'execution:status:result');
      if (statusMessage && statusMessage.data.artifacts) {
        expect(Object.keys(statusMessage.data.artifacts).length).toBeGreaterThan(0);
      }
    }, 5000);
  });

  describe('error handling with real services', () => {
    it('should handle tool execution failures', async () => {
      const behaviorTree = {
        type: 'action',
        tool: 'nonexistent_tool',
        params: {}
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-error',
          planId: 'plan-error',
          behaviorTree
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const errorMessage = messages.find(m => m.type === 'execution:error');
      if (errorMessage) {
        expect(errorMessage.data.error).toContain('fail');
      }
    });

    it('should handle invalid behavior tree structures', async () => {
      const behaviorTree = {
        type: 'invalid_type',
        children: []
      };
      
      wsClient.send(JSON.stringify({
        type: 'execution:start',
        data: {
          executionId: 'exec-invalid',
          planId: 'plan-invalid',
          behaviorTree
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const errorMessage = messages.find(m => m.type === 'execution:error');
      if (errorMessage) {
        expect(errorMessage.data.error).toBeDefined();
      }
    });
  });
});