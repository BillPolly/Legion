/**
 * Integration tests for WebSocket event streaming
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Agent } from '../../src/Agent.js';
import { AgentWebSocketServer } from '../../src/websocket-server.js';
import { Module } from '@jsenvoy/module-loader';
import Tool from '@jsenvoy/module-loader/src/tool/Tool.js';
import WebSocket from 'ws';

// Mock Tool class for testing
class MockTool extends Tool {
  constructor(name) {
    super();
    this.name = name;
    this.description = `Mock tool: ${name}`;
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async invoke(toolCall) {
    return { success: true, data: { result: 'mock result' } };
  }
}

// Mock Module class for testing
class MockModule extends Module {
  constructor(name) {
    super();
    this.name = name;
    
    // Add test tools
    const tool = new MockTool(`${name}Tool`);
    this.registerTool(`${name}Tool`, tool);
  }

  async performTask(taskName, steps = 3) {
    this.emitInfo(`Starting task: ${taskName}`, { task: taskName, totalSteps: steps });
    
    for (let i = 1; i <= steps; i++) {
      this.emitProgress(`Step ${i} of ${steps}`, { 
        task: taskName,
        step: i, 
        totalSteps: steps,
        percentage: Math.round((i / steps) * 100)
      });
      
      // Small delay to simulate work
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.emitInfo(`Task completed: ${taskName}`, { 
      task: taskName,
      result: 'success',
      totalSteps: steps
    });
  }

  async performTaskWithError(taskName) {
    this.emitInfo(`Starting task: ${taskName}`, { task: taskName });
    
    this.emitProgress('Processing...', { task: taskName, step: 1, totalSteps: 2 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.emitError(`Task failed: ${taskName}`, { 
      task: taskName,
      errorCode: 'TASK_FAILED',
      details: 'Simulated error for testing'
    });
  }
}

// Helper function to create WebSocket client
function createWebSocketClient(port = 3001) {
  return new WebSocket(`ws://localhost:${port}`);
}

// Helper function to wait for WebSocket connection
function waitForConnection(ws) {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
}

// Helper function to send message and wait for response
function sendAndWaitForResponse(ws, message) {
  return new Promise((resolve, reject) => {
    const messageHandler = (data) => {
      ws.removeListener('message', messageHandler);
      try {
        const response = JSON.parse(data.toString());
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };
    
    ws.on('message', messageHandler);
    ws.send(JSON.stringify(message));
  });
}

// Helper function to collect events for a duration
function collectEvents(ws, duration = 1000) {
  return new Promise((resolve) => {
    const events = [];
    
    const messageHandler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'event') {
          events.push(message);
        }
      } catch (error) {
        // Ignore parse errors
      }
    };
    
    ws.on('message', messageHandler);
    
    setTimeout(() => {
      ws.removeListener('message', messageHandler);
      resolve(events);
    }, duration);
  });
}

describe('WebSocket Event Streaming Integration', () => {
  let agent;
  let server;
  let wsClient;
  const testPort = 3002; // Use different port to avoid conflicts

  beforeEach(async () => {
    // Create agent
    agent = new Agent({
      name: 'WebSocketTestAgent',
      bio: 'Test agent for WebSocket event streaming',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });

    // Create and start WebSocket server
    server = new AgentWebSocketServer(agent, { port: testPort });
    await server.start();
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Close client connection
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    
    // Stop server
    if (server) {
      await server.stop();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('WebSocket Server Setup', () => {
    test('should start WebSocket server and accept connections', async () => {
      wsClient = createWebSocketClient(testPort);
      await waitForConnection(wsClient);
      
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
    });

    test('should handle multiple client connections', async () => {
      const client1 = createWebSocketClient(testPort);
      const client2 = createWebSocketClient(testPort);
      
      await Promise.all([
        waitForConnection(client1),
        waitForConnection(client2)
      ]);
      
      expect(client1.readyState).toBe(WebSocket.OPEN);
      expect(client2.readyState).toBe(WebSocket.OPEN);
      
      client1.close();
      client2.close();
    });
  });

  describe('Event Subscription Management', () => {
    beforeEach(async () => {
      wsClient = createWebSocketClient(testPort);
      await waitForConnection(wsClient);
    });

    test('should subscribe to events', async () => {
      const response = await sendAndWaitForResponse(wsClient, {
        id: 'test-1',
        type: 'subscribe-events'
      });
      
      expect(response).toMatchObject({
        id: 'test-1',
        success: true,
        message: 'Successfully subscribed to events',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    test('should unsubscribe from events', async () => {
      // First subscribe
      await sendAndWaitForResponse(wsClient, {
        id: 'test-1',
        type: 'subscribe-events'
      });
      
      // Then unsubscribe
      const response = await sendAndWaitForResponse(wsClient, {
        id: 'test-2',
        type: 'unsubscribe-events'
      });
      
      expect(response).toMatchObject({
        id: 'test-2',
        success: true,
        message: 'Successfully unsubscribed from events',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    test('should handle multiple subscriptions from same client', async () => {
      const response1 = await sendAndWaitForResponse(wsClient, {
        id: 'test-1',
        type: 'subscribe-events'
      });
      
      const response2 = await sendAndWaitForResponse(wsClient, {
        id: 'test-2',
        type: 'subscribe-events'
      });
      
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
    });
  });

  describe('Event Broadcasting', () => {
    beforeEach(async () => {
      wsClient = createWebSocketClient(testPort);
      await waitForConnection(wsClient);
      
      // Subscribe to events
      await sendAndWaitForResponse(wsClient, {
        id: 'subscribe-1',
        type: 'subscribe-events'
      });
    });

    test('should broadcast module events to subscribed clients', async () => {
      const module = new MockModule('BroadcastModule');
      agent.registerModule(module);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 500);
      
      // Emit an event from the module
      module.emitInfo('Test broadcast message', { testData: 'broadcast-value' });
      
      const events = await eventsPromise;
      
      // Should receive 2 identical events (generic + specific have same structure)
      expect(events).toHaveLength(2);
      
      // Both events should have the same structure
      events.forEach(event => {
        expect(event).toMatchObject({
          type: 'event',
          event: {
            type: 'info',
            module: 'BroadcastModule',
            tool: null,
            message: 'Test broadcast message',
            data: { testData: 'broadcast-value' },
            agentId: 'WebSocketTestAgent',
            agentName: 'WebSocketTestAgent'
          },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        });
      });
    });

    test('should broadcast tool events to subscribed clients', async () => {
      const module = new MockModule('ToolModule');
      agent.registerModule(module);
      
      const tool = module.tools[0];
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 500);
      
      // Emit an event from the tool
      tool.emitProgress('Tool progress update', { progress: 50 });
      
      const events = await eventsPromise;
      
      // Should receive 2 identical events
      expect(events).toHaveLength(2);
      
      // Both events should have the same structure
      events.forEach(event => {
        expect(event.event).toMatchObject({
          type: 'progress',
          module: 'ToolModule',
          tool: 'ToolModuleTool',
          message: 'Tool progress update',
          data: { progress: 50 }
        });
      });
    });

    test('should broadcast different event types', async () => {
      const module = new MockModule('TypesModule');
      agent.registerModule(module);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 500);
      
      // Emit different types of events
      module.emitInfo('Info message');
      module.emitProgress('Progress message');
      module.emitWarning('Warning message');
      module.emitError('Error message');
      
      const events = await eventsPromise;
      
      // Each module event triggers both generic and specific event handlers
      // So we expect 8 events (2 for each of the 4 event types)
      expect(events).toHaveLength(8);
      
      // Check that we have the right event types (each appears twice)
      const eventTypes = events.map(e => e.event.type);
      expect(eventTypes.filter(t => t === 'info')).toHaveLength(2);
      expect(eventTypes.filter(t => t === 'progress')).toHaveLength(2);
      expect(eventTypes.filter(t => t === 'warning')).toHaveLength(2);
      expect(eventTypes.filter(t => t === 'error')).toHaveLength(2);
      
      // Check that we have at least one of each event type
      const uniqueTypes = new Set(eventTypes);
      expect(uniqueTypes).toContain('info');
      expect(uniqueTypes).toContain('progress');
      expect(uniqueTypes).toContain('warning');
      expect(uniqueTypes).toContain('error');
    });

    test('should not broadcast to unsubscribed clients', async () => {
      const module = new MockModule('UnsubscribedModule');
      agent.registerModule(module);
      
      // Unsubscribe from events
      await sendAndWaitForResponse(wsClient, {
        id: 'unsubscribe-1',
        type: 'unsubscribe-events'
      });
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 500);
      
      // Emit an event from the module
      module.emitInfo('Should not be received');
      
      const events = await eventsPromise;
      
      expect(events).toHaveLength(0);
    });
  });

  describe('Multiple Client Event Streaming', () => {
    let client1, client2;

    beforeEach(async () => {
      client1 = createWebSocketClient(testPort);
      client2 = createWebSocketClient(testPort);
      
      await Promise.all([
        waitForConnection(client1),
        waitForConnection(client2)
      ]);
      
      // Subscribe both clients to events
      await Promise.all([
        sendAndWaitForResponse(client1, { id: 'sub-1', type: 'subscribe-events' }),
        sendAndWaitForResponse(client2, { id: 'sub-2', type: 'subscribe-events' })
      ]);
    });

    afterEach(() => {
      if (client1) client1.close();
      if (client2) client2.close();
    });

    test('should broadcast events to all subscribed clients', async () => {
      const module = new MockModule('MultiClientModule');
      agent.registerModule(module);
      
      // Start collecting events from both clients
      const events1Promise = collectEvents(client1, 500);
      const events2Promise = collectEvents(client2, 500);
      
      // Emit an event from the module
      module.emitInfo('Multi-client broadcast', { clientTest: true });
      
      const [events1, events2] = await Promise.all([events1Promise, events2Promise]);
      
      // Each client should receive 2 events (generic + specific)
      expect(events1).toHaveLength(2);
      expect(events2).toHaveLength(2);
      
      // Both clients should receive the same events
      expect(events1[0].event.message).toBe('Multi-client broadcast');
      expect(events2[0].event.message).toBe('Multi-client broadcast');
      expect(events1[1].event.message).toBe('Multi-client broadcast');
      expect(events2[1].event.message).toBe('Multi-client broadcast');
    });

    test('should handle selective subscription', async () => {
      const module = new MockModule('SelectiveModule');
      agent.registerModule(module);
      
      // Unsubscribe client2
      await sendAndWaitForResponse(client2, {
        id: 'unsub-2',
        type: 'unsubscribe-events'
      });
      
      // Start collecting events
      const events1Promise = collectEvents(client1, 500);
      const events2Promise = collectEvents(client2, 500);
      
      // Emit an event
      module.emitInfo('Selective broadcast');
      
      const [events1, events2] = await Promise.all([events1Promise, events2Promise]);
      
      // Client1 should receive 2 events (generic + specific)
      expect(events1).toHaveLength(2);
      // Client2 should receive 0 events (unsubscribed)
      expect(events2).toHaveLength(0);
    });
  });

  describe('Complex Event Scenarios', () => {
    beforeEach(async () => {
      wsClient = createWebSocketClient(testPort);
      await waitForConnection(wsClient);
      
      await sendAndWaitForResponse(wsClient, {
        id: 'subscribe-complex',
        type: 'subscribe-events'
      });
    });

    test('should handle workflow with multiple events', async () => {
      const module = new MockModule('WorkflowModule');
      agent.registerModule(module);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 1000);
      
      // Perform a task with multiple events
      await module.performTask('complex-workflow', 3);
      
      const events = await eventsPromise;
      
      expect(events.length).toBeGreaterThanOrEqual(4); // 1 start + 3 progress + 1 complete
      
      // Check event sequence
      const eventMessages = events.map(e => e.event.message);
      expect(eventMessages[0]).toBe('Starting task: complex-workflow');
      expect(eventMessages[eventMessages.length - 1]).toBe('Task completed: complex-workflow');
    });

    test('should handle error scenarios', async () => {
      const module = new MockModule('ErrorModule');
      agent.registerModule(module);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 1000);
      
      // Perform a task that will fail
      await module.performTaskWithError('error-task');
      
      const events = await eventsPromise;
      
      expect(events.length).toBeGreaterThanOrEqual(3); // 1 start + 1 progress + 1 error
      
      // Check for error event
      const errorEvent = events.find(e => e.event.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.event.message).toBe('Task failed: error-task');
    });

    test('should handle concurrent workflows from multiple modules', async () => {
      const module1 = new MockModule('ConcurrentModule1');
      const module2 = new MockModule('ConcurrentModule2');
      
      agent.registerModules([module1, module2]);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 1500);
      
      // Run concurrent workflows
      await Promise.all([
        module1.performTask('concurrent-task-1', 2),
        module2.performTask('concurrent-task-2', 2)
      ]);
      
      const events = await eventsPromise;
      
      expect(events.length).toBeGreaterThanOrEqual(6); // 3 events per module
      
      // Check that events from both modules are present
      const module1Events = events.filter(e => e.event.module === 'ConcurrentModule1');
      const module2Events = events.filter(e => e.event.module === 'ConcurrentModule2');
      
      expect(module1Events.length).toBeGreaterThanOrEqual(3);
      expect(module2Events.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      wsClient = createWebSocketClient(testPort);
      await waitForConnection(wsClient);
      
      await sendAndWaitForResponse(wsClient, {
        id: 'subscribe-error',
        type: 'subscribe-events'
      });
    });

    test('should handle client disconnect during event streaming', async () => {
      const module = new MockModule('DisconnectModule');
      agent.registerModule(module);
      
      // Close client connection
      wsClient.close();
      
      // Wait for disconnect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Emit event (should not cause errors)
      expect(() => {
        module.emitInfo('Event after disconnect');
      }).not.toThrow();
    });

    test('should handle malformed subscription messages', async () => {
      // Send malformed message
      const response = await sendAndWaitForResponse(wsClient, {
        id: 'malformed-1',
        type: 'invalid-subscription-type'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('should handle high-frequency event emission', async () => {
      const module = new MockModule('HighFrequencyModule');
      agent.registerModule(module);
      
      // Start collecting events
      const eventsPromise = collectEvents(wsClient, 1000);
      
      // Emit many events rapidly
      for (let i = 0; i < 100; i++) {
        module.emitInfo(`High frequency event ${i}`, { index: i });
      }
      
      const events = await eventsPromise;
      
      // Each event triggers both generic and specific handlers, so 200 events total
      expect(events.length).toBe(200);
      
      // All events should be info events
      events.forEach(event => {
        expect(event.event.type).toBe('info');
      });
      
      // Check that events are properly ordered (every 2nd event should be sequential)
      for (let i = 0; i < 100; i++) {
        const eventIndex = i * 2; // Events come in pairs
        expect(events[eventIndex].event.message).toBe(`High frequency event ${i}`);
        expect(events[eventIndex].event.data.index).toBe(i);
        expect(events[eventIndex + 1].event.message).toBe(`High frequency event ${i}`);
        expect(events[eventIndex + 1].event.data.index).toBe(i);
      }
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle many concurrent connections', async () => {
      const clients = [];
      const connectionPromises = [];
      
      // Create many clients
      for (let i = 0; i < 10; i++) {
        const client = createWebSocketClient(testPort);
        clients.push(client);
        connectionPromises.push(waitForConnection(client));
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // Subscribe all clients
      const subscriptionPromises = clients.map((client, index) => 
        sendAndWaitForResponse(client, {
          id: `sub-${index}`,
          type: 'subscribe-events'
        })
      );
      
      await Promise.all(subscriptionPromises);
      
      // Emit an event
      const module = new MockModule('ManyClientsModule');
      agent.registerModule(module);
      
      module.emitInfo('Broadcast to many clients');
      
      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean up
      clients.forEach(client => client.close());
    });

    test('should clean up event listeners on server stop', async () => {
      const module = new MockModule('CleanupModule');
      agent.registerModule(module);
      
      // Stop server
      await server.stop();
      
      // Emit event (should not cause errors)
      expect(() => {
        module.emitInfo('Event after server stop');
      }).not.toThrow();
    });
  });
});