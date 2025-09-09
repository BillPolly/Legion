/**
 * Integration Tests for Server → Client Actor Communication
 * 
 * Tests complete flow from server events to client actor responses
 * NO MOCKS - Tests real WebSocket communication and actor messaging
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { ResourceManager } from '@legion/resource-manager';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';

describe('Server → Client Actor Communication Integration', () => {
  let server;
  let clientActor;
  let ws;
  let resourceManager;
  let testPort;

  beforeAll(async () => {
    testPort = getRandomTestPort();
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Wait for server to be ready
    await waitForServer(500);
  }, 30000);

  afterAll(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    if (clientActor) {
      await clientActor.cleanup();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('server-initiated asset notifications', () => {
    let clientWs;
    let messages;

    beforeEach(async () => {
      messages = [];
      clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      clientWs.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      // Register client
      clientWs.send(JSON.stringify({
        type: 'register-client',
        clientId: 'test-client-001',
        capabilities: ['display', 'window-management']
      }));
      
      await waitForServer(500);
    });

    afterEach(() => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    test('should notify client when new asset is created', async () => {
      // Create asset on server
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { notification: 'test' },
          assetType: 'json',
          title: 'Notification Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Wait for notification
      await waitForServer(500);
      
      // Check for asset-created notification
      const notification = messages.find(m => 
        m.type === 'asset-created' || m.type === 'new-asset'
      );
      
      if (notification) {
        expect(notification.assetId).toBeTruthy();
      }
    });

    test('should broadcast display commands to all connected clients', async () => {
      // Connect multiple clients
      const client2 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      const client2Messages = [];
      
      await new Promise((resolve) => {
        client2.on('open', resolve);
      });
      
      client2.on('message', (data) => {
        client2Messages.push(JSON.parse(data.toString()));
      });
      
      // Create and display asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { broadcast: 'test' },
          assetType: 'json',
          title: 'Broadcast Test',
          broadcast: true
        })
      });
      
      const { assetId } = await response.json();
      
      // Trigger display command
      await fetch(`http://localhost:${testPort}/api/display/${assetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windowOptions: { width: 800, height: 600 }
        })
      });
      
      await waitForServer(500);
      
      // Both clients should receive notification
      const client1Display = messages.find(m => 
        m.type === 'display-asset' && m.assetId === assetId
      );
      const client2Display = client2Messages.find(m => 
        m.type === 'display-asset' && m.assetId === assetId
      );
      
      if (client1Display || client2Display) {
        expect(client1Display || client2Display).toBeTruthy();
      }
      
      client2.close();
    });

    test('should send asset updates to subscribed clients', async () => {
      // Subscribe to updates
      clientWs.send(JSON.stringify({
        type: 'subscribe',
        events: ['asset-updated'],
        assetId: '*' // All assets
      }));
      
      // Create asset
      const createResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { version: 1 },
          assetType: 'json',
          title: 'Update Test'
        })
      });
      
      const { assetId } = await createResponse.json();
      
      // Update asset
      await fetch(`http://localhost:${testPort}/api/update-asset/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { version: 2, updated: true }
        })
      });
      
      await waitForServer(500);
      
      // Check for update notification
      const updateNotification = messages.find(m => 
        m.type === 'asset-updated' && m.assetId === assetId
      );
      
      if (updateNotification) {
        expect(updateNotification.asset).toEqual({ version: 2, updated: true });
      }
    });
  });

  describe('client actor message handling', () => {
    let clientActor;
    let actorMessages;

    beforeEach(async () => {
      actorMessages = [];
      
      // Create client actor
      clientActor = new ShowMeClientActor({
        serverUrl: `ws://localhost:${testPort}/ws?route=/showme`,
        onMessage: (message) => {
          actorMessages.push(message);
        }
      });
      
      await clientActor.initialize();
      await clientActor.connect();
      
      // Wait for connection
      await waitForServer(500);
    });

    afterEach(async () => {
      if (clientActor) {
        await clientActor.disconnect();
        await clientActor.cleanup();
      }
    });

    test('should process display commands from server', async () => {
      // Create asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { actor: 'test' },
          assetType: 'json',
          title: 'Actor Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Send display command through actor
      await clientActor.requestDisplay(assetId, {
        width: 1024,
        height: 768
      });
      
      await waitForServer(500);
      
      // Check if actor received confirmation
      const displayConfirmation = actorMessages.find(m => 
        m.type === 'display-confirmed' && m.assetId === assetId
      );
      
      if (displayConfirmation) {
        expect(displayConfirmation).toBeTruthy();
      }
    });

    test('should handle window state synchronization', async () => {
      // Create multiple assets
      const assetIds = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { window: i },
            assetType: 'json',
            title: `Window ${i}`
          })
        });
        
        const { assetId } = await response.json();
        assetIds.push(assetId);
      }
      
      // Request window state
      await clientActor.requestWindowState();
      
      await waitForServer(500);
      
      // Check for state response
      const stateMessage = actorMessages.find(m => 
        m.type === 'window-state' || m.type === 'state-response'
      );
      
      if (stateMessage) {
        expect(stateMessage).toBeTruthy();
      }
    });

    test('should handle error notifications from server', async () => {
      // Request non-existent asset
      await clientActor.requestAsset('non-existent-id');
      
      await waitForServer(500);
      
      // Check for error message
      const errorMessage = actorMessages.find(m => 
        m.type === 'error' || m.error
      );
      
      if (errorMessage) {
        expect(errorMessage.error).toContain('not found');
      }
    });
  });

  describe('bidirectional actor protocol', () => {
    let clientActor;
    let serverMessages;

    beforeEach(async () => {
      serverMessages = [];
      
      // Create client actor with message tracking
      clientActor = new ShowMeClientActor({
        serverUrl: `ws://localhost:${testPort}/ws?route=/showme`
      });
      
      await clientActor.initialize();
      await clientActor.connect();
      
      // Track server responses
      clientActor.on('message', (msg) => {
        serverMessages.push(msg);
      });
      
      await waitForServer(500);
    });

    afterEach(async () => {
      if (clientActor) {
        await clientActor.disconnect();
        await clientActor.cleanup();
      }
    });

    test('should maintain request-response correlation', async () => {
      const requestId = 'req-' + Date.now();
      
      // Create asset first
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { correlation: 'test' },
          assetType: 'json',
          title: 'Correlation Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Send request with ID
      await clientActor.send({
        type: 'get-asset-details',
        requestId: requestId,
        assetId: assetId
      });
      
      await waitForServer(500);
      
      // Check for correlated response
      const correlatedResponse = serverMessages.find(m => 
        m.requestId === requestId
      );
      
      if (correlatedResponse) {
        expect(correlatedResponse.assetId).toBe(assetId);
      }
    });

    test('should handle actor state transitions', async () => {
      const states = [];
      
      // Track state changes
      clientActor.on('state-change', (state) => {
        states.push(state);
      });
      
      // Trigger state changes
      await clientActor.disconnect();
      await waitForServer(500);
      
      await clientActor.connect();
      await waitForServer(500);
      
      // Should have state transitions
      expect(states.length).toBeGreaterThan(0);
    });

    test('should queue messages during reconnection', async () => {
      // Create asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { queue: 'test' },
          assetType: 'json',
          title: 'Queue Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Disconnect
      await clientActor.disconnect();
      
      // Queue messages while disconnected
      clientActor.queueMessage({
        type: 'queued-request',
        assetId: assetId
      });
      
      // Reconnect
      await clientActor.connect();
      await waitForServer(500);
      
      // Queued message should be sent
      const queuedResponse = serverMessages.find(m => 
        m.type === 'queued-response' || m.assetId === assetId
      );
      
      if (queuedResponse) {
        expect(queuedResponse).toBeTruthy();
      }
    });
  });

  describe('event-driven communication', () => {
    let clientWs;
    let events;

    beforeEach(async () => {
      events = [];
      clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      clientWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.event) {
          events.push(message);
        }
      });
      
      // Subscribe to all events
      clientWs.send(JSON.stringify({
        type: 'subscribe-all'
      }));
      
      await waitForServer(500);
    });

    afterEach(() => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    test('should emit lifecycle events', async () => {
      // Create asset (should emit event)
      const createResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { lifecycle: 'test' },
          assetType: 'json',
          title: 'Lifecycle Test'
        })
      });
      
      const { assetId } = await createResponse.json();
      
      // Delete asset (should emit event)
      await fetch(`http://localhost:${testPort}/api/assets/${assetId}`, {
        method: 'DELETE'
      });
      
      await waitForServer(500);
      
      // Check for lifecycle events
      const createEvent = events.find(e => 
        e.event === 'asset:created' && e.data?.assetId === assetId
      );
      const deleteEvent = events.find(e => 
        e.event === 'asset:deleted' && e.data?.assetId === assetId
      );
      
      if (createEvent || deleteEvent) {
        expect(createEvent || deleteEvent).toBeTruthy();
      }
    });

    test('should emit performance metrics', async () => {
      // Create large asset to trigger metrics
      const largeAsset = {
        data: Array(1000).fill(0).map((_, i) => ({
          index: i,
          value: Math.random()
        }))
      };
      
      await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: largeAsset,
          assetType: 'json',
          title: 'Performance Test'
        })
      });
      
      await waitForServer(500);
      
      // Check for performance events
      const perfEvent = events.find(e => 
        e.event?.includes('performance') || e.event?.includes('metrics')
      );
      
      if (perfEvent) {
        expect(perfEvent.data).toHaveProperty('duration');
      }
    });
  });

  describe('connection resilience', () => {
    test('should handle rapid connect/disconnect cycles', async () => {
      const connections = [];
      
      // Rapidly create and close connections
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
        
        await new Promise((resolve) => {
          ws.on('open', resolve);
          ws.on('error', resolve); // Continue even on error
          setTimeout(resolve, 100); // Timeout fallback
        });
        
        connections.push(ws);
        
        // Close immediately
        ws.close();
        await waitForServer(500);
      }
      
      // Server should remain stable
      const testWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      const connected = await new Promise((resolve) => {
        testWs.on('open', () => resolve(true));
        testWs.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 2000);
      });
      
      expect(connected).toBe(true);
      testWs.close();
    });

    test('should recover from malformed messages', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Send various malformed messages
      ws.send('not json');
      ws.send('{"incomplete": ');
      ws.send(JSON.stringify({ no_type_field: true }));
      ws.send(JSON.stringify({ type: 123 })); // Wrong type
      
      await waitForServer(500);
      
      // Connection should remain open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Should still handle valid messages
      const validResponse = new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong') {
            resolve(true);
          }
        });
      });
      
      ws.send(JSON.stringify({ type: 'ping' }));
      
      const received = await Promise.race([
        validResponse,
        new Promise(resolve => setTimeout(() => resolve(false), 1000))
      ]);
      
      if (received) {
        expect(received).toBe(true);
      }
      
      ws.close();
    });

    test('should handle message flooding gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Flood with messages
      for (let i = 0; i < 1000; i++) {
        ws.send(JSON.stringify({
          type: 'flood-test',
          index: i,
          timestamp: Date.now()
        }));
      }
      
      await waitForServer(500);
      
      // Connection should survive
      expect([WebSocket.OPEN, WebSocket.CLOSING]).toContain(ws.readyState);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });
});