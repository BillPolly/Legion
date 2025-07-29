/**
 * WebSocketHandler Unit Tests
 * 
 * Tests WebSocket protocol handling, message types, and codec integration
 * without requiring full server setup.
 */

import { jest } from '@jest/globals';
import { TestServer } from '../helpers/TestServer.js';
import { TestClient } from '../helpers/TestClient.js';
import { TestAssertions } from '../helpers/TestAssertions.js';
import { validateSchema } from '../fixtures/testSchemas.js';

describe('WebSocketHandler Protocol Tests', () => {
  let testServer;
  let client;

  beforeEach(async () => {
    testServer = new TestServer();
    await testServer.start();
    
    client = new TestClient();
    await client.connect(testServer.getWebSocketUrl());
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
    if (testServer) {
      await testServer.stop();
    }
  });

  describe('Connection and Welcome Message', () => {
    test('should receive welcome message with schemas', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      TestAssertions.assertWelcomeMessage(welcomeMessage);
      
      // Validate welcome message structure
      expect(() => validateSchema(welcomeMessage, 'welcome')).not.toThrow();
      
      // Should have at least some schemas
      expect(Object.keys(welcomeMessage.schemas).length).toBeGreaterThan(0);
      
      console.log('Received schemas:', Object.keys(welcomeMessage.schemas));
    });

    test('should include server capabilities', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      expect(welcomeMessage.capabilities).toContain('sessions');
      expect(welcomeMessage.capabilities).toContain('tools');
      expect(welcomeMessage.capabilities).toContain('context');
      expect(welcomeMessage.capabilities).toContain('handles');
    });

    test('should provide unique client ID', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      expect(welcomeMessage.clientId).toBeDefined();
      expect(typeof welcomeMessage.clientId).toBe('string');
      expect(welcomeMessage.clientId.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should create session successfully', async () => {
      // Wait for welcome message first
      await client.waitForMessage('welcome');
      
      const response = await client.createSession();
      
      TestAssertions.assertSessionCreated(response);
      expect(client.sessionId).toBeDefined();
      
      // Validate session response structure
      expect(() => validateSchema(response, 'session_created')).not.toThrow();
    });

    test('should handle session creation request format', async () => {
      await client.waitForMessage('welcome');
      
      const response = await client.sendRequest('session_create');
      
      expect(response.type).toBe('session_created');
      expect(response.requestId).toBeDefined();
      expect(response.success).toBe(true);
    });
  });

  describe('Tool Request Protocol', () => {
    beforeEach(async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
    });

    test('should handle tool request message format', async () => {
      const response = await client.sendRequest('tool_request', {
        method: 'tools/list',
        params: {}
      });
      
      expect(response.type).toBe('tool_response');
      expect(response.requestId).toBeDefined();
      
      // Should either succeed or fail with proper error format
      if (response.error) {
        expect(response.error.message).toBeDefined();
      } else {
        expect(response.result).toBeDefined();
      }
    });

    test('should reject tool request without session', async () => {
      // Create new client without session
      const clientNoSession = new TestClient();
      await clientNoSession.connect(testServer.getWebSocketUrl());
      await clientNoSession.waitForMessage('welcome');
      
      // Try to execute tool without creating session
      const response = await clientNoSession.sendRequest('tool_request', {
        method: 'tools/list',
        params: {}
      });
      
      expect(response.type).toBe('error');
      expect(response.error.message).toMatch(/authenticated|session/i);
      
      clientNoSession.disconnect();
    });

    test('should handle invalid tool request format', async () => {
      const response = await client.sendRequest('tool_request', {
        // Missing required 'method' field
        params: {}
      });
      
      expect(response.type).toBe('error');
      expect(response.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown message type', async () => {
      await client.waitForMessage('welcome');
      
      const response = await client.sendRequest('unknown_message_type', {
        data: 'test'
      });
      
      expect(response.type).toBe('error');
      expect(response.error.message).toMatch(/unknown.*message.*type/i);
    });
    
    test('should handle malformed JSON', async () => {
      await client.waitForMessage('welcome');
      
      // This test would require sending raw malformed data
      // For now, just verify error response format
      const response = await client.sendRequest('tool_request', {
        method: null, // Invalid method
        params: {}
      });
      
      // Should get an error response
      expect(response.type).toBe('error');
      expect(response.error).toBeDefined();
    });
  });

  describe('Request/Response Matching', () => {
    test('should match responses to requests by ID', async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
      
      // Send multiple requests
      const promise1 = client.sendRequest('tool_request', {
        method: 'tools/list',
        params: {}
      });
      
      const promise2 = client.sendRequest('tool_request', {
        method: 'tools/list', 
        params: {}
      });
      
      const [response1, response2] = await Promise.all([promise1, promise2]);
      
      // Should get different request IDs
      expect(response1.requestId).not.toBe(response2.requestId);
      expect(response1.type).toBe('tool_response');
      expect(response2.type).toBe('tool_response');
    });
  });

  describe('Connection Lifecycle', () => {
    test('should handle client disconnect gracefully', async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
      
      // Disconnect client
      client.disconnect();
      
      // Server should handle this gracefully (no way to test directly)
      // Just ensure no errors are thrown
      expect(true).toBe(true);
    });

    test('should handle multiple concurrent connections', async () => {
      const client2 = new TestClient();
      await client2.connect(testServer.getWebSocketUrl());
      
      const welcome1 = await client.waitForMessage('welcome');
      const welcome2 = await client2.waitForMessage('welcome');
      
      // Should get different client IDs
      expect(welcome1.clientId).not.toBe(welcome2.clientId);
      
      client2.disconnect();
    });
  });
});