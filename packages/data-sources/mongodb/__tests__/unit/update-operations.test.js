/**
 * Unit tests for MongoDB update operations
 * Tests all CRUD operations at different levels
 * Uses callback-based Handle pattern with Jest done() callbacks
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';

describe('MongoDBDataSource - Update Operations', () => {
  let dataSource;
  let mockClient;
  let mockDb;
  let mockCollection;
  let mockBulkOp;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock bulk operation
    mockBulkOp = {
      insert: jest.fn().mockReturnThis(),
      find: jest.fn().mockReturnThis(),
      updateOne: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      replaceOne: jest.fn().mockReturnThis(),
      deleteOne: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        ok: 1,
        nInserted: 0,
        nModified: 0,
        nRemoved: 0
      })
    };
    
    // Setup mock collection
    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ 
        acknowledged: true, 
        insertedId: 'new-id' 
      }),
      insertMany: jest.fn().mockResolvedValue({ 
        acknowledged: true, 
        insertedCount: 2,
        insertedIds: ['id1', 'id2']
      }),
      updateOne: jest.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1
      }),
      updateMany: jest.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 3,
        modifiedCount: 3
      }),
      replaceOne: jest.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1
      }),
      deleteOne: jest.fn().mockResolvedValue({
        acknowledged: true,
        deletedCount: 1
      }),
      deleteMany: jest.fn().mockResolvedValue({
        acknowledged: true,
        deletedCount: 5
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        value: { _id: 'id1', name: 'Updated' }
      }),
      findOneAndReplace: jest.fn().mockResolvedValue({
        value: { _id: 'id1', name: 'Replaced' }
      }),
      findOneAndDelete: jest.fn().mockResolvedValue({
        value: { _id: 'id1', name: 'Deleted' }
      }),
      bulkWrite: jest.fn().mockResolvedValue({
        acknowledged: true,
        insertedCount: 1,
        matchedCount: 1,
        deletedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0
      }),
      initializeUnorderedBulkOp: jest.fn().mockReturnValue(mockBulkOp)
    };
    
    // Setup mock database
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      createCollection: jest.fn().mockResolvedValue(mockCollection),
      dropCollection: jest.fn().mockResolvedValue(true)
    };
    
    // Setup mock MongoDB client
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true)
    };
    
    // Create DataSource instance
    dataSource = new MongoDBDataSource({
      connectionString: 'mongodb://localhost:27017/test'
    });
    
    // Directly set the client to bypass connection
    dataSource.client = mockClient;
    dataSource.connected = true;
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('insert operations', () => {
    it('should insert a single document', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'insert',
        document: { name: 'John', email: 'john@example.com' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockDb.collection).toHaveBeenCalledWith('users');
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          updateSpec.document,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          insertedId: 'new-id'
        });
        done();
      });
    });
    
    it('should insert multiple documents', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'insert',
        documents: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ]
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.insertMany).toHaveBeenCalledWith(
          updateSpec.documents,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          insertedCount: 2,
          insertedIds: ['id1', 'id2']
        });
        done();
      });
    });
    
    it('should pass insert options', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'insert',
        document: { name: 'John' },
        options: { ordered: false }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.insertOne).toHaveBeenCalledWith(
          updateSpec.document,
          { ordered: false }
        );
        done();
      });
    });
  });
  
  describe('update operations', () => {
    it('should update one document', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'updateOne',
        filter: { email: 'john@example.com' },
        update: { $set: { lastLogin: new Date() } }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.update,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          matchedCount: 1,
          modifiedCount: 1
        });
        done();
      });
    });
    
    it('should update many documents', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'updateMany',
        filter: { status: 'inactive' },
        update: { $set: { status: 'archived' } }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.updateMany).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.update,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          matchedCount: 3,
          modifiedCount: 3
        });
        done();
      });
    });
    
    it('should support upsert option', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'updateOne',
        filter: { email: 'new@example.com' },
        update: { $set: { name: 'New User' } },
        options: { upsert: true }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.update,
          { upsert: true }
        );
        done();
      });
    });
  });
  
  describe('replace operations', () => {
    it('should replace a document', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'replace',
        filter: { _id: 'user123' },
        replacement: { name: 'Replaced', email: 'replaced@example.com' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.replaceOne).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.replacement,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          matchedCount: 1,
          modifiedCount: 1
        });
        done();
      });
    });
  });
  
  describe('delete operations', () => {
    it('should delete one document', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'deleteOne',
        filter: { email: 'delete@example.com' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.deleteOne).toHaveBeenCalledWith(
          updateSpec.filter,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          deletedCount: 1
        });
        done();
      });
    });
    
    it('should delete many documents', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'deleteMany',
        filter: { status: 'deleted' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.deleteMany).toHaveBeenCalledWith(
          updateSpec.filter,
          {}
        );
        expect(data).toEqual({
          acknowledged: true,
          deletedCount: 5
        });
        done();
      });
    });
  });
  
  describe('findAndModify operations', () => {
    it('should findOneAndUpdate', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'findOneAndUpdate',
        filter: { _id: 'user123' },
        update: { $inc: { visits: 1 } },
        options: { returnDocument: 'after' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.update,
          updateSpec.options
        );
        expect(data.value).toBeDefined();
        done();
      });
    });
    
    it('should findOneAndReplace', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'findOneAndReplace',
        filter: { _id: 'user123' },
        replacement: { name: 'New', email: 'new@example.com' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.findOneAndReplace).toHaveBeenCalledWith(
          updateSpec.filter,
          updateSpec.replacement,
          {}
        );
        expect(data.value).toBeDefined();
        done();
      });
    });
    
    it('should findOneAndDelete', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'findOneAndDelete',
        filter: { _id: 'user123' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.findOneAndDelete).toHaveBeenCalledWith(
          updateSpec.filter,
          {}
        );
        expect(data.value).toBeDefined();
        done();
      });
    });
  });
  
  describe('bulk operations', () => {
    it('should execute bulkWrite operations', (done) => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'bulkWrite',
        operations: [
          { insertOne: { document: { name: 'New' } } },
          { updateOne: { filter: { _id: '1' }, update: { $set: { status: 'active' } } } },
          { deleteOne: { filter: { _id: '2' } } }
        ]
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockCollection.bulkWrite).toHaveBeenCalledWith(
          updateSpec.operations,
          {}
        );
        expect(data.insertedCount).toBe(1);
        expect(data.modifiedCount).toBe(1);
        expect(data.deletedCount).toBe(1);
        done();
      });
    });
  });
  
  describe('error handling', () => {
    it('should throw error for invalid update level', () => {
      const updateSpec = {
        level: 'invalid',
        operation: 'insert'
      };
      
      expect(() => dataSource.update(updateSpec)).toThrow('Invalid update level');
    });
    
    it('should throw error for missing operation', () => {
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users'
      };
      
      expect(() => dataSource.update(updateSpec)).toThrow('Operation is required');
    });
    
    it('should handle async execution errors', (done) => {
      mockCollection.insertOne.mockRejectedValue(new Error('Database error'));
      
      const updateSpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'insert',
        document: { name: 'John' }
      };
      
      const handle = dataSource.update(updateSpec);
      
      handle.onData((data, error) => {
        expect(data).toBeNull();
        expect(error).toBeDefined();
        expect(error.message).toContain('Database error');
        done();
      });
    });
  });
});