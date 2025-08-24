/**
 * ToolRegistry Vector Operations Integration Tests
 * 
 * Tests complete semantic search workflow through ToolRegistry singleton
 * NO MOCKS - uses real Qdrant, real embeddings, real ResourceManager singleton
 * 
 * Verifies:
 * - ToolRegistry singleton properly initializes vector operations
 * - EmbeddingService integration through ResourceManager
 * - VectorStore operations through ToolRegistry methods
 * - Tool perspective indexing and semantic search
 * - Proper tool-to-embedding linkage
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('ToolRegistry Vector Operations', () => {
  let resourceManager;
  let toolRegistry;
  let databaseStorage;
  let testDatabaseName;

  beforeAll(async () => {
    // Check prerequisites
    const qdrantUrl = process.env.QDRANT_URL;
    if (!qdrantUrl) {
      throw new Error('QDRANT_URL environment variable required for vector operations tests');
    }

    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();

    // Create test database
    testDatabaseName = `test_vector_ops_${Date.now()}`;
    
    // Initialize DatabaseStorage for testing
    databaseStorage = new DatabaseStorage({
      resourceManager,
      databaseName: testDatabaseName
    });
    await databaseStorage.initialize();

    // Create and initialize ToolRegistry
    toolRegistry = new ToolRegistry({
      resourceManager,
      databaseStorage
    });
    await toolRegistry.initialize();

    // Create LLMClient if not exists
    let llmClient = resourceManager.get('llmClient');
    if (!llmClient) {
      llmClient = await resourceManager.createLLMClient();
      resourceManager.set('llmClient', llmClient);
    }

    // Set up EmbeddingService in ResourceManager
    const { EmbeddingService } = await import('../../src/search/EmbeddingService.js');
    const embeddingService = new EmbeddingService({
      resourceManager,
      options: { dimensions: 768 }  // Nomic embeddings
    });
    await embeddingService.initialize();
    resourceManager.set('embeddingService', embeddingService);

    // Load a test module to have tools for testing
    const { DatabaseOperations } = await import('../../src/core/DatabaseOperations.js');
    const dbOps = new DatabaseOperations({
      resourceManager,
      databaseStorage
    });

    // Load calculator module for testing
    const calculatorPath = '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/calculator/CalculatorModule.js';
    const result = await dbOps.loadModule(calculatorPath);
    
    if (!result.success) {
      throw new Error(`Failed to load calculator module: ${result.error}`);
    }
  });

  afterAll(async () => {
    // Cleanup test database
    if (databaseStorage) {
      await databaseStorage.client.db(testDatabaseName).dropDatabase();
      await databaseStorage.close();
    }

    // Cleanup ToolRegistry vector store
    if (toolRegistry) {
      try {
        const vectorStore = await toolRegistry.getVectorStore();
        await vectorStore.clear();
      } catch (error) {
        // Vector store might not be initialized, ignore
      }
      await toolRegistry.cleanup();
    }
  });

  beforeEach(async () => {
    // Clear vector store before each test
    try {
      const vectorStore = await toolRegistry.getVectorStore();
      await vectorStore.clear();
    } catch (error) {
      // Vector store might not be initialized yet, ignore
    }
  });

  describe('ToolRegistry Vector Store Initialization', () => {
    test('should initialize VectorStore through ToolRegistry singleton', async () => {
      const vectorStore = await toolRegistry.getVectorStore();

      expect(vectorStore).toBeDefined();
      expect(vectorStore.constructor.name).toBe('VectorStore');

      // Verify VectorStore is properly configured
      expect(vectorStore.options.collectionName).toBe('tool_perspectives');
      expect(vectorStore.embeddingClient).toBeDefined();
      expect(vectorStore.vectorDatabase).toBeDefined();
      expect(vectorStore.vectorDatabase.constructor.name).toBe('QdrantVectorDatabase');
    });

    test('should return same VectorStore instance on multiple calls', async () => {
      const vectorStore1 = await toolRegistry.getVectorStore();
      const vectorStore2 = await toolRegistry.getVectorStore();

      // Should be same instance (singleton behavior)
      expect(vectorStore1).toBe(vectorStore2);
    });

    test('should get vector statistics from initialized store', async () => {
      const stats = await toolRegistry.getVectorStats();

      expect(stats).toHaveProperty('vectors_count');
      expect(stats).toHaveProperty('dimensions', 768);
      expect(typeof stats.vectors_count).toBe('number');
    });
  });

  describe('Tool Perspective Indexing', () => {
    test('should index tool perspectives with real embeddings', async () => {
      // Create test perspectives for calculator tool
      const perspectives = [
        {
          query: 'Calculate mathematical expressions',
          context: 'Mathematical calculations and arithmetic operations',
          perspectiveType: 'usage',
          moduleName: 'Calculator'
        },
        {
          query: 'Compute numeric values',
          context: 'Numerical computation and evaluation',
          perspectiveType: 'functionality',
          moduleName: 'Calculator'
        },
        {
          query: 'Evaluate arithmetic formulas',
          context: 'Formula evaluation and expression parsing',
          perspectiveType: 'capability',
          moduleName: 'Calculator'
        }
      ];

      // Index perspectives through ToolRegistry
      const result = await toolRegistry.indexToolPerspectives('calculator', perspectives);

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('calculator');
      expect(result.indexed).toBe(3);
      expect(result.results).toHaveLength(3);

      // Verify each result has proper structure
      result.results.forEach(indexResult => {
        expect(indexResult).toHaveProperty('id');
        expect(indexResult.id).toContain('point_');
      });

      // Verify vectors were actually stored
      const stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(3);
    });

    test('should handle indexing errors gracefully', async () => {
      // Try to index with invalid perspectives
      const invalidPerspectives = [
        { /* missing required fields */ }
      ];

      const result = await toolRegistry.indexToolPerspectives('invalid_tool', invalidPerspectives);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.indexed).toBe(0);
    });

    test('should index perspectives with different perspective types', async () => {
      const perspectives = [
        {
          query: 'Basic math operations',
          context: 'Addition, subtraction, multiplication, division',
          perspectiveType: 'usage',
          moduleName: 'Calculator'
        },
        {
          query: 'Advanced mathematical functions',
          context: 'Trigonometry, logarithms, exponentials',
          perspectiveType: 'capability',
          moduleName: 'Calculator'
        },
        {
          query: 'Scientific calculations',
          context: 'Complex mathematical computations',
          perspectiveType: 'domain',
          moduleName: 'Calculator'
        }
      ];

      const result = await toolRegistry.indexToolPerspectives('advanced_calculator', perspectives);

      expect(result.success).toBe(true);
      expect(result.indexed).toBe(3);

      // Verify different perspective types are stored
      const stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(3);
    });
  });

  describe('Semantic Tool Search', () => {
    beforeEach(async () => {
      // Index multiple tools with different perspectives
      const toolPerspectives = [
        {
          toolName: 'calculator',
          perspectives: [
            {
              query: 'Perform mathematical calculations',
              context: 'Arithmetic and mathematical operations',
              perspectiveType: 'usage',
              moduleName: 'MathModule'
            },
            {
              query: 'Compute numeric expressions',
              context: 'Expression evaluation and computation',
              perspectiveType: 'functionality',
              moduleName: 'MathModule'
            }
          ]
        },
        {
          toolName: 'file_reader',
          perspectives: [
            {
              query: 'Read files from filesystem',
              context: 'File I/O operations and content retrieval',
              perspectiveType: 'usage',
              moduleName: 'FileModule'
            },
            {
              query: 'Load file contents into memory',
              context: 'File system access and data loading',
              perspectiveType: 'functionality',
              moduleName: 'FileModule'
            }
          ]
        },
        {
          toolName: 'json_parser',
          perspectives: [
            {
              query: 'Parse JSON strings',
              context: 'JSON data structure parsing and conversion',
              perspectiveType: 'usage',
              moduleName: 'UtilModule'
            }
          ]
        }
      ];

      // Index all tool perspectives
      for (const { toolName, perspectives } of toolPerspectives) {
        await toolRegistry.indexToolPerspectives(toolName, perspectives);
      }
    });

    test('should search for similar tools by semantic similarity', async () => {
      // Search for math-related functionality
      const results = await toolRegistry.searchSimilarTools('I need to do some mathematical computations', {
        limit: 5,
        minScore: 0.3
      });

      expect(results).toHaveLength(5); // Should find all indexed perspectives
      expect(results[0]).toHaveProperty('toolName');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('description');
      expect(results[0]).toHaveProperty('moduleName');
      expect(results[0]).toHaveProperty('perspective');

      // Calculator should be most relevant
      const calcResults = results.filter(r => r.toolName === 'calculator');
      expect(calcResults.length).toBeGreaterThan(0);
      
      // Should have high similarity scores for math-related query
      const highScoreResults = results.filter(r => r.score > 0.5);
      expect(highScoreResults.length).toBeGreaterThan(0);
    });

    test('should respect minimum score threshold', async () => {
      // Search with high minimum score
      const highThresholdResults = await toolRegistry.searchSimilarTools('mathematical operations', {
        limit: 10,
        minScore: 0.8
      });

      // Search with low minimum score
      const lowThresholdResults = await toolRegistry.searchSimilarTools('mathematical operations', {
        limit: 10,
        minScore: 0.2
      });

      // High threshold should return fewer results
      expect(highThresholdResults.length).toBeLessThanOrEqual(lowThresholdResults.length);

      // All results should meet minimum score requirement
      expect(highThresholdResults.every(r => r.score >= 0.8)).toBe(true);
      expect(lowThresholdResults.every(r => r.score >= 0.2)).toBe(true);
    });

    test('should limit results according to limit parameter', async () => {
      // Search with limit of 2
      const limitedResults = await toolRegistry.searchSimilarTools('file operations', {
        limit: 2
      });

      expect(limitedResults).toHaveLength(2);

      // Search with higher limit
      const moreResults = await toolRegistry.searchSimilarTools('file operations', {
        limit: 10
      });

      expect(moreResults.length).toBeGreaterThanOrEqual(limitedResults.length);
      expect(moreResults.length).toBeLessThanOrEqual(10);
    });

    test('should return relevant tool metadata in search results', async () => {
      const results = await toolRegistry.searchSimilarTools('parse data structures', {
        limit: 3
      });

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('toolName');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('moduleName');
        expect(result).toHaveProperty('perspective');
        expect(result).toHaveProperty('perspectiveType');

        // Validate types
        expect(typeof result.toolName).toBe('string');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    test('should handle empty search results', async () => {
      // Clear all vectors first
      await toolRegistry.getVectorStore().then(vs => vs.clear());

      // Search on empty index
      const results = await toolRegistry.searchSimilarTools('any query', {
        limit: 5
      });

      expect(results).toEqual([]);
    });
  });

  describe('Tool Vector Management', () => {
    test('should remove tool vectors by tool name', async () => {
      // Index a tool
      await toolRegistry.indexToolPerspectives('removable_tool', [
        {
          query: 'Test perspective for removal',
          context: 'Testing vector removal functionality',
          perspectiveType: 'testing'
        }
      ]);

      // Verify tool was indexed
      let stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(1);

      // Remove tool vectors
      const removed = await toolRegistry.removeToolVectors('removable_tool');
      expect(removed).toBe(true);

      // Verify tool vectors were removed
      stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(0);
    });

    test('should handle removal of non-existent tool', async () => {
      const removed = await toolRegistry.removeToolVectors('non_existent_tool');
      expect(removed).toBe(true); // Should not error on non-existent tool
    });

    test('should maintain vector consistency across operations', async () => {
      // Index multiple tools
      const tools = ['tool1', 'tool2', 'tool3'];
      
      for (const toolName of tools) {
        await toolRegistry.indexToolPerspectives(toolName, [
          {
            query: `${toolName} functionality`,
            context: `Context for ${toolName}`,
            perspectiveType: 'testing'
          }
        ]);
      }

      // Verify all tools indexed
      let stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(3);

      // Remove one tool
      await toolRegistry.removeToolVectors('tool2');

      // Verify only 2 tools remain
      stats = await toolRegistry.getVectorStats();
      expect(stats.vectors_count).toBe(2);

      // Search should still work for remaining tools
      const results = await toolRegistry.searchSimilarTools('tool functionality');
      expect(results.length).toBe(2);
      
      const toolNames = results.map(r => r.toolName);
      expect(toolNames).toContain('tool1');
      expect(toolNames).toContain('tool3');
      expect(toolNames).not.toContain('tool2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle ToolRegistry initialization without Qdrant', async () => {
      // Temporarily remove QDRANT_URL
      const originalQdrantUrl = resourceManager.get('env.QDRANT_URL');
      resourceManager.set('env.QDRANT_URL', null);

      // Create new ToolRegistry instance
      const testToolRegistry = new ToolRegistry({
        resourceManager,
        databaseStorage
      });
      await testToolRegistry.initialize();

      // Should fall back to mock vector database
      const vectorStore = await testToolRegistry.getVectorStore();
      expect(vectorStore.vectorDatabase.isConnected).toBe(false);

      // Restore original URL
      resourceManager.set('env.QDRANT_URL', originalQdrantUrl);
      
      await testToolRegistry.cleanup();
    });

    test('should handle embedding service failures', async () => {
      // Create ToolRegistry without embedding service
      const testResourceManager = {
        get: (key) => {
          if (key === 'embeddingService') return null;
          return resourceManager.get(key);
        }
      };

      const testToolRegistry = new ToolRegistry({
        resourceManager: testResourceManager,
        databaseStorage
      });
      await testToolRegistry.initialize();

      // Should throw error when trying to get VectorStore
      await expect(testToolRegistry.getVectorStore()).rejects.toThrow('EmbeddingService not available');
      
      await testToolRegistry.cleanup();
    });

    test('should handle malformed perspective data', async () => {
      const malformedPerspectives = [
        null,
        undefined,
        { /* missing query */ context: 'test' },
        { query: '', context: 'empty query' },
        { query: 'test', /* missing context */ }
      ];

      for (const perspective of malformedPerspectives) {
        const result = await toolRegistry.indexToolPerspectives('test_tool', [perspective]);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    test('should handle search with invalid query', async () => {
      // Empty query
      await expect(toolRegistry.searchSimilarTools('', {})).rejects.toThrow();

      // Non-string query
      await expect(toolRegistry.searchSimilarTools(null, {})).rejects.toThrow();
      await expect(toolRegistry.searchSimilarTools(123, {})).rejects.toThrow();
    });
  });
});