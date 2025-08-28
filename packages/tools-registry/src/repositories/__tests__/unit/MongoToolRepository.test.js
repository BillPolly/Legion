/**
 * MongoToolRepository unit tests
 * 
 * Tests the MongoDB implementation of IToolRepository
 * following Clean Architecture principles
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MongoToolRepository } from '../../mongodb/MongoToolRepository.js';
import { IToolRepository } from '../../interfaces/IToolRepository.js';
import {
  DatabaseError,
  DatabaseOperationError
} from '../../../errors/index.js';

describe('MongoToolRepository', () => {
  let mockDatabaseStorage;
  let mockCollection;
  let repository;

  beforeEach(() => {
    // Create chainable mock methods
    const mockChain = {
      toArray: jest.fn(() => Promise.resolve([])),
      sort: jest.fn(),
      limit: jest.fn(),
      skip: jest.fn()
    };
    
    // Make methods chainable
    mockChain.sort.mockReturnValue(mockChain);
    mockChain.limit.mockReturnValue(mockChain);
    mockChain.skip.mockReturnValue(mockChain);

    // Mock MongoDB collection
    mockCollection = {
      findOne: jest.fn(),
      find: jest.fn(() => mockChain),
      insertOne: jest.fn(() => Promise.resolve({ insertedId: 'test-id' })),
      insertMany: jest.fn(() => Promise.resolve({ insertedIds: ['id1', 'id2'] })),
      replaceOne: jest.fn(() => Promise.resolve({ matchedCount: 1 })),
      deleteOne: jest.fn(() => Promise.resolve({ deletedCount: 1 })),
      deleteMany: jest.fn(() => Promise.resolve({ deletedCount: 2 })),
      countDocuments: jest.fn(() => Promise.resolve(5)),
      createIndex: jest.fn(() => Promise.resolve())
    };

    // Mock DatabaseStorage
    mockDatabaseStorage = {
      isConnected: true,
      getCollection: jest.fn(() => mockCollection)
    };

    repository = new MongoToolRepository(mockDatabaseStorage, { verbose: false });
  });

  describe('constructor', () => {
    it('should create MongoToolRepository instance', () => {
      expect(repository).toBeInstanceOf(MongoToolRepository);
      expect(repository).toBeInstanceOf(IToolRepository);
    });

    it('should throw error without DatabaseStorage', () => {
      expect(() => {
        new MongoToolRepository(null);
      }).toThrow(DatabaseError);
    });

    it('should accept options', () => {
      const repo = new MongoToolRepository(mockDatabaseStorage, { verbose: true });
      expect(repo.options.verbose).toBe(true);
    });
  });

  describe('findByName', () => {
    it('should find tool by name', async () => {
      const mockTool = { name: 'test-tool', description: 'Test tool' };
      mockCollection.findOne.mockResolvedValue(mockTool);

      const result = await repository.findByName('test-tool');

      expect(result).toEqual(mockTool);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ name: 'test-tool' });
    });

    it('should return null if tool not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await repository.findByName('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseOperationError on database error', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('DB error'));

      await expect(repository.findByName('test')).rejects.toThrow(DatabaseOperationError);
    });
  });

  describe('findById', () => {
    it('should find tool by ID', async () => {
      const mockTool = { _id: 'test-id', name: 'test-tool' };
      mockCollection.findOne.mockResolvedValue(mockTool);

      const result = await repository.findById('test-id');

      expect(result).toEqual(mockTool);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'test-id' });
    });
  });

  describe('findByModuleName', () => {
    it('should find tools by module name', async () => {
      const mockTools = [
        { name: 'tool1', moduleName: 'test-module' },
        { name: 'tool2', moduleName: 'test-module' }
      ];
      const mockChain = mockCollection.find();
      mockChain.toArray.mockResolvedValue(mockTools);

      const result = await repository.findByModuleName('test-module');

      expect(result).toEqual(mockTools);
      expect(mockCollection.find).toHaveBeenCalledWith({ moduleName: 'test-module' });
    });
  });

  describe('save', () => {
    it('should insert new tool', async () => {
      const newTool = { name: 'new-tool', description: 'New tool' };
      const expectedResult = { ...newTool, _id: 'test-id' };

      const result = await repository.save(newTool);

      expect(result._id).toBe('test-id');
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newTool,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );
    });

    it('should update existing tool', async () => {
      const existingTool = { _id: 'existing-id', name: 'existing-tool' };

      const result = await repository.save(existingTool);

      expect(result).toEqual(existingTool);
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { _id: 'existing-id' },
        existingTool,
        { upsert: true }
      );
    });
  });

  describe('saveMany', () => {
    it('should insert multiple tools', async () => {
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];

      const result = await repository.saveMany(tools);

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('id1');
      expect(result[1]._id).toBe('id2');
      expect(mockCollection.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'tool1', createdAt: expect.any(Date) }),
          expect.objectContaining({ name: 'tool2', createdAt: expect.any(Date) })
        ])
      );
    });

    it('should handle empty array', async () => {
      const result = await repository.saveMany([]);

      expect(result).toEqual([]);
      expect(mockCollection.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByName', () => {
    it('should delete tool by name', async () => {
      const result = await repository.deleteByName('test-tool');

      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ name: 'test-tool' });
    });

    it('should return false if tool not found', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await repository.deleteByName('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('deleteByModuleName', () => {
    it('should delete tools by module name', async () => {
      const result = await repository.deleteByModuleName('test-module');

      expect(result).toBe(2);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({ moduleName: 'test-module' });
    });
  });

  describe('count', () => {
    it('should count tools with filters', async () => {
      const filters = { moduleName: 'test-module' };

      const result = await repository.count(filters);

      expect(result).toBe(5);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith(filters);
    });
  });

  describe('textSearch', () => {
    it('should perform text search', async () => {
      const mockResults = [{ name: 'matching-tool' }];
      const mockChain = mockCollection.find();
      mockChain.toArray.mockResolvedValue(mockResults);

      const result = await repository.textSearch('test query');

      expect(result).toEqual(mockResults);
      expect(mockCollection.find).toHaveBeenCalledWith(
        { $text: { $search: 'test query' } },
        {}
      );
    });

    it('should handle search with score sorting', async () => {
      const options = { sortByScore: true, limit: 10 };
      const mockChain = mockCollection.find();

      await repository.textSearch('test query', options);

      expect(mockChain.sort).toHaveBeenCalledWith({ score: { $meta: 'textScore' } });
      expect(mockChain.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('createTextIndexes', () => {
    it('should create text indexes', async () => {
      await repository.createTextIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { name: 'text', description: 'text' },
        {
          name: 'tool_text_index',
          weights: {
            name: 10,
            description: 5
          }
        }
      );
    });

    it('should handle index already exists error', async () => {
      const indexError = new Error('Index exists');
      indexError.code = 85;
      mockCollection.createIndex.mockRejectedValue(indexError);

      await expect(repository.createTextIndexes()).resolves.not.toThrow();
    });
  });

  describe('connection handling', () => {
    it('should throw error when database not connected', async () => {
      mockDatabaseStorage.isConnected = false;

      await expect(repository.findByName('test')).rejects.toThrow('Database not connected');
    });
  });
});