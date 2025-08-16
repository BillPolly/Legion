/**
 * Integration tests for Write Operations
 * Tests with real MongoDB connection - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('Write Operations - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testCollection = 'test_write_' + Date.now();
  const testDatabase = 'legion_test';

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Create module with real MongoDB
    module = await MongoQueryModule.create(resourceManager);
    tool = module.getTool('mongo_query');
  });

  afterEach(async () => {
    // Clean up test collection after each test
    await tool.execute({
      database: testDatabase,
      collection: testCollection,
      command: 'deleteMany',
      params: { filter: {} }
    });
  });

  afterAll(async () => {
    // Drop test collection
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

  describe('Insert Operations', () => {
    it('should insertOne document', async () => {
      const doc = { name: 'Test User', age: 25, email: 'test@example.com' };
      
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { document: doc }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.insertedCount).toBe(1);
      expect(result.data.result.acknowledged).toBe(true);
      
      // Verify document was inserted
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: { query: { name: 'Test User' } }
      });
      
      expect(findResult.data.result.length).toBe(1);
      expect(findResult.data.result[0].name).toBe('Test User');
    });

    it('should insertMany documents', async () => {
      const docs = [
        { name: 'User 1', age: 20, role: 'admin' },
        { name: 'User 2', age: 30, role: 'user' },
        { name: 'User 3', age: 25, role: 'user' }
      ];
      
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertMany',
        params: { documents: docs }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.insertedCount).toBe(3);
      expect(result.data.result.acknowledged).toBe(true);
      
      // Verify all documents were inserted
      const countResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'countDocuments',
        params: {}
      });
      
      expect(countResult.data.result).toBe(3);
    });

    it('should handle insert validation errors gracefully', async () => {
      // Try to insert with invalid params - missing document field
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { notDocument: 'test' }  // Wrong field name
      });

      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toBeDefined();
    });
  });

  describe('Update Operations', () => {
    beforeEach(async () => {
      // Insert test data
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertMany',
        params: {
          documents: [
            { name: 'Alice', age: 30, status: 'active' },
            { name: 'Bob', age: 25, status: 'inactive' },
            { name: 'Charlie', age: 35, status: 'active' },
            { name: 'David', age: 28, status: 'inactive' }
          ]
        }
      });
    });

    it('should updateOne document', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { name: 'Alice' },
          update: { $set: { age: 31, status: 'premium' } }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.modifiedCount).toBe(1);
      expect(result.data.result.matchedCount).toBe(1);
      
      // Verify update
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { name: 'Alice' } }
      });
      
      expect(findResult.data.result.age).toBe(31);
      expect(findResult.data.result.status).toBe('premium');
    });

    it('should updateMany documents', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateMany',
        params: {
          filter: { status: 'inactive' },
          update: { $set: { status: 'active' }, $inc: { age: 1 } }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.modifiedCount).toBe(2);
      expect(result.data.result.matchedCount).toBe(2);
      
      // Verify updates
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: { query: { name: { $in: ['Bob', 'David'] } } }
      });
      
      findResult.data.result.forEach(doc => {
        expect(doc.status).toBe('active');
      });
      expect(findResult.data.result.find(d => d.name === 'Bob').age).toBe(26);
      expect(findResult.data.result.find(d => d.name === 'David').age).toBe(29);
    });

    it('should update with upsert option', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { name: 'Eve' },
          update: { $set: { name: 'Eve', age: 40, status: 'new' } },
          options: { upsert: true }
        }
      });

      expect(result.success).toBe(true);
      // Should have created a new document
      expect(result.data.result.matchedCount).toBe(0);
      expect(result.data.result.acknowledged).toBe(true);
      
      // Verify new document exists
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { name: 'Eve' } }
      });
      
      expect(findResult.data.result).not.toBeNull();
      expect(findResult.data.result.age).toBe(40);
    });

    it('should update with $set operator', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateOne',
        params: {
          filter: { name: 'Charlie' },
          update: { $set: { newField: 'test', age: 36 } }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.modifiedCount).toBe(1);
      
      const doc = (await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { name: 'Charlie' } }
      })).data.result;
      
      expect(doc.newField).toBe('test');
      expect(doc.age).toBe(36);
    });

    it('should update with $inc operator', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'updateMany',
        params: {
          filter: { status: 'active' },
          update: { $inc: { age: 5 } }
        }
      });

      expect(result.success).toBe(true);
      
      const alice = (await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { name: 'Alice' } }
      })).data.result;
      
      expect(alice.age).toBe(35); // 30 + 5
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      // Insert test data
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertMany',
        params: {
          documents: [
            { name: 'Alice', category: 'A' },
            { name: 'Bob', category: 'B' },
            { name: 'Charlie', category: 'A' },
            { name: 'David', category: 'B' },
            { name: 'Eve', category: 'C' }
          ]
        }
      });
    });

    it('should deleteOne document', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'deleteOne',
        params: {
          filter: { name: 'Alice' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.deletedCount).toBe(1);
      
      // Verify deletion
      const findResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: { query: { name: 'Alice' } }
      });
      
      expect(findResult.data.result).toBeNull();
    });

    it('should deleteMany documents', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'deleteMany',
        params: {
          filter: { category: 'B' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.deletedCount).toBe(2);
      
      // Verify remaining documents
      const countResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'countDocuments',
        params: {}
      });
      
      expect(countResult.data.result).toBe(3); // Only A and C category docs remain
    });

    it('should handle delete with no matches', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'deleteOne',
        params: {
          filter: { name: 'NonExistent' }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result.deletedCount).toBe(0);
      
      // Verify no documents were deleted
      const countResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'countDocuments',
        params: {}
      });
      
      expect(countResult.data.result).toBe(5);
    });
  });
});