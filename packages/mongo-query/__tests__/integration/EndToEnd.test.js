/**
 * End-to-End Integration Tests
 * Complete workflows with real MongoDB and ResourceManager - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('End-to-End Testing - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testDatabase = 'legion_e2e_test';
  const testCollection = 'e2e_test_' + Date.now();

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Verify environment variables are loaded
    expect(resourceManager.get('env.MONGODB_URL')).toBeDefined();
  });

  afterAll(async () => {
    // Clean up
    if (module && tool) {
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'dropCollection',
        params: {}
      });
    }
    
    // Disconnect MongoDB
    if (module && module.mongoProvider && module.mongoProvider.connected) {
      await module.mongoProvider.disconnect();
    }
  });

  describe('Complete Workflow Tests', () => {
    it('should complete full workflow: Module creation → Tool execution → Result verification', async () => {
      // Step 1: Create module with ResourceManager
      module = await MongoQueryModule.create(resourceManager);
      expect(module).toBeDefined();
      expect(module.name).toBe('mongo-query');
      
      // Step 2: Get tool from module
      tool = module.getTool('mongo_query');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('mongo_query');
      
      // Step 3: Execute operations
      const insertResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { workflow: 'e2e', step: 1 } }
      });
      expect(insertResult.success).toBe(true);
      
      // Step 4: Verify results
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { workflow: 'e2e' } }
      });
      expect(findResult.success).toBe(true);
      expect(findResult.data.result.step).toBe(1);
    });

    it('should handle multiple operations in sequence', async () => {
      if (!module) {
        module = await MongoQueryModule.create(resourceManager);
        tool = module.getTool('mongo_query');
      }
      
      // Insert multiple documents
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertMany',
        params: {
          documents: [
            { type: 'user', name: 'Alice', score: 100 },
            { type: 'user', name: 'Bob', score: 85 },
            { type: 'admin', name: 'Charlie', score: 95 }
          ]
        }
      });
      
      // Update documents
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateMany',
        params: {
          filter: { type: 'user' },
          update: { $inc: { score: 10 } }
        }
      });
      
      // Aggregate to verify
      const aggResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'aggregate',
        params: {
          pipeline: [
            { $match: { type: 'user' } },
            { $group: { _id: null, avgScore: { $avg: '$score' } } }
          ]
        }
      });
      
      expect(aggResult.success).toBe(true);
      expect(aggResult.data.result[0].avgScore).toBeGreaterThan(100);
    });

    it('should handle mixed read/write operations', async () => {
      if (!module) {
        module = await MongoQueryModule.create(resourceManager);
        tool = module.getTool('mongo_query');
      }
      
      // Write
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { _id: 'mixed1', value: 10 } }
      });
      
      // Read
      const read1 = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { _id: 'mixed1' } }
      });
      expect(read1.data.result.value).toBe(10);
      
      // Update
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { _id: 'mixed1' },
          update: { $set: { value: 20 } }
        }
      });
      
      // Read again
      const read2 = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { _id: 'mixed1' } }
      });
      expect(read2.data.result.value).toBe(20);
      
      // Delete
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'deleteOne',
        params: { filter: { _id: 'mixed1' } }
      });
      
      // Verify deletion
      const read3 = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { _id: 'mixed1' } }
      });
      expect(read3.data.result).toBeNull();
    });

    it('should handle database switching workflow', async () => {
      if (!module) {
        module = await MongoQueryModule.create(resourceManager);
        tool = module.getTool('mongo_query');
      }
      
      const db1 = 'legion_e2e_db1';
      const db2 = 'legion_e2e_db2';
      const collection = 'switch_test';
      
      // Insert into db1
      await tool.execute({
        database: db1,
        collection,
        command: 'insertOne',
        params: { document: { db: 1, value: 'db1_data' } }
      });
      
      // Insert into db2
      await tool.execute({
        database: db2,
        collection,
        command: 'insertOne',
        params: { document: { db: 2, value: 'db2_data' } }
      });
      
      // Query db1
      const result1 = await tool.execute({
        database: db1,
        collection,
        command: 'findOne',
        params: { query: {} }
      });
      expect(result1.data.result.db).toBe(1);
      
      // Query db2
      const result2 = await tool.execute({
        database: db2,
        collection,
        command: 'findOne',
        params: { query: {} }
      });
      expect(result2.data.result.db).toBe(2);
      
      // Clean up
      await tool.execute({ database: db1, collection, command: 'dropCollection', params: {} });
      await tool.execute({ database: db2, collection, command: 'dropCollection', params: {} });
    });
  });

  describe('ResourceManager Integration', () => {
    it('should work with real ResourceManager initialization', async () => {
      // Create fresh ResourceManager
      const freshRM = await getResourceManager();
      
      // Verify it has MongoDB URL from .env
      const mongoUrl = freshRM.get('env.MONGODB_URL');
      expect(mongoUrl).toBeDefined();
      expect(mongoUrl).toContain('mongodb');
      
      // Create module with it
      const freshModule = await MongoQueryModule.create(freshRM);
      expect(freshModule).toBeDefined();
      
      // Execute a simple operation
      const freshTool = freshModule.getTool('mongo_query');
      const result = await freshTool.execute({
        collection: 'rm_test_' + Date.now(),
        command: 'insertOne',
        params: { document: { test: 'rm_integration' } }
      });
      
      expect(result.success).toBe(true);
      
      // Clean up
      await freshTool.execute({
        collection: result.data.collection,
        command: 'dropCollection',
        params: {}
      });
      
      await freshModule.mongoProvider.disconnect();
    });

    it('should use .env variables correctly', async () => {
      // Get values from ResourceManager
      const mongoUrl = resourceManager.get('env.MONGODB_URL');
      const defaultDb = resourceManager.get('env.MONGODB_DATABASE') || 'legion';
      
      // Create a fresh ResourceManager to ensure clean state
      const freshRM = await getResourceManager();
      freshRM.set('MongoDBProvider', null); // Clear any existing provider
      
      // Create module
      const envModule = await MongoQueryModule.create(freshRM);
      
      // Verify it uses the correct database
      expect(envModule.mongoProvider.databaseName).toBe(defaultDb);
      
      // Execute operation to verify connection works
      const envTool = envModule.getTool('mongo_query');
      const testCol = 'env_test_' + Date.now();
      const result = await envTool.execute({
        collection: testCol,
        command: 'insertOne',
        params: { document: { env: 'test' } }
      });
      
      expect(result.success).toBe(true);
      expect(result.data.database).toBe(defaultDb);
      
      // Clean up
      await envTool.execute({
        collection: testCol,
        command: 'dropCollection',
        params: {}
      });
      
      await envModule.mongoProvider.disconnect();
    });

    it('should maintain MongoDBProvider singleton behavior', async () => {
      // Clear any existing provider
      resourceManager.set('MongoDBProvider', null);
      
      // Create first module
      const module1 = await MongoQueryModule.create(resourceManager);
      const provider1 = resourceManager.get('MongoDBProvider');
      
      // Create second module - should reuse provider
      const module2 = await MongoQueryModule.create(resourceManager);
      const provider2 = resourceManager.get('MongoDBProvider');
      
      // Verify same provider instance
      expect(provider1).toBe(provider2);
      expect(module1.mongoProvider).toBe(module2.mongoProvider);
      
      // Clean up
      await provider1.disconnect();
    });

    it('should complete full ResourceManager integration', async () => {
      // Full workflow with ResourceManager - use fresh one
      const rm = await getResourceManager();
      rm.set('MongoDBProvider', null); // Clear any existing provider
      
      // Create module
      const fullModule = await MongoQueryModule.create(rm);
      
      // Get tool
      const fullTool = fullModule.getTool('mongo_query');
      
      // Complex operation sequence
      const testCol = 'full_rm_test_' + Date.now();
      
      // 1. Insert data
      await fullTool.execute({
        collection: testCol,
        command: 'insertMany',
        params: {
          documents: [
            { category: 'A', value: 10 },
            { category: 'B', value: 20 },
            { category: 'A', value: 15 }
          ]
        }
      });
      
      // 2. Aggregate
      const aggResult = await fullTool.execute({
        collection: testCol,
        command: 'aggregate',
        params: {
          pipeline: [
            { $group: { _id: '$category', total: { $sum: '$value' } } },
            { $sort: { _id: 1 } }
          ]
        }
      });
      
      expect(aggResult.success).toBe(true);
      expect(aggResult.data.result).toHaveLength(2);
      expect(aggResult.data.result[0].total).toBe(25); // Category A
      expect(aggResult.data.result[1].total).toBe(20); // Category B
      
      // 3. Clean up
      await fullTool.execute({
        collection: testCol,
        command: 'dropCollection',
        params: {}
      });
      
      await fullModule.mongoProvider.disconnect();
    });
  });
});