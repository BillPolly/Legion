/**
 * Unit tests for QdrantDataSource
 * Following TDD - these tests are written before implementation
 */

import { jest } from '@jest/globals';
import { QdrantDataSource } from '../../../src/datasources/QdrantDataSource.js';
import { ResourceManager } from '../../../src/ResourceManager.js';

describe('QdrantDataSource', () => {
  let dataSource;
  let resourceManager;
  let mockQdrantClient;

  beforeEach(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create mock Qdrant client
    mockQdrantClient = {
      getCollections: jest.fn().mockResolvedValue({
        collections: []
      }),
      createCollection: jest.fn().mockResolvedValue({ ok: true }),
      getCollection: jest.fn().mockResolvedValue({
        collection_name: 'test',
        vectors_count: 0,
        points_count: 0
      }),
      deleteCollection: jest.fn().mockResolvedValue({ ok: true }),
      upsert: jest.fn().mockResolvedValue({
        operation_id: 1,
        status: 'completed'
      }),
      search: jest.fn().mockResolvedValue({
        result: []
      }),
      retrieve: jest.fn().mockResolvedValue({
        result: []
      }),
      delete: jest.fn().mockResolvedValue({ ok: true }),
      update: jest.fn().mockResolvedValue({ ok: true })
    };
    
    // Override ResourceManager to provide mock client
    const originalGet = resourceManager.get.bind(resourceManager);
    resourceManager.get = (key) => {
      if (key === 'qdrantClient') {
        return mockQdrantClient;
      }
      return originalGet(key);
    };
    
    // Create DataSource
    dataSource = new QdrantDataSource(resourceManager);
  });

  afterEach(() => {
    if (dataSource && dataSource.cleanup) {
      dataSource.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create QdrantDataSource with ResourceManager', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.resourceManager).toBe(resourceManager);
    });

    it('should initialize with Qdrant client', async () => {
      await dataSource.initialize();
      
      expect(dataSource.initialized).toBe(true);
      expect(dataSource.qdrantClient).toBe(mockQdrantClient);
    });

    it('should connect to Qdrant server', async () => {
      await dataSource.initialize();
      
      // Should check collections to verify connection
      expect(mockQdrantClient.getCollections).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockQdrantClient.getCollections.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(dataSource.initialize()).rejects.toThrow('Connection failed');
      expect(dataSource.initialized).toBe(false);
    });

    it('should only initialize once', async () => {
      await dataSource.initialize();
      await dataSource.initialize();
      
      expect(mockQdrantClient.getCollections).toHaveBeenCalledTimes(1);
    });
  });

  describe('collection operations', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should create a collection', async () => {
      const config = {
        collection_name: 'test_collection',
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      };
      
      const result = await dataSource.createCollection(config);
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          vectors: expect.objectContaining({
            size: 768,
            distance: 'Cosine'
          })
        })
      );
    });

    it('should get collection info', async () => {
      const info = await dataSource.getCollectionInfo('test_collection');
      
      expect(info).toBeDefined();
      expect(info.collection_name).toBe('test');
      expect(mockQdrantClient.getCollection).toHaveBeenCalledWith('test_collection');
    });

    it('should list all collections', async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [
          { name: 'collection1' },
          { name: 'collection2' }
        ]
      });
      
      const collections = await dataSource.listCollections();
      
      expect(collections).toHaveLength(2);
      expect(collections[0].name).toBe('collection1');
    });

    it('should delete a collection', async () => {
      const result = await dataSource.deleteCollection('test_collection');
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.deleteCollection).toHaveBeenCalledWith('test_collection');
    });

    it('should check if collection exists', async () => {
      mockQdrantClient.getCollection.mockResolvedValueOnce({ collection_name: 'existing' });
      
      const exists = await dataSource.collectionExists('existing');
      expect(exists).toBe(true);
      
      mockQdrantClient.getCollection.mockRejectedValueOnce(new Error('Not found'));
      
      const notExists = await dataSource.collectionExists('non_existing');
      expect(notExists).toBe(false);
    });
  });

  describe('point operations', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should upsert points with vectors', async () => {
      const points = [
        {
          id: 'point1',
          vector: new Array(768).fill(0),
          payload: { text: 'test text 1' }
        },
        {
          id: 'point2',
          vector: new Array(768).fill(0.1),
          payload: { text: 'test text 2' }
        }
      ];
      
      const result = await dataSource.upsertPoints('test_collection', points);
      
      expect(result.status).toBe('completed');
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          points: expect.arrayContaining([
            expect.objectContaining({
              id: 'point1',
              vector: expect.any(Array),
              payload: expect.objectContaining({ text: 'test text 1' })
            })
          ])
        })
      );
    });

    it('should search for similar vectors', async () => {
      const queryVector = new Array(768).fill(0);
      mockQdrantClient.search.mockResolvedValue({
        result: [
          { id: 'point1', score: 0.95, payload: { text: 'similar text' } },
          { id: 'point2', score: 0.85, payload: { text: 'less similar' } }
        ]
      });
      
      const results = await dataSource.search('test_collection', queryVector, 5);
      
      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(results[0].payload.text).toBe('similar text');
      
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          vector: queryVector,
          limit: 5
        })
      );
    });

    it('should search with filters', async () => {
      const queryVector = new Array(768).fill(0);
      const filter = {
        must: [
          { key: 'category', match: { value: 'documents' } }
        ]
      };
      
      await dataSource.searchWithFilter('test_collection', queryVector, filter, 10);
      
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          vector: queryVector,
          filter: filter,
          limit: 10
        })
      );
    });

    it('should retrieve points by IDs', async () => {
      mockQdrantClient.retrieve.mockResolvedValue({
        result: [
          { id: 'point1', payload: { text: 'text 1' } },
          { id: 'point2', payload: { text: 'text 2' } }
        ]
      });
      
      const points = await dataSource.getPoints('test_collection', ['point1', 'point2']);
      
      expect(points).toHaveLength(2);
      expect(points[0].payload.text).toBe('text 1');
      
      expect(mockQdrantClient.retrieve).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          ids: ['point1', 'point2']
        })
      );
    });

    it('should delete points by IDs', async () => {
      const result = await dataSource.deletePoints('test_collection', ['point1', 'point2']);
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({
          points: ['point1', 'point2']
        })
      );
    });

    it('should update point payload', async () => {
      const updates = {
        'point1': { category: 'updated' },
        'point2': { status: 'archived' }
      };
      
      const result = await dataSource.updatePayloads('test_collection', updates);
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.update).toHaveBeenCalled();
    });
  });

  describe('batch operations', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should handle batch upsert with chunking', async () => {
      // Create 150 points to test chunking (default chunk size should be 100)
      const points = Array.from({ length: 150 }, (_, i) => ({
        id: `point${i}`,
        vector: new Array(768).fill(i / 150),
        payload: { index: i }
      }));
      
      await dataSource.batchUpsert('test_collection', points);
      
      // Should be called twice (100 + 50)
      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle batch search', async () => {
      const queries = [
        new Array(768).fill(0),
        new Array(768).fill(0.5),
        new Array(768).fill(1)
      ];
      
      mockQdrantClient.search
        .mockResolvedValueOnce({ result: [{ id: '1', score: 0.9 }] })
        .mockResolvedValueOnce({ result: [{ id: '2', score: 0.8 }] })
        .mockResolvedValueOnce({ result: [{ id: '3', score: 0.7 }] });
      
      const results = await dataSource.batchSearch('test_collection', queries, 5);
      
      expect(results).toHaveLength(3);
      expect(results[0][0].score).toBe(0.9);
      expect(mockQdrantClient.search).toHaveBeenCalledTimes(3);
    });
  });

  describe('query interface (DataSource pattern)', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should handle query for collections', async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [{ name: 'col1' }, { name: 'col2' }]
      });
      
      const result = await dataSource.query({ type: 'collections' });
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('col1');
    });

    it('should handle query for specific collection', async () => {
      const result = await dataSource.query({
        type: 'collection',
        collection: 'test_collection'
      });
      
      expect(result.collection_name).toBe('test');
      expect(mockQdrantClient.getCollection).toHaveBeenCalled();
    });

    it('should handle search query', async () => {
      mockQdrantClient.search.mockResolvedValue({
        result: [{ id: 'match1', score: 0.92 }]
      });
      
      const result = await dataSource.query({
        type: 'search',
        collection: 'test_collection',
        vector: new Array(768).fill(0),
        limit: 10
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0.92);
    });

    it('should handle points query', async () => {
      mockQdrantClient.retrieve.mockResolvedValue({
        result: [{ id: 'p1', payload: { data: 'test' } }]
      });
      
      const result = await dataSource.query({
        type: 'points',
        collection: 'test_collection',
        ids: ['p1']
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].payload.data).toBe('test');
    });

    it('should throw for unknown query type', async () => {
      await expect(
        dataSource.query({ type: 'unknown' })
      ).rejects.toThrow('Unknown query type: unknown');
    });
  });

  describe('subscription support', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should support subscriptions to collection changes', () => {
      const callback = jest.fn();
      const subscription = dataSource.subscribe(callback, {
        type: 'collection.change',
        collection: 'test_collection'
      });
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should notify subscribers on collection operations', async () => {
      const callback = jest.fn();
      
      dataSource.subscribe(callback, {
        type: 'collection.change',
        collection: 'test_collection'
      });
      
      // Trigger a change
      await dataSource.upsertPoints('test_collection', [
        { id: 'new', vector: new Array(768).fill(0), payload: {} }
      ]);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'collection.change',
          operation: 'upsert',
          collection: 'test_collection'
        })
      );
    });

    it('should handle unsubscribe', async () => {
      const callback = jest.fn();
      
      const subscription = dataSource.subscribe(callback, {
        type: 'collection.change'
      });
      
      subscription.unsubscribe();
      
      // Should not receive notifications after unsubscribe
      await dataSource.upsertPoints('test_collection', [
        { id: 'new', vector: new Array(768).fill(0), payload: {} }
      ]);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('resource management', () => {
    it('should cleanup resources', async () => {
      await dataSource.initialize();
      
      dataSource.cleanup();
      
      expect(dataSource.initialized).toBe(false);
      expect(dataSource.qdrantClient).toBeNull();
    });

    it('should handle multiple cleanup calls', () => {
      dataSource.cleanup();
      
      // Should not throw
      expect(() => dataSource.cleanup()).not.toThrow();
    });

    it('should clear subscriptions on cleanup', async () => {
      await dataSource.initialize();
      
      const callback = jest.fn();
      dataSource.subscribe(callback, { type: 'test' });
      
      expect(dataSource._subscriptions.size).toBe(1);
      
      dataSource.cleanup();
      
      expect(dataSource._subscriptions.size).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await dataSource.initialize();
    });

    it('should handle network errors gracefully', async () => {
      mockQdrantClient.search.mockRejectedValue(new Error('Network error'));
      
      await expect(
        dataSource.search('test_collection', new Array(768).fill(0), 5)
      ).rejects.toThrow('Network error');
    });

    it('should validate vector dimensions', async () => {
      const invalidVector = new Array(512).fill(0); // Wrong size
      
      await expect(
        dataSource.search('test_collection', invalidVector, 5)
      ).rejects.toThrow('Invalid vector dimension');
    });

    it('should validate collection names', async () => {
      await expect(
        dataSource.createCollection({ collection_name: '', vectors: { size: 768 } })
      ).rejects.toThrow('Collection name is required');
      
      await expect(
        dataSource.createCollection({ collection_name: null, vectors: { size: 768 } })
      ).rejects.toThrow('Collection name is required');
    });

    it('should handle invalid point IDs', async () => {
      await expect(
        dataSource.getPoints('test_collection', [])
      ).rejects.toThrow('Point IDs are required');
      
      await expect(
        dataSource.getPoints('test_collection', null)
      ).rejects.toThrow('Point IDs are required');
    });
  });

  describe('connection configuration', () => {
    it('should use environment configuration', async () => {
      // ResourceManager should provide Qdrant URL from env
      const qdrantUrl = resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333';
      
      expect(dataSource.qdrantUrl).toBeDefined();
      // Should default to localhost if not in env
      expect(dataSource.qdrantUrl).toMatch(/http:\/\/.*:6333/);
    });

    it('should support custom configuration', async () => {
      const customDataSource = new QdrantDataSource(resourceManager, {
        url: 'http://custom:6333',
        apiKey: 'test-key'
      });
      
      expect(customDataSource.config.url).toBe('http://custom:6333');
      expect(customDataSource.config.apiKey).toBe('test-key');
    });
  });
});