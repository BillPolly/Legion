/**
 * Tests for SemanticSearchProvider
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { TestDataGenerator } from '../utils/TestDataGenerator.js';

describe('SemanticSearchProvider (requires Qdrant)', () => {
  let resourceManager;
  let provider;

  beforeEach(async () => {
    // Use singleton ResourceManager instance
    resourceManager = ResourceManager.getInstance();
    
    // Clear any existing resources for clean test state
    resourceManager.clear();
    
    // Initialize ResourceManager to load .env
    await resourceManager.initialize();
    
    // Force local embeddings by setting the environment variable
    resourceManager.set('env.USE_LOCAL_EMBEDDINGS', 'true');
  });

  afterEach(async () => {
    if (provider) {
      await provider.disconnect();
      provider = null;
    }
  });

  describe('create', () => {
    it('should create provider with valid ResourceManager', async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      
      expect(provider).toBeInstanceOf(SemanticSearchProvider);
      expect(provider.initialized).toBe(true);
    });

    it('should throw error without ResourceManager', async () => {
      await expect(SemanticSearchProvider.create(null))
        .rejects.toThrow('ResourceManager is required');
    });

    it('should work with local embeddings without OpenAI key', async () => {
      // Local embeddings are always used now, no need for API key
      provider = await SemanticSearchProvider.create(resourceManager);
      
      expect(provider).toBeInstanceOf(SemanticSearchProvider);
      expect(provider.initialized).toBe(true);
      expect(provider.getMetadata().embeddingService).toBe('local-onnx');
    });

    it('should use default configuration values', async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      
      expect(provider.config.embeddingModel).toBe('text-embedding-3-small');
      expect(provider.config.batchSize).toBe(100);
      expect(provider.config.cacheTtl).toBe(3600);
      expect(provider.config.enableCache).toBe(true);
    });
  });

  describe('connection management', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
    });

    it('should connect successfully', async () => {
      await provider.connect();
      expect(provider.connected).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await provider.connect();
      await provider.disconnect();
      expect(provider.connected).toBe(false);
    });
  });

  describe('document insertion', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();
    });

    it('should insert single document', async () => {
      const document = { id: '1', content: 'Test content', name: 'Test' };
      
      const result = await provider.insert('test_collection', document);
      
      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
      expect(result.vectorsStored).toBe(1);
    });

    it('should insert multiple documents', async () => {
      const documents = TestDataGenerator.generateDocuments(3);
      
      const result = await provider.insert('test_collection', documents);
      
      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(3);
      expect(result.vectorsStored).toBe(3);
    });

    it('should process documents before insertion', async () => {
      const document = { name: 'Test Tool', description: 'A test tool' };
      
      await provider.insert('test_collection', document);
      
      // Verify document processor was called
      expect(provider.documentProcessor.processDocument).toBeDefined();
    });
  });

  describe('semantic search', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();
      
      // Mock vector store search to return test results
      const mockSearchResults = [
        { document: { id: '1', content: 'test doc 1' }, _similarity: 0.9, _searchType: 'semantic', _id: '1' },
        { document: { id: '2', content: 'test doc 2' }, _similarity: 0.8, _searchType: 'semantic', _id: '2' },
        { document: { id: '3', content: 'test doc 3' }, _similarity: 0.7, _searchType: 'semantic', _id: '3' }
      ];
      provider.vectorStore.search = jest.fn().mockResolvedValue(mockSearchResults);
    });

    it('should perform semantic search with default options', async () => {
      const query = 'find files and directories';
      
      const results = await provider.semanticSearch('test_collection', query);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      
      results.forEach(result => {
        expect(result).toHaveProperty('document');
        expect(result).toHaveProperty('_similarity');
        expect(result._searchType).toBe('semantic');
      });
    });

    it('should respect search options', async () => {
      const query = 'find files';
      const options = {
        limit: 5,
        threshold: 0.8,
        includeMetadata: true,
        filter: { module: 'file-ops' }
      };
      
      await provider.semanticSearch('test_collection', query, options);
      
      expect(provider.vectorStore.search).toHaveBeenCalledWith(
        'test_collection',
        expect.any(Array), // embedding vector
        expect.objectContaining({
          limit: 5,
          threshold: 0.8,
          includeMetadata: true,
          filter: { module: 'file-ops' }
        })
      );
    });

    it('should handle empty search results', async () => {
      provider.vectorStore.search = jest.fn().mockResolvedValue([]);
      
      const results = await provider.semanticSearch('test_collection', 'nonexistent');
      
      expect(results).toEqual([]);
    });
  });

  describe('hybrid search', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();
      
      // Mock both semantic and keyword results
      const mockSemanticResults = [
        { id: '1', content: 'semantic doc 1', _similarity: 0.9, _searchType: 'semantic', _id: '1' },
        { id: '2', content: 'semantic doc 2', _similarity: 0.8, _searchType: 'semantic', _id: '2' }
      ];
      const mockKeywordResults = TestDataGenerator.generateDocuments(2);
      
      provider.semanticSearch = jest.fn().mockResolvedValue(mockSemanticResults);
      provider.find = jest.fn().mockResolvedValue(mockKeywordResults);
    });

    it('should perform hybrid search', async () => {
      const query = 'file operations';
      
      const results = await provider.hybridSearch('test_collection', query);
      
      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result).toHaveProperty('_semanticScore');
        expect(result).toHaveProperty('_keywordScore');
        expect(result).toHaveProperty('_hybridScore');
        expect(result._searchType).toBe('hybrid');
      });
    });

    it('should respect weight parameters', async () => {
      const query = 'database tools';
      const options = {
        semanticWeight: 0.8,
        keywordWeight: 0.2
      };
      
      const results = await provider.hybridSearch('test_collection', query, options);
      
      results.forEach(result => {
        expect(result._hybridScore).toBeGreaterThan(0);
        expect(result._semanticScore).toBeGreaterThanOrEqual(0);
        expect(result._keywordScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('findSimilar', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();
      
      const mockSearchResults = [
        { document: { id: '1', content: 'similar doc 1' }, _similarity: 0.9, _searchType: 'semantic', _id: '1' },
        { document: { id: '2', content: 'similar doc 2' }, _similarity: 0.8, _searchType: 'semantic', _id: '2' },
        { document: { id: '3', content: 'similar doc 3' }, _similarity: 0.7, _searchType: 'semantic', _id: '3' }
      ];
      provider.vectorStore.search = jest.fn().mockResolvedValue(mockSearchResults);
    });

    it('should find similar documents', async () => {
      const document = { name: 'File Reader', description: 'Read files from disk' };
      
      const results = await provider.findSimilar('test_collection', document);
      
      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result).toHaveProperty('document');
        expect(result).toHaveProperty('_similarity');
      });
    });
  });

  describe('standard CRUD operations', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();
    });

    it('should delegate find to vector store', async () => {
      provider.vectorStore.find = jest.fn().mockResolvedValue([]);
      
      await provider.find('test_collection', { name: 'test' });
      
      expect(provider.vectorStore.find).toHaveBeenCalledWith(
        'test_collection',
        { name: 'test' },
        {}
      );
    });

    it('should delegate update to vector store', async () => {
      provider.vectorStore.update = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      
      const result = await provider.update('test_collection', { id: '1' }, { name: 'updated' });
      
      expect(provider.vectorStore.update).toHaveBeenCalled();
      expect(result.modifiedCount).toBe(1);
    });

    it('should delegate delete to vector store', async () => {
      provider.vectorStore.delete = jest.fn().mockResolvedValue({ operation_id: 1 });
      
      await provider.delete('test_collection', { id: '1' });
      
      expect(provider.vectorStore.delete).toHaveBeenCalled();
    });
  });

  describe('metadata and capabilities', () => {
    beforeEach(async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
    });

    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toContain('semanticSearch');
      expect(capabilities).toContain('hybridSearch');
      expect(capabilities).toContain('findSimilar');
      expect(capabilities).toContain('vectorSearch');
      expect(capabilities).toContain('embeddingGeneration');
    });

    it('should return provider metadata', () => {
      const metadata = provider.getMetadata();
      
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('embeddingModel');
      expect(metadata).toHaveProperty('initialized');
      expect(metadata.initialized).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle embedding service errors gracefully', async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();

      // Mock embedding service to throw error
      provider.embeddingService.generateEmbeddings = jest.fn().mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(provider.semanticSearch('test_collection', 'test query'))
        .rejects.toThrow('OpenAI API error');
    });

    it('should handle vector store errors gracefully', async () => {
      provider = await SemanticSearchProvider.create(resourceManager);
      await provider.connect();

      // Mock vector store to throw error
      provider.vectorStore.search = jest.fn().mockRejectedValue(
        new Error('Qdrant connection error')
      );

      await expect(provider.semanticSearch('test_collection', 'test query'))
        .rejects.toThrow('Qdrant connection error');
    });
  });
});