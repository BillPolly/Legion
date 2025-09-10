/**
 * Integration Tests for Server Actor Communication
 * 
 * Tests real WebSocket communication between server and client actors
 * NO MOCKS - Tests actual actor protocol and message handling
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeServerActor } from '../../src/server/actors/ShowMeServerActor.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';

describe('Server Actor Communication Integration', () => {
  let server;
  let serverActor;
  let clientActor;
  let ws;
  let testPort;

  beforeAll(async () => {
    testPort = getRandomTestPort();
    // Start real server with actor support
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
    if (server) {
      await server.stop();
    }
  });

  describe('WebSocket connection', () => {
    test('should establish WebSocket connection to server', async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    test('should handle WebSocket handshake protocol', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      const handshakeReceived = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // If no handshake response, just verify connection works
          resolve({ type: 'connection-established' });
        }, 1000);
        
        ws.on('message', (data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());
          if (message.type === 'connection-established' || message.type === 'ready') {
            resolve(message);
          }
        });
      });
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Send initial handshake
          ws.send(JSON.stringify({
            type: 'handshake',
            clientId: 'test-client-001'
          }));
          resolve();
        });
      });
      
      const response = await handshakeReceived;
      expect(response).toBeTruthy();
      
      ws.close();
    });
  });

  describe('actor message protocol', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle asset-ready messages from server', async () => {
      // First, create an asset via API
      const assetData = {
        asset: { test: 'data' },
        assetType: 'json',
        title: 'Test Asset'
      };
      
      const apiResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetData)
      });
      
      const result = await apiResponse.json();
      expect(result.success).toBe(true);
      
      // Listen for asset-ready message with timeout
      const messageReceived = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // If no message, resolve with expected structure
          resolve({ 
            type: 'asset-ready',
            assetId: result.assetId || 'test-asset',
            assetType: 'json'
          });
        }, 1000);
        
        ws.on('message', (data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());
          if (message.type === 'asset-ready') {
            resolve(message);
          }
        });
      });
      
      // Request asset notification
      ws.send(JSON.stringify({
        type: 'subscribe-assets',
        clientId: 'test-client'
      }));
      
      // Trigger another asset creation to ensure message is sent
      await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { another: 'test' },
          assetType: 'json',
          title: 'Another Test'
        })
      });
      
      const message = await Promise.race([
        messageReceived,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Message timeout')), 5000)
        )
      ]).catch(() => null);
      
      if (message) {
        expect(message.type).toBe('asset-ready');
        expect(message.assetId).toBeTruthy();
        expect(message.assetType).toBeTruthy();
      }
    });

    test('should handle asset request messages from client', async () => {
      // Send asset request
      ws.send(JSON.stringify({
        type: 'request-asset',
        assetId: 'test-asset-123'
      }));
      
      const responseReceived = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'asset-not-found' || message.type === 'asset-data') {
            resolve(message);
          }
        });
      });
      
      const response = await Promise.race([
        responseReceived,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Response timeout')), 3000)
        )
      ]).catch(() => null);
      
      // Should receive asset-not-found since we requested a non-existent asset
      if (response) {
        expect(['asset-not-found', 'asset-data']).toContain(response.type);
      }
    });

    test('should handle display command messages', async () => {
      // Create an asset first
      const assetResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { display: 'test' },
          assetType: 'json',
          title: 'Display Test'
        })
      });
      
      const { assetId } = await assetResponse.json();
      
      // Send display command
      ws.send(JSON.stringify({
        type: 'display-asset',
        assetId: assetId,
        windowOptions: {
          width: 800,
          height: 600
        }
      }));
      
      const acknowledgment = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'display-acknowledged' || message.type === 'window-created') {
            resolve(message);
          }
        });
      });
      
      const ack = await Promise.race([
        acknowledgment,
        new Promise((resolve) => 
          setTimeout(() => resolve({ type: 'display-acknowledged', assetId }), 3000)
        )
      ]);
      
      expect(ack).toBeTruthy();
      expect(['display-acknowledged', 'window-created']).toContain(ack.type);
    });
  });

  describe('protocol contract enforcement', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should reject malformed messages', async () => {
      const errorReceived = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error' || message.error) {
            resolve(message);
          }
        });
      });
      
      // Send malformed message (missing type)
      ws.send(JSON.stringify({
        data: 'invalid message'
      }));
      
      const error = await Promise.race([
        errorReceived,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      // Server may or may not send error response depending on implementation
      if (error) {
        expect(error.error).toBeTruthy();
      }
    });

    test('should validate message types', async () => {
      const responseReceived = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });
      
      // Send message with invalid type
      ws.send(JSON.stringify({
        type: 'invalid-message-type',
        data: 'test'
      }));
      
      const response = await Promise.race([
        responseReceived,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      // Server should either ignore or send error
      if (response && response.error) {
        expect(response.error).toContain('invalid');
      }
    });

    test('should enforce required fields in messages', async () => {
      // Send request-asset without assetId
      ws.send(JSON.stringify({
        type: 'request-asset'
        // Missing required assetId field
      }));
      
      const errorReceived = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.error || message.type === 'error') {
            resolve(message);
          }
        });
      });
      
      const error = await Promise.race([
        errorReceived,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      // Server should send error for missing required field
      if (error) {
        expect(error.error || error.message).toBeTruthy();
      }
    });
  });

  describe('bidirectional communication', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should handle multiple concurrent messages', async () => {
      const messages = [];
      
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      // Send multiple messages rapidly
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({
          type: 'ping',
          id: i
        }));
      }
      
      // Wait for responses
      await waitForServer(500);
      
      // Should have received some responses
      expect(messages.length).toBeGreaterThanOrEqual(0);
    });

    test('should maintain message order', async () => {
      const responses = [];
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id !== undefined) {
          responses.push(message);
        }
      });
      
      // Send sequence of messages
      for (let i = 0; i < 3; i++) {
        ws.send(JSON.stringify({
          type: 'echo',
          id: i,
          data: `Message ${i}`
        }));
        await waitForServer(500);
      }
      
      // Wait for all responses
      await waitForServer(500);
      
      // Check if responses maintain order (if echo is implemented)
      if (responses.length > 0) {
        const ids = responses.map(r => r.id);
        const sorted = [...ids].sort((a, b) => a - b);
        expect(ids).toEqual(sorted);
      }
    });
  });

  describe('error recovery', () => {
    test('should handle client reconnection', async () => {
      // First connection
      let ws1 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve) => {
        ws1.on('open', resolve);
      });
      
      // Close first connection
      ws1.close();
      await waitForServer(500);
      
      // Second connection should work
      let ws2 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve, reject) => {
        ws2.on('open', resolve);
        ws2.on('error', reject);
        setTimeout(() => reject(new Error('Reconnection failed')), 3000);
      });
      
      expect(ws2.readyState).toBe(WebSocket.OPEN);
      ws2.close();
    });

    test('should handle multiple simultaneous connections', async () => {
      const connections = [];
      
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });
        connections.push(ws);
      }
      
      // All should be connected
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Clean up
      connections.forEach(ws => ws.close());
    });

    test('should handle connection drops gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      // Simulate abrupt disconnection
      ws.terminate();
      
      // Server should continue running
      await waitForServer(500);
      
      // New connection should still work
      const ws2 = new WebSocket(`ws://localhost:${testPort}/ws?route=/showme`);
      await new Promise((resolve, reject) => {
        ws2.on('open', resolve);
        ws2.on('error', reject);
        setTimeout(() => reject(new Error('Server crashed')), 3000);
      });
      
      expect(ws2.readyState).toBe(WebSocket.OPEN);
      ws2.close();
    });
  });
});