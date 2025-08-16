/**
 * Unit tests for MongoQueryTool
 * Testing tool structure, validation, and command mapping
 */

import { jest } from '@jest/globals';
import { MongoQueryTool } from '../../src/MongoQueryTool.js';
import { Tool } from '@legion/tools-registry';

describe('MongoQueryTool - Core Structure', () => {
  describe('Constructor', () => {
    it('should create tool with valid dependencies', () => {
      const mockProvider = {
        find: jest.fn(),
        findOne: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        distinct: jest.fn(),
        aggregate: jest.fn(),
        createIndex: jest.fn(),
        dropCollection: jest.fn(),
        listCollections: jest.fn(),
        databaseName: 'test',
        useDatabase: jest.fn()
      };

      const tool = new MongoQueryTool({ mongoProvider: mockProvider });
      
      expect(tool).toBeInstanceOf(Tool);
      expect(tool.name).toBe('mongo_query');
      expect(tool.description).toBe('Execute MongoDB database operations with native JSON syntax');
      expect(tool.mongoProvider).toBe(mockProvider);
    });

    it('should throw error when mongoProvider is missing', () => {
      expect(() => new MongoQueryTool({})).toThrow('MongoDBProvider is required');
      expect(() => new MongoQueryTool()).toThrow('MongoDBProvider is required');
    });
  });

  describe('Input Schema Validation', () => {
    let tool;
    let mockProvider;

    beforeEach(() => {
      mockProvider = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ insertedCount: 1 }),
        update: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        delete: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        count: jest.fn().mockResolvedValue(0),
        distinct: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue([]),
        createIndex: jest.fn().mockResolvedValue('index_name'),
        dropCollection: jest.fn().mockResolvedValue(true),
        listCollections: jest.fn().mockResolvedValue([]),
        databaseName: 'test',
        useDatabase: jest.fn().mockResolvedValue(true)
      };
      tool = new MongoQueryTool({ mongoProvider: mockProvider });
    });

    it('should accept valid find command', async () => {
      const input = {
        collection: 'users',
        command: 'find',
        params: { query: { active: true } }
      };

      const result = await tool.execute(input);
      expect(result.success).toBe(true);
      expect(result.data.command).toBe('find');
    });

    it('should accept all valid commands', async () => {
      const commands = [
        { command: 'find', params: {} },
        { command: 'findOne', params: {} },
        { command: 'insertOne', params: { document: { test: true } } },
        { command: 'insertMany', params: { documents: [{ test: true }] } },
        { command: 'updateOne', params: { filter: {}, update: { $set: { test: true } } } },
        { command: 'updateMany', params: { filter: {}, update: { $set: { test: true } } } },
        { command: 'deleteOne', params: { filter: {} } },
        { command: 'deleteMany', params: {} },
        { command: 'aggregate', params: {} },
        { command: 'countDocuments', params: {} },
        { command: 'distinct', params: { field: 'test' } },
        { command: 'createIndex', params: { keys: { field: 1 } } },
        { command: 'dropCollection', params: {} },
        { command: 'listCollections', params: {} }
      ];

      for (const cmd of commands) {
        const input = {
          collection: 'test',
          ...cmd
        };

        const result = await tool.execute(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject missing required fields', async () => {
      const invalidInputs = [
        { command: 'find', params: {} }, // missing collection
        { collection: 'test', params: {} }, // missing command
        { collection: 'test', command: 'find' } // missing params
      ];

      for (const input of invalidInputs) {
        const result = await tool.execute(input);
        expect(result.success).toBe(false);
        expect(result.data.errorMessage).toContain('Validation failed');
      }
    });

    it('should reject invalid command names', async () => {
      const input = {
        collection: 'test',
        command: 'invalidCommand',
        params: {}
      };

      const result = await tool.execute(input);
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    it('should accept optional database parameter', async () => {
      // Need a fresh mock that handles database switching
      const switchableMock = {
        find: jest.fn().mockResolvedValue([]),
        databaseName: 'default_db',
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(true),
        db: null
      };
      const switchableTool = new MongoQueryTool({ mongoProvider: switchableMock });

      const input = {
        database: 'custom_db',
        collection: 'users',
        command: 'find',
        params: {}
      };

      const result = await switchableTool.execute(input);
      expect(result.success).toBe(true);
      expect(result.data.database).toBe('custom_db');
    });
  });

  describe('Command Execution Mapping', () => {
    let tool;
    let mockProvider;

    beforeEach(() => {
      mockProvider = {
        find: jest.fn().mockResolvedValue([{ id: 1 }]),
        findOne: jest.fn().mockResolvedValue({ id: 1 }),
        insert: jest.fn().mockResolvedValue({ insertedCount: 1 }),
        update: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        delete: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        count: jest.fn().mockResolvedValue(5),
        distinct: jest.fn().mockResolvedValue(['a', 'b']),
        aggregate: jest.fn().mockResolvedValue([{ total: 100 }]),
        createIndex: jest.fn().mockResolvedValue('idx_name'),
        dropCollection: jest.fn().mockResolvedValue(true),
        listCollections: jest.fn().mockResolvedValue(['col1', 'col2']),
        databaseName: 'test',
        useDatabase: jest.fn().mockResolvedValue(true)
      };
      tool = new MongoQueryTool({ mongoProvider: mockProvider });
    });

    it('should map find command correctly', async () => {
      await tool.execute({
        collection: 'users',
        command: 'find',
        params: {
          query: { active: true },
          options: { limit: 10, sort: { name: 1 } }
        }
      });

      expect(mockProvider.find).toHaveBeenCalledWith(
        'users',
        { active: true },
        { limit: 10, sort: { name: 1 } }
      );
    });

    it('should map insertOne command correctly', async () => {
      await tool.execute({
        collection: 'users',
        command: 'insertOne',
        params: {
          document: { name: 'John', age: 30 }
        }
      });

      expect(mockProvider.insert).toHaveBeenCalledWith(
        'users',
        { name: 'John', age: 30 }
      );
    });

    it('should map updateMany command correctly', async () => {
      await tool.execute({
        collection: 'users',
        command: 'updateMany',
        params: {
          filter: { status: 'pending' },
          update: { $set: { status: 'active' } },
          options: { upsert: true }
        }
      });

      expect(mockProvider.update).toHaveBeenCalledWith(
        'users',
        { status: 'pending' },
        { $set: { status: 'active' } },
        { upsert: true, multi: true }
      );
    });

    it('should map aggregate command correctly', async () => {
      const pipeline = [
        { $match: { status: 'active' } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ];

      await tool.execute({
        collection: 'users',
        command: 'aggregate',
        params: { pipeline }
      });

      expect(mockProvider.aggregate).toHaveBeenCalledWith('users', pipeline);
    });
  });

  describe('Database Switching', () => {
    let tool;
    let mockProvider;

    beforeEach(() => {
      mockProvider = {
        find: jest.fn().mockResolvedValue([]),
        databaseName: 'default_db',
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(true),
        db: null
      };
      tool = new MongoQueryTool({ mongoProvider: mockProvider });
    });

    it('should switch database when specified', async () => {
      await tool.execute({
        database: 'custom_db',
        collection: 'users',
        command: 'find',
        params: {}
      });

      // Check disconnect, change db, reconnect sequence
      expect(mockProvider.disconnect).toHaveBeenCalled();
      expect(mockProvider.databaseName).toBe('default_db'); // restored
      expect(mockProvider.connect).toHaveBeenCalled();
    });

    it('should restore original database after execution', async () => {
      const originalDb = mockProvider.databaseName;
      
      await tool.execute({
        database: 'temp_db',
        collection: 'users',
        command: 'find',
        params: {}
      });

      // Should disconnect and reconnect twice
      expect(mockProvider.disconnect).toHaveBeenCalledTimes(2);
      expect(mockProvider.connect).toHaveBeenCalledTimes(2);
      expect(mockProvider.databaseName).toBe(originalDb);
    });

    it('should not switch database when not specified', async () => {
      await tool.execute({
        collection: 'users',
        command: 'find',
        params: {}
      });

      expect(mockProvider.disconnect).not.toHaveBeenCalled();
      expect(mockProvider.connect).not.toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    let tool;
    let mockProvider;
    let progressEvents;
    let infoEvents;
    let errorEvents;

    beforeEach(() => {
      mockProvider = {
        find: jest.fn().mockResolvedValue([]),
        databaseName: 'test',
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(true),
        db: null
      };
      tool = new MongoQueryTool({ mongoProvider: mockProvider });
      
      progressEvents = [];
      infoEvents = [];
      errorEvents = [];
      
      tool.on('progress', (data) => progressEvents.push(data));
      tool.on('info', (data) => infoEvents.push(data));
      tool.on('error', (data) => errorEvents.push(data));
    });

    it('should emit progress event when executing', async () => {
      await tool.execute({
        collection: 'users',
        command: 'find',
        params: {}
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].message).toContain('Executing find on users');
    });

    it('should emit info event on success', async () => {
      await tool.execute({
        collection: 'users',
        command: 'find',
        params: {}
      });

      expect(infoEvents.length).toBeGreaterThan(0);
      expect(infoEvents[0].message).toContain('Command find completed successfully');
    });

    it('should emit error event on failure', async () => {
      mockProvider.find.mockRejectedValue(new Error('Connection failed'));
      
      await tool.execute({
        collection: 'users',
        command: 'find',
        params: {}
      });

      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });
});