/**
 * Integration tests for MongoDocumentHandle
 * Tests document-level operations with real MongoDB
 */

import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { jest } from '@jest/globals';

describe('MongoDocumentHandle Integration Tests', () => {
  let mongod;
  let dataSource;
  let mongoClient;
  let db;
  let collection;
  let testDocId;

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
    
    // Insert test document
    const result = await collection.insertOne({
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
      tags: ['user', 'active'],
      profile: {
        bio: 'Software developer',
        location: 'San Francisco'
      },
      scores: [85, 92, 78]
    });
    testDocId = result.insertedId;
  });

  afterAll(async () => {
    await dataSource.disconnect();
    await mongoClient.close();
    await mongod.stop();
  });

  describe('Document Retrieval', () => {
    test('should get document by ID', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const resultHandle = docHandle.value();
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(30);
      expect(result._id.toString()).toBe(testDocId.toString());
    });

    test('should handle string ObjectId', async () => {
      const stringId = testDocId.toString();
      const docHandle = dataSource.document('testdb', 'users', stringId);
      
      const resultHandle = docHandle.value();
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
    });

    test('should return null for non-existent document', async () => {
      const fakeId = new ObjectId();
      const docHandle = dataSource.document('testdb', 'users', fakeId);
      
      const resultHandle = docHandle.value();
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeNull();
    });

    test('should check if document exists', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const existsHandle = docHandle.exists();
      const exists = await new Promise(resolve => existsHandle.onData(resolve));
      
      expect(exists).toBe(true);
      
      // Check non-existent
      const fakeHandle = dataSource.document('testdb', 'users', new ObjectId());
      const fakeExistsHandle = fakeHandle.exists();
      const fakeExists = await new Promise(resolve => fakeExistsHandle.onData(resolve));
      
      expect(fakeExists).toBe(false);
    });
  });

  describe('Field Operations', () => {
    test('should get specific field value', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const fieldHandle = docHandle.field('name');
      const name = await new Promise(resolve => fieldHandle.onData(resolve));
      
      expect(name).toBe('John Doe');
    });

    test('should get nested field value', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const fieldHandle = docHandle.field('profile.location');
      const location = await new Promise(resolve => fieldHandle.onData(resolve));
      
      expect(location).toBe('San Francisco');
    });

    test('should return undefined for non-existent field', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const fieldHandle = docHandle.field('nonexistent');
      const value = await new Promise(resolve => fieldHandle.onData(resolve));
      
      expect(value).toBeUndefined();
    });

    test('should get multiple fields', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const fieldsHandle = docHandle.fields(['name', 'age', 'email']);
      const fields = await new Promise(resolve => fieldsHandle.onData(resolve));
      
      expect(fields).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      });
    });
  });

  describe('Document Updates', () => {
    test('should update entire document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.update({
        name: 'Jane Doe',
        age: 25,
        email: 'jane@example.com'
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.name).toBe('Jane Doe');
      expect(doc.age).toBe(25);
    });

    test('should set specific fields', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.set({
        name: 'Jane Doe',
        'profile.location': 'New York'
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.name).toBe('Jane Doe');
      expect(doc.profile.location).toBe('New York');
      expect(doc.profile.bio).toBe('Software developer'); // Unchanged
    });

    test('should unset fields', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.unset(['email', 'profile.bio']);
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.email).toBeUndefined();
      expect(doc.profile.bio).toBeUndefined();
      expect(doc.profile.location).toBe('San Francisco'); // Unchanged
    });

    test('should increment numeric fields', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.increment({ age: 5 });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.age).toBe(35);
    });

    test('should rename fields', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.rename({
        email: 'emailAddress',
        'profile.bio': 'profile.biography'
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.email).toBeUndefined();
      expect(doc.emailAddress).toBe('john@example.com');
      expect(doc.profile.bio).toBeUndefined();
      expect(doc.profile.biography).toBe('Software developer');
    });
  });

  describe('Array Operations', () => {
    test('should push items to array', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.push({
        tags: 'premium',
        scores: 95
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.tags).toContain('premium');
      expect(doc.scores).toContain(95);
    });

    test('should push multiple items to array', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.pushMany({
        tags: ['premium', 'verified'],
        scores: [88, 91]
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.tags).toEqual(['user', 'active', 'premium', 'verified']);
      expect(doc.scores).toEqual([85, 92, 78, 88, 91]);
    });

    test('should pull items from array', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const updateHandle = docHandle.pull({
        tags: 'active',
        scores: 78
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.tags).toEqual(['user']);
      expect(doc.scores).toEqual([85, 92]);
    });

    test('should add unique items to array', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      // Try to add existing and new items
      const updateHandle = docHandle.addToSet({
        tags: { $each: ['user', 'premium', 'verified'] }
      });
      
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify update
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.tags).toEqual(['user', 'active', 'premium', 'verified']);
    });

    test('should pop first/last elements from array', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      // Pop first element from tags
      const popFirstHandle = docHandle.pop({ tags: -1 });
      const result1 = await new Promise(resolve => popFirstHandle.onData(resolve));
      expect(result1.modifiedCount).toBe(1);
      
      // Pop last element from scores
      const popLastHandle = docHandle.pop({ scores: 1 });
      const result2 = await new Promise(resolve => popLastHandle.onData(resolve));
      expect(result2.modifiedCount).toBe(1);
      
      // Verify updates
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.tags).toEqual(['active']); // 'user' removed from front
      expect(doc.scores).toEqual([85, 92]); // 78 removed from end
    });
  });

  describe('Atomic Operations', () => {
    test('should find and update document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const resultHandle = docHandle.findAndUpdate(
        { $set: { name: 'Jane Doe' }, $inc: { age: 1 } },
        { returnDocument: 'after' }
      );
      
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Jane Doe');
      expect(result.age).toBe(31);
    });

    test('should find and replace document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const resultHandle = docHandle.findAndReplace(
        {
          name: 'Jane Doe',
          age: 25,
          email: 'jane@example.com'
        },
        { returnDocument: 'after' }
      );
      
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Jane Doe');
      expect(result.age).toBe(25);
      expect(result.tags).toBeUndefined(); // Original fields removed
    });

    test('should find and delete document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const resultHandle = docHandle.findAndDelete();
      
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe'); // Returns deleted document
      
      // Verify deletion
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc).toBeNull();
    });
  });

  describe('Document Operations', () => {
    test('should replace entire document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const replaceHandle = docHandle.replace({
        name: 'New User',
        role: 'admin'
      });
      
      const result = await new Promise(resolve => replaceHandle.onData(resolve));
      expect(result.modifiedCount).toBe(1);
      
      // Verify replacement
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc.name).toBe('New User');
      expect(doc.role).toBe('admin');
      expect(doc.age).toBeUndefined(); // Original fields gone
    });

    test('should delete document', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const deleteHandle = docHandle.delete();
      
      const result = await new Promise(resolve => deleteHandle.onData(resolve));
      expect(result.deletedCount).toBe(1);
      
      // Verify deletion
      const doc = await collection.findOne({ _id: testDocId });
      expect(doc).toBeNull();
    });

    test('should get document with projection', async () => {
      const docHandle = dataSource.document('testdb', 'users', testDocId);
      
      const resultHandle = docHandle.project({ name: 1, age: 1 });
      const result = await new Promise(resolve => resultHandle.onData(resolve));
      
      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe(30);
      expect(result.email).toBeUndefined(); // Not in projection
      expect(result.tags).toBeUndefined(); // Not in projection
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid database name', () => {
      expect(() => dataSource.document('', 'users', testDocId))
        .toThrow('Database name is required');
    });

    test('should handle invalid collection name', () => {
      expect(() => dataSource.document('testdb', '', testDocId))
        .toThrow('Collection name is required');
    });

    test('should handle invalid document ID', () => {
      expect(() => dataSource.document('testdb', 'users', null))
        .toThrow('Document ID is required');
    });

    test('should handle update on non-existent document', async () => {
      const fakeId = new ObjectId();
      const docHandle = dataSource.document('testdb', 'users', fakeId);
      
      const updateHandle = docHandle.set({ name: 'Test' });
      const result = await new Promise(resolve => updateHandle.onData(resolve));
      
      expect(result.matchedCount).toBe(0);
      expect(result.modifiedCount).toBe(0);
    });
  });
});