/**
 * Unit tests for HandleSemanticSearchManager
 * Phase 5: Core API orchestration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandleSemanticSearchManager } from '../../src/HandleSemanticSearchManager.js';

describe('HandleSemanticSearchManager (Unit)', () => {
  let manager;
  let mockResourceManager;
  let mockMetadataExtractor;
  let mockGlossGenerator;
  let mockVectorStore;

  beforeEach(() => {
    // Mock dependencies
    mockMetadataExtractor = {
      extractMetadata: jest.fn().mockResolvedValue({
        handleType: 'filesystem',
        resourceDescription: 'Test file',
        path: '/test.js'
      })
    };

    mockGlossGenerator = {
      generateGlosses: jest.fn().mockResolvedValue([
        {
          perspective: 'functional',
          description: 'Test file description',
          keywords: ['test']
        }
      ])
    };

    mockVectorStore = {
      storeHandle: jest.fn().mockResolvedValue({
        success: true,
        vectorIds: [123],
        mongoId: 'test-id'
      }),
      searchSimilar: jest.fn().mockResolvedValue([
        {
          handleURI: 'legion://local/test/file',
          similarity: 0.95,
          description: 'Test file',
          keywords: []
        }
      ]),
      getHandleRecord: jest.fn().mockResolvedValue({
        handleURI: 'legion://local/test/file',
        handleType: 'filesystem',
        metadata: {},
        glosses: []
      }),
      deleteVectors: jest.fn().mockResolvedValue({ success: true })
    };

    mockResourceManager = {
      createHandleFromURI: jest.fn().mockResolvedValue({
        uri: 'legion://local/test/file',
        handleType: 'filesystem'
      })
    };

    manager = new HandleSemanticSearchManager(
      mockResourceManager,
      mockMetadataExtractor,
      mockGlossGenerator,
      mockVectorStore
    );
  });

  describe('Constructor', () => {
    it('should create instance with all dependencies', () => {
      expect(manager).toBeInstanceOf(HandleSemanticSearchManager);
      expect(manager.resourceManager).toBe(mockResourceManager);
      expect(manager.metadataExtractor).toBe(mockMetadataExtractor);
      expect(manager.glossGenerator).toBe(mockGlossGenerator);
      expect(manager.vectorStore).toBe(mockVectorStore);
    });

    it('should throw error without ResourceManager', () => {
      expect(() => new HandleSemanticSearchManager()).toThrow('ResourceManager is required');
    });

    it('should throw error without MetadataExtractor', () => {
      expect(() => new HandleSemanticSearchManager(mockResourceManager)).toThrow('MetadataExtractor is required');
    });

    it('should throw error without GlossGenerator', () => {
      expect(() => new HandleSemanticSearchManager(mockResourceManager, mockMetadataExtractor)).toThrow('GlossGenerator is required');
    });

    it('should throw error without VectorStore', () => {
      expect(() => new HandleSemanticSearchManager(
        mockResourceManager,
        mockMetadataExtractor,
        mockGlossGenerator
      )).toThrow('VectorStore is required');
    });
  });

  describe('storeHandle()', () => {
    it('should accept handle URI as string', async () => {
      const result = await manager.storeHandle('legion://local/test/file');

      expect(result.success).toBe(true);
      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith('legion://local/test/file');
    });

    it('should accept handle object', async () => {
      const mockHandle = {
        uri: 'legion://local/test/file',
        handleType: 'filesystem'
      };

      const result = await manager.storeHandle(mockHandle);

      expect(result.success).toBe(true);
      expect(mockResourceManager.createHandleFromURI).not.toHaveBeenCalled();
    });

    it('should orchestrate full workflow: extract → generate → store', async () => {
      await manager.storeHandle('legion://local/test/file');

      expect(mockMetadataExtractor.extractMetadata).toHaveBeenCalled();
      expect(mockGlossGenerator.generateGlosses).toHaveBeenCalled();
      expect(mockVectorStore.storeHandle).toHaveBeenCalled();
    });

    it('should pass handle to metadata extractor', async () => {
      const handle = { uri: 'legion://local/test/file' };
      await manager.storeHandle(handle);

      expect(mockMetadataExtractor.extractMetadata).toHaveBeenCalledWith(handle);
    });

    it('should pass metadata to gloss generator', async () => {
      const metadata = { handleType: 'filesystem', path: '/test.js' };
      mockMetadataExtractor.extractMetadata.mockResolvedValue(metadata);

      await manager.storeHandle('legion://local/test/file');

      expect(mockGlossGenerator.generateGlosses).toHaveBeenCalledWith(metadata);
    });

    it('should pass URI, metadata, and glosses to vector store', async () => {
      const handle = { uri: 'legion://local/test/file' };
      const metadata = { handleType: 'filesystem' };
      const glosses = [{ perspective: 'functional', description: 'Test', keywords: [] }];

      mockMetadataExtractor.extractMetadata.mockResolvedValue(metadata);
      mockGlossGenerator.generateGlosses.mockResolvedValue(glosses);

      await manager.storeHandle(handle);

      expect(mockVectorStore.storeHandle).toHaveBeenCalledWith(
        'legion://local/test/file',
        metadata,
        glosses
      );
    });

    it('should return result with handleURI', async () => {
      const result = await manager.storeHandle('legion://local/test/file');

      expect(result.handleURI).toBe('legion://local/test/file');
      expect(result.success).toBe(true);
    });
  });

  describe('searchHandles()', () => {
    it('should call vector store search with query', async () => {
      await manager.searchHandles('test query');

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith(
        'test query',
        expect.any(Object)
      );
    });

    it('should apply default limit of 10', async () => {
      await manager.searchHandles('test query');

      const [, options] = mockVectorStore.searchSimilar.mock.calls[0];
      expect(options.limit).toBe(10);
    });

    it('should accept custom limit', async () => {
      await manager.searchHandles('test query', { limit: 5 });

      const [, options] = mockVectorStore.searchSimilar.mock.calls[0];
      expect(options.limit).toBe(5);
    });

    it('should enrich results with handle records', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue([
        { handleURI: 'legion://local/test/file', similarity: 0.95 }
      ]);

      mockVectorStore.getHandleRecord.mockResolvedValue({
        handleURI: 'legion://local/test/file',
        handleType: 'filesystem',
        metadata: { path: '/test.js' },
        glosses: []
      });

      const results = await manager.searchHandles('test query');

      expect(results.results).toHaveLength(1);
      expect(results.results[0].handleType).toBe('filesystem');
      expect(results.results[0].metadata).toEqual({ path: '/test.js' });
    });

    it('should return formatted search result', async () => {
      const results = await manager.searchHandles('test query');

      expect(results).toHaveProperty('query');
      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('totalResults');
      expect(results.query).toBe('test query');
    });
  });

  describe('recallHandles()', () => {
    it('should search and instantiate handles', async () => {
      // Mock search results
      mockVectorStore.searchSimilar.mockResolvedValue([
        { handleURI: 'legion://local/mongodb/users', similarity: 0.95, glossType: 'functional' }
      ]);
      mockVectorStore.getHandleRecord.mockResolvedValue({
        handleURI: 'legion://local/mongodb/users',
        handleType: 'mongodb',
        metadata: {},
        glosses: []
      });

      // Mock handle creation
      const mockHandle = { uri: 'legion://local/mongodb/users', resourceType: 'mongodb' };
      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);

      const results = await manager.recallHandles('user database');

      expect(results).toHaveLength(1);
      expect(results[0].handle).toBe(mockHandle);
      expect(results[0].handleURI).toBe('legion://local/mongodb/users');
      expect(results[0].similarity).toBe(0.95);
      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith('legion://local/mongodb/users');
    });

    it('should return array with searchResult and handle', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue([
        { handleURI: 'legion://local/test/file', similarity: 0.85, glossType: 'technical' }
      ]);
      mockVectorStore.getHandleRecord.mockResolvedValue({
        handleURI: 'legion://local/test/file',
        handleType: 'file',
        metadata: { path: '/test/file.js' },
        glosses: []
      });
      const mockHandle = { uri: 'legion://local/test/file', resourceType: 'filesystem' };
      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);

      const results = await manager.recallHandles('test file');

      expect(results[0]).toHaveProperty('searchResult');
      expect(results[0]).toHaveProperty('handle');
      expect(results[0]).toHaveProperty('handleURI');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0]).toHaveProperty('handleType');
      expect(results[0].searchResult.handleURI).toBe('legion://local/test/file');
    });

    it('should skip handles that fail to instantiate', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue([
        { handleURI: 'legion://local/good/handle', similarity: 0.9, glossType: 'functional' },
        { handleURI: 'legion://local/bad/handle', similarity: 0.8, glossType: 'functional' }
      ]);
      mockVectorStore.getHandleRecord.mockResolvedValue({
        handleURI: 'legion://local/good/handle',
        handleType: 'mongodb',
        metadata: {},
        glosses: []
      });

      // First call succeeds, second fails
      mockResourceManager.createHandleFromURI
        .mockResolvedValueOnce({ uri: 'legion://local/good/handle' })
        .mockRejectedValueOnce(new Error('Handle not found'));

      const results = await manager.recallHandles('test');

      // Should only return the successful one
      expect(results).toHaveLength(1);
      expect(results[0].handleURI).toBe('legion://local/good/handle');
    });

    it('should pass search options through', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue([]);

      await manager.recallHandles('test query', { limit: 5, threshold: 0.8, handleTypes: ['mongodb'] });

      // Verify searchHandles was called with options (indirectly through searchSimilar)
      expect(mockVectorStore.searchSimilar).toHaveBeenCalled();
    });
  });

  describe('restoreHandle()', () => {
    it('should use ResourceManager to create handle', async () => {
      await manager.restoreHandle('legion://local/test/file');

      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith('legion://local/test/file');
    });

    it('should return restored handle', async () => {
      const mockHandle = { uri: 'legion://local/test/file', handleType: 'filesystem' };
      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);

      const result = await manager.restoreHandle('legion://local/test/file');

      expect(result).toBe(mockHandle);
    });
  });

  describe('getHandleInfo()', () => {
    it('should retrieve handle record from vector store', async () => {
      await manager.getHandleInfo('legion://local/test/file');

      expect(mockVectorStore.getHandleRecord).toHaveBeenCalledWith('legion://local/test/file');
    });

    it('should return handle information', async () => {
      const mockRecord = {
        handleURI: 'legion://local/test/file',
        handleType: 'filesystem',
        metadata: {},
        glosses: []
      };
      mockVectorStore.getHandleRecord.mockResolvedValue(mockRecord);

      const result = await manager.getHandleInfo('legion://local/test/file');

      expect(result).toEqual(mockRecord);
    });
  });

  describe('updateGlosses()', () => {
    it('should restore handle, re-extract metadata, and regenerate glosses', async () => {
      const mockHandle = {
        uri: 'legion://local/test/file',
        handleType: 'filesystem',
        path: '/test/file.js'
      };
      const mockMetadata = { handleType: 'file', path: '/test/file.js' };
      const mockGlosses = [
        { perspective: 'functional', description: 'Updated description', keywords: ['test'] }
      ];

      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);
      mockMetadataExtractor.extractMetadata.mockResolvedValue(mockMetadata);
      mockGlossGenerator.generateGlosses.mockResolvedValue(mockGlosses);
      mockVectorStore.deleteVectors.mockResolvedValue({ success: true, deletedCount: 2 });
      mockVectorStore.storeHandle.mockResolvedValue({
        success: true,
        vectorIds: [1, 2, 3],
        mongoId: 'new_mongo_id'
      });

      await manager.updateGlosses('legion://local/test/file');

      expect(mockResourceManager.createHandleFromURI).toHaveBeenCalledWith('legion://local/test/file');
      expect(mockMetadataExtractor.extractMetadata).toHaveBeenCalledWith(mockHandle);
      expect(mockGlossGenerator.generateGlosses).toHaveBeenCalledWith(mockMetadata);
      expect(mockVectorStore.deleteVectors).toHaveBeenCalledWith('legion://local/test/file');
      expect(mockVectorStore.storeHandle).toHaveBeenCalledWith(
        'legion://local/test/file',
        mockMetadata,
        mockGlosses
      );
    });

    it('should return update result with updated flag', async () => {
      const mockHandle = { uri: 'legion://local/test/file' };
      const mockMetadata = { handleType: 'file' };
      const mockGlosses = [{ perspective: 'functional', description: 'Test' }];

      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);
      mockMetadataExtractor.extractMetadata.mockResolvedValue(mockMetadata);
      mockGlossGenerator.generateGlosses.mockResolvedValue(mockGlosses);
      mockVectorStore.deleteVectors.mockResolvedValue({ success: true });
      mockVectorStore.storeHandle.mockResolvedValue({
        success: true,
        vectorIds: [1],
        mongoId: 'mongo_id'
      });

      const result = await manager.updateGlosses('legion://local/test/file');

      expect(result).toEqual({
        success: true,
        handleURI: 'legion://local/test/file',
        vectorIds: [1],
        mongoId: 'mongo_id',
        glossCount: 1,
        updated: true
      });
    });

    it('should handle options parameter', async () => {
      const mockHandle = { uri: 'legion://local/test/file' };
      const mockMetadata = { handleType: 'file' };
      const mockGlosses = [];

      mockResourceManager.createHandleFromURI.mockResolvedValue(mockHandle);
      mockMetadataExtractor.extractMetadata.mockResolvedValue(mockMetadata);
      mockGlossGenerator.generateGlosses.mockResolvedValue(mockGlosses);
      mockVectorStore.deleteVectors.mockResolvedValue({ success: true });
      mockVectorStore.storeHandle.mockResolvedValue({
        success: true,
        vectorIds: [],
        mongoId: 'mongo_id'
      });

      const result = await manager.updateGlosses('legion://local/test/file', { force: true });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });
  });

  describe('removeHandle()', () => {
    it('should delete vectors from vector store', async () => {
      await manager.removeHandle('legion://local/test/file');

      expect(mockVectorStore.deleteVectors).toHaveBeenCalledWith('legion://local/test/file');
    });

    it('should return removal result', async () => {
      mockVectorStore.deleteVectors.mockResolvedValue({ success: true, deletedCount: 3 });

      const result = await manager.removeHandle('legion://local/test/file');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(3);
    });
  });
});