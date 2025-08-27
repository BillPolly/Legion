/**
 * Integration tests for Query Operations
 * Tests with real MongoDB connection - NO MOCKS
 */

import { getResourceManager } from '@legion/resource-manager';
import MongoQueryModule from '../../src/MongoQueryModule.js';

describe('Query Operations - Real MongoDB Integration', () => {
  let resourceManager;
  let module;
  let tool;
  const testCollection = 'test_query_' + Date.now();
  const testDatabase = 'legion_test';

  beforeAll(async () => {
    // Get real ResourceManager with .env loaded
    resourceManager = await getResourceManager();
    
    // Create module with real MongoDB
    module = await MongoQueryModule.create(resourceManager);
    tool = module.getTool('mongo_query');
    
    // Insert test data
    await tool.execute({
      database: testDatabase,
      collection: testCollection,
      command: 'insertMany',
      params: {
        documents: [
          { name: 'Alice', age: 30, city: 'New York', active: true },
          { name: 'Bob', age: 25, city: 'Los Angeles', active: true },
          { name: 'Charlie', age: 35, city: 'New York', active: false },
          { name: 'David', age: 28, city: 'Chicago', active: true },
          { name: 'Eve', age: 32, city: 'Los Angeles', active: false }
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
    
    // Disconnect MongoDB
    if (module.mongoProvider && module.mongoProvider.connected) {
      await module.mongoProvider.disconnect();
    }
  });

  describe('Find Operations', () => {
    it('should find with empty query', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {}
      });

      expect(result).toBeDefined();
      expect(result.result).toBeInstanceOf(Array);
      expect(result.result.length).toBe(5);
    });

    it('should find with query conditions', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: { active: true }
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(3);
      result.result.forEach(doc => {
        expect(doc.active).toBe(true);
      });
    });

    it('should find with sort option', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: {},
          options: { sort: { age: -1 } }
        }
      });

      expect(result).toBeDefined();
      const ages = result.result.map(doc => doc.age);
      expect(ages).toEqual([35, 32, 30, 28, 25]);
    });

    it('should find with limit option', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: {},
          options: { limit: 2 }
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(2);
    });

    it('should find with skip option', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: {},
          options: { skip: 3, limit: 10 }
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(2); // Only 2 docs left after skipping 3
    });

    it('should find with projection', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'find',
        params: {
          query: { active: true },
          options: { projection: { name: 1, age: 1, _id: 0 } }
        }
      });

      expect(result).toBeDefined();
      result.result.forEach(doc => {
        expect(doc).toHaveProperty('name');
        expect(doc).toHaveProperty('age');
        expect(doc).not.toHaveProperty('city');
        expect(doc).not.toHaveProperty('active');
      });
    });
  });

  describe('FindOne Operations', () => {
    it('should findOne with query', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: {
          query: { name: 'Alice' }
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toBeInstanceOf(Object);
      expect(result.result.name).toBe('Alice');
      expect(result.result.age).toBe(30);
    });

    it('should findOne with projection', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: {
          query: { name: 'Bob' },
          options: { projection: { name: 1, _id: 0 } }
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toEqual({ name: 'Bob' });
    });

    it('should return null for findOne with no match', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'findOne',
        params: {
          query: { name: 'NonExistent' }
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toBeNull();
    });
  });

  describe('Count Operations', () => {
    it('should count with empty query', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'countDocuments',
        params: {}
      });

      expect(result).toBeDefined();
      expect(result.result).toBe(5);
    });

    it('should count with conditions', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'countDocuments',
        params: {
          query: { city: 'New York' }
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toBe(2);
    });
  });

  describe('Distinct Operations', () => {
    it('should get distinct field values', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'distinct',
        params: {
          field: 'city'
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toBeInstanceOf(Array);
      expect(result.result.sort()).toEqual(['Chicago', 'Los Angeles', 'New York']);
    });

    it('should get distinct with query filter', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'distinct',
        params: {
          field: 'city',
          query: { active: true }
        }
      });

      expect(result).toBeDefined();
      expect(result.result.sort()).toEqual(['Chicago', 'Los Angeles', 'New York']);
    });
  });

  describe('Aggregation Pipeline', () => {
    it('should execute simple aggregation', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'aggregate',
        params: {
          pipeline: [
            { $match: { active: true } },
            { $project: { name: 1, age: 1, _id: 0 } }
          ]
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(3);
      result.result.forEach(doc => {
        expect(doc).toHaveProperty('name');
        expect(doc).toHaveProperty('age');
      });
    });

    it('should execute complex multi-stage pipeline', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'aggregate',
        params: {
          pipeline: [
            { $match: { age: { $gte: 28 } } },
            { $group: { 
              _id: '$city', 
              count: { $sum: 1 },
              avgAge: { $avg: '$age' }
            }},
            { $sort: { count: -1 } }
          ]
        }
      });

      expect(result).toBeDefined();
      expect(result.result).toBeInstanceOf(Array);
      // Verify grouping worked
      result.result.forEach(doc => {
        expect(doc).toHaveProperty('_id'); // city name
        expect(doc).toHaveProperty('count');
        expect(doc).toHaveProperty('avgAge');
      });
    });

    it('should execute aggregation with $group', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'aggregate',
        params: {
          pipeline: [
            { $group: { 
              _id: '$active', 
              count: { $sum: 1 },
              names: { $push: '$name' }
            }}
          ]
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(2); // true and false groups
      
      const activeGroup = result.result.find(g => g._id === true);
      expect(activeGroup.count).toBe(3);
      expect(activeGroup.names.length).toBe(3);
    });

    it('should execute aggregation with $sort', async () => {
      const result = await tool.execute({
        database: testDatabase,
        collection: testCollection,
        command: 'aggregate',
        params: {
          pipeline: [
            { $sort: { age: 1 } },
            { $limit: 3 },
            { $project: { name: 1, age: 1, _id: 0 } }
          ]
        }
      });

      expect(result).toBeDefined();
      expect(result.result.length).toBe(3);
      expect(result.result[0].age).toBe(25); // Youngest
      expect(result.result[2].age).toBe(30); // Third youngest
    });
  });
});