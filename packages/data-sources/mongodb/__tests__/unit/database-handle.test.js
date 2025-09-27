/**
 * Unit tests for MongoDatabaseHandle
 * Tests database-level handle operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MongoDatabaseHandle } from '../../src/handles/MongoDatabaseHandle.js';
import { MongoCollectionHandle } from '../../src/handles/MongoCollectionHandle.js';
import { QueryResultHandle } from '../../src/handles/QueryResultHandle.js';
import { UpdateResultHandle } from '../../src/handles/UpdateResultHandle.js';
import { SubscriptionHandle } from '../../src/handles/SubscriptionHandle.js';

describe('MongoDatabaseHandle', () => {
  let mockDataSource;
  let dbHandle;

  beforeEach(() => {
    // Create mock dataSource with all required methods
    mockDataSource = {
      query: jest.fn(),
      subscribe: jest.fn(),
      update: jest.fn(),
      getSchema: jest.fn(),
      validate: jest.fn(),
      queryBuilder: jest.fn()
    };
    
    // Create database handle
    dbHandle = new MongoDatabaseHandle(mockDataSource, 'testdb');
  });

  describe('Constructor and Initialization', () => {
    it('should create database handle with database name', () => {
      expect(dbHandle).toBeDefined();
      expect(dbHandle.database).toBe('testdb');
      expect(dbHandle.dataSource).toBe(mockDataSource);
    });

    it('should inherit from Handle base class', () => {
      expect(typeof dbHandle.value).toBe('function');
    });

    it('should throw error if database name not provided', () => {
      expect(() => new MongoDatabaseHandle(mockDataSource)).toThrow('Database name is required');
    });

    it('should throw error if database name is empty', () => {
      expect(() => new MongoDatabaseHandle(mockDataSource, '')).toThrow('Database name is required');
    });
  });

  describe('value() method', () => {
    it('should query database statistics', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'stats'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = dbHandle.value();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'stats'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('collections() method', () => {
    it('should list all collections in database', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'listCollections'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = dbHandle.collections();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'listCollections'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('collection() projection method', () => {
    it('should create collection handle for specified collection', () => {
      const collHandle = dbHandle.collection('users');

      expect(collHandle).toBeInstanceOf(MongoCollectionHandle);
      expect(collHandle.database).toBe('testdb');
      expect(collHandle.collection).toBe('users');
      expect(collHandle.dataSource).toBe(mockDataSource);
    });

    it('should throw error if collection name not provided', () => {
      expect(() => dbHandle.collection()).toThrow('Collection name is required');
    });

    it('should throw error if collection name is empty string', () => {
      expect(() => dbHandle.collection('')).toThrow('Collection name is required');
    });
  });

  describe('createCollection() method', () => {
    it('should create collection without options', () => {
      const mockResult = new UpdateResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'createCollection'
      });
      mockDataSource.update.mockReturnValue(mockResult);

      const result = dbHandle.createCollection('newcollection');

      expect(mockDataSource.update).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'createCollection',
        collectionName: 'newcollection',
        options: {}
      });
      expect(result).toBe(mockResult);
    });

    it('should create collection with options', () => {
      const mockResult = new UpdateResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'createCollection'
      });
      mockDataSource.update.mockReturnValue(mockResult);

      const options = {
        capped: true,
        size: 100000,
        max: 1000,
        validator: { $jsonSchema: { required: ['name'] } }
      };
      const result = dbHandle.createCollection('cappedcollection', options);

      expect(mockDataSource.update).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'createCollection',
        collectionName: 'cappedcollection',
        options
      });
      expect(result).toBe(mockResult);
    });

    it('should throw error if collection name not provided', () => {
      expect(() => dbHandle.createCollection()).toThrow('Collection name is required');
    });
  });

  describe('drop() method', () => {
    it('should drop database', () => {
      const mockResult = new UpdateResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'dropDatabase'
      });
      mockDataSource.update.mockReturnValue(mockResult);

      const result = dbHandle.drop();

      expect(mockDataSource.update).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'dropDatabase'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('dropDatabase() alias method', () => {
    it('should be an alias for drop()', () => {
      const mockResult = new UpdateResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'dropDatabase'
      });
      mockDataSource.update.mockReturnValue(mockResult);

      const result = dbHandle.dropDatabase();

      expect(mockDataSource.update).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'dropDatabase'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('command() method', () => {
    it('should execute database command', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        operation: 'command'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const command = { dbStats: 1 };
      const result = dbHandle.command(command);

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        operation: 'command',
        command
      });
      expect(result).toBe(mockResult);
    });

    it('should throw error if command not provided', () => {
      expect(() => dbHandle.command()).toThrow('Command is required');
    });
  });

  describe('collectionNames() method', () => {
    it('should return collection names from collections query', () => {
      // Mock the collections() method to return a handle with data
      const mockCollectionsData = [
        { name: 'users', type: 'collection' },
        { name: 'products', type: 'collection' },
        { name: 'orders', type: 'collection' }
      ];
      
      const mockHandle = {
        value: jest.fn().mockReturnValue(mockCollectionsData),
        isPending: jest.fn().mockReturnValue(false)
      };
      
      mockDataSource.query.mockReturnValue(mockHandle);

      const result = dbHandle.collectionNames();

      expect(result).toEqual(['users', 'products', 'orders']);
    });

    it('should return empty array if no collections', () => {
      const mockHandle = {
        value: jest.fn().mockReturnValue([]),
        isPending: jest.fn().mockReturnValue(false)
      };
      
      mockDataSource.query.mockReturnValue(mockHandle);

      const result = dbHandle.collectionNames();

      expect(result).toEqual([]);
    });

    it('should return empty array if collections query returns null', () => {
      const mockHandle = {
        value: jest.fn().mockReturnValue(null),
        isPending: jest.fn().mockReturnValue(true)
      };
      
      mockDataSource.query.mockReturnValue(mockHandle);

      const result = dbHandle.collectionNames();

      expect(result).toEqual([]);
    });
  });

  describe('hasCollection() method', () => {
    it('should return true if collection exists', () => {
      const mockCollectionsData = [
        { name: 'users', type: 'collection' },
        { name: 'products', type: 'collection' }
      ];
      
      const mockHandle = {
        value: jest.fn().mockReturnValue(mockCollectionsData),
        isPending: jest.fn().mockReturnValue(false)
      };
      
      mockDataSource.query.mockReturnValue(mockHandle);

      const result = dbHandle.hasCollection('users');

      expect(result).toBe(true);
    });

    it('should return false if collection does not exist', () => {
      const mockCollectionsData = [
        { name: 'users', type: 'collection' },
        { name: 'products', type: 'collection' }
      ];
      
      const mockHandle = {
        value: jest.fn().mockReturnValue(mockCollectionsData),
        isPending: jest.fn().mockReturnValue(false)
      };
      
      mockDataSource.query.mockReturnValue(mockHandle);

      const result = dbHandle.hasCollection('nonexistent');

      expect(result).toBe(false);
    });

    it('should throw error if collection name not provided', () => {
      expect(() => dbHandle.hasCollection()).toThrow('Collection name is required');
    });
  });

  describe('watch() subscription method', () => {
    it('should create database-level subscription without pipeline', () => {
      const mockCallback = jest.fn();
      const mockSubscription = new SubscriptionHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        pipeline: []
      });
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      const result = dbHandle.watch(mockCallback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        pipeline: [],
        changeStream: true,
        callback: mockCallback
      });
      expect(result).toBe(mockSubscription);
    });

    it('should create database-level subscription with pipeline', () => {
      const pipeline = [
        { $match: { 'ns.coll': 'users' } },
        { $project: { fullDocument: 1 } }
      ];
      const mockCallback = jest.fn();
      const mockSubscription = new SubscriptionHandle(mockDataSource, {
        level: 'database',
        database: 'testdb',
        pipeline
      });
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      const result = dbHandle.watch(pipeline, mockCallback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith({
        level: 'database',
        database: 'testdb',
        pipeline,
        changeStream: true,
        callback: mockCallback
      });
      expect(result).toBe(mockSubscription);
    });
  });

  describe('Error Handling', () => {
    it('should propagate query errors', () => {
      const error = new Error('Query failed');
      mockDataSource.query.mockImplementation(() => {
        throw error;
      });

      expect(() => dbHandle.value()).toThrow('Query failed');
    });

    it('should propagate update errors', () => {
      const error = new Error('Update failed');
      mockDataSource.update.mockImplementation(() => {
        throw error;
      });

      expect(() => dbHandle.drop()).toThrow('Update failed');
    });

    it('should propagate subscription errors', () => {
      const error = new Error('Subscription failed');
      mockDataSource.subscribe.mockImplementation(() => {
        throw error;
      });

      expect(() => dbHandle.watch()).toThrow('Subscription failed');
    });
  });
});