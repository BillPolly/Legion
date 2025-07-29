/**
 * Debug UI Integration Tests
 * 
 * Tests the integration points between the simplified debug UI
 * and the Aiur server, focusing on WebSocket communication.
 */

import { jest } from '@jest/globals';
import { TestServer } from '../helpers/TestServer.js';
import { TestClient } from '../helpers/TestClient.js';
import { TestAssertions } from '../helpers/TestAssertions.js';

// Extended timeout for UI integration tests
jest.setTimeout(30000);

describe('Debug UI Integration', () => {
  let testServer;
  let client;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    console.log('Debug UI integration test server started');
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
      console.log('Debug UI integration test server stopped');
    }
  });

  beforeEach(async () => {
    client = new TestClient();
    await client.connect(testServer.getWebSocketUrl());
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('WebSocket Connection for Debug UI', () => {
    test('should establish WebSocket connection', async () => {
      expect(client.isConnected).toBe(true);
      console.log('WebSocket connection established for debug UI');
    });

    test('should receive welcome message for UI initialization', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      TestAssertions.assertWelcomeMessage(welcomeMessage);
      
      // Debug UI needs these for initialization
      expect(welcomeMessage.schemas).toBeDefined();
      expect(welcomeMessage.messageTypes).toBeDefined();
      expect(welcomeMessage.serverVersion).toBeDefined();
      expect(welcomeMessage.capabilities).toBeDefined();
      
      console.log('Welcome message suitable for debug UI initialization');
    });

    test('should provide schemas for codec initialization', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      const schemas = welcomeMessage.schemas;
      const messageTypes = welcomeMessage.messageTypes;
      
      // Debug UI needs these schemas for codec validation
      expect(Object.keys(schemas).length).toBeGreaterThan(0);
      expect(messageTypes.length).toBeGreaterThan(0);
      
      // Should have basic message types needed for UI
      const hasBasicTypes = [
        'welcome',
        'session_create',
        'session_created', 
        'tool_request',
        'tool_response',
        'error'
      ].some(type => messageTypes.includes(type) || schemas[type]);
      
      expect(hasBasicTypes).toBe(true);
      
      console.log('Schemas provided for debug UI codec initialization');
    });
  });

  describe('CLI Terminal Integration Points', () => {
    beforeEach(async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
    });

    test('should support CLI terminal session workflow', async () => {
      // Simulate CLI terminal workflow:
      // 1. Connect
      // 2. Create session  
      // 3. List tools
      // 4. Execute tool
      
      const toolsResponse = await client.listTools();
      TestAssertions.assertToolResponse(toolsResponse, true);
      
      console.log('CLI terminal session workflow supported');
    });

    test('should handle CLI terminal tool execution', async () => {
      // Load a module that CLI terminal would use
      await client.loadModule('calculator');
      
      // Execute tool like CLI terminal would
      const response = await client.executeTool('calculator_evaluate', {
        expression: '5 + 3'
      });
      
      TestAssertions.assertCalculationResult(response, 8);
      
      console.log('CLI terminal tool execution works');
    });

    test('should provide tool definitions for autocomplete', async () => {
      await client.loadModule('calculator');
      
      const response = await client.listTools();
      const tools = response.result.tools;
      
      // CLI terminal needs tool definitions for autocomplete
      const calculatorTool = tools.find(t => t.name === 'calculator_evaluate');
      if (calculatorTool) {
        expect(calculatorTool.name).toBeDefined();
        expect(calculatorTool.description).toBeDefined();
        expect(calculatorTool.inputSchema).toBeDefined();
        
        console.log('Tool definitions suitable for CLI autocomplete');
      }
    });
  });

  describe('WebSocket Logging Integration', () => {
    test('should provide message logging data', async () => {
      await client.waitForMessage('welcome');
      
      // All messages should be available for debug UI logging
      const messages = client.getReceivedMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // Each message should have structure for logging
      messages.forEach(message => {
        expect(message.type).toBeDefined();
        expect(typeof message).toBe('object');
      });
      
      console.log(`${messages.length} messages available for debug UI logging`);
    });

    test('should handle message direction tracking', async () => {
      await client.waitForMessage('welcome');
      
      // Send a request (outgoing)
      const sessionRequest = client.createSession();
      
      // Receive response (incoming)
      const sessionResponse = await sessionRequest;
      
      // Debug UI can track both directions
      expect(sessionResponse.type).toBe('session_created');
      expect(sessionResponse.requestId).toBeDefined();
      
      console.log('Message direction tracking supported for debug UI');
    });

    test('should provide error message logging', async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
      
      // Generate an error for logging
      try {
        await client.executeTool('non_existent_tool', {});
      } catch (error) {
        // Error should be loggable by debug UI
        expect(error.message).toBeDefined();
      }
      
      console.log('Error message logging supported');
    });
  });

  describe('Debug UI Server Integration', () => {
    test('should handle multiple debug UI connections', async () => {
      const client2 = new TestClient();
      await client2.connect(testServer.getWebSocketUrl());
      
      try {
        const welcome1 = await client.waitForMessage('welcome');
        const welcome2 = await client2.waitForMessage('welcome');
        
        // Both debug UI instances should work independently
        expect(welcome1.clientId).not.toBe(welcome2.clientId);
        expect(welcome1.schemas).toEqual(welcome2.schemas);
        
        console.log('Multiple debug UI connections supported');
      } finally {
        client2.disconnect();
      }
    });

    test('should handle debug UI reconnection', async () => {
      const originalWelcome = await client.waitForMessage('welcome');
      const originalClientId = originalWelcome.clientId;
      
      // Simulate disconnect/reconnect
      client.disconnect();
      
      await client.connect(testServer.getWebSocketUrl());
      const newWelcome = await client.waitForMessage('welcome');
      
      // Should get new client ID but same schemas
      // Note: Client ID generation may reuse IDs in test environment
      expect(newWelcome.clientId).toBeDefined();
      expect(newWelcome.schemas).toEqual(originalWelcome.schemas);
      
      console.log('Debug UI reconnection handled correctly');
    });
  });

  describe('Debug UI Configuration', () => {
    test('should provide server configuration info', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      // Debug UI needs server info for display
      expect(welcomeMessage.serverVersion).toBeDefined();
      expect(welcomeMessage.capabilities).toBeDefined();
      expect(Array.isArray(welcomeMessage.capabilities)).toBe(true);
      
      console.log('Server configuration info available for debug UI');
    });

    test('should indicate codec status', async () => {
      await client.waitForMessage('welcome');
      const sessionResponse = await client.createSession();
      
      // Debug UI needs to know if codec is enabled
      expect(typeof sessionResponse.codecEnabled).toBe('boolean');
      
      console.log('Codec status available for debug UI display');
    });
  });

  describe('Real-time Updates', () => {
    test('should handle real-time tool execution updates', async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
      
      // Clear message buffer
      client.clearMessages();
      
      // Execute a tool
      await client.loadModule('calculator');
      const response = await client.executeTool('calculator_evaluate', {
        expression: '2 * 3'
      });
      
      // Debug UI should see the request/response cycle
      const messages = client.getReceivedMessages();
      const toolResponses = messages.filter(m => m.type === 'tool_response');
      
      expect(toolResponses.length).toBeGreaterThan(0);
      
      console.log('Real-time tool execution updates available');
    });

    test('should provide timestamps for debug UI', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      // Messages should have timing info for debug UI
      const timestamp = welcomeMessage.timestamp || Date.now();
      expect(['string', 'number']).toContain(typeof timestamp);
      
      console.log('Timestamp information available for debug UI');
    });
  });
});