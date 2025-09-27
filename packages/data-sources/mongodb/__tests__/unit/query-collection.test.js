/**
 * Unit tests for collection-level query operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MongoDBDataSource } from '../../src/MongoDBDataSource.js';
import { MongoClient } from 'mongodb';

describe('MongoDBDataSource - Collection Query Operations', () => {
  let dataSource;
  let mockClient;
  let mockDb;
  let mockCollection;
  let mockCursor;

  beforeEach(() => {
    // Create mocks - all operations now return Promises
    mockCursor = {
      filter: jest.fn().mockReturnThis(),
      project: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      collation: jest.fn().mockReturnThis(),
      hint: jest.fn().mockReturnThis(),
      comment: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([])
    };

    mockCollection = {
      find: jest.fn().mockReturnValue(mockCursor),
      findOne: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      countDocuments: jest.fn().mockResolvedValue(0),
      distinct: jest.fn().mockResolvedValue([]),
      stats: jest.fn().mockResolvedValue({ count: 0 }),
      indexes: jest.fn().mockResolvedValue([])
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      command: jest.fn().mockResolvedValue({}),
      admin: jest.fn().mockReturnValue({
        ping: jest.fn().mockReturnValue({ ok: 1 })
      })
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      db: jest.fn().mockReturnValue(mockDb),
      isConnected: jest.fn().mockReturnValue(true)
    };

    dataSource = new MongoDBDataSource({
      connectionString: 'mongodb://localhost:27017/test'
    });
    
    // Directly inject mock client (unit test - no real connection)
    dataSource.client = mockClient;
  });

  describe('find operations', () => {
    it('should execute find query with filter', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'find',
        filter: { age: { $gte: 18 } }
      };

      const resultHandle = dataSource.query(querySpec);
      
      // Handle should return immediately
      expect(resultHandle).toBeDefined();
      expect(resultHandle.constructor.name).toBe('QueryResultHandle');

      // Set up callback to check results
      resultHandle.onData((data, error) => {
        expect(error).toBeNull();
        expect(mockDb.collection).toHaveBeenCalledWith('users');
        expect(mockCollection.find).toHaveBeenCalledWith({ age: { $gte: 18 } });
        expect(data).toEqual([]);
        done();
      });
    });

    it('should apply projection to find query', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'find',
        filter: {},
        projection: { name: 1, email: 1 }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCursor.project).toHaveBeenCalledWith({ name: 1, email: 1 });
        done();
      });
    });

    it('should apply sort to find query', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'find',
        filter: {},
        sort: { age: -1 }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCursor.sort).toHaveBeenCalledWith({ age: -1 });
        done();
      });
    });

    it('should apply limit and skip to find query', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'find',
        filter: {},
        limit: 10,
        skip: 20
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCursor.limit).toHaveBeenCalledWith(10);
        expect(mockCursor.skip).toHaveBeenCalledWith(20);
        done();
      });
    });

    it('should execute findOne query', (done) => {
      mockCollection.findOne.mockResolvedValue({ _id: '123', name: 'John' });

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'findOne',
        filter: { email: 'john@example.com' }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.findOne).toHaveBeenCalledWith(
          { email: 'john@example.com' },
          {}
        );
        expect(data).toEqual({ _id: '123', name: 'John' });
        done();
      });
    });

    it('should apply projection to findOne', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'findOne',
        filter: { _id: '123' },
        projection: { password: 0 }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.findOne).toHaveBeenCalledWith(
          { _id: '123' },
          { projection: { password: 0 } }
        );
        done();
      });
    });
  });

  describe('aggregation operations', () => {
    it('should execute aggregation pipeline', (done) => {
      const pipeline = [
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];

      const mockAggCursor = {
        toArray: jest.fn().mockResolvedValue([
          { _id: 'electronics', count: 10 },
          { _id: 'books', count: 5 }
        ])
      };
      mockCollection.aggregate.mockReturnValue(mockAggCursor);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'products',
        operation: 'aggregate',
        pipeline
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.aggregate).toHaveBeenCalledWith(pipeline, {});
        expect(data).toEqual([
          { _id: 'electronics', count: 10 },
          { _id: 'books', count: 5 }
        ]);
        done();
      });
    });

    it('should pass aggregation options', (done) => {
      const pipeline = [{ $match: { active: true } }];
      const options = { allowDiskUse: true };

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'orders',
        operation: 'aggregate',
        pipeline,
        options
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.aggregate).toHaveBeenCalledWith(pipeline, options);
        done();
      });
    });

    it('should handle empty aggregation pipeline', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'aggregate',
        pipeline: []
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.aggregate).toHaveBeenCalledWith([], {});
        done();
      });
    });
  });

  describe('count operations', () => {
    it('should count all documents', (done) => {
      mockCollection.countDocuments.mockResolvedValue(100);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'count'
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.countDocuments).toHaveBeenCalledWith({}, {});
        expect(data).toBe(100);
        done();
      });
    });

    it('should count documents matching filter', (done) => {
      mockCollection.countDocuments.mockResolvedValue(25);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'count',
        filter: { status: 'active', age: { $gte: 18 } }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.countDocuments).toHaveBeenCalledWith(
          { status: 'active', age: { $gte: 18 } },
          {}
        );
        expect(data).toBe(25);
        done();
      });
    });

    it('should pass count options', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'count',
        filter: { active: true },
        options: { maxTimeMS: 5000 }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.countDocuments).toHaveBeenCalledWith(
          { active: true },
          { maxTimeMS: 5000 }
        );
        done();
      });
    });
  });

  describe('distinct operations', () => {
    it('should get distinct values for field', (done) => {
      mockCollection.distinct.mockResolvedValue(['USA', 'Canada', 'Mexico']);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'distinct',
        field: 'country'
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.distinct).toHaveBeenCalledWith('country', {}, {});
        expect(data).toEqual(['USA', 'Canada', 'Mexico']);
        done();
      });
    });

    it('should get distinct values with filter', (done) => {
      mockCollection.distinct.mockResolvedValue(['admin', 'user']);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'distinct',
        field: 'role',
        filter: { active: true }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.distinct).toHaveBeenCalledWith(
          'role',
          { active: true },
          {}
        );
        expect(data).toEqual(['admin', 'user']);
        done();
      });
    });

    it('should handle nested field paths', (done) => {
      mockCollection.distinct.mockResolvedValue(['New York', 'Los Angeles']);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'distinct',
        field: 'address.city',
        filter: { 'address.country': 'USA' }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.distinct).toHaveBeenCalledWith(
          'address.city',
          { 'address.country': 'USA' },
          {}
        );
        done();
      });
    });

    it('should throw error when field is not specified', () => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'distinct'
      };

      expect(() => dataSource.query(querySpec)).toThrow('Field is required for distinct operation');
    });
  });

  describe('collection metadata operations', () => {
    it('should get collection statistics', (done) => {
      // Mock the db.command for collStats
      mockCollection.s = { db: mockDb };
      mockCollection.collectionName = 'users';
      mockDb.command.mockResolvedValue({
        ns: 'testdb.users',
        size: 1024000,
        count: 100,
        avgObjSize: 10240,
        storageSize: 2048000
      });

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'stats'
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data, error) => {
        if (error) {
          done(error);
          return;
        }
        expect(mockDb.command).toHaveBeenCalledWith({ collStats: 'users' });
        expect(data).toHaveProperty('count', 100);
        expect(data).toHaveProperty('size', 1024000);
        done();
      });
    });

    it('should list collection indexes', (done) => {
      mockCollection.indexes.mockResolvedValue([
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { email: 1 }, name: 'email_1', unique: true }
      ]);

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'indexes'
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data) => {
        expect(mockCollection.indexes).toHaveBeenCalled();
        expect(data).toHaveLength(2);
        expect(data[0]).toHaveProperty('name', '_id_');
        expect(data[1]).toHaveProperty('unique', true);
        done();
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid collection operation', () => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'invalid'
      };

      expect(() => dataSource.query(querySpec)).toThrow('Unsupported collection operation: invalid');
    });

    it('should throw error when collection is not specified', () => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        operation: 'find'
      };

      expect(() => dataSource.query(querySpec)).toThrow('Collection name is required for collection operations');
    });

    it('should propagate MongoDB errors', (done) => {
      // Mock cursor.toArray() to reject with error
      mockCursor.toArray.mockRejectedValue(new Error('MongoDB error: connection lost'));

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'users',
        operation: 'find',
        filter: {}
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData((data, error) => {
        expect(error).toBeDefined();
        expect(error.message).toBe('MongoDB error: connection lost');
        expect(data).toBeNull();
        done();
      });
    });
  });

  describe('complex query scenarios', () => {
    it('should handle complex find with all options', (done) => {
      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'orders',
        operation: 'find',
        filter: {
          status: { $in: ['pending', 'processing'] },
          total: { $gte: 100 },
          'customer.country': 'USA'
        },
        projection: { _id: 1, status: 1, total: 1, 'customer.name': 1 },
        sort: { createdAt: -1, total: -1 },
        limit: 50,
        skip: 100,
        options: {
          collation: { locale: 'en', strength: 2 },
          hint: { status: 1, createdAt: -1 }
        }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.find).toHaveBeenCalledWith(querySpec.filter);
        expect(mockCursor.project).toHaveBeenCalledWith(querySpec.projection);
        expect(mockCursor.sort).toHaveBeenCalledWith(querySpec.sort);
        expect(mockCursor.limit).toHaveBeenCalledWith(50);
        expect(mockCursor.skip).toHaveBeenCalledWith(100);
        done();
      });
    });

    it('should handle complex aggregation pipeline', (done) => {
      const pipeline = [
        { $match: { createdAt: { $gte: new Date('2024-01-01') } } },
        { 
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$product.category',
            totalSales: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 10 }
      ];

      const querySpec = {
        level: 'collection',
        database: 'testdb',
        collection: 'sales',
        operation: 'aggregate',
        pipeline,
        options: { allowDiskUse: true }
      };

      const resultHandle = dataSource.query(querySpec);
      
      resultHandle.onData(() => {
        expect(mockCollection.aggregate).toHaveBeenCalledWith(pipeline, { allowDiskUse: true });
        done();
      });
    });
  });
});