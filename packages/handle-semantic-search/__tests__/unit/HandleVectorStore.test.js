/**
 * Unit tests for HandleVectorStore
 * Phase 3, Step 3.2: Vector store structure and initialization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandleVectorStore } from '../../src/HandleVectorStore.js';

describe('HandleVectorStore', () => {
  let store;
  let mockResourceManager;
  let mockNomicHandle;
  let mockQdrantHandle;

  beforeEach(() => {
    // Create mock Nomic handle
    mockNomicHandle = {
      embed: jest.fn().mockResolvedValue(
        new Array(768).fill(0).map(() => Math.random())
      )
    };

    // Create mock Qdrant handle
    mockQdrantHandle = {
      exists: jest.fn().mockResolvedValue(true),
      getInfo: jest.fn().mockResolvedValue({ status: 'ok' }),
      createCollection: jest.fn().mockResolvedValue({ success: true }),
      upsert: jest.fn().mockResolvedValue({ success: true }),
      search: jest.fn().mockResolvedValue([]),
      searchWithFilter: jest.fn().mockResolvedValue([]),
      deletePoints: jest.fn().mockResolvedValue({ success: true })
    };

    // Create mock ResourceManager
    mockResourceManager = {
      createHandleFromURI: jest.fn().mockImplementation((uri) => {
        if (uri.includes('nomic')) {
          return Promise.resolve(mockNomicHandle);
        }
        if (uri.includes('qdrant')) {
          return Promise.resolve(mockQdrantHandle);
        }
        if (uri.includes('mongodb')) {
          return Promise.resolve({ dataSource: {} });
        }
        return Promise.reject(new Error('Unknown URI'));
      })
    };

    store = new HandleVectorStore(mockResourceManager);
  });

  describe('Constructor', () => {
    it('should create an instance with ResourceManager', () => {
      expect(store).toBeInstanceOf(HandleVectorStore);
      expect(store.resourceManager).toBe(mockResourceManager);
    });

    it('should throw error without ResourceManager', () => {
      expect(() => new HandleVectorStore()).toThrow('ResourceManager is required');
    });

    it('should initialize with null handles', () => {
      expect(store.nomicHandle).toBeNull();
      expect(store.qdrantHandle).toBeNull();
      expect(store.initialized).toBe(false);
    });

    it('should have default collection name', () => {
      expect(store.collectionName).toBe('handle_vectors');
    });
  });

  describe('Initialization', () => {
    it('should initialize and get handles from ResourceManager', async () => {
      await store.initialize();

      expect(store.initialized).toBe(true);
      expect(store.nomicHandle).toBe(mockNomicHandle);
      expect(store.qdrantHandle).toBe(mockQdrantHandle);
      expect(store.mongoHandle).toBeDefined();
      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledTimes(3);
    });

    it('should not reinitialize if already initialized', async () => {
      await store.initialize();
      await store.initialize();

      // Should only call once
      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledTimes(3); // Once for each handle type (Nomic, Qdrant, MongoDB)
    });

    it('should check if Qdrant collection exists', async () => {
      await store.initialize();

      expect(mockQdrantHandle.exists).toHaveBeenCalled();
    });

    it('should create collection if it does not exist', async () => {
      mockQdrantHandle.exists.mockResolvedValueOnce(false);

      await store.initialize();

      expect(mockQdrantHandle.createCollection).toHaveBeenCalledWith({
        collection_name: 'handle_vectors',
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });
    });
  });

  describe('Embedding Generation', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should generate embedding for text', async () => {
      const text = 'Test gloss description';
      const embedding = await store.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
      expect(mockNomicHandle.embed).toHaveBeenCalledWith(text);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedStore = new HandleVectorStore(mockResourceManager);

      await expect(
        uninitializedStore.generateEmbedding('test')
      ).rejects.toThrow('not initialized');
    });

    it('should throw error for empty text', async () => {
      await expect(
        store.generateEmbedding('')
      ).rejects.toThrow('Text is required');
    });

    it('should throw error for non-string text', async () => {
      await expect(
        store.generateEmbedding(123)
      ).rejects.toThrow('Text is required');
    });
  });

  describe('Store Gloss Embeddings', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('should store embeddings for glosses', async () => {
      const handleURI = 'legion://local/filesystem/test.js';
      const glosses = [
        {
          perspective: 'functional',
          description: 'JavaScript code file with Express server implementation',
          keywords: ['javascript', 'express', 'server']
        },
        {
          perspective: 'contextual',
          description: 'Backend API service configuration and routing logic',
          keywords: ['api', 'backend', 'routing']
        }
      ];

      const result = await store.storeGlossEmbeddings(handleURI, glosses);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.vectorIds).toHaveLength(2);
      expect(mockNomicHandle.embed).toHaveBeenCalledTimes(2);
      expect(mockQdrantHandle.upsert).toHaveBeenCalled();
    });

    it('should create proper vector IDs', async () => {
      const handleURI = 'legion://local/test/resource';
      const glosses = [{
        perspective: 'functional',
        description: 'Test description',
        keywords: ['test']
      }];

      const result = await store.storeGlossEmbeddings(handleURI, glosses);

      expect(typeof result.vectorIds[0]).toBe('number');
      expect(result.vectorIds[0]).toBeGreaterThan(0);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedStore = new HandleVectorStore(mockResourceManager);

      await expect(
        uninitializedStore.storeGlossEmbeddings('uri', [])
      ).rejects.toThrow('not initialized');
    });

    it('should throw error without handle URI', async () => {
      await expect(
        store.storeGlossEmbeddings('', [{ perspective: 'test', description: 'test', keywords: [] }])
      ).rejects.toThrow('Handle URI is required');
    });

    it('should throw error with empty glosses array', async () => {
      await expect(
        store.storeGlossEmbeddings('uri', [])
      ).rejects.toThrow('must not be empty');
    });
  });
});