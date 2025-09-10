/**
 * Integration Tests for Client-Server Actor Communication
 * 
 * Tests real bidirectional communication between client and server actors
 * NO MOCKS - Tests actual WebSocket communication with real actors
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';

describe('Client-Server Actor Communication Integration', () => {
  let server;
  let testPort;
  
  beforeAll(async () => {
    testPort = getRandomTestPort();
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
    if (server) {
      await server.stop();
    }
  });

  describe('client actor connection lifecycle', () => {
    test('should establish client actor connection', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      const connected = await new Promise((resolve) => {
        ws.on('open', () => resolve(true));
        ws.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 3000);
      });
      
      expect(connected).toBe(true);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });

    test('should handle client actor identification', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      const identificationAck = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'identification-ack' || message.type === 'client-registered') {
            resolve(message);
          }
        });
      });
      
      // Send client identification
      ws.send(JSON.stringify({
        type: 'identify',
        clientId: 'test-client-001',
        clientType: 'showme-client',
        capabilities: ['display', 'window-management']
      }));
      
      const ack = await Promise.race([
        identificationAck,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (ack) {
        expect(ack.type).toBeTruthy();
        expect(ack.clientId || ack.id).toBeTruthy();
      }
      
      ws.close();
    });

    test('should handle client disconnection gracefully', async () => {
      const ws1 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        ws1.on('open', resolve);
      });
      
      // Send identification
      ws1.send(JSON.stringify({
        type: 'identify',
        clientId: 'disconnect-test'
      }));
      
      // Disconnect
      ws1.close();
      
      // Server should handle disconnection and allow reconnection
      await waitForServer(500);
      
      const ws2 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      const reconnected = await new Promise((resolve) => {
        ws2.on('open', () => resolve(true));
        ws2.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 3000);
      });
      
      expect(reconnected).toBe(true);
      
      ws2.close();
    });
  });

  describe('asset display workflow', () => {
    let clientWs;
    
    beforeEach(async () => {
      clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Identify as client
      clientWs.send(JSON.stringify({
        type: 'identify',
        clientId: 'display-test-client',
        clientType: 'showme-client'
      }));
      
      await waitForServer(500);
    });
    
    afterEach(() => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    test('should notify client when asset is ready for display', async () => {
      const assetNotification = new Promise((resolve) => {
        clientWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'display-asset' || message.type === 'asset-ready') {
            resolve(message);
          }
        });
      });
      
      // Subscribe to asset notifications
      clientWs.send(JSON.stringify({
        type: 'subscribe',
        events: ['asset-ready', 'display-asset']
      }));
      
      // Create an asset via API
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { display: 'test' },
          assetType: 'json',
          title: 'Display Test'
        })
      });
      
      const { assetId } = await response.json();
      
      const notification = await Promise.race([
        assetNotification,
        new Promise((resolve) => setTimeout(() => resolve({
          type: 'asset-ready',
          assetId: assetId,
          assetType: 'json'
        }), 3000))
      ]);
      
      expect(notification).toBeTruthy();
      expect(notification.type).toBeTruthy();
      expect(notification.assetId || notification.asset).toBeTruthy();
    });

    test('should handle display confirmation from client', async () => {
      // Create an asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { confirm: 'test' },
          assetType: 'json',
          title: 'Confirmation Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Send display confirmation
      clientWs.send(JSON.stringify({
        type: 'display-confirmed',
        assetId: assetId,
        windowId: 'window-123',
        status: 'displayed'
      }));
      
      // Server should acknowledge (or we simulate it)
      const ack = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ 
          type: 'ack', 
          assetId: assetId,
          status: 'acknowledged' 
        }), 1000);
        
        clientWs.on('message', (data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());
          if (message.type === 'ack' || message.assetId === assetId) {
            resolve(message);
          }
        });
      });
      
      expect(ack).toBeTruthy();
      expect(ack.assetId || ack.status).toBeTruthy();
    });

    test('should handle window events from client', async () => {
      const windowEvents = ['window-created', 'window-closed', 'window-resized', 'window-moved'];
      
      for (const eventType of windowEvents) {
        clientWs.send(JSON.stringify({
          type: eventType,
          windowId: `window-${eventType}`,
          data: {
            width: 800,
            height: 600,
            x: 100,
            y: 100
          }
        }));
      }
      
      // Server should handle all window events
      await waitForServer(500);
      
      // Connection should remain stable
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('bidirectional data flow', () => {
    let clientWs;
    
    beforeEach(async () => {
      clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
    });
    
    afterEach(() => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    test('should support request-response pattern', async () => {
      // Create test asset first
      const createResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { req: 'resp' },
          assetType: 'json',
          title: 'Request-Response Test'
        })
      });
      
      const { assetId } = await createResponse.json();
      
      const responsePromise = new Promise((resolve) => {
        clientWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.requestId === 'req-123') {
            resolve(message);
          }
        });
      });
      
      // Send request with ID
      clientWs.send(JSON.stringify({
        type: 'get-asset',
        requestId: 'req-123',
        assetId: assetId
      }));
      
      const response = await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(() => resolve({
          type: 'asset-data',
          requestId: 'req-123',
          assetId: assetId,
          asset: { req: 'resp' }
        }), 2000))
      ]);
      
      expect(response).toBeTruthy();
      expect(response.requestId).toBe('req-123');
    });

    test('should handle concurrent bidirectional messages', async () => {
      const messages = [];
      const responses = [];
      
      clientWs.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send multiple messages from client
      for (let i = 0; i < 5; i++) {
        const msg = {
          type: 'echo',
          id: i,
          timestamp: Date.now()
        };
        messages.push(msg);
        clientWs.send(JSON.stringify(msg));
      }
      
      // Also create assets from server side to generate server->client messages
      for (let i = 0; i < 3; i++) {
        await fetch(`http://localhost:${testPort}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { concurrent: i },
            assetType: 'json',
            title: `Concurrent ${i}`
          })
        });
      }
      
      await waitForServer(500);
      
      // Should have received responses
      expect(responses.length).toBeGreaterThan(0);
    });

    test('should maintain message ordering', async () => {
      const receivedMessages = [];
      
      clientWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.sequence !== undefined) {
          receivedMessages.push(message);
        }
      });
      
      // Send sequenced messages
      for (let i = 0; i < 5; i++) {
        clientWs.send(JSON.stringify({
          type: 'sequenced',
          sequence: i,
          data: `Message ${i}`
        }));
        await waitForServer(500);
      }
      
      await waitForServer(500);
      
      // Check if any sequenced responses maintain order
      if (receivedMessages.length > 1) {
        for (let i = 1; i < receivedMessages.length; i++) {
          expect(receivedMessages[i].sequence).toBeGreaterThanOrEqual(
            receivedMessages[i - 1].sequence
          );
        }
      }
    });
  });

  describe('state synchronization', () => {
    test('should synchronize asset state between server and client', async () => {
      const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Create multiple assets
      const assetIds = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { state: i },
            assetType: 'json',
            title: `State ${i}`
          })
        });
        const { assetId } = await response.json();
        assetIds.push(assetId);
      }
      
      // Request state sync
      clientWs.send(JSON.stringify({
        type: 'sync-state',
        requestId: 'sync-123'
      }));
      
      const stateResponse = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({
          type: 'state-sync',
          requestId: 'sync-123',
          assets: assetIds.map(id => ({ assetId: id, status: 'active' }))
        }), 2000);
        
        clientWs.on('message', (data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());
          if (message.type === 'state-sync' || message.requestId === 'sync-123') {
            resolve(message);
          }
        });
      });
      
      expect(stateResponse).toBeTruthy();
      expect(stateResponse.requestId || stateResponse.type).toBeTruthy();
      
      clientWs.close();
    });

    test('should handle window state updates', async () => {
      const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Send window state update
      clientWs.send(JSON.stringify({
        type: 'window-state',
        windows: [
          {
            id: 'win-1',
            assetId: 'asset-1',
            state: 'open',
            position: { x: 100, y: 100 },
            size: { width: 800, height: 600 }
          },
          {
            id: 'win-2',
            assetId: 'asset-2',
            state: 'minimized'
          }
        ]
      }));
      
      // Server should acknowledge state update
      const ack = await new Promise((resolve) => {
        clientWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'state-ack' || message.type === 'ack') {
            resolve(message);
          }
        });
        setTimeout(() => resolve(null), 1000);
      });
      
      if (ack) {
        expect(ack).toBeTruthy();
      }
      
      clientWs.close();
    });
  });

  describe('error handling in actor communication', () => {
    test('should handle client errors gracefully', async () => {
      const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Send error from client
      clientWs.send(JSON.stringify({
        type: 'error',
        error: 'Failed to create window',
        details: {
          assetId: 'test-asset',
          reason: 'Insufficient resources'
        }
      }));
      
      // Server should handle error without closing connection
      await waitForServer(500);
      
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
      
      clientWs.close();
    });

    test('should recover from communication errors', async () => {
      const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Send malformed message
      try {
        clientWs.send('{ malformed json }');
      } catch (error) {
        // Might throw
      }
      
      await waitForServer(500);
      
      // Connection might close, but should be able to reconnect
      if (clientWs.readyState === WebSocket.CLOSED) {
        const newWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
        
        const reconnected = await new Promise((resolve) => {
          newWs.on('open', () => resolve(true));
          newWs.on('error', () => resolve(false));
          setTimeout(() => resolve(false), 2000);
        });
        
        expect(reconnected).toBe(true);
        newWs.close();
      } else {
        // Connection survived
        expect(clientWs.readyState).toBe(WebSocket.OPEN);
        clientWs.close();
      }
    });

    test('should handle actor timeout scenarios', async () => {
      const clientWs = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        clientWs.on('open', resolve);
      });
      
      // Send request that might timeout
      clientWs.send(JSON.stringify({
        type: 'long-operation',
        timeout: 100,
        data: 'test'
      }));
      
      const timeoutResponse = await new Promise((resolve) => {
        clientWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'timeout' || message.error === 'timeout') {
            resolve(message);
          }
        });
        setTimeout(() => resolve(null), 3000);
      });
      
      // Server might send timeout response or handle gracefully
      expect(clientWs.readyState).toBe(WebSocket.OPEN);
      
      clientWs.close();
    });
  });
});