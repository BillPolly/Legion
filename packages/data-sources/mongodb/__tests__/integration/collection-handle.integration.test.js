/**
 * Integration tests for MongoCollectionHandle
 * Tests all collection-level operations with real MongoDB
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { MongoServerHandle } from '../../src/handles/MongoServerHandle.js';
import { MongoDatabaseHandle } from '../../src/handles/MongoDatabaseHandle.js';
import { MongoCollectionHandle } from '../../src/handles/MongoCollectionHandle.js';
import { MongoDocumentHandle } from '../../src/handles/MongoDocumentHandle.js';
import { QueryResultHandle } from '../../src/handles/QueryResultHandle.js';
import { UpdateResultHandle } from '../../src/handles/UpdateResultHandle.js';

describe('MongoCollectionHandle Integration Tests', () => {
  let mongod;
  let connectionString;
  let dataSource;
  let testClient;
  let collHandle;
  const testDbName = 'testdb';
  const testCollName = 'testcoll';

  beforeAll(async () => {
    // Start MongoDB Memory Server once
    mongod = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0'
      }
    });
    connectionString = mongod.getUri();
  }, 60000);

  afterAll(async () => {
    // Stop MongoDB Memory Server
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    // Create test client
    testClient = new MongoClient(connectionString);
    await testClient.connect();
    
    // Create data source
    dataSource = new MongoDBDataSource(connectionString);
    await dataSource.connect();
    
    // Get collection handle through hierarchy
    const serverHandle = new MongoServerHandle(dataSource, connectionString);
    const dbHandle = serverHandle.database(testDbName);
    collHandle = dbHandle.collection(testCollName);
    
    // Clear collection for clean test
    const db = testClient.db(testDbName);
    const collection = db.collection(testCollName);
    
    // Drop all indexes except _id to ensure clean state
    try {
      await collection.dropIndexes();
    } catch (err) {
      // Ignore error if no indexes exist
    }
    
    // Clear all documents
    await collection.deleteMany({});
  });

  afterEach(async () => {
    // Cleanup
    if (dataSource) {
      await dataSource.disconnect();
    }
    if (testClient) {
      await testClient.close();
    }
  });

  describe('Constructor and Validation', () => {
    it('should create collection handle with valid parameters', () => {
      const handle = new MongoCollectionHandle(dataSource, 'db', 'coll');
      expect(handle.database).toBe('db');
      expect(handle.collection).toBe('coll');
      expect(handle.dataSource).toBe(dataSource);
    });

    it('should throw error for missing database name', () => {
      expect(() => new MongoCollectionHandle(dataSource, null, 'coll'))
        .toThrow('Database name is required');
    });

    it('should throw error for missing collection name', () => {
      expect(() => new MongoCollectionHandle(dataSource, 'db', null))
        .toThrow('Collection name is required');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Insert test data
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { _id: 1, name: 'Alice', age: 30, city: 'New York' },
        { _id: 2, name: 'Bob', age: 25, city: 'Los Angeles' },
        { _id: 3, name: 'Charlie', age: 35, city: 'Chicago' },
        { _id: 4, name: 'David', age: 28, city: 'New York' },
        { _id: 5, name: 'Eve', age: 32, city: 'Boston' }
      ]);
    });

    it('should find all documents', async () => {
      const resultHandle = collHandle.find();
      expect(resultHandle).toBeInstanceOf(QueryResultHandle);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const docs = resultHandle.value();
      expect(docs).toBeInstanceOf(Array);
      expect(docs.length).toBe(5);
    });

    it('should find documents with filter', async () => {
      const resultHandle = collHandle.find({ city: 'New York' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const docs = resultHandle.value();
      expect(docs.length).toBe(2);
      expect(docs[0].name).toBe('Alice');
      expect(docs[1].name).toBe('David');
    });

    it('should find with projection', async () => {
      const resultHandle = collHandle.find({}, { projection: { name: 1, _id: 0 } });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const docs = resultHandle.value();
      expect(docs.length).toBe(5);
      expect(docs[0]).toEqual({ name: 'Alice' });
      expect(docs[0].age).toBeUndefined();
    });

    it('should find with sort', async () => {
      const resultHandle = collHandle.find({}, { sort: { age: -1 } });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const docs = resultHandle.value();
      expect(docs[0].name).toBe('Charlie'); // Age 35
      expect(docs[1].name).toBe('Eve');     // Age 32
    });

    it('should find with limit and skip', async () => {
      const resultHandle = collHandle.find({}, { 
        sort: { _id: 1 },
        limit: 2, 
        skip: 1 
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const docs = resultHandle.value();
      expect(docs.length).toBe(2);
      expect(docs[0].name).toBe('Bob');
      expect(docs[1].name).toBe('Charlie');
    });

    it('should find single document', async () => {
      const resultHandle = collHandle.findOne({ name: 'Bob' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const doc = resultHandle.value();
      expect(doc).toBeDefined();
      expect(doc.name).toBe('Bob');
      expect(doc.age).toBe(25);
    });

    it('should return null for findOne with no match', async () => {
      const resultHandle = collHandle.findOne({ name: 'Nobody' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const doc = resultHandle.value();
      expect(doc).toBeNull();
    });

    it('should count documents', async () => {
      const resultHandle = collHandle.countDocuments();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const count = resultHandle.value();
      expect(count).toBe(5);
    });

    it('should count documents with filter', async () => {
      const resultHandle = collHandle.countDocuments({ city: 'New York' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const count = resultHandle.value();
      expect(count).toBe(2);
    });

    it('should get distinct values', async () => {
      const resultHandle = collHandle.distinct('city');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cities = resultHandle.value();
      expect(cities).toBeInstanceOf(Array);
      expect(cities.sort()).toEqual(['Boston', 'Chicago', 'Los Angeles', 'New York']);
    });

    it('should get distinct values with filter', async () => {
      const resultHandle = collHandle.distinct('name', { age: { $gte: 30 } });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const names = resultHandle.value();
      expect(names.sort()).toEqual(['Alice', 'Charlie', 'Eve']);
    });

    it('should throw error for distinct without field', () => {
      expect(() => collHandle.distinct())
        .toThrow('Field name is required for distinct operation');
    });
  });

  describe('Aggregation Operations', () => {
    beforeEach(async () => {
      // Insert test data
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { category: 'Electronics', product: 'Laptop', price: 999 },
        { category: 'Electronics', product: 'Phone', price: 699 },
        { category: 'Furniture', product: 'Desk', price: 299 },
        { category: 'Furniture', product: 'Chair', price: 199 },
        { category: 'Electronics', product: 'Tablet', price: 399 }
      ]);
    });

    it('should run aggregation pipeline', async () => {
      const pipeline = [
        { $match: { category: 'Electronics' } },
        { $group: { 
          _id: '$category', 
          avgPrice: { $avg: '$price' },
          count: { $sum: 1 }
        }}
      ];
      
      const resultHandle = collHandle.aggregate(pipeline);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBeInstanceOf(Array);
      expect(result[0]._id).toBe('Electronics');
      expect(result[0].count).toBe(3);
      expect(result[0].avgPrice).toBeCloseTo(699, 0);
    });

    it('should throw error for non-array pipeline', () => {
      expect(() => collHandle.aggregate({}))
        .toThrow('Pipeline must be an array');
    });
  });

  describe('Insert Operations', () => {
    it('should insert single document', async () => {
      const doc = { name: 'Test', value: 123 };
      const resultHandle = collHandle.insertOne(doc);
      expect(resultHandle).toBeInstanceOf(UpdateResultHandle);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(1);
      
      // Verify document was inserted
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const inserted = await collection.findOne({ name: 'Test' });
      expect(inserted.value).toBe(123);
    });

    it('should insert multiple documents', async () => {
      const docs = [
        { name: 'Doc1', value: 1 },
        { name: 'Doc2', value: 2 },
        { name: 'Doc3', value: 3 }
      ];
      const resultHandle = collHandle.insertMany(docs);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.insertedCount).toBe(3);
      
      // Verify documents were inserted
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const count = await collection.countDocuments();
      expect(count).toBe(3);
    });

    it('should throw error for insertOne without document', () => {
      expect(() => collHandle.insertOne())
        .toThrow('Document is required for insert');
    });

    it('should throw error for insertMany without documents', () => {
      expect(() => collHandle.insertMany([]))
        .toThrow('Documents array is required for insertMany');
    });
  });

  describe('Update Operations', () => {
    beforeEach(async () => {
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { _id: 1, name: 'Item1', count: 5 },
        { _id: 2, name: 'Item2', count: 10 },
        { _id: 3, name: 'Item3', count: 5 }
      ]);
    });

    it('should update single document', async () => {
      const resultHandle = collHandle.updateOne(
        { name: 'Item1' },
        { $inc: { count: 1 } }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const doc = await collection.findOne({ name: 'Item1' });
      expect(doc.count).toBe(6);
    });

    it('should update multiple documents', async () => {
      const resultHandle = collHandle.updateMany(
        { count: 5 },
        { $set: { status: 'low' } }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.modifiedCount).toBe(2);
      
      // Verify updates
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const updated = await collection.find({ status: 'low' }).toArray();
      expect(updated.length).toBe(2);
    });

    it('should replace document', async () => {
      const resultHandle = collHandle.replaceOne(
        { name: 'Item1' },
        { name: 'NewItem', newField: 'value' }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.modifiedCount).toBe(1);
      
      // Verify replacement
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const doc = await collection.findOne({ name: 'NewItem' });
      expect(doc).toBeDefined();
      expect(doc.count).toBeUndefined(); // Old field removed
      expect(doc.newField).toBe('value');
    });

    it('should throw error for updateOne without filter', () => {
      expect(() => collHandle.updateOne(null, { $set: { a: 1 } }))
        .toThrow('Filter is required for update');
    });

    it('should throw error for updateOne without update', () => {
      expect(() => collHandle.updateOne({ a: 1 }, null))
        .toThrow('Update operations are required');
    });
  });

  describe('Delete Operations', () => {
    beforeEach(async () => {
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { _id: 1, type: 'A' },
        { _id: 2, type: 'B' },
        { _id: 3, type: 'A' },
        { _id: 4, type: 'C' },
        { _id: 5, type: 'A' }
      ]);
    });

    it('should delete single document', async () => {
      const resultHandle = collHandle.deleteOne({ type: 'A' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(1);
      
      // Verify deletion
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const count = await collection.countDocuments({ type: 'A' });
      expect(count).toBe(2); // Started with 3, deleted 1
    });

    it('should delete multiple documents', async () => {
      const resultHandle = collHandle.deleteMany({ type: 'A' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.acknowledged).toBe(true);
      expect(result.deletedCount).toBe(3);
      
      // Verify deletion
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const count = await collection.countDocuments({ type: 'A' });
      expect(count).toBe(0);
    });

    it('should throw error for deleteOne without filter', () => {
      expect(() => collHandle.deleteOne())
        .toThrow('Filter is required for delete');
    });
  });

  describe('FindAndModify Operations', () => {
    beforeEach(async () => {
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { _id: 1, name: 'Item1', value: 10 },
        { _id: 2, name: 'Item2', value: 20 },
        { _id: 3, name: 'Item3', value: 30 }
      ]);
    });

    it('should findOneAndUpdate document', async () => {
      const resultHandle = collHandle.findOneAndUpdate(
        { name: 'Item2' },
        { $inc: { value: 5 } },
        { returnDocument: 'after' }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBeDefined();
      expect(result.name).toBe('Item2');
      expect(result.value).toBe(25);
    });

    it('should findOneAndReplace document', async () => {
      const resultHandle = collHandle.findOneAndReplace(
        { name: 'Item1' },
        { name: 'NewItem', newValue: 100 },
        { returnDocument: 'after' }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBeDefined();
      expect(result.name).toBe('NewItem');
      expect(result.newValue).toBe(100);
      expect(result.value).toBeUndefined();
    });

    it('should findOneAndDelete document', async () => {
      const resultHandle = collHandle.findOneAndDelete({ name: 'Item3' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBeDefined();
      expect(result.name).toBe('Item3');
      expect(result.value).toBe(30);
      
      // Verify deletion
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const doc = await collection.findOne({ name: 'Item3' });
      expect(doc).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    it('should execute bulk write operations', async () => {
      const operations = [
        { insertOne: { document: { _id: 1, name: 'Doc1' } } },
        { insertOne: { document: { _id: 2, name: 'Doc2' } } },
        { updateOne: { 
          filter: { _id: 1 }, 
          update: { $set: { status: 'active' } } 
        }},
        { deleteOne: { filter: { _id: 2 } } }
      ];
      
      const resultHandle = collHandle.bulkWrite(operations);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = resultHandle.value();
      expect(result).toBeDefined();
      expect(result.insertedCount).toBe(2);
      expect(result.modifiedCount).toBe(1);
      expect(result.deletedCount).toBe(1);
      
      // Verify operations
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const doc1 = await collection.findOne({ _id: 1 });
      expect(doc1.status).toBe('active');
      const doc2 = await collection.findOne({ _id: 2 });
      expect(doc2).toBeNull();
    });

    it('should throw error for bulkWrite without operations', () => {
      expect(() => collHandle.bulkWrite([]))
        .toThrow('Operations array is required for bulkWrite');
    });
  });

  describe('Index Operations', () => {
    it('should create index', async () => {
      const resultHandle = collHandle.createIndex(
        { name: 1 },
        { unique: true }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBeDefined();
      expect(result).toContain('name_1');
      
      // Verify index was created
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      const indexes = await collection.indexes();
      const nameIndex = indexes.find(idx => idx.name === 'name_1');
      expect(nameIndex).toBeDefined();
      expect(nameIndex.unique).toBe(true);
    });

    it('should list indexes', async () => {
      // Create an index first
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.createIndex({ field: 1 });
      
      const resultHandle = collHandle.indexes();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const indexes = resultHandle.value();
      expect(indexes).toBeInstanceOf(Array);
      expect(indexes.length).toBeGreaterThan(0);
      expect(indexes.some(idx => idx.key && idx.key.field === 1)).toBe(true);
    });

    it('should drop index', async () => {
      // Create an index first
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.createIndex({ field: 1 }, { name: 'field_index' });
      
      const resultHandle = collHandle.dropIndex('field_index');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result.ok).toBe(1);
      
      // Verify index was dropped
      const indexes = await collection.indexes();
      const fieldIndex = indexes.find(idx => idx.name === 'field_index');
      expect(fieldIndex).toBeUndefined();
    });

    it('should throw error for createIndex without keys', () => {
      expect(() => collHandle.createIndex({}))
        .toThrow('Index keys are required');
    });

    it('should throw error for dropIndex without name', () => {
      expect(() => collHandle.dropIndex())
        .toThrow('Index name is required');
    });
  });

  describe('Collection Operations', () => {
    it('should get collection statistics', async () => {
      // Insert some data first
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertMany([
        { a: 1 }, { b: 2 }, { c: 3 }
      ]);
      
      const resultHandle = collHandle.value();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = resultHandle.value();
      expect(stats).toBeDefined();
      expect(stats.ns).toBe(`${testDbName}.${testCollName}`);
      expect(stats.count).toBe(3);
    });

    it('should drop collection', async () => {
      // Create collection with data
      const db = testClient.db(testDbName);
      const collection = db.collection(testCollName);
      await collection.insertOne({ test: 'data' });
      
      const resultHandle = collHandle.drop();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = resultHandle.value();
      expect(result).toBe(true);
      
      // Verify collection was dropped
      const collections = await db.listCollections({ name: testCollName }).toArray();
      expect(collections.length).toBe(0);
    });
  });

  describe('Document Handle Projection', () => {
    it('should create document handle', () => {
      const docHandle = collHandle.document('507f1f77bcf86cd799439011');
      expect(docHandle).toBeInstanceOf(MongoDocumentHandle);
      expect(docHandle.database).toBe(testDbName);
      expect(docHandle.collection).toBe(testCollName);
      // documentId should be stored as ObjectId instance
      expect(docHandle.documentId).toBeInstanceOf(ObjectId);
      expect(docHandle.documentId.toString()).toBe('507f1f77bcf86cd799439011');
    });

    it('should throw error for document without ID', () => {
      expect(() => collHandle.document())
        .toThrow('Document ID is required');
    });
  });
});