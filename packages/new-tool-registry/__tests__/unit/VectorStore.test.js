/**
 * Unit tests for VectorStore functionality
 * 
 * Tests vector storage and similarity search for semantic tool discovery
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VectorStore } from '../../src/search/VectorStore.js';

describe('VectorStore', () => {
  let vectorStore;
  let mockEmbeddingClient;
  let mockVectorDatabase;
  
  beforeEach(() => {
    // Create mock embedding client
    mockEmbeddingClient = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
      generateBatch: jest.fn().mockResolvedValue([
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.2, 0.3, 0.4, 0.5, 0.6]
      ])
    };
    
    // Create mock vector database
    mockVectorDatabase = {
      createCollection: jest.fn().mockResolvedValue(true),
      hasCollection: jest.fn().mockResolvedValue(false),
      insert: jest.fn().mockResolvedValue({ id: 'vec_123' }),
      insertBatch: jest.fn().mockResolvedValue([
        { id: 'vec_123' },
        { id: 'vec_124' }
      ]),
      search: jest.fn().mockResolvedValue([
        { id: 'vec_123', score: 0.95, metadata: { toolName: 'file-reader' } },
        { id: 'vec_124', score: 0.85, metadata: { toolName: 'file-writer' } }
      ]),
      update: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue({ deletedCount: 10 }),
      getStatistics: jest.fn().mockResolvedValue({
        vectorCount: 100,
        dimensions: 5,
        indexType: 'hnsw'
      }),
      isConnected: true
    };
    
    // Create vector store instance
    vectorStore = new VectorStore({
      embeddingClient: mockEmbeddingClient,
      vectorDatabase: mockVectorDatabase
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create a VectorStore instance', () => {
      expect(vectorStore).toBeInstanceOf(VectorStore);
    });
    
    it('should accept options', () => {
      const store = new VectorStore({
        embeddingClient: mockEmbeddingClient,
        vectorDatabase: mockVectorDatabase,
        collectionName: 'custom_tools',
        dimensions: 768,
        verbose: true
      });
      
      expect(store.options.collectionName).toBe('custom_tools');
      expect(store.options.dimensions).toBe(768);
      expect(store.options.verbose).toBe(true);
    });
    
    it('should throw error without embeddingClient', () => {
      expect(() => new VectorStore({ vectorDatabase: mockVectorDatabase }))
        .toThrow('Embedding client is required');
    });
    
    it('should throw error without vectorDatabase', () => {
      expect(() => new VectorStore({ embeddingClient: mockEmbeddingClient }))
        .toThrow('Vector database is required');
    });
  });
  
  describe('initialize', () => {
    it('should create collection if it does not exist', async () => {
      await vectorStore.initialize();
      
      expect(mockVectorDatabase.hasCollection).toHaveBeenCalledWith('tool_vectors');
      expect(mockVectorDatabase.createCollection).toHaveBeenCalledWith(
        'tool_vectors',
        expect.objectContaining({ dimensions: 384 })
      );
    });
    
    it('should not create collection if it already exists', async () => {
      mockVectorDatabase.hasCollection.mockResolvedValue(true);
      
      await vectorStore.initialize();
      
      expect(mockVectorDatabase.hasCollection).toHaveBeenCalled();
      expect(mockVectorDatabase.createCollection).not.toHaveBeenCalled();
    });
  });
  
  describe('indexTool', () => {
    it('should index a single tool', async () => {
      const tool = {
        name: 'file-reader',
        description: 'Read files from the filesystem',
        moduleName: 'FileModule'
      };
      
      const result = await vectorStore.indexTool(tool);
      
      expect(result).toHaveProperty('id');
      expect(mockEmbeddingClient.generateEmbedding).toHaveBeenCalled();
      expect(mockVectorDatabase.insert).toHaveBeenCalledWith(
        'tool_vectors',
        expect.objectContaining({
          vector: expect.any(Array),
          metadata: expect.objectContaining({ toolName: 'file-reader' })
        })
      );
    });
    
    it('should include perspective in embedding if provided', async () => {
      const tool = {
        name: 'file-reader',
        description: 'Read files from the filesystem'
      };
      
      const perspective = {
        perspective: 'Used to read configuration files and data',
        category: 'file-operations'
      };
      
      await vectorStore.indexTool(tool, perspective);
      
      expect(mockEmbeddingClient.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('configuration files')
      );
    });
  });
  
  describe('indexTools', () => {
    it('should index multiple tools in batch', async () => {
      const tools = [
        { name: 'file-reader', description: 'Read files' },
        { name: 'file-writer', description: 'Write files' }
      ];
      
      const results = await vectorStore.indexTools(tools);
      
      expect(results).toHaveLength(2);
      expect(mockEmbeddingClient.generateBatch).toHaveBeenCalled();
      expect(mockVectorDatabase.insertBatch).toHaveBeenCalled();
    });
    
    it('should handle empty tools array', async () => {
      const results = await vectorStore.indexTools([]);
      
      expect(results).toEqual([]);
      expect(mockEmbeddingClient.generateBatch).not.toHaveBeenCalled();
    });
  });
  
  describe('search', () => {
    it('should search for similar tools', async () => {
      const results = await vectorStore.search('read files from disk');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('score', 0.95);
      expect(results[0]).toHaveProperty('toolName', 'file-reader');
      expect(mockEmbeddingClient.generateEmbedding).toHaveBeenCalledWith('read files from disk');
      expect(mockVectorDatabase.search).toHaveBeenCalled();
    });
    
    it('should limit search results', async () => {
      mockVectorDatabase.search.mockResolvedValue([
        { id: 'vec_123', score: 0.95, metadata: { toolName: 'file-reader' } }
      ]);
      
      const results = await vectorStore.search('files', { limit: 1 });
      
      expect(results).toHaveLength(1);
      expect(mockVectorDatabase.search).toHaveBeenCalledWith(
        'tool_vectors',
        expect.any(Array),
        expect.objectContaining({ limit: 1 })
      );
    });
    
    it('should filter by minimum score', async () => {
      const results = await vectorStore.search('files', { minScore: 0.9 });
      
      // Should only return results with score >= 0.9
      expect(results.every(r => r.score >= 0.9)).toBe(true);
    });
    
    it('should include metadata filters', async () => {
      await vectorStore.search('files', {
        filter: { moduleName: 'FileModule' }
      });
      
      expect(mockVectorDatabase.search).toHaveBeenCalledWith(
        'tool_vectors',
        expect.any(Array),
        expect.objectContaining({
          filter: { moduleName: 'FileModule' }
        })
      );
    });
  });
  
  describe('updateTool', () => {
    it('should update tool vector', async () => {
      const tool = {
        name: 'file-reader',
        description: 'Updated description'
      };
      
      const result = await vectorStore.updateTool('file-reader', tool);
      
      expect(result).toBe(true);
      expect(mockEmbeddingClient.generateEmbedding).toHaveBeenCalled();
      expect(mockVectorDatabase.update).toHaveBeenCalledWith(
        'tool_vectors',
        { toolName: 'file-reader' },
        expect.objectContaining({
          vector: expect.any(Array),
          metadata: expect.objectContaining({ toolName: 'file-reader' })
        })
      );
    });
  });
  
  describe('deleteTool', () => {
    it('should delete tool vector', async () => {
      const result = await vectorStore.deleteTool('file-reader');
      
      expect(result).toBe(true);
      expect(mockVectorDatabase.delete).toHaveBeenCalledWith(
        'tool_vectors',
        { toolName: 'file-reader' }
      );
    });
  });
  
  describe('clear', () => {
    it('should clear all vectors', async () => {
      const result = await vectorStore.clear();
      
      expect(result.deletedCount).toBe(10);
      expect(mockVectorDatabase.clear).toHaveBeenCalledWith('tool_vectors');
    });
    
    it('should clear vectors by filter', async () => {
      await vectorStore.clear({ moduleName: 'FileModule' });
      
      expect(mockVectorDatabase.clear).toHaveBeenCalledWith(
        'tool_vectors',
        { moduleName: 'FileModule' }
      );
    });
  });
  
  describe('rebuildIndex', () => {
    it('should rebuild vector index for all tools', async () => {
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      
      const result = await vectorStore.rebuildIndex(tools);
      
      expect(result).toHaveProperty('indexed', 2);
      expect(result).toHaveProperty('failed', 0);
      expect(mockVectorDatabase.clear).toHaveBeenCalled();
      expect(mockVectorDatabase.insertBatch).toHaveBeenCalled();
    });
    
    it('should handle partial failures', async () => {
      mockEmbeddingClient.generateBatch.mockRejectedValueOnce(new Error('Embedding error'));
      
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      
      const result = await vectorStore.rebuildIndex(tools, { continueOnError: true });
      
      expect(result.failed).toBeGreaterThan(0);
    });
  });
  
  describe('getStatistics', () => {
    it('should return vector store statistics', async () => {
      const stats = await vectorStore.getStatistics();
      
      expect(stats).toHaveProperty('vectorCount', 100);
      expect(stats).toHaveProperty('dimensions', 5);
      expect(stats).toHaveProperty('indexType', 'hnsw');
      expect(mockVectorDatabase.getStatistics).toHaveBeenCalled();
    });
  });
  
  describe('findSimilarTools', () => {
    it('should find tools similar to a given tool', async () => {
      // Mock getting the tool's vector
      mockVectorDatabase.search.mockResolvedValue([
        { id: 'vec_124', score: 0.92, metadata: { toolName: 'file-writer' } },
        { id: 'vec_125', score: 0.88, metadata: { toolName: 'file-list' } }
      ]);
      
      const similar = await vectorStore.findSimilarTools('file-reader', { limit: 5 });
      
      expect(similar).toHaveLength(2);
      expect(similar[0].toolName).toBe('file-writer');
      // Should not include the source tool itself
      expect(similar.every(t => t.toolName !== 'file-reader')).toBe(true);
    });
  });
  
  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockVectorDatabase.isConnected = false;
      
      await expect(vectorStore.search('test')).rejects.toThrow();
    });
    
    it('should handle embedding generation errors', async () => {
      mockEmbeddingClient.generateEmbedding.mockRejectedValue(new Error('Embedding error'));
      
      await expect(vectorStore.indexTool({ name: 'test' })).rejects.toThrow('Embedding error');
    });
    
    it('should handle vector database errors', async () => {
      mockVectorDatabase.insert.mockRejectedValue(new Error('Database error'));
      
      await expect(vectorStore.indexTool({ name: 'test' })).rejects.toThrow('Database error');
    });
  });
});