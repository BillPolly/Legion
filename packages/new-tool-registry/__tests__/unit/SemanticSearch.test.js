/**
 * SemanticSearch Unit Tests
 * 
 * Tests for semantic search functionality following TDD principles
 * All tests written before implementation - they should fail initially
 * 
 * Test Categories:
 * 1. Query embedding and vector search
 * 2. Hybrid search (semantic + text)
 * 3. Result ranking and filtering
 * 4. Integration with EmbeddingService and VectorStore
 * 5. Caching and performance optimization
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SemanticSearch } from '../../src/search/SemanticSearch.js';
import { SemanticSearchError } from '../../src/errors/index.js';

describe('SemanticSearch', () => {
  let mockResourceManager;
  let mockEmbeddingService;
  let mockVectorStore;
  let mockDatabaseStorage;
  let mockToolsCollection;
  let semanticSearch;

  beforeEach(() => {
    // Mock ResourceManager
    mockResourceManager = {
      get: jest.fn()
    };

    // Mock EmbeddingService
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn(),
      initialize: jest.fn().mockResolvedValue(),
      shutdown: jest.fn().mockResolvedValue(),
      isInitialized: jest.fn(() => true)
    };

    // Mock VectorStore
    mockVectorStore = {
      initialize: jest.fn().mockResolvedValue(),
      search: jest.fn(),
      upsert: jest.fn().mockResolvedValue(),
      delete: jest.fn().mockResolvedValue(),
      getCollectionInfo: jest.fn(),
      indexTools: jest.fn().mockResolvedValue(),
      shutdown: jest.fn().mockResolvedValue(),
      isConnected: true,
      vectorDatabase: {
        isConnected: true
      }
    };

    // Mock database tools collection
    mockToolsCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      findOne: jest.fn().mockResolvedValue(null)
    };

    // Mock DatabaseStorage
    mockDatabaseStorage = {
      getCollection: jest.fn((name) => {
        if (name === 'tools') return mockToolsCollection;
        return null;
      }),
      isConnected: true
    };

    mockResourceManager.get.mockImplementation((key) => {
      switch (key) {
        case 'embeddingService':
          return mockEmbeddingService;
        case 'vectorStore':
          return mockVectorStore;
        case 'databaseStorage':
          return mockDatabaseStorage;
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create SemanticSearch with ResourceManager', () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager,
        options: { 
          vectorCollection: 'tool_vectors',
          topK: 10 
        }
      });

      expect(semanticSearch).toBeDefined();
      expect(semanticSearch.initialized).toBe(false);
      expect(semanticSearch.options.vectorCollection).toBe('tool_vectors');
      expect(semanticSearch.options.topK).toBe(10);
    });

    test('should throw error if ResourceManager is missing', () => {
      expect(() => {
        new SemanticSearch({});
      }).toThrow(SemanticSearchError);
    });

    test('should use default options when none provided', () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });

      expect(semanticSearch.options.vectorCollection).toBe('perspectives');
      expect(semanticSearch.options.topK).toBe(20);
      expect(semanticSearch.options.similarityThreshold).toBe(0.7);
      expect(semanticSearch.options.hybridWeight).toBe(0.6);
    });

    test('should initialize successfully with all dependencies', async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });

      await semanticSearch.initialize();

      expect(semanticSearch.initialized).toBe(true);
      expect(mockResourceManager.get).toHaveBeenCalledWith('embeddingService');
      expect(mockResourceManager.get).toHaveBeenCalledWith('vectorStore');
      expect(mockResourceManager.get).toHaveBeenCalledWith('databaseStorage');
      expect(mockEmbeddingService.initialize).toHaveBeenCalled();
      expect(mockVectorStore.initialize).toHaveBeenCalled();
    });

    test('should throw error if dependencies not available during initialization', async () => {
      mockResourceManager.get.mockReturnValue(null);
      
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });

      await expect(semanticSearch.initialize()).rejects.toThrow(SemanticSearchError);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager,
        options: { topK: 5 }
      });
      await semanticSearch.initialize();
    });

    test('should perform semantic search for query', async () => {
      const queryText = 'read files from filesystem';
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const vectorResults = [
        { id: 'tool-1', score: 0.95, payload: { toolName: 'file_reader', perspective: 'read files' } },
        { id: 'tool-2', score: 0.88, payload: { toolName: 'file_loader', perspective: 'load data' } }
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue(vectorResults);
      
      // Mock tool lookup
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'file_reader', description: 'Read files from filesystem', module: 'FileModule' },
        { name: 'file_loader', description: 'Load data from files', module: 'FileModule' }
      ]);

      const results = await semanticSearch.searchSemantic(queryText);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(queryText);
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        queryEmbedding,
        expect.objectContaining({
          limit: 5,
          scoreThreshold: 0.7
        })
      );
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('tool');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('perspective');
    });

    test('should handle empty vector search results', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([]);

      const results = await semanticSearch.searchSemantic('non-existent query');

      expect(results).toEqual([]);
    });

    test('should filter results by similarity threshold', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const vectorResults = [
        { id: 'tool-1', score: 0.95, payload: { toolName: 'high_match' } },
        { id: 'tool-2', score: 0.65, payload: { toolName: 'low_match' } }, // Below threshold
        { id: 'tool-3', score: 0.85, payload: { toolName: 'good_match' } }
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue(vectorResults);
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'high_match', description: 'High similarity tool' },
        { name: 'good_match', description: 'Good similarity tool' }
      ]);

      const results = await semanticSearch.searchSemantic('test query', {
        similarityThreshold: 0.7
      });

      expect(results).toHaveLength(2);
      expect(results[0].tool.name).toBe('high_match');
      expect(results[1].tool.name).toBe('good_match');
    });

    test('should limit results to topK', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const vectorResults = Array.from({ length: 10 }, (_, i) => ({
        id: `tool-${i}`,
        score: 0.9 - i * 0.05,
        payload: { toolName: `tool_${i}` }
      }));

      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue(vectorResults);
      mockToolsCollection.find().toArray.mockResolvedValue(
        vectorResults.map((r, i) => ({ name: `tool_${i}`, description: `Tool ${i}` }))
      );

      const results = await semanticSearch.searchSemantic('test query', { topK: 3 });

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();
    });

    test('should perform hybrid search combining semantic and text search', async () => {
      const queryText = 'calculate mathematical expressions';
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      // Mock semantic results
      const semanticResults = [
        { id: 'tool-1', score: 0.95, payload: { toolName: 'calculator', perspective: 'math operations' } },
        { id: 'tool-2', score: 0.85, payload: { toolName: 'evaluator', perspective: 'expression eval' } }
      ];

      // Mock text search results (different tools)
      const textResults = [
        { name: 'math_processor', description: 'Process mathematical expressions', score: 0.8 },
        { name: 'calculator', description: 'Basic calculator functionality', score: 0.9 } // Overlap
      ];

      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue(semanticResults);
      
      // Mock text search via database
      mockToolsCollection.find().toArray
        .mockResolvedValueOnce([
          { name: 'calculator', description: 'Calculate expressions', module: 'MathModule' },
          { name: 'evaluator', description: 'Evaluate mathematical expressions', module: 'MathModule' }
        ])
        .mockResolvedValueOnce([
          { name: 'math_processor', description: 'Process mathematical expressions', module: 'MathModule' },
          { name: 'calculator', description: 'Basic calculator functionality', module: 'MathModule' }
        ]);

      // Mock the searchByText method call
      semanticSearch.searchByText = jest.fn().mockResolvedValue(textResults);

      const results = await semanticSearch.searchHybrid(queryText);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('tool');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('sources'); // Should indicate both semantic and text
    });

    test('should weight semantic and text results according to hybridWeight', async () => {
      const semanticWeight = 0.7;
      const textWeight = 0.3;
      
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager,
        options: { hybridWeight: semanticWeight }
      });
      await semanticSearch.initialize();

      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([
        { id: 'tool-1', score: 0.9, payload: { toolName: 'semantic_tool' } }
      ]);
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'semantic_tool', description: 'Tool found semantically' }
      ]);

      semanticSearch.searchByText = jest.fn().mockResolvedValue([
        { name: 'text_tool', description: 'Tool found by text', score: 0.8 }
      ]);

      const results = await semanticSearch.searchHybrid('test query');

      expect(semanticSearch.searchByText).toHaveBeenCalled();
      expect(results).toBeDefined();
      // Verify that scoring incorporates both semantic and text weights
    });

    test('should handle cases where only semantic results exist', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([
        { id: 'tool-1', score: 0.9, payload: { toolName: 'semantic_only' } }
      ]);
      mockToolsCollection.find().toArray.mockResolvedValue([
        { name: 'semantic_only', description: 'Only semantic match' }
      ]);

      semanticSearch.searchByText = jest.fn().mockResolvedValue([]);

      const results = await semanticSearch.searchHybrid('unique semantic query');

      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe('semantic_only');
      expect(results[0].sources).toContain('semantic');
    });

    test('should handle cases where only text results exist', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([]);

      semanticSearch.searchByText = jest.fn().mockResolvedValue([
        { name: 'text_only', description: 'Only text match', score: 0.8 }
      ]);

      const results = await semanticSearch.searchHybrid('text only query');

      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe('text_only');
      expect(results[0].sources).toContain('text');
    });
  });

  describe('Text Search Integration', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();
    });

    test('should perform text-based search using database', async () => {
      const queryText = 'file operations';
      const textResults = [
        { name: 'file_reader', description: 'Read files from disk', module: 'FileModule' },
        { name: 'file_writer', description: 'Write files to disk', module: 'FileModule' }
      ];

      mockToolsCollection.find().toArray.mockResolvedValue(textResults);

      const results = await semanticSearch.searchByText(queryText);

      expect(mockToolsCollection.find).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('description');
      expect(results[0]).toHaveProperty('score');
    });

    test('should score text search results by relevance', async () => {
      const queryText = 'calculator';
      const textResults = [
        { name: 'calculator', description: 'Basic calculator', module: 'MathModule' }, // Exact name match
        { name: 'math_calc', description: 'Calculator for math operations', module: 'MathModule' }, // Description match
        { name: 'evaluator', description: 'Expression evaluator', module: 'MathModule' } // Lower relevance
      ];

      mockToolsCollection.find().toArray.mockResolvedValue(textResults);

      const results = await semanticSearch.searchByText(queryText);

      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });

    test('should handle empty text search results', async () => {
      mockToolsCollection.find().toArray.mockResolvedValue([]);

      const results = await semanticSearch.searchByText('non-existent-tool');

      expect(results).toEqual([]);
    });
  });

  describe('Vector Management', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();
    });

    test('should index tool perspectives as vectors', async () => {
      const toolName = 'file_reader';
      const perspectives = [
        { query: 'How to read files?', context: 'File reading operations' },
        { query: 'Load file data', context: 'Data loading from files' }
      ];
      const embeddings = perspectives.map(() => new Array(384).fill(0).map(() => Math.random()));

      mockEmbeddingService.generateEmbeddings.mockResolvedValue(embeddings);

      await semanticSearch.indexToolPerspectives(toolName, perspectives);

      expect(mockEmbeddingService.generateEmbeddings).toHaveBeenCalledWith(
        perspectives.map(p => `${p.query} ${p.context}`)
      );
      expect(mockVectorStore.indexTools).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: `${toolName}_perspective_0`,
            description: perspectives[0].query,
            moduleName: toolName
          })
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            perspective: perspectives[0].context,
            category: 'semantic-search',
            useCases: [perspectives[0].query]
          })
        ])
      );
    });

    test('should remove vectors for a tool', async () => {
      const toolName = 'deprecated_tool';

      await semanticSearch.removeToolVectors(toolName);

      expect(mockVectorStore.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { must: [{ key: 'toolName', match: { value: toolName } }] }
        })
      );
    });

    test('should get vector collection statistics', async () => {
      const collectionInfo = {
        vectorsCount: 1500,
        indexedVectorsCount: 1500,
        pointsCount: 1500
      };

      mockVectorStore.getCollectionInfo.mockResolvedValue(collectionInfo);

      const stats = await semanticSearch.getVectorStats();

      expect(mockVectorStore.getCollectionInfo).toHaveBeenCalledWith('perspectives');
      expect(stats).toEqual(collectionInfo);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();
    });

    test('should handle embedding service failures', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding service error'));

      await expect(semanticSearch.searchSemantic('test query')).rejects.toThrow(SemanticSearchError);
    });

    test('should handle vector store failures', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockRejectedValue(new Error('Vector store error'));

      await expect(semanticSearch.searchSemantic('test query')).rejects.toThrow(SemanticSearchError);
    });

    test('should handle database connection failures', async () => {
      mockDatabaseStorage.isConnected = false;

      await expect(semanticSearch.searchByText('test query')).rejects.toThrow(SemanticSearchError);
    });

    test('should handle invalid input parameters', async () => {
      await expect(semanticSearch.searchSemantic('')).rejects.toThrow(SemanticSearchError);
      await expect(semanticSearch.searchSemantic(null)).rejects.toThrow(SemanticSearchError);
      await expect(semanticSearch.searchHybrid(123)).rejects.toThrow(SemanticSearchError);
    });

    test('should throw error when called before initialization', async () => {
      const uninitializedSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });

      await expect(uninitializedSearch.searchSemantic('test')).rejects.toThrow(SemanticSearchError);
      await expect(uninitializedSearch.searchHybrid('test')).rejects.toThrow(SemanticSearchError);
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager,
        options: { enableCaching: true, cacheSize: 100 }
      });
      await semanticSearch.initialize();
    });

    test('should cache query embeddings for repeated searches', async () => {
      const queryText = 'repeated query';
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([]);

      // First search
      await semanticSearch.searchSemantic(queryText);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(1);

      // Second search - should use cached embedding
      await semanticSearch.searchSemantic(queryText);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(1); // No additional call
    });

    test('should provide search statistics', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([]);

      await semanticSearch.searchSemantic('test query');

      const stats = semanticSearch.getSearchStats();
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('averageSearchTime');
      expect(stats.totalQueries).toBe(1);
    });

    test('should handle concurrent search requests', async () => {
      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      mockEmbeddingService.generateEmbedding.mockResolvedValue(queryEmbedding);
      mockVectorStore.search.mockResolvedValue([]);

      const promises = [
        semanticSearch.searchSemantic('query1'),
        semanticSearch.searchSemantic('query2'),
        semanticSearch.searchSemantic('query3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(3);
    });
  });

  describe('Resource Management', () => {
    test('should properly cleanup resources on shutdown', async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();

      await semanticSearch.shutdown();

      expect(mockEmbeddingService.shutdown).toHaveBeenCalled();
      // VectorStore doesn't have a shutdown method - it uses the underlying database connection
      // which is managed elsewhere, so we shouldn't expect shutdown to be called
      expect(semanticSearch.initialized).toBe(false);
      expect(semanticSearch.vectorStore).toBeNull();
      expect(semanticSearch.embeddingService).toBeNull();
    });

    test('should handle graceful shutdown with pending requests', async () => {
      semanticSearch = new SemanticSearch({
        resourceManager: mockResourceManager
      });
      await semanticSearch.initialize();

      const queryEmbedding = new Array(384).fill(0).map(() => Math.random());
      const slowPromise = new Promise(resolve => 
        setTimeout(() => resolve(queryEmbedding), 1000)
      );
      mockEmbeddingService.generateEmbedding.mockReturnValue(slowPromise);
      mockVectorStore.search.mockResolvedValue([]);

      // Start a search but don't wait
      const searchPromise = semanticSearch.searchSemantic('test');

      // Shutdown immediately
      await semanticSearch.shutdown();

      // Pending request should fail gracefully with SERVICE_UNAVAILABLE
      await expect(searchPromise).rejects.toThrow(SemanticSearchError);
      await expect(searchPromise).rejects.toThrow('VectorStore not available - service may be shutting down');
    });
  });
});