/**
 * Unit tests for QdrantHandle
 * Following TDD - these tests are written before implementation
 */

import { jest } from '@jest/globals';
import { QdrantHandle } from '../../../src/handles/QdrantHandle.js';
import { QdrantDataSource } from '../../../src/datasources/QdrantDataSource.js';
import { ResourceManager } from '../../../src/ResourceManager.js';

describe('QdrantHandle', () => {
  let handle;
  let dataSource;
  let resourceManager;
  let parsed;
  let mockQdrantClient;

  beforeEach(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create mock Qdrant client
    mockQdrantClient = {
      getCollections: jest.fn().mockResolvedValue({
        collections: [{ name: 'test_collection' }]
      }),
      createCollection: jest.fn().mockResolvedValue({ ok: true }),
      getCollection: jest.fn().mockResolvedValue({
        collection_name: 'test_collection',
        vectors_count: 10,
        points_count: 10
      }),
      deleteCollection: jest.fn().mockResolvedValue({ ok: true }),
      upsert: jest.fn().mockResolvedValue({
        operation_id: 1,
        status: 'completed'
      }),
      search: jest.fn().mockResolvedValue({
        result: [
          { id: '1', score: 0.95, payload: { text: 'result 1' } },
          { id: '2', score: 0.85, payload: { text: 'result 2' } }
        ]
      }),
      retrieve: jest.fn().mockResolvedValue({
        result: [
          { id: '1', payload: { text: 'point 1' } }
        ]
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
    await dataSource.initialize();
    
    // Parsed URI components for a collection
    parsed = {
      scheme: 'legion',
      server: 'local',
      resourceType: 'qdrant',
      path: 'collections/test_collection',
      original: 'legion://local/qdrant/collections/test_collection'
    };
    
    // Create Handle
    handle = new QdrantHandle(dataSource, parsed);
  });

  afterEach(() => {
    if (handle && handle.destroy) {
      handle.destroy();
    }
    if (dataSource && dataSource.cleanup) {
      dataSource.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('construction', () => {
    it('should require DataSource', () => {
      expect(() => new QdrantHandle(null, parsed)).toThrow('DataSource is required');
    });

    it('should require parsed URI components', () => {
      expect(() => new QdrantHandle(dataSource, null)).toThrow('Parsed URI components are required');
    });

    it('should create Handle with DataSource and parsed components', () => {
      expect(handle).toBeDefined();
      expect(handle.dataSource).toBe(dataSource);
      expect(handle.parsed).toBe(parsed);
    });

    it('should parse collection name from path', () => {
      expect(handle.collectionName).toBe('test_collection');
    });

    it('should handle different URI paths', () => {
      const rootParsed = { ...parsed, path: 'collections' };
      const rootHandle = new QdrantHandle(dataSource, rootParsed);
      expect(rootHandle.collectionName).toBeNull();
      expect(rootHandle.isRoot).toBe(true);
      rootHandle.destroy();

      const specificParsed = { ...parsed, path: 'collections/my_vectors' };
      const specificHandle = new QdrantHandle(dataSource, specificParsed);
      expect(specificHandle.collectionName).toBe('my_vectors');
      expect(specificHandle.isRoot).toBe(false);
      specificHandle.destroy();
    });

    it('should create proxy for transparent property access', () => {
      expect(typeof handle).toBe('object');
      expect(handle.constructor.name).toBe('QdrantHandle');
    });
  });

  describe('collection operations through Handle', () => {
    it('should create a collection', async () => {
      const result = await handle.createCollection({
        collection_name: 'new_collection',
        vectors: { size: 768, distance: 'Cosine' }
      });
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalled();
    });

    it('should get collection info for current collection', async () => {
      const info = await handle.getInfo();
      
      expect(info).toBeDefined();
      expect(info.collection_name).toBe('test_collection');
      expect(info.vectors_count).toBe(10);
      expect(mockQdrantClient.getCollection).toHaveBeenCalledWith('test_collection');
    });

    it('should list all collections from root Handle', async () => {
      const rootParsed = { ...parsed, path: 'collections' };
      const rootHandle = new QdrantHandle(dataSource, rootParsed);
      
      const collections = await rootHandle.listCollections();
      
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('test_collection');
      expect(mockQdrantClient.getCollections).toHaveBeenCalled();
      
      rootHandle.destroy();
    });

    it('should delete current collection', async () => {
      const result = await handle.deleteCollection();
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.deleteCollection).toHaveBeenCalledWith('test_collection');
    });

    it('should check if current collection exists', async () => {
      const exists = await handle.exists();
      
      expect(exists).toBe(true);
      expect(mockQdrantClient.getCollection).toHaveBeenCalledWith('test_collection');
    });
  });

  describe('point operations through Handle', () => {
    it('should upsert points to current collection', async () => {
      const points = [
        { id: 'p1', vector: new Array(768).fill(0), payload: { text: 'test' } }
      ];
      
      const result = await handle.upsert(points);
      
      expect(result.status).toBe('completed');
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ points })
      );
    });

    it('should search in current collection', async () => {
      const vector = new Array(768).fill(0);
      const results = await handle.search(vector, 5);
      
      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ vector, limit: 5 })
      );
    });

    it('should search with filters', async () => {
      const vector = new Array(768).fill(0);
      const filter = { must: [{ key: 'category', match: { value: 'test' } }] };
      
      const results = await handle.searchWithFilter(vector, filter, 10);
      
      expect(results).toHaveLength(2);
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ vector, filter, limit: 10 })
      );
    });

    it('should get points by IDs from current collection', async () => {
      const points = await handle.getPoints(['1']);
      
      expect(points).toHaveLength(1);
      expect(points[0].payload.text).toBe('point 1');
      expect(mockQdrantClient.retrieve).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ ids: ['1'] })
      );
    });

    it('should delete points from current collection', async () => {
      const result = await handle.deletePoints(['1', '2']);
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(
        'test_collection',
        expect.objectContaining({ points: ['1', '2'] })
      );
    });

    it('should update point payloads in current collection', async () => {
      const updates = { '1': { status: 'updated' } };
      const result = await handle.updatePayloads(updates);
      
      expect(result.ok).toBe(true);
      expect(mockQdrantClient.update).toHaveBeenCalled();
    });
  });

  describe('batch operations through Handle', () => {
    it('should handle batch upsert', async () => {
      const points = Array.from({ length: 150 }, (_, i) => ({
        id: `p${i}`,
        vector: new Array(768).fill(i / 150),
        payload: { index: i }
      }));
      
      await handle.batchUpsert(points);
      
      // Should chunk into 2 calls (100 + 50)
      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle batch search', async () => {
      const vectors = [
        new Array(768).fill(0),
        new Array(768).fill(0.5),
        new Array(768).fill(1)
      ];
      
      const results = await handle.batchSearch(vectors, 5);
      
      expect(results).toHaveLength(3);
      expect(mockQdrantClient.search).toHaveBeenCalledTimes(3);
    });
  });

  describe('proxy-based property access', () => {
    it('should allow transparent property access for collection metadata', async () => {
      await handle.getInfo(); // Populate cache
      
      handle.metadata = { custom: 'value' };
      expect(handle.metadata).toEqual({ custom: 'value' });
    });

    it('should handle dynamic property setting', () => {
      handle.customProperty = 'custom value';
      expect(handle.customProperty).toBe('custom value');
    });

    it('should preserve Handle methods', () => {
      expect(typeof handle.search).toBe('function');
      expect(typeof handle.upsert).toBe('function');
      expect(typeof handle.getInfo).toBe('function');
      expect(typeof handle.toURI).toBe('function');
      expect(typeof handle.destroy).toBe('function');
    });

    it('should handle "in" operator correctly', () => {
      expect('search' in handle).toBe(true);
      expect('upsert' in handle).toBe(true);
      expect('collectionName' in handle).toBe(true);
      expect('nonExistent' in handle).toBe(false);
    });
  });

  describe('URI operations', () => {
    it('should generate correct URI for collection', () => {
      const uri = handle.toURI();
      expect(uri).toBe('legion://local/qdrant/collections/test_collection');
    });

    it('should generate correct URI for root', () => {
      const rootParsed = { ...parsed, path: 'collections' };
      const rootHandle = new QdrantHandle(dataSource, rootParsed);
      
      expect(rootHandle.toURI()).toBe('legion://local/qdrant/collections');
      
      rootHandle.destroy();
    });

    it('should create child Handles for sub-resources', () => {
      const child = handle.child('points/123');
      
      expect(child).toBeDefined();
      expect(child.toURI()).toBe('legion://local/qdrant/collections/test_collection/points/123');
      expect(child.dataSource).toBe(dataSource);
      
      child.destroy();
    });

    it('should get parent Handle', () => {
      const parent = handle.parent();
      
      expect(parent).toBeDefined();
      expect(parent.toURI()).toBe('legion://local/qdrant/collections');
      expect(parent.isRoot).toBe(true);
      
      parent.destroy();
    });

    it('should navigate to different collection', () => {
      const otherCollection = handle.collection('other_collection');
      
      expect(otherCollection).toBeDefined();
      expect(otherCollection.toURI()).toBe('legion://local/qdrant/collections/other_collection');
      expect(otherCollection.collectionName).toBe('other_collection');
      
      otherCollection.destroy();
    });
  });

  describe('query interface', () => {
    it('should execute queries through Handle', async () => {
      const result = await handle.query({
        type: 'search',
        vector: new Array(768).fill(0),
        limit: 10
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use current collection for queries', async () => {
      await handle.query({
        type: 'search',
        vector: new Array(768).fill(0)
      });
      
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'test_collection',
        expect.any(Object)
      );
    });

    it('should override collection in query if specified', async () => {
      await handle.query({
        type: 'search',
        collection: 'other_collection',
        vector: new Array(768).fill(0)
      });
      
      expect(mockQdrantClient.search).toHaveBeenCalledWith(
        'other_collection',
        expect.any(Object)
      );
    });
  });

  describe('metadata and schema', () => {
    it('should provide collection metadata', async () => {
      const metadata = await handle.getMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.collection).toBe('test_collection');
      expect(metadata.vectorsCount).toBe(10);
      expect(metadata.pointsCount).toBe(10);
    });

    it('should provide schema information', () => {
      const schema = handle.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('qdrant');
      expect(schema.operations).toContain('search');
      expect(schema.operations).toContain('upsert');
      expect(schema.operations).toContain('delete');
    });
  });

  describe('subscription support', () => {
    it('should support subscription to collection events', () => {
      const callback = jest.fn();
      
      const subscription = handle.subscribe(callback, {
        event: 'collection.change'
      });
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should notify on collection operations', async () => {
      const callback = jest.fn();
      
      const subscription = handle.subscribe(callback, {
        event: 'collection.change'
      });
      
      await handle.upsert([
        { id: 'new', vector: new Array(768).fill(0), payload: {} }
      ]);
      
      expect(callback).toHaveBeenCalled();
      
      subscription.unsubscribe();
    });

    it('should filter events by collection', async () => {
      const callback = jest.fn();
      
      handle.subscribe(callback, {
        event: 'collection.change',
        collection: 'other_collection'
      });
      
      await handle.upsert([
        { id: 'new', vector: new Array(768).fill(0), payload: {} }
      ]);
      
      // Should not be called since it's for different collection
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate vector dimensions', () => {
      const validVector = new Array(768).fill(0);
      const invalidVector = new Array(512).fill(0);
      
      expect(handle.validateVector(validVector)).toBe(true);
      expect(handle.validateVector(invalidVector)).toBe(false);
      expect(handle.validateVector(null)).toBe(false);
      expect(handle.validateVector('not an array')).toBe(false);
    });

    it('should validate point structure', () => {
      const validPoint = {
        id: 'p1',
        vector: new Array(768).fill(0),
        payload: {}
      };
      
      const invalidPoint = {
        id: 'p1',
        vector: new Array(512).fill(0)
      };
      
      expect(handle.validatePoint(validPoint)).toBe(true);
      expect(handle.validatePoint(invalidPoint)).toBe(false);
      expect(handle.validatePoint({})).toBe(false);
    });

    it('should validate collection name', () => {
      expect(handle.validateCollectionName('valid_name')).toBe(true);
      expect(handle.validateCollectionName('')).toBe(false);
      expect(handle.validateCollectionName(null)).toBe(false);
      expect(handle.validateCollectionName(123)).toBe(false);
    });
  });

  describe('export and serialization', () => {
    it('should export Handle state', async () => {
      await handle.getInfo(); // Populate some data
      
      const exported = handle.export();
      
      expect(exported).toBeDefined();
      expect(exported.uri).toBe('legion://local/qdrant/collections/test_collection');
      expect(exported.collectionName).toBe('test_collection');
      expect(exported).toHaveProperty('metadata');
    });

    it('should provide JSON representation', () => {
      const json = handle.toJSON();
      
      expect(json).toBeDefined();
      expect(json.type).toBe('QdrantHandle');
      expect(json.uri).toBe('legion://local/qdrant/collections/test_collection');
      expect(json.collectionName).toBe('test_collection');
    });

    it('should provide string representation', () => {
      const str = handle.toString();
      
      expect(typeof str).toBe('string');
      expect(str).toContain('QdrantHandle');
      expect(str).toContain('test_collection');
    });
  });

  describe('resource management', () => {
    it('should check if Handle is destroyed', () => {
      expect(handle.isDestroyed()).toBe(false);
      
      handle.destroy();
      
      expect(handle.isDestroyed()).toBe(true);
    });

    it('should cleanup resources on destroy', async () => {
      handle.destroy();
      
      expect(handle.isDestroyed()).toBe(true);
      await expect(handle.search(new Array(768).fill(0))).rejects.toThrow('destroyed');
    });

    it('should handle multiple destroy calls gracefully', () => {
      handle.destroy();
      
      // Should not throw
      expect(() => handle.destroy()).not.toThrow();
      expect(handle.isDestroyed()).toBe(true);
    });

    it('should clone Handle', () => {
      const cloned = handle.clone();
      
      expect(cloned).toBeDefined();
      expect(cloned).not.toBe(handle);
      expect(cloned.toURI()).toBe(handle.toURI());
      expect(cloned.dataSource).toBe(handle.dataSource);
      expect(cloned.collectionName).toBe(handle.collectionName);
      
      cloned.destroy();
    });
  });

  describe('error handling', () => {
    it('should handle operation errors gracefully', async () => {
      mockQdrantClient.search.mockRejectedValueOnce(new Error('Search failed'));
      
      await expect(
        handle.search(new Array(768).fill(0))
      ).rejects.toThrow('Search failed');
    });

    it('should validate operations when destroyed', () => {
      handle.destroy();
      
      expect(() => handle.getSchema()).toThrow('destroyed');
      expect(() => handle.export()).toThrow('destroyed');
    });

    it('should validate collection context', async () => {
      const rootParsed = { ...parsed, path: 'collections' };
      const rootHandle = new QdrantHandle(dataSource, rootParsed);
      
      // Root handle should not allow collection-specific operations
      await expect(
        rootHandle.upsert([{ id: '1', vector: new Array(768).fill(0) }])
      ).rejects.toThrow('Collection name is required');
      
      rootHandle.destroy();
    });
  });

  describe('integration with ResourceManager Handle system', () => {
    it('should be compatible with ResourceManager Handle creation', () => {
      const standardParsed = {
        scheme: 'legion',
        server: 'local',
        resourceType: 'qdrant',
        path: 'collections/vectors',
        original: 'legion://local/qdrant/collections/vectors'
      };
      
      const standardHandle = new QdrantHandle(dataSource, standardParsed);
      expect(standardHandle).toBeDefined();
      expect(standardHandle.toURI()).toBe('legion://local/qdrant/collections/vectors');
      expect(standardHandle.collectionName).toBe('vectors');
      
      standardHandle.destroy();
    });

    it('should support different server locations', () => {
      const remoteParsed = {
        ...parsed,
        server: 'remote',
        original: 'legion://remote/qdrant/collections/test_collection'
      };
      
      const remoteHandle = new QdrantHandle(dataSource, remoteParsed);
      expect(remoteHandle.toURI()).toBe('legion://remote/qdrant/collections/test_collection');
      
      remoteHandle.destroy();
    });
  });
});