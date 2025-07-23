/**
 * Event system integration tests for WebDebugServer
 */

import { WebDebugServer } from '../../WebDebugServer.js';
import { mockResourceManager, mockMCPServer } from '../fixtures/mockData.js';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';
import { WebSocket } from 'ws';

describe('WebDebugServer Event System Integration', () => {
  let webDebugServer;
  let mockRM;

  beforeAll(async () => {
    // Get shared server instance to reduce console noise
    webDebugServer = await getSharedWebDebugServer();
  });

  beforeEach(async () => {
    mockRM = {
      ...mockResourceManager,
      get: mockResourceManager.get
    };
  });

  afterEach(async () => {
    // Small delay to let connections clean up
    await waitForAsync(50);
  });

  describe('MonitoringSystem event forwarding', () => {
    test('should setup event listeners for MonitoringSystem events', () => {
      const monitoringSystem = mockMCPServer.monitoringSystem;
      
      // Should have registered listeners for forwarded events
      expect(monitoringSystem.on.calls.length).toBeGreaterThan(0);
      
      // Check that expected events are being listened to
      const eventTypes = monitoringSystem.on.calls.map(call => call[0]);
      expect(eventTypes).toContain('metric-recorded');
      expect(eventTypes).toContain('alert-triggered');
      expect(eventTypes).toContain('anomaly-detected');
      expect(eventTypes).toContain('monitoring-stopped');
      expect(eventTypes).toContain('configuration-applied');
    });

    test('should forward MonitoringSystem events to WebSocket clients', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      // Wait for connection
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      // Simulate MonitoringSystem event
      webDebugServer._broadcastEvent('metric-recorded', {
        metric: 'cpu_usage',
        value: 85.5,
        timestamp: new Date().toISOString()
      });

      // Wait for event to be received
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventMessage = receivedMessages.find(msg => msg.type === 'event');
      expect(eventMessage).toBeDefined();
      expect(eventMessage.data.eventType).toBe('metric-recorded');
      expect(eventMessage.data.payload.metric).toBe('cpu_usage');
      expect(eventMessage.data.payload.value).toBe(85.5);

      ws.close();
    });

    test('should handle monitoring system events when no clients connected', () => {
      // Should not throw error when broadcasting events without clients
      expect(() => {
        webDebugServer._broadcastEvent('test-event', { test: 'data' });
      }).not.toThrow();
    });
  });

  describe('event buffering and client broadcasting', () => {
    test('should buffer events up to maxEventBuffer limit', () => {
      const maxBuffer = webDebugServer.maxEventBuffer;
      
      // Add events beyond buffer limit
      for (let i = 0; i < maxBuffer + 10; i++) {
        webDebugServer._broadcastEvent('test-event', { index: i });
      }
      
      expect(webDebugServer.eventBuffer.length).toBe(maxBuffer);
      
      // Should have the most recent events
      const lastEvent = webDebugServer.eventBuffer[webDebugServer.eventBuffer.length - 1];
      expect(lastEvent.data.payload.index).toBe(maxBuffer + 9);
    });

    test('should send buffered events to new clients', async () => {
      // Add some events to buffer
      webDebugServer._broadcastEvent('test-event-1', { data: 'first' });
      webDebugServer._broadcastEvent('test-event-2', { data: 'second' });
      
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      // Wait for connection and messages
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive welcome message + buffered events
      expect(receivedMessages.length).toBeGreaterThanOrEqual(3);
      
      const welcomeMsg = receivedMessages.find(msg => msg.type === 'welcome');
      expect(welcomeMsg).toBeDefined();
      
      const event1 = receivedMessages.find(msg => 
        msg.type === 'event' && msg.data.eventType === 'test-event-1'
      );
      expect(event1).toBeDefined();
      expect(event1.data.payload.data).toBe('first');
      
      const event2 = receivedMessages.find(msg => 
        msg.type === 'event' && msg.data.eventType === 'test-event-2'
      );
      expect(event2).toBeDefined();
      expect(event2.data.payload.data).toBe('second');

      ws.close();
    });

    test('should broadcast events to all connected clients', async () => {
      const ws1 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      const messages1 = [];
      const messages2 = [];
      
      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Wait for connections
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      // Clear initial messages
      messages1.length = 0;
      messages2.length = 0;

      // Broadcast an event
      webDebugServer._broadcastEvent('broadcast-test', { message: 'hello' });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Both clients should receive the event
      const event1 = messages1.find(msg => msg.type === 'event');
      const event2 = messages2.find(msg => msg.type === 'event');
      
      expect(event1).toBeDefined();
      expect(event2).toBeDefined();
      expect(event1.data.eventType).toBe('broadcast-test');
      expect(event2.data.eventType).toBe('broadcast-test');
      expect(event1.data.payload.message).toBe('hello');
      expect(event2.data.payload.message).toBe('hello');

      ws1.close();
      ws2.close();
    });
  });

  describe('WebSocket message routing', () => {
    test('should handle unknown message types gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Send unknown message type
      ws.send(JSON.stringify({
        type: 'unknown-message-type',
        data: { test: 'data' }
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorMsg = receivedMessages.find(msg => msg.type === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.data.message).toContain('Unknown message type');

      ws.close();
    });

    test('should handle malformed JSON messages', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Send malformed JSON
      ws.send('{ invalid json }');

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorMsg = receivedMessages.find(msg => msg.type === 'error');
      expect(errorMsg).toBeDefined();

      ws.close();
    });

    test('should handle get-server-info request', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Clear welcome message
      receivedMessages.length = 0;

      ws.send(JSON.stringify({
        type: 'get-server-info'
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const serverInfoMsg = receivedMessages.find(msg => msg.type === 'server-info');
      expect(serverInfoMsg).toBeDefined();
      expect(serverInfoMsg.data.serverId).toBe(webDebugServer.serverId);
      expect(serverInfoMsg.data.status).toBe('running');
      expect(serverInfoMsg.data.port).toBe(webDebugServer.port);

      ws.close();
    });

    test('should handle get-tool-stats request', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Clear welcome message
      receivedMessages.length = 0;

      ws.send(JSON.stringify({
        type: 'get-tool-stats'
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const toolStatsMsg = receivedMessages.find(msg => msg.type === 'tool-stats');
      expect(toolStatsMsg).toBeDefined();
      expect(toolStatsMsg.data.total).toBe(5);
      expect(toolStatsMsg.data.context).toBe(3);
      expect(toolStatsMsg.data.modules).toBe(2);

      ws.close();
    });
  });

  describe('client connection and disconnection handling', () => {
    test('should track connected clients', async () => {
      expect(webDebugServer.clients.size).toBe(0);
      
      const ws1 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);
      
      expect(webDebugServer.clients.size).toBe(2);
      
      ws1.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(webDebugServer.clients.size).toBe(1);
      
      ws2.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(webDebugServer.clients.size).toBe(0);
    });

    test('should remove clients on connection error', async () => {
      const ws = new WebSocket(`ws://localhost:${webDebugServer.port}/ws`);
      
      await new Promise(resolve => ws.on('open', resolve));
      expect(webDebugServer.clients.size).toBe(1);
      
      // Force an error
      ws.terminate();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(webDebugServer.clients.size).toBe(0);
    });
  });
});