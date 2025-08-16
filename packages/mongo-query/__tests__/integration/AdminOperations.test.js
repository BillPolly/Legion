/**
 * Integration tests for Admin Operations
 * Tests with real MongoDB connection - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('Admin Operations - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testDatabase = 'legion_test';
  const testCollectionPrefix = 'test_admin_';

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Create module with real MongoDB
    module = await MongoQueryModule.create(resourceManager);
    tool = module.getTool('mongo_query');
  });

  afterAll(async () => {
    // Clean up any test collections
    const collections = await tool.execute({
      database: testDatabase,
      collection: '',
      command: 'listCollections',
      params: {}
    });
    
    for (const collName of collections.data.result) {
      if (collName.startsWith(testCollectionPrefix)) {
        await tool.execute({
          database: testDatabase,
          collection: collName,
          command: 'dropCollection',
          params: {}
        });
      }
    }
    
    // Disconnect MongoDB
    if (module.mongoProvider && module.mongoProvider.connected) {
      await module.mongoProvider.disconnect();
    }
  });

  describe('Collection Management', () => {
    const testCollection = testCollectionPrefix + Date.now();

    beforeEach(async () => {
      // Create collection with some data
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertOne',
        params: { document: { test: true } }
      });
    });

    it('should list collections', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: '',  // Not needed for listCollections
        command: 'listCollections',
        params: {}
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeInstanceOf(Array);
      expect(result.data.result).toContain(testCollection);
    });

    it('should drop collection', async () => {
      // Verify collection exists
      let collections = await tool.execute({
        database: testDatabase,
        collection: '',
        command: 'listCollections',
        params: {}
      });
      expect(collections.data.result).toContain(testCollection);

      // Drop the collection
      const dropResult = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'dropCollection',
        params: {}
      });

      expect(dropResult.success).toBe(true);
      expect(dropResult.data.result).toBe(true);

      // Verify collection no longer exists
      collections = await tool.execute({
        database: testDatabase,
        collection: '',
        command: 'listCollections',
        params: {}
      });
      expect(collections.data.result).not.toContain(testCollection);
    });

    it('should handle dropping non-existent collection', async () => {
      const nonExistentCollection = testCollectionPrefix + 'nonexistent_' + Date.now();
      
      const result = await tool.execute({
        database: testDatabase,
        collection: nonExistentCollection,
        command: 'dropCollection',
        params: {}
      });

      expect(result.success).toBe(true);
      // MongoDB 5.0+ returns true even for non-existent collections (no error)
      expect(typeof result.data.result).toBe('boolean');
    });
  });

  describe('Index Management', () => {
    const testCollection = testCollectionPrefix + 'indexes_' + Date.now();

    beforeAll(async () => {
      // Create collection with test data
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'insertMany',
        params: {
          documents: [
            { name: 'Alice', age: 30, email: 'alice@example.com' },
            { name: 'Bob', age: 25, email: 'bob@example.com' },
            { name: 'Charlie', age: 35, email: 'charlie@example.com' }
          ]
        }
      });
    });

    afterAll(async () => {
      // Clean up test collection
      await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'dropCollection',
        params: {}
      });
    });

    it('should create single field index', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'createIndex',
        params: {
          keys: { email: 1 }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeDefined();
      // MongoDB returns the index name
      expect(typeof result.data.result).toBe('string');
    });

    it('should create compound index', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'createIndex',
        params: {
          keys: { name: 1, age: -1 }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBeDefined();
      expect(typeof result.data.result).toBe('string');
    });

    it('should create index with options', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'createIndex',
        params: {
          keys: { email: 1 },
          options: {
            unique: true,
            name: 'unique_email_index'
          }
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBe('unique_email_index');
    });
  });
});