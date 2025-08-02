/**
 * MongoDBProvider Integration Tests
 * Phase 2: MongoDB Provider Implementation
 */

import { MongoDBProvider } from '../../src/providers/mongodb/MongoDBProvider.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('MongoDBProvider Integration', () => {
  let mongoServer;
  let provider;
  let connectionString;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    connectionString = mongoServer.getUri();
  });

  afterAll(async () => {
    // Stop MongoDB instance
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    provider = new MongoDBProvider({
      connectionString: connectionString,
      database: 'test'
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    if (provider && provider.connected) {
      await provider.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should connect to MongoDB', async () => {
      await provider.connect();
      
      expect(provider.connected).toBe(true);
      expect(provider.client).toBeDefined();
      expect(provider.db).toBeDefined();
    });

    test('should disconnect from MongoDB', async () => {
      await provider.connect();
      await provider.disconnect();
      
      expect(provider.connected).toBe(false);
      expect(provider.client).toBeNull();
      expect(provider.db).toBeNull();
    });

    test('should handle multiple connect calls', async () => {
      await provider.connect();
      await provider.connect(); // Should not throw
      
      expect(provider.connected).toBe(true);
    });

    test('should handle multiple disconnect calls', async () => {
      await provider.connect();
      await provider.disconnect();
      await provider.disconnect(); // Should not throw
      
      expect(provider.connected).toBe(false);
    });

    test('should extract database name from connection string', () => {
      const provider2 = new MongoDBProvider({
        connectionString: 'mongodb://localhost:27017/mydb'
      });
      
      expect(provider2.databaseName).toBe('mydb');
    });

    test('should use default database name if not in connection string', () => {
      const provider3 = new MongoDBProvider({
        connectionString: 'mongodb://localhost:27017'
      });
      
      expect(provider3.databaseName).toBe('test');
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      await provider.connect();
      // Clear test collection
      try {
        await provider.db.collection('test').drop();
      } catch (e) {
        // Collection might not exist
      }
    });

    describe('Insert Operations', () => {
      test('should insert single document', async () => {
        const doc = { name: 'Test', value: 42 };
        const result = await provider.insert('test', doc);
        
        expect(result.acknowledged).toBe(true);
        expect(result.insertedCount).toBe(1);
        expect(result.insertedIds).toBeDefined();
      });

      test('should insert multiple documents', async () => {
        const docs = [
          { name: 'Test1', value: 1 },
          { name: 'Test2', value: 2 },
          { name: 'Test3', value: 3 }
        ];
        
        const result = await provider.insert('test', docs);
        
        expect(result.acknowledged).toBe(true);
        expect(result.insertedCount).toBe(3);
      });
    });

    describe('Find Operations', () => {
      beforeEach(async () => {
        // Insert test data
        await provider.insert('test', [
          { name: 'Alice', age: 30, active: true },
          { name: 'Bob', age: 25, active: false },
          { name: 'Charlie', age: 35, active: true }
        ]);
      });

      test('should find all documents', async () => {
        const results = await provider.find('test');
        
        expect(results).toHaveLength(3);
      });

      test('should find documents with query', async () => {
        const results = await provider.find('test', { active: true });
        
        expect(results).toHaveLength(2);
        expect(results[0].active).toBe(true);
        expect(results[1].active).toBe(true);
      });

      test('should find with options (limit, sort)', async () => {
        const results = await provider.find('test', {}, {
          limit: 2,
          sort: { age: -1 }
        });
        
        expect(results).toHaveLength(2);
        expect(results[0].name).toBe('Charlie');
        expect(results[1].name).toBe('Alice');
      });

      test('should find one document', async () => {
        const result = await provider.findOne('test', { name: 'Bob' });
        
        expect(result).toBeDefined();
        expect(result.name).toBe('Bob');
      });

      test('should return null when findOne finds nothing', async () => {
        const result = await provider.findOne('test', { name: 'Nobody' });
        
        expect(result).toBeNull();
      });
    });

    describe('Update Operations', () => {
      beforeEach(async () => {
        await provider.insert('test', [
          { _id: '1', name: 'Alice', age: 30 },
          { _id: '2', name: 'Bob', age: 25 }
        ]);
      });

      test('should update single document', async () => {
        const result = await provider.update(
          'test',
          { name: 'Alice' },
          { $set: { age: 31 } }
        );
        
        expect(result.acknowledged).toBe(true);
        expect(result.modifiedCount).toBe(1);
      });

      test('should update multiple documents', async () => {
        const result = await provider.update(
          'test',
          {},
          { $inc: { age: 1 } },
          { multi: true }
        );
        
        expect(result.acknowledged).toBe(true);
        expect(result.modifiedCount).toBe(2);
      });
    });

    describe('Delete Operations', () => {
      beforeEach(async () => {
        await provider.insert('test', [
          { name: 'Alice', temp: true },
          { name: 'Bob', temp: false },
          { name: 'Charlie', temp: true }
        ]);
      });

      test('should delete single document', async () => {
        const result = await provider.delete('test', { name: 'Alice' });
        
        expect(result.acknowledged).toBe(true);
        expect(result.deletedCount).toBe(1);
      });

      test('should delete multiple documents', async () => {
        const result = await provider.delete('test', { temp: true });
        
        expect(result.acknowledged).toBe(true);
        expect(result.deletedCount).toBe(2);
      });
    });
  });

  describe('Collection Management', () => {
    beforeEach(async () => {
      await provider.connect();
    });

    test('should list collections', async () => {
      // Create a collection
      await provider.insert('test_collection', { test: true });
      
      const collections = await provider.listCollections();
      
      expect(Array.isArray(collections)).toBe(true);
      expect(collections).toContain('test_collection');
    });

    test('should drop collection', async () => {
      // Create a collection
      await provider.insert('to_drop', { test: true });
      
      const result = await provider.dropCollection('to_drop');
      
      expect(result).toBe(true);
      
      // Verify it's gone
      const collections = await provider.listCollections();
      expect(collections).not.toContain('to_drop');
    });

    test('should return false when dropping non-existent collection', async () => {
      const result = await provider.dropCollection('does_not_exist');
      
      expect(result).toBe(false);
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(async () => {
      await provider.connect();
      
      // Insert test data
      await provider.insert('sales', [
        { product: 'A', quantity: 10, price: 100 },
        { product: 'B', quantity: 5, price: 200 },
        { product: 'A', quantity: 15, price: 100 },
        { product: 'C', quantity: 20, price: 50 }
      ]);
    });

    test('should perform aggregation', async () => {
      const pipeline = [
        { $group: { 
          _id: '$product', 
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: { $multiply: ['$quantity', '$price'] } }
        }},
        { $sort: { totalRevenue: -1 } }
      ];
      
      const results = await provider.aggregate('sales', pipeline);
      
      expect(results).toHaveLength(3);
      expect(results[0]._id).toBe('A'); // Highest revenue
      expect(results[0].totalQuantity).toBe(25);
      expect(results[0].totalRevenue).toBe(2500);
    });

    test('should create index', async () => {
      const result = await provider.createIndex('sales', { product: 1 });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string'); // Index name
    });

    test('should count documents', async () => {
      const count = await provider.count('sales', { product: 'A' });
      
      expect(count).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when operating without connection', async () => {
      await expect(provider.find('test')).rejects.toThrow();
    });

    test('should handle invalid connection string', async () => {
      const badProvider = new MongoDBProvider({
        connectionString: 'invalid://connection'
      });
      
      await expect(badProvider.connect()).rejects.toThrow();
    });
  });
});