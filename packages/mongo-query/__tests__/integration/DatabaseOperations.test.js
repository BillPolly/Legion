/**
 * Integration tests for Database Operations
 * Tests with real MongoDB connection - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('Database Operations - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testDb1 = 'legion_test_db1_' + Date.now();
  const testDb2 = 'legion_test_db2_' + Date.now();
  const testCollection = 'test_collection';

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Create module with real MongoDB
    module = await MongoQueryModule.create(resourceManager);
    tool = module.getTool('mongo_query');
  });

  afterAll(async () => {
    // Clean up test databases
    // Note: In production MongoDB, you might not have dropDatabase permission
    // So we'll just clean up collections instead
    for (const db of [testDb1, testDb2]) {
      await tool.execute({
        database: db,
        collection: testCollection,
        command: 'dropCollection',
        params: {}
      });
    }
    
    // Disconnect MongoDB
    if (module.mongoProvider && module.mongoProvider.connected) {
      await module.mongoProvider.disconnect();
    }
  });

  describe('Database Switching', () => {
    it('should operate on different database when specified', async () => {
      // Insert into first database
      await tool.execute({
        database: testDb1,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { db: 'db1', value: 'test1' } }
      });

      // Insert into second database
      await tool.execute({
        database: testDb2,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { db: 'db2', value: 'test2' } }
      });

      // Query first database
      const result1 = await tool.execute({
        database: testDb1,
        collection: testCollection,
        command: 'findOne',
        params: { query: {} }
      });

      expect(result1.success).toBe(true);
      expect(result1.data.database).toBe(testDb1);
      expect(result1.data.result.db).toBe('db1');

      // Query second database
      const result2 = await tool.execute({
        database: testDb2,
        collection: testCollection,
        command: 'findOne',
        params: { query: {} }
      });

      expect(result2.success).toBe(true);
      expect(result2.data.database).toBe(testDb2);
      expect(result2.data.result.db).toBe('db2');
    });

    it('should restore original database after operation', async () => {
      const originalDb = module.mongoProvider.databaseName;
      
      // Perform operation on different database
      await tool.execute({
        database: testDb1,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { test: 'restore' } }
      });

      // Check that database was restored
      expect(module.mongoProvider.databaseName).toBe(originalDb);
    });

    it('should handle multiple operations with database switches', async () => {
      // Perform multiple operations with different databases
      const operations = [
        {
          database: testDb1,
          collection: testCollection,
          command: 'insertOne',
          params: { document: { op: 1, db: 'db1' } }
        },
        {
          database: testDb2,
          collection: testCollection,
          command: 'insertOne',
          params: { document: { op: 2, db: 'db2' } }
        },
        {
          database: testDb1,
          collection: testCollection,
          command: 'insertOne',
          params: { document: { op: 3, db: 'db1' } }
        }
      ];

      for (const op of operations) {
        const result = await tool.execute(op);
        expect(result.success).toBe(true);
        expect(result.data.database).toBe(op.database);
      }

      // Verify data in each database
      const count1 = await tool.execute({
        database: testDb1,
        collection: testCollection,
        command: 'countDocuments',
        params: { query: { db: 'db1' } }
      });
      expect(count1.data.result).toBeGreaterThanOrEqual(2);

      const count2 = await tool.execute({
        database: testDb2,
        collection: testCollection,
        command: 'countDocuments',
        params: { query: { db: 'db2' } }
      });
      expect(count2.data.result).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Default Database Operations', () => {
    it('should use default database from .env when not specified', async () => {
      const defaultDb = resourceManager.get('env.MONGODB_DATABASE') || 'legion';
      
      // Insert without specifying database
      const insertResult = await tool.execute({
        collection: 'default_test_' + Date.now(),
        command: 'insertOne',
        params: { document: { test: 'default' } }
      });

      expect(insertResult.success).toBe(true);
      expect(insertResult.data.database).toBe(defaultDb);

      // Clean up
      await tool.execute({
        collection: insertResult.data.collection,
        command: 'dropCollection',
        params: {}
      });
    });

    it('should not change database when not specified', async () => {
      const originalDb = module.mongoProvider.databaseName;
      const tempCollection = 'no_switch_test_' + Date.now();
      
      // Perform operations without database parameter
      await tool.execute({
        collection: tempCollection,
        command: 'insertOne',
        params: { document: { test: 'no_switch' } }
      });

      await tool.execute({
        collection: tempCollection,
        command: 'find',
        params: { query: {} }
      });

      // Database should remain unchanged
      expect(module.mongoProvider.databaseName).toBe(originalDb);

      // Clean up
      await tool.execute({
        collection: tempCollection,
        command: 'dropCollection',
        params: {}
      });
    });
  });
});