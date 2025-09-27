/**
 * Integration tests for MongoDB Query Builder
 * Tests fluent API for building complex queries
 */

import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { jest } from '@jest/globals';

describe('MongoDB Query Builder Integration Tests', () => {
  let mongod;
  let dataSource;
  let mongoClient;
  let db;
  let collection;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    
    // Create data source
    dataSource = new MongoDBDataSource({ connectionString: uri });
    await dataSource.connect();
    
    // Get direct MongoDB client for test setup
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    db = mongoClient.db('testdb');
    collection = db.collection('users');
  });

  beforeEach(async () => {
    // Clear collection
    await collection.deleteMany({});
    
    // Insert test documents
    await collection.insertMany([
      { name: 'John Doe', age: 30, role: 'admin', active: true, tags: ['user', 'premium'] },
      { name: 'Jane Smith', age: 25, role: 'user', active: true, tags: ['user'] },
      { name: 'Bob Johnson', age: 35, role: 'admin', active: false, tags: ['user', 'staff'] },
      { name: 'Alice Brown', age: 28, role: 'user', active: true, tags: ['premium'] },
      { name: 'Charlie Wilson', age: 32, role: 'moderator', active: true, tags: ['user', 'staff'] }
    ]);
  });

  afterAll(async () => {
    await dataSource.disconnect();
    await mongoClient.close();
    await mongod.stop();
  });

  describe('Basic Query Building', () => {
    test('should create query builder from collection handle', () => {
      const collHandle = dataSource.collection('testdb', 'users');
      const builder = collHandle.query();
      
      expect(builder).toBeDefined();
      expect(builder.where).toBeDefined();
      expect(builder.select).toBeDefined();
      expect(builder.sort).toBeDefined();
      expect(builder.limit).toBeDefined();
      expect(builder.execute).toBeDefined();
    });

    test('should build and execute simple where query', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ role: 'admin' })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('John Doe');
      expect(results[1].name).toBe('Bob Johnson');
    });

    test('should build query with multiple where conditions', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ role: 'admin' })
        .where({ active: true })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');
    });
  });

  describe('Comparison Operators', () => {
    test('should support greater than operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ age: { $gt: 30 } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toEqual(
        expect.arrayContaining(['Bob Johnson', 'Charlie Wilson'])
      );
    });

    test('should support less than or equal operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ age: { $lte: 28 } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toEqual(
        expect.arrayContaining(['Jane Smith', 'Alice Brown'])
      );
    });

    test('should support in operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ role: { $in: ['admin', 'moderator'] } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
    });

    test('should support exists operator', async () => {
      // Add document with extra field
      await collection.insertOne({ name: 'Test User', age: 40, email: 'test@example.com' });
      
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ email: { $exists: true } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test User');
    });
  });

  describe('Logical Operators', () => {
    test('should support OR operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .or([
          { role: 'admin' },
          { age: { $lt: 26 } }
        ])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
      expect(results.map(r => r.name)).toEqual(
        expect.arrayContaining(['John Doe', 'Jane Smith', 'Bob Johnson'])
      );
    });

    test('should support AND operator explicitly', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .and([
          { active: true },
          { age: { $gte: 30 } }
        ])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toEqual(
        expect.arrayContaining(['John Doe', 'Charlie Wilson'])
      );
    });

    test('should support NOT operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .not({ role: 'user' })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.role !== 'user')).toBe(true);
    });

    test('should support NOR operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .nor([
          { role: 'admin' },
          { age: { $lt: 28 } }
        ])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toEqual(
        expect.arrayContaining(['Alice Brown', 'Charlie Wilson'])
      );
    });
  });

  describe('Array Operators', () => {
    test('should query arrays with $all operator', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ tags: { $all: ['user', 'premium'] } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');
    });

    test('should query arrays with $elemMatch', async () => {
      // Insert documents with complex arrays
      await collection.insertOne({
        name: 'Test User',
        scores: [
          { subject: 'math', score: 90 },
          { subject: 'science', score: 85 }
        ]
      });
      
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({
          scores: {
            $elemMatch: { subject: 'math', score: { $gte: 90 } }
          }
        })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test User');
    });

    test('should query array size', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ tags: { $size: 2 } })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3); // John, Bob, Charlie
    });
  });

  describe('Projection', () => {
    test('should select specific fields', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .select(['name', 'age'])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('age');
      expect(results[0]).not.toHaveProperty('role');
      expect(results[0]).not.toHaveProperty('active');
    });

    test('should exclude specific fields', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .exclude(['_id', 'tags'])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(5);
      expect(results[0]).not.toHaveProperty('_id');
      expect(results[0]).not.toHaveProperty('tags');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('age');
    });
  });

  describe('Sorting', () => {
    test('should sort ascending', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ age: 1 })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results[0].name).toBe('Jane Smith');
      expect(results[4].name).toBe('Bob Johnson');
    });

    test('should sort descending', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ age: -1 })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results[0].name).toBe('Bob Johnson');
      expect(results[4].name).toBe('Jane Smith');
    });

    test('should support multiple sort fields', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ role: 1, age: -1 })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      // Should be grouped by role, then sorted by age within each group
      const admins = results.filter(r => r.role === 'admin');
      expect(admins[0].age).toBeGreaterThan(admins[1].age);
    });
  });

  describe('Pagination', () => {
    test('should limit results', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .limit(2)
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
    });

    test('should skip results', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ age: 1 })
        .skip(2)
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
      expect(results[0].age).toBe(30); // Skip first 2 (25, 28)
    });

    test('should combine skip and limit for pagination', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ age: 1 })
        .skip(1)
        .limit(2)
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results[0].age).toBe(28);
      expect(results[1].age).toBe(30);
    });
  });

  describe('Aggregation Pipeline', () => {
    test('should support aggregation through pipeline method', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .pipeline([
          { $match: { active: true } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
      expect(results[0]._id).toBe('user');
      expect(results[0].count).toBe(2);
    });

    test('should build aggregation pipeline from query methods', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ active: true })
        .group({ _id: '$role', avgAge: { $avg: '$age' } })
        .sort({ avgAge: -1 })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(3);
      expect(results[0]._id).toBe('moderator');
      expect(results[0].avgAge).toBe(32);
    });
  });

  describe('Counting', () => {
    test('should count all documents', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .count();
      
      const count = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(count).toBe(5);
    });

    test('should count with filter', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ role: 'admin' })
        .count();
      
      const count = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(count).toBe(2);
    });
  });

  describe('Distinct Values', () => {
    test('should get distinct values for field', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .distinct('role');
      
      const roles = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(roles).toHaveLength(3);
      expect(roles).toEqual(expect.arrayContaining(['admin', 'user', 'moderator']));
    });

    test('should get distinct values with filter', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ active: true })
        .distinct('role');
      
      const roles = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(roles).toHaveLength(3);
      expect(roles).toEqual(expect.arrayContaining(['admin', 'user', 'moderator']));
    });
  });

  describe('Method Chaining', () => {
    test('should support complex method chaining', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ active: true })
        .where({ age: { $gte: 28 } })
        .select(['name', 'age', 'role'])
        .sort({ age: -1 })
        .limit(2)
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Charlie Wilson');
      expect(results[1].name).toBe('John Doe');
      expect(results[0]).not.toHaveProperty('active');
    });

    test('should maintain immutability - reusing builder', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      const baseQuery = collHandle.query().where({ active: true });
      
      // Create two different queries from base
      const query1 = baseQuery.where({ role: 'admin' });
      const query2 = baseQuery.where({ role: 'user' });
      
      const results1 = await new Promise(resolve => 
        query1.execute().onData(resolve)
      );
      const results2 = await new Promise(resolve => 
        query2.execute().onData(resolve)
      );
      
      expect(results1).toHaveLength(1);
      expect(results1[0].name).toBe('John Doe');
      
      expect(results2).toHaveLength(2);
      expect(results2.map(r => r.name)).toEqual(
        expect.arrayContaining(['Jane Smith', 'Alice Brown'])
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid field in where clause', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .where({ $invalidOperator: 'value' })
        .execute();
      
      await expect(new Promise((resolve, reject) => {
        resultHandle.onData((data, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      })).rejects.toThrow();
    });

    test('should handle invalid sort specification', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .sort({ age: 'invalid' }) // Should be 1 or -1
        .execute();
      
      await expect(new Promise((resolve, reject) => {
        resultHandle.onData((data, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      })).rejects.toThrow();
    });
  });

  describe('Raw Query Access', () => {
    test('should provide access to raw MongoDB query', () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const builder = collHandle.query()
        .where({ role: 'admin' })
        .where({ active: true })
        .select(['name', 'age'])
        .sort({ age: -1 })
        .limit(10);
      
      const raw = builder.toMongoQuery();
      
      expect(raw.filter).toEqual({
        role: 'admin',
        active: true
      });
      expect(raw.projection).toEqual({
        name: 1,
        age: 1
      });
      expect(raw.sort).toEqual({ age: -1 });
      expect(raw.limit).toBe(10);
    });

    test('should allow raw MongoDB query execution', async () => {
      const collHandle = dataSource.collection('testdb', 'users');
      
      const resultHandle = collHandle.query()
        .raw({
          filter: { role: 'admin' },
          projection: { name: 1, _id: 0 },
          sort: { name: 1 }
        })
        .execute();
      
      const results = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Bob Johnson');
      expect(results[1].name).toBe('John Doe');
    });
  });
});