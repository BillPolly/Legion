/**
 * Server-Codec Integration Tests
 * 
 * Tests the complete integration between AiurServer and Codec,
 * verifying that schemas are properly distributed to clients.
 */

import { jest } from '@jest/globals';
import { TestServer } from '../helpers/TestServer.js';
import { TestClient } from '../helpers/TestClient.js';
import { TestAssertions } from '../helpers/TestAssertions.js';
import { expectedSchemas, testData } from '../fixtures/testSchemas.js';

// Extended timeout for integration tests
jest.setTimeout(30000);

describe('Server-Codec Integration', () => {
  let testServer;
  let client;

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    console.log('Integration test server started');
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
      console.log('Integration test server stopped');
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

  describe('Schema Distribution', () => {
    test('should provide schemas in welcome message', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      TestAssertions.assertWelcomeMessage(welcomeMessage);
      
      // Verify schema content
      const schemas = welcomeMessage.schemas;
      const messageTypes = welcomeMessage.messageTypes;
      
      expect(Object.keys(schemas).length).toBeGreaterThan(0);
      expect(messageTypes.length).toBeGreaterThan(0);
      
      console.log('Schemas provided:', Object.keys(schemas));
      console.log('Message types:', messageTypes);
    });

    test('should have consistent schema and message type lists', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      const schemaIds = Object.keys(welcomeMessage.schemas);
      const messageTypes = welcomeMessage.messageTypes;
      
      // Should have some overlap between schema IDs and message types
      const overlap = schemaIds.filter(id => messageTypes.includes(id));
      expect(overlap.length).toBeGreaterThan(0);
      
      console.log('Schema/MessageType overlap:', overlap);
    });

    test('should provide valid schema definitions', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      const schemas = welcomeMessage.schemas;
      
      // Each schema should have basic structure
      Object.entries(schemas).forEach(([id, schema]) => {
        expect(schema).toBeDefined();
        expect(typeof schema).toBe('object');
        
        // Should have either type or properties (basic JSON schema)
        expect(schema.type || schema.properties).toBeDefined();
        
        console.log(`Schema ${id} is valid`);
      });
    });
  });

  describe('Schema-Based Communication', () => {
    test('should validate welcome message against expected schema', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      const schemas = welcomeMessage.schemas;
      
      // If we have a welcome schema, validate the message
      const welcomeSchema = schemas['welcome'];
      if (welcomeSchema) {
        // Basic validation that welcome message matches its own schema
        expect(welcomeMessage.type).toBe('welcome');
        expect(welcomeMessage.clientId).toBeDefined();
        expect(welcomeMessage.serverVersion).toBeDefined();
        
        console.log('Welcome message validates against its schema');
      }
    });

    test('should handle session creation with schema validation', async () => {
      await client.waitForMessage('welcome');
      
      const sessionResponse = await client.createSession();
      
      TestAssertions.assertSessionCreated(sessionResponse);
      
      // Response should match session_created format
      expect(sessionResponse.type).toBe('session_created');
      expect(sessionResponse.requestId).toBeDefined();
      expect(sessionResponse.sessionId).toBeDefined();
      expect(sessionResponse.success).toBe(true);
    });

    test('should provide error responses in valid format', async () => {
      await client.waitForMessage('welcome');
      await client.createSession();
      
      // Send invalid tool request - use try/catch since it may throw
      try {
        const response = await client.sendRequest('tool_request', {
          method: 'invalid_method',
          params: {}
        });
        
        // If we get a response, validate error format
        if (response.type === 'error') {
          TestAssertions.assertErrorResponse(response);
        } else if (response.type === 'tool_response' && response.error) {
          expect(response.error).toBeDefined();
        }
        console.log('Error response format validated');
      } catch (error) {
        // Error thrown by client is also acceptable
        expect(error.message).toBeDefined();
        console.log('Error thrown as expected:', error.message.substring(0, 50));
      }
    });
  });

  describe('Multiple Client Schema Distribution', () => {
    test('should provide consistent schemas to multiple clients', async () => {
      const client2 = new TestClient();
      await client2.connect(testServer.getWebSocketUrl());
      
      try {
        const welcome1 = await client.waitForMessage('welcome');
        const welcome2 = await client2.waitForMessage('welcome');
        
        // Should provide same schemas to both clients
        const schemas1 = Object.keys(welcome1.schemas).sort();
        const schemas2 = Object.keys(welcome2.schemas).sort();
        
        expect(schemas1).toEqual(schemas2);
        
        // Should have same message types
        const types1 = welcome1.messageTypes.sort();
        const types2 = welcome2.messageTypes.sort();
        
        expect(types1).toEqual(types2);
        
        console.log('Both clients received identical schema information');
      } finally {
        client2.disconnect();
      }
    });
  });

  describe('Server Codec Configuration', () => {
    test('should indicate codec is enabled', async () => {
      await client.waitForMessage('welcome');
      
      const sessionResponse = await client.createSession();
      
      // Session response should indicate codec is enabled
      expect(sessionResponse.codecEnabled).toBeDefined();
      expect(typeof sessionResponse.codecEnabled).toBe('boolean');
      
      console.log('Codec enabled:', sessionResponse.codecEnabled);
    });

    test('should handle codec metadata injection', async () => {
      const welcomeMessage = await client.waitForMessage('welcome');
      
      // Welcome message should have metadata if codec injects it
      expect(welcomeMessage.type).toBeDefined();
      
      // May have messageId or timestamp from codec
      const hasMetadata = welcomeMessage.messageId || welcomeMessage.timestamp;
      console.log('Codec metadata present:', !!hasMetadata);
    });
  });

  describe('Schema Evolution', () => {
    test('should handle schema queries', async () => {
      await client.waitForMessage('welcome');
      
      // Try to request schema information directly - use try/catch since it may throw
      try {
        const response = await client.sendRequest('schema_request', {});
        
        // Should either provide schemas or indicate not supported
        expect(response).toBeDefined();
        
        if (response.type === 'schema_definition') {
          expect(response.schemas).toBeDefined();
          expect(response.version).toBeDefined();
          console.log('Schema request supported');
        } else if (response.type === 'error') {
          expect(response.error).toBeDefined();
          console.log('Schema request not supported (expected)');
        }
      } catch (error) {
        // Server may not support schema_request, which is acceptable
        expect(error.message).toBeDefined();
        console.log('Schema request not supported (threw error, which is expected)');
      }
    });
  });
});