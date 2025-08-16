/**
 * Integration tests for Error Handling
 * Tests with real MongoDB connection - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('Error Handling - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testDatabase = 'legion_test';
  const testCollection = 'test_errors_' + Date.now();

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Create module with real MongoDB
    module = await MongoQueryModule.create(resourceManager);
    tool = module.getTool('mongo_query');
  });

  afterAll(async () => {
    // Clean up
    await tool.execute({
      database: testDatabase,
      collection: testCollection,
      command: 'dropCollection',
      params: {}
    });
    
    // Disconnect MongoDB
    if (module.mongoProvider && module.mongoProvider.connected) {
      await module.mongoProvider.disconnect();
    }
  });

  describe('Connection Errors', () => {
    it('should handle MongoDBProvider not connected', async () => {
      // Create a new module with disconnected provider
      const disconnectedProvider = module.mongoProvider;
      await disconnectedProvider.disconnect();
      
      const disconnectedTool = new (await import('../../src/MongoQueryTool.js')).MongoQueryTool({
        mongoProvider: disconnectedProvider
      });

      const result = await disconnectedTool.execute({
        collection: testCollection,
        command: 'find',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Not connected to database');
      
      // Reconnect for other tests
      await disconnectedProvider.connect();
    });

    it('should handle invalid connection string gracefully', async () => {
      // Create ResourceManager with invalid MongoDB URL
      const badRM = {
        get: (key) => {
          if (key === 'env.MONGODB_URL') return 'invalid://connection:string';
          return resourceManager.get(key);
        },
        set: () => {},
        has: () => false
      };

      try {
        await MongoQueryModule.create(badRM);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Operation Errors', () => {
    it('should handle invalid collection name', async () => {
      // MongoDB doesn't allow certain characters in collection names
      const result = await tool.execute({
        database: testDatabase,
        collection: 'invalid$collection',
        command: 'insertOne',
        params: { document: { test: true } }
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toBeDefined();
    });

    it('should handle malformed query syntax', async () => {
      // Create a query with invalid operators
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: { $invalidOperator: 'test' }
        }
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('unknown top level operator');
    });

    it('should handle invalid update operators', async () => {
      // Insert a document first
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { _id: 'test1', value: 1 } }
      });

      // Try to update with invalid operator
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { _id: 'test1' },
          update: { $invalidOp: { value: 2 } }
        }
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage.toLowerCase()).toContain('modifier');
    });
  });

  describe('Input Validation Errors', () => {
    it('should reject missing required fields', async () => {
      const invalidInputs = [
        { command: 'find', params: {} }, // missing collection
        { collection: testCollection, params: {} }, // missing command  
        { collection: testCollection, command: 'find' } // missing params
      ];

      for (const input of invalidInputs) {
        const result = await tool.execute(input);
        expect(result.success).toBe(false);
        expect(result.data.errorMessage).toContain('Validation failed');
      }
    });

    it('should reject invalid command names', async () => {
      const result = await tool.execute({
        collection: testCollection,
        command: 'nonExistentCommand',
        params: {}
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    it('should reject wrong parameter types', async () => {
      const result = await tool.execute({
        collection: testCollection,
        command: 'find',
        params: 'not_an_object' // params must be an object
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Validation failed');
    });
  });

  describe('Error Format Compliance', () => {
    it('should return Legion error format for all errors', async () => {
      // Test various error conditions
      const errorConditions = [
        {
          // Missing required document
          collection: testCollection,
          command: 'insertOne',
          params: {}
        },
        {
          // Invalid command
          collection: testCollection,
          command: 'invalidCommand',
          params: {}
        },
        {
          // Invalid collection name
          collection: 123, // Should be string
          command: 'find',
          params: {}
        }
      ];

      for (const condition of errorConditions) {
        const result = await tool.execute(condition);
        
        // Check Legion error format
        expect(result.success).toBe(false);
        expect(result.data).toBeDefined();
        expect(result.data.errorMessage).toBeDefined();
        expect(result.data.tool).toBe('mongo_query');
        expect(result.data.timestamp).toBeDefined();
      }
    });

    it('should include context in error responses', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { _id: 'test' },
          update: { $badOperator: { value: 1 } }
        }
      });

      expect(result.success).toBe(false);
      expect(result.data.tool).toBe('mongo_query');
      expect(result.data.errorMessage).toBeDefined();
      // Check that error includes operation context
      expect(result.data.code).toBe('EXECUTION_ERROR');
    });
  });
});