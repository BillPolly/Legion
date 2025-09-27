/**
 * Unit tests for MongoServerHandle
 * Tests server-level handle operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MongoServerHandle } from '../../src/handles/MongoServerHandle.js';
import { MongoDatabaseHandle } from '../../src/handles/MongoDatabaseHandle.js';
import { QueryResultHandle } from '../../src/handles/QueryResultHandle.js';
import { SubscriptionHandle } from '../../src/handles/SubscriptionHandle.js';

describe('MongoServerHandle', () => {
  let mockDataSource;
  let serverHandle;

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
    
    // Create server handle
    serverHandle = new MongoServerHandle(mockDataSource, 'mongodb://localhost:27017');
  });

  describe('Constructor and Initialization', () => {
    it('should create server handle with connection string', () => {
      expect(serverHandle).toBeDefined();
      expect(serverHandle.connectionString).toBe('mongodb://localhost:27017');
      expect(serverHandle.dataSource).toBe(mockDataSource);
    });

    it('should inherit from Handle base class', () => {
      // Check if it has base Handle methods
      expect(typeof serverHandle.value).toBe('function');
    });
  });

  describe('value() method', () => {
    it('should query server status', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'serverStatus'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.value();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'serverStatus'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('databases() method', () => {
    it('should list all databases', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'listDatabases'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.databases();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'listDatabases'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('database() projection method', () => {
    it('should create database handle for specified database', () => {
      const dbHandle = serverHandle.database('testdb');

      expect(dbHandle).toBeInstanceOf(MongoDatabaseHandle);
      expect(dbHandle.database).toBe('testdb');
      expect(dbHandle.dataSource).toBe(mockDataSource);
    });

    it('should throw error if database name not provided', () => {
      expect(() => serverHandle.database()).toThrow('Database name is required');
    });

    it('should throw error if database name is empty string', () => {
      expect(() => serverHandle.database('')).toThrow('Database name is required');
    });
  });

  describe('stats() method', () => {
    it('should query server statistics', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'serverStatus'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.stats();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'serverStatus'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('currentOps() method', () => {
    it('should query current operations without options', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'currentOp'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.currentOps();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'currentOp',
        options: {}
      });
      expect(result).toBe(mockResult);
    });

    it('should query current operations with options', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'currentOp'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const options = { allUsers: true, idleConnections: false };
      const result = serverHandle.currentOps(options);

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'currentOp',
        options
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('ping() method', () => {
    it('should ping server', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'ping'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.ping();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'ping'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('buildInfo() method', () => {
    it('should query build information', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'buildInfo'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.buildInfo();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'buildInfo'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('hostInfo() method', () => {
    it('should query host information', () => {
      const mockResult = new QueryResultHandle(mockDataSource, {
        level: 'server',
        operation: 'hostInfo'
      });
      mockDataSource.query.mockReturnValue(mockResult);

      const result = serverHandle.hostInfo();

      expect(mockDataSource.query).toHaveBeenCalledWith({
        level: 'server',
        operation: 'hostInfo'
      });
      expect(result).toBe(mockResult);
    });
  });

  describe('watch() subscription method', () => {
    it('should create subscription without pipeline', () => {
      const mockCallback = jest.fn();
      const mockSubscription = new SubscriptionHandle(mockDataSource, {
        level: 'server',
        pipeline: []
      });
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      const result = serverHandle.watch(mockCallback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith({
        level: 'server',
        pipeline: [],
        changeStream: true,
        callback: mockCallback
      });
      expect(result).toBe(mockSubscription);
    });

    it('should create subscription with pipeline', () => {
      const pipeline = [
        { $match: { operationType: 'insert' } },
        { $project: { fullDocument: 1 } }
      ];
      const mockCallback = jest.fn();
      const mockSubscription = new SubscriptionHandle(mockDataSource, {
        level: 'server',
        pipeline
      });
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      const result = serverHandle.watch(pipeline, mockCallback);

      expect(mockDataSource.subscribe).toHaveBeenCalledWith({
        level: 'server',
        pipeline,
        changeStream: true,
        callback: mockCallback
      });
      expect(result).toBe(mockSubscription);
    });

    it('should handle missing callback', () => {
      const mockSubscription = new SubscriptionHandle(mockDataSource, {
        level: 'server',
        pipeline: []
      });
      mockDataSource.subscribe.mockReturnValue(mockSubscription);

      const result = serverHandle.watch();

      expect(mockDataSource.subscribe).toHaveBeenCalledWith({
        level: 'server',
        pipeline: [],
        changeStream: true,
        callback: undefined
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

      expect(() => serverHandle.value()).toThrow('Query failed');
    });

    it('should propagate subscription errors', () => {
      const error = new Error('Subscription failed');
      mockDataSource.subscribe.mockImplementation(() => {
        throw error;
      });

      expect(() => serverHandle.watch()).toThrow('Subscription failed');
    });
  });
});