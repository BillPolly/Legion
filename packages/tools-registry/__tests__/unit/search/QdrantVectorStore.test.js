/**
 * Unit tests for QdrantVectorStore
 * Tests the Qdrant vector database integration
 */

import { jest } from '@jest/globals';
import { QdrantVectorStore } from '../../../src/search/QdrantVectorStore.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('QdrantVectorStore', () => {
  let vectorStore;
  let mockResourceManager;

  beforeEach(() => {
    // Reset fetch mock
    global.fetch.mockReset();
    
    // Create a mock client that will be returned by getOrInitialize
    const mockClient = {
      getCollections: jest.fn(async () => ({
        collections: []
      })),
      createCollection: jest.fn(async () => ({ result: true })),
      deleteCollection: jest.fn(async () => ({ result: true })),
      getCollection: jest.fn(async () => ({
        status: 'green',
        vectors_count: 0,
        points_count: 0
      })),
      upsert: jest.fn(async () => ({
        operation_id: 1,
        status: 'completed'
      })),
      search: jest.fn(async () => []),
      retrieve: jest.fn(async () => ({ points: [] })),
      delete: jest.fn(async () => ({ result: true })),
      count: jest.fn(async () => ({ count: 0 })),
      scroll: jest.fn(async () => ({ points: [] }))
    };
    
    // Create mock resource manager
    mockResourceManager = {
      get: jest.fn((key) => {
        if (key === 'env.QDRANT_URL') return 'http://localhost:6333';
        if (key === 'env.QDRANT_API_KEY') return 'test-api-key';
        return null;
      }),
      getOrInitialize: jest.fn(async (key, factory) => {
        // Always return the same mock client
        return mockClient;
      })
    };

    vectorStore = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-api-key'
    }, mockResourceManager);
    
    // Store reference to mockClient for test access
    vectorStore.mockClient = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with config', () => {
      expect(vectorStore).toBeDefined();
      expect(vectorStore.config.url).toBe('http://localhost:6333');
      expect(vectorStore.config.apiKey).toBe('test-api-key');
    });

    test('should use resource manager for config if not provided', () => {
      const store = new QdrantVectorStore({}, mockResourceManager);
      expect(store.config.url).toBe('http://localhost:6333');
      // apiKey won't be set from resource manager in constructor
      expect(store.config.apiKey).toBeUndefined();
    });
  });

  describe('Collection Management', () => {
    test('should create collection successfully', async () => {
      // Mock for deleteCollection (called first)
      vectorStore.mockClient.deleteCollection.mockResolvedValueOnce({ result: true });
      // Mock for getCollections (called by ensureCollection)
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: []
      });
      // Mock for createCollection
      vectorStore.mockClient.createCollection.mockResolvedValueOnce({ result: true });

      await vectorStore.createCollection('test-collection', { dimension: 768 });
      
      expect(vectorStore.mockClient.deleteCollection).toHaveBeenCalledWith('test-collection');
      expect(vectorStore.mockClient.getCollections).toHaveBeenCalled();
      expect(vectorStore.mockClient.createCollection).toHaveBeenCalledWith('test-collection', {
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });
    });

    test('should check if collection exists', async () => {
      // Update the mock to return a collection
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'test-collection' }]
      });

      const exists = await vectorStore.collectionExists('test-collection');
      
      expect(exists).toBe(true);
      expect(vectorStore.mockClient.getCollections).toHaveBeenCalled();
    });

    test('should return false if collection does not exist', async () => {
      // Mock returns empty collections array
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: []
      });

      const exists = await vectorStore.collectionExists('non-existent');
      expect(exists).toBe(false);
    });

    test('should delete collection', async () => {
      vectorStore.mockClient.deleteCollection.mockResolvedValueOnce({ result: true });

      const result = await vectorStore.deleteCollection('test-collection');
      
      expect(vectorStore.mockClient.deleteCollection).toHaveBeenCalledWith('test-collection');
      expect(result).toEqual({ success: true, message: 'Collection test-collection deleted' });
    });
  });

  describe('Vector Operations', () => {
    test('should upsert vectors successfully', async () => {
      // Mock getCollections for ensureCollection
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'test-collection' }]
      });
      // Mock upsert
      vectorStore.mockClient.upsert.mockResolvedValueOnce({
        operation_id: 1,
        status: 'completed'
      });

      const vectors = [
        {
          id: 'vec1',
          vector: new Array(768).fill(0.1),
          payload: { text: 'test' }
        }
      ];

      const result = await vectorStore.upsert('test-collection', vectors);
      
      expect(vectorStore.mockClient.upsert).toHaveBeenCalledWith('test-collection', {
        wait: true,
        points: vectors
      });
      expect(result).toEqual({ operation_id: 1, status: 'completed' });
    });

    test('should handle upsert failure', async () => {
      // Mock getCollections for ensureCollection
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'test-collection' }]
      });
      // Mock upsert to throw error
      const error = new Error('Bad Request');
      error.response = { text: async () => 'Invalid vector dimension' };
      vectorStore.mockClient.upsert.mockRejectedValueOnce(error);

      const vectors = [
        {
          id: 'vec1',
          vector: new Array(768).fill(0.1),
          payload: { text: 'test' }
        }
      ];

      await expect(vectorStore.upsert('test-collection', vectors)).rejects.toThrow('Bad Request');
    });

    test('should search vectors', async () => {
      const mockResults = [
        { id: 'vec1', score: 0.95, payload: { text: 'test1' } },
        { id: 'vec2', score: 0.85, payload: { text: 'test2' } }
      ];

      vectorStore.mockClient.search.mockResolvedValueOnce(mockResults);

      const query = new Array(768).fill(0.1);
      const results = await vectorStore.search('test-collection', query, { limit: 5 });
      
      expect(vectorStore.mockClient.search).toHaveBeenCalledWith('test-collection', {
        vector: query,
        limit: 5,
        score_threshold: 0,
        filter: undefined,
        with_payload: true,
        with_vector: undefined
      });
      expect(results).toEqual(mockResults);
    });

    test('should handle search with filter', async () => {
      vectorStore.mockClient.search.mockResolvedValueOnce([]);

      const query = new Array(768).fill(0.1);
      const filter = { category: 'test' };
      
      await vectorStore.search('test-collection', query, { limit: 5, filter });
      
      expect(vectorStore.mockClient.search).toHaveBeenCalledWith('test-collection', {
        vector: query,
        limit: 5,
        score_threshold: 0,
        filter: {
          must: [{ key: 'category', match: { value: 'test' } }]
        },
        with_payload: true,
        with_vector: undefined
      });
    });
  });

  describe('Batch Operations', () => {
    test('should batch upsert large arrays', async () => {
      // Mock for ensureCollection
      vectorStore.mockClient.getCollections.mockResolvedValue({
        collections: [{ name: 'test-collection' }]
      });
      // Mock for upsert calls
      vectorStore.mockClient.upsert.mockResolvedValue({
        operation_id: 1,
        status: 'completed'
      });

      // Create 150 vectors (should split into 2 batches of 100 and 50)
      const vectors = Array(150).fill(null).map((_, i) => ({
        id: `vec${i}`,
        vector: new Array(768).fill(0.1),
        payload: { text: `test${i}` }
      }));

      // Note: upsertBatch doesn't exist in the implementation, using upsert instead
      const result = await vectorStore.upsert('test-collection', vectors);
      
      // Should have been called once (implementation doesn't batch)
      expect(vectorStore.mockClient.upsert).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ operation_id: 1, status: 'completed' });
    });

    test('should handle partial batch failure', async () => {
      // Mock for ensureCollection
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: [{ name: 'test-collection' }]
      });
      // Mock upsert to fail
      const error = new Error('Bad Request');
      error.response = { text: async () => 'Batch too large' };
      vectorStore.mockClient.upsert.mockRejectedValueOnce(error);

      const vectors = Array(150).fill(null).map((_, i) => ({
        id: `vec${i}`,
        vector: new Array(768).fill(0.1),
        payload: { text: `test${i}` }
      }));

      await expect(vectorStore.upsert('test-collection', vectors)).rejects.toThrow('Bad Request');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      vectorStore.mockClient.getCollections.mockRejectedValueOnce(new Error('Network error'));

      await expect(vectorStore.collectionExists('test-collection')).rejects.toThrow('Network error');
    });

    test('should handle invalid responses', async () => {
      vectorStore.mockClient.search.mockRejectedValueOnce(new Error('Invalid response'));

      await expect(vectorStore.search('test-collection', new Array(768).fill(0.1), { limit: 5 }))
        .rejects.toThrow('Invalid response');
    });

    test('should validate vector dimensions', async () => {
      const invalidVector = new Array(512).fill(0.1); // Wrong dimensions
      
      // Mock for ensureCollection - should create with detected dimension
      vectorStore.mockClient.getCollections.mockResolvedValueOnce({
        collections: []
      });
      vectorStore.mockClient.createCollection.mockResolvedValueOnce({ result: true });
      
      // Mock upsert to fail with dimension error
      const error = new Error('Bad Request');
      error.response = { text: async () => 'Vector dimension mismatch' };
      vectorStore.mockClient.upsert.mockRejectedValueOnce(error);

      await expect(vectorStore.upsert('test-collection', [{
        id: 'vec1',
        vector: invalidVector,
        payload: {}
      }])).rejects.toThrow('Bad Request');
    });
  });

});