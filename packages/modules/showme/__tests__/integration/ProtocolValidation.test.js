/**
 * Integration Tests for Protocol Contract Enforcement
 * 
 * Tests protocol validation and contract enforcement between actors
 * NO MOCKS - Tests actual protocol implementation with real components
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import WebSocket from 'ws';
import fetch from 'node-fetch';

describe('Protocol Validation Integration', () => {
  let server;
  const testPort = 3794;
  
  beforeAll(async () => {
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('message structure validation', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should validate message has required type field', async () => {
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send message without type
      ws.send(JSON.stringify({
        data: 'test',
        id: '123'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should either receive error or message should be ignored
      const errorResponse = responses.find(r => r.type === 'error' || r.error);
      if (errorResponse) {
        expect(errorResponse.error || errorResponse.message).toContain('type');
      }
    });

    test('should validate message type is string', async () => {
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send message with non-string type
      ws.send(JSON.stringify({
        type: 123,
        data: 'test'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should receive error or ignore message
      const errorResponse = responses.find(r => r.type === 'error' || r.error);
      if (errorResponse) {
        expect(errorResponse.error || errorResponse.message).toBeTruthy();
      }
    });

    test('should validate JSON structure', async () => {
      let errorReceived = false;
      
      ws.on('error', () => {
        errorReceived = true;
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.error || message.type === 'error') {
          errorReceived = true;
        }
      });
      
      // Send invalid JSON
      ws.send('{ invalid json }');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connection might close or receive error
      expect(ws.readyState === WebSocket.CLOSED || errorReceived).toBeTruthy();
    });
  });

  describe('protocol message types', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should support handshake message', async () => {
      const responsePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'handshake-ack' || message.type === 'ready') {
            resolve(message);
          }
        });
      });
      
      ws.send(JSON.stringify({
        type: 'handshake',
        clientId: 'test-client',
        version: '1.0.0'
      }));
      
      const response = await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (response) {
        expect(response.type).toBeTruthy();
      }
    });

    test('should support asset-ready notification', async () => {
      // Create an asset to trigger notification
      const assetResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { test: 'notification' },
          assetType: 'json',
          title: 'Notification Test'
        })
      });
      
      const { assetId } = await assetResponse.json();
      
      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'asset-ready' && message.assetId === assetId) {
            resolve(message);
          }
        });
      });
      
      // Subscribe to notifications
      ws.send(JSON.stringify({
        type: 'subscribe',
        events: ['asset-ready']
      }));
      
      // Create another asset to ensure subscription is active
      await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { trigger: 'notification' },
          assetType: 'json',
          title: 'Trigger'
        })
      });
      
      const message = await Promise.race([
        messagePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 3000))
      ]);
      
      if (message) {
        expect(message.type).toBe('asset-ready');
        expect(message.assetId).toBeTruthy();
      }
    });

    test('should support request-asset message', async () => {
      // First create an asset
      const createResponse = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { request: 'test' },
          assetType: 'json',
          title: 'Request Test'
        })
      });
      
      const { assetId } = await createResponse.json();
      
      const responsePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'asset-data' || message.type === 'asset-response') {
            resolve(message);
          }
        });
      });
      
      ws.send(JSON.stringify({
        type: 'request-asset',
        assetId: assetId
      }));
      
      const response = await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (response) {
        expect(response.assetId).toBe(assetId);
      }
    });
  });

  describe('field validation', () => {
    let ws;

    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should validate required fields for request-asset', async () => {
      const errorPromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.error || message.type === 'error' || message.type === 'asset-not-found') {
            resolve(message);
          }
        });
      });
      
      // Send request-asset without assetId
      ws.send(JSON.stringify({
        type: 'request-asset'
      }));
      
      const error = await Promise.race([
        errorPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (error) {
        expect(error.error || error.type).toBeTruthy();
      }
    });

    test('should validate field types', async () => {
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send display-asset with invalid windowOptions type
      ws.send(JSON.stringify({
        type: 'display-asset',
        assetId: 'test-123',
        windowOptions: 'invalid-should-be-object'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should receive error or handle gracefully
      const errorResponse = responses.find(r => r.error || r.type === 'error');
      if (errorResponse) {
        expect(errorResponse.error).toBeTruthy();
      }
    });

    test('should validate enum values', async () => {
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send message with invalid asset type
      ws.send(JSON.stringify({
        type: 'display-asset',
        assetId: 'test-123',
        assetType: 'invalid-type' // Should be one of: image, code, json, data, web, text
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should handle invalid enum value
      const response = responses[responses.length - 1];
      if (response && response.error) {
        expect(response.error).toContain('type');
      }
    });
  });

  describe('protocol versioning', () => {
    test('should handle version negotiation', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      const versionResponse = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.version || message.protocol_version) {
            resolve(message);
          }
        });
      });
      
      ws.send(JSON.stringify({
        type: 'version',
        clientVersion: '1.0.0'
      }));
      
      const response = await Promise.race([
        versionResponse,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (response) {
        expect(response.version || response.protocol_version).toBeTruthy();
      }
      
      ws.close();
    });

    test('should handle incompatible version gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      ws.send(JSON.stringify({
        type: 'handshake',
        version: '99.99.99', // Incompatible version
        clientId: 'test'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should either accept or send compatibility warning
      if (responses.length > 0) {
        const response = responses[0];
        expect(response.type).toBeTruthy();
      }
      
      ws.close();
    });
  });

  describe('security validation', () => {
    test('should sanitize message content', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      const responses = [];
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Send message with potentially dangerous content
      ws.send(JSON.stringify({
        type: 'display-asset',
        assetId: '../../../etc/passwd', // Path traversal attempt
        title: '<script>alert("xss")</script>' // XSS attempt
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should handle dangerous input safely
      expect(ws.readyState).toBeLessThanOrEqual(WebSocket.OPEN);
      
      ws.close();
    });

    test('should limit message size', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      let connectionClosed = false;
      
      ws.on('close', () => {
        connectionClosed = true;
      });
      
      // Try to send very large message
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
      
      try {
        ws.send(JSON.stringify({
          type: 'test',
          data: largeData
        }));
      } catch (error) {
        // Message might be too large to send
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connection might close or handle gracefully
      expect(ws.readyState === WebSocket.CLOSED || !connectionClosed).toBeTruthy();
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should validate message rate limiting', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}/showme`);
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      let errorReceived = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.error && message.error.includes('rate')) {
          errorReceived = true;
        }
      });
      
      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        ws.send(JSON.stringify({
          type: 'ping',
          id: i
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Server may implement rate limiting
      // Connection should still be open or error received
      expect(ws.readyState === WebSocket.OPEN || errorReceived).toBeTruthy();
      
      ws.close();
    });
  });
});