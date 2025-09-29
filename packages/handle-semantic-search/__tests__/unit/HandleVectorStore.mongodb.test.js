/**
 * Unit tests for HandleVectorStore MongoDB integration
 * Phase 4: Metadata storage in MongoDB
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';

describe('HandleVectorStore MongoDB Integration (Unit)', () => {
  let store;
  let mockResourceManager;
  let mockNomicHandle;
  let mockQdrantHandle;
  let mockMongoHandle;

  beforeEach(() => {
    // Mock Nomic handle
    mockNomicHandle = {
      embed: jest.fn().mockResolvedValue(new Array(768).fill(0.1))
    };

    // Mock Qdrant handle
    mockQdrantHandle = {
      exists: jest.fn().mockResolvedValue(true),
      createCollection: jest.fn().mockResolvedValue({ status: 'ok' }),
      upsert: jest.fn().mockResolvedValue({ status: 'ok' }),
      search: jest.fn().mockResolvedValue([]),
      searchWithFilter: jest.fn().mockResolvedValue([]),
      deletePoints: jest.fn().mockResolvedValue({ status: 'ok' }),
      collectionName: 'handle_vectors'
    };

    // Mock MongoDB handle with dataSource
    mockMongoHandle = {
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'test-id' }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      dataSource: {
        updateAsync: jest.fn().mockResolvedValue({
          success: true,
          changes: [{ type: 'updateOne', matchedCount: 1, modifiedCount: 1 }]
        }),
        queryAsync: jest.fn().mockResolvedValue([])
      }
    };

    // Mock ResourceManager
    mockResourceManager = {
      createHandleFromURI: jest.fn().mockImplementation((uri) => {
        if (uri.includes('nomic')) return Promise.resolve(mockNomicHandle);
        if (uri.includes('qdrant')) return Promise.resolve(mockQdrantHandle);
        if (uri.includes('mongodb')) return Promise.resolve(mockMongoHandle);
        throw new Error('Unknown URI');
      })
    };

    store = new HandleVectorStore(mockResourceManager);
  });

  describe('MongoDB Handle Initialization', () => {
    it('should initialize with MongoDB handle', async () => {
      await store.initialize();

      expect(store.mongoHandle).toBeDefined();
      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith(
        expect.stringContaining('mongodb')
      );
    });

    it('should use handle_records collection', async () => {
      await store.initialize();

      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith(
        'legion://local/mongodb/handle_semantic_search/handle_records'
      );
    });

    it('should keep MongoDB handle for lifetime', async () => {
      await store.initialize();

      const mongoHandle1 = store.mongoHandle;

      // Call another method
      await store.generateEmbedding('test');

      expect(store.mongoHandle).toBe(mongoHandle1);
    });
  });

  describe('Handle Record Persistence', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should store complete handle record', async () => {
      const handleURI = 'legion://local/filesystem/test.js';
      const metadata = {
        server: 'local',
        resourceType: 'filesystem',
        path: '/test.js',
        capabilities: ['read'],
        handleType: 'filesystem'
      };
      const glosses = [
        {
          perspective: 'functional',
          description: 'Test file',
          keywords: ['test']
        }
      ];

      await store.storeHandleRecord(handleURI, metadata, glosses, [123456]);

      expect(mockMongoHandle.dataSource.updateAsync).toHaveBeenCalled();
      const [updateSpec] = mockMongoHandle.dataSource.updateAsync.mock.calls[0];

      expect(updateSpec.updateOne.filter).toEqual({ handleURI });
      expect(updateSpec.updateOne.options).toEqual({ upsert: true });
      expect(updateSpec.updateOne.update.$set.handleURI).toBe(handleURI);
      expect(updateSpec.updateOne.update.$set.handleType).toBe('filesystem');
      expect(updateSpec.updateOne.update.$set.metadata).toEqual(metadata);
      expect(updateSpec.updateOne.update.$set.glosses).toHaveLength(1);
    });

    it('should store vector IDs with glosses', async () => {
      const handleURI = 'legion://local/test/resource';
      const glosses = [
        {
          perspective: 'functional',
          description: 'Test gloss',
          keywords: ['test']
        }
      ];
      const vectorIds = [123456, 789012];

      await store.storeHandleRecord(handleURI, {}, glosses, vectorIds);

      const [updateSpec] = mockMongoHandle.dataSource.updateAsync.mock.calls[0];
      expect(updateSpec.updateOne.update.$set.glosses[0].vector_id).toBe(123456);
    });

    it('should set timestamps', async () => {
      const handleURI = 'legion://local/test/resource';

      await store.storeHandleRecord(handleURI, {}, [], []);

      const [updateSpec] = mockMongoHandle.dataSource.updateAsync.mock.calls[0];
      expect(updateSpec.updateOne.update.$set.updated_at).toBeDefined();
      expect(updateSpec.updateOne.update.$setOnInsert.indexed_at).toBeDefined();
    });

    it('should set status and vector collection name', async () => {
      const handleURI = 'legion://local/test/resource';

      await store.storeHandleRecord(handleURI, {}, [], []);

      const [updateSpec] = mockMongoHandle.dataSource.updateAsync.mock.calls[0];
      expect(updateSpec.updateOne.update.$set.status).toBe('active');
      expect(updateSpec.updateOne.update.$set.vector_collection).toBe('handle_vectors');
    });
  });

  describe('Handle Record Retrieval', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should retrieve handle record by URI', async () => {
      const handleURI = 'legion://local/test/resource';
      const mockRecord = {
        _id: 'test-id',
        handleURI,
        handleType: 'test',
        metadata: {},
        glosses: []
      };

      mockMongoHandle.dataSource.queryAsync.mockResolvedValue([
        { data: mockRecord }
      ]);

      const result = await store.getHandleRecord(handleURI);

      expect(mockMongoHandle.dataSource.queryAsync).toHaveBeenCalledWith({
        findOne: { handleURI }
      });
      expect(result).toEqual(mockRecord);
    });

    it('should return null if record not found', async () => {
      mockMongoHandle.dataSource.queryAsync.mockResolvedValue([]);

      const result = await store.getHandleRecord('legion://local/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Dual Storage Coordination', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should coordinate Qdrant and MongoDB operations', async () => {
      const handleURI = 'legion://local/test/resource';
      const metadata = { handleType: 'test' };
      const glosses = [
        {
          perspective: 'functional',
          description: 'Test description',
          keywords: ['test']
        }
      ];

      const result = await store.storeHandle(handleURI, metadata, glosses);

      expect(mockQdrantHandle.upsert).toHaveBeenCalled();
      expect(mockMongoHandle.dataSource.updateAsync).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.vectorIds).toBeDefined();
      expect(result.mongoId).toBeDefined();
    });

    it('should store vectors before MongoDB record', async () => {
      const callOrder = [];

      mockQdrantHandle.upsert.mockImplementation(() => {
        callOrder.push('qdrant');
        return Promise.resolve({ status: 'ok' });
      });

      mockMongoHandle.dataSource.updateAsync.mockImplementation(() => {
        callOrder.push('mongo');
        return Promise.resolve({ success: true, changes: [] });
      });

      await store.storeHandle('legion://local/test', {}, [
        { perspective: 'test', description: 'test', keywords: [] }
      ]);

      expect(callOrder).toEqual(['qdrant', 'mongo']);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should throw error if MongoDB operation fails', async () => {
      mockMongoHandle.dataSource.updateAsync.mockRejectedValue(new Error('MongoDB error'));

      await expect(
        store.storeHandleRecord('uri', {}, [], [])
      ).rejects.toThrow('MongoDB error');
    });
  });
});