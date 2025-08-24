/**
 * QdrantIntegration Integration Tests
 * 
 * Tests real Qdrant vector database operations with actual embeddings
 * NO MOCKS - uses real Qdrant instance, real embedding service
 * 
 * Prerequisites:
 * - Qdrant running locally (default: http://localhost:6333)
 * - QDRANT_URL environment variable set
 * - Real embedding service available
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { QdrantVectorDatabase } from '../../src/search/QdrantVectorDatabase.js';
import { VectorStore } from '../../src/search/VectorStore.js';
import { EmbeddingService } from '../../src/search/EmbeddingService.js';

describe('QdrantIntegration', () => {
  let resourceManager;
  let qdrantVectorDb;
  let vectorStore;
  let embeddingService;
  let testCollectionName;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();

    // Check if Qdrant is available
    const qdrantUrl = resourceManager.get('env.QDRANT_URL');
    if (!qdrantUrl) {
      throw new Error('QDRANT_URL environment variable not set - Qdrant integration tests require real Qdrant instance');
    }

    // Initialize embedding service
    const llmClient = resourceManager.get('llmClient');
    if (!llmClient) {
      const llmClient = await resourceManager.createLLMClient();
      resourceManager.set('llmClient', llmClient);
    }

    embeddingService = new EmbeddingService({
      resourceManager,
      options: { dimensions: 768 }  // Nomic embeddings are 768-dimensional
    });
    await embeddingService.initialize();

    // Create QdrantClient and QdrantVectorDatabase
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const qdrantClient = new QdrantClient({ url: qdrantUrl });
    
    qdrantVectorDb = new QdrantVectorDatabase(qdrantClient, {
      dimensions: 768,
      distance: 'cosine'
    });

    // Test collection name with timestamp to avoid conflicts
    testCollectionName = `test_qdrant_integration_${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup: delete test collection
    if (qdrantVectorDb) {
      try {
        await qdrantVectorDb.client.deleteCollection(testCollectionName);
      } catch (error) {
        // Collection might not exist, ignore error
      }
      await qdrantVectorDb.close();
    }

    if (embeddingService) {
      await embeddingService.shutdown();
    }
  });

  beforeEach(async () => {
    // Clean collection before each test
    if (await qdrantVectorDb.hasCollection(testCollectionName)) {
      await qdrantVectorDb.clear(testCollectionName);
    }
  });

  describe('QdrantVectorDatabase Core Operations', () => {
    test('should create and verify collection exists', async () => {
      // Create collection
      const created = await qdrantVectorDb.createCollection(testCollectionName, {
        dimensions: 768,
        distance: 'cosine'
      });

      expect(created).toBe(true);

      // Verify collection exists
      const exists = await qdrantVectorDb.hasCollection(testCollectionName);
      expect(exists).toBe(true);

      // Get statistics
      const stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats).toHaveProperty('vectors_count', 0);
      expect(stats).toHaveProperty('dimensions', 768);
    });

    test('should insert single point with tool metadata', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Generate real embedding
      const testText = 'Calculate mathematical expressions and arithmetic operations';
      const embedding = await embeddingService.generateEmbedding(testText);
      
      expect(embedding).toHaveLength(768);
      expect(embedding.every(val => typeof val === 'number' && isFinite(val))).toBe(true);

      // Insert point with tool metadata
      const doc = {
        vector: embedding,
        metadata: {
          toolName: 'calculator',
          description: testText,
          moduleName: 'MathModule',
          perspectiveType: 'usage',
          context: 'Mathematical calculations and arithmetic'
        }
      };

      const result = await qdrantVectorDb.insert(testCollectionName, doc);

      expect(result).toHaveProperty('id');
      expect(result.id).toContain('point_');
      expect(result).toHaveProperty('vector', embedding);
      expect(result).toHaveProperty('metadata');

      // Verify point was inserted
      const stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(1);
    });

    test('should insert multiple points in batch', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Generate embeddings for multiple tools
      const toolTexts = [
        'Read files from filesystem and return contents',
        'Write content to files on disk',
        'Parse JSON strings and convert to objects'
      ];

      const embeddings = await embeddingService.generateEmbeddings(toolTexts);
      expect(embeddings).toHaveLength(3);
      expect(embeddings.every(emb => emb.length === 768)).toBe(true);

      // Create batch documents
      const docs = toolTexts.map((text, index) => ({
        vector: embeddings[index],
        metadata: {
          toolName: `tool_${index}`,
          description: text,
          moduleName: `Module${index}`,
          perspectiveType: 'functionality',
          batchIndex: index
        }
      }));

      // Insert batch
      const results = await qdrantVectorDb.insertBatch(testCollectionName, docs);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('id');
        expect(result.vector).toEqual(embeddings[index]);
        expect(result.metadata.toolName).toBe(`tool_${index}`);
      });

      // Verify all points were inserted
      const stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(3);
    });

    test('should search for similar vectors', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Insert calculator tool perspective
      const calcText = 'Perform mathematical calculations and arithmetic operations';
      const calcEmbedding = await embeddingService.generateEmbedding(calcText);

      await qdrantVectorDb.insert(testCollectionName, {
        vector: calcEmbedding,
        metadata: {
          toolName: 'calculator',
          description: calcText,
          moduleName: 'MathModule',
          perspectiveType: 'usage'
        }
      });

      // Insert file reader tool perspective
      const fileText = 'Read files from filesystem and return their content';
      const fileEmbedding = await embeddingService.generateEmbedding(fileText);

      await qdrantVectorDb.insert(testCollectionName, {
        vector: fileEmbedding,
        metadata: {
          toolName: 'file_reader',
          description: fileText,
          moduleName: 'FileModule',
          perspectiveType: 'functionality'
        }
      });

      // Search for math-related tools
      const queryText = 'I need to compute some math calculations';
      const queryEmbedding = await embeddingService.generateEmbedding(queryText);
      
      const searchResults = await qdrantVectorDb.search(testCollectionName, queryEmbedding, {
        limit: 5,
        scoreThreshold: 0.3,
        withPayload: true
      });

      expect(searchResults).toHaveLength(2); // Should find both tools
      expect(searchResults[0]).toHaveProperty('score');
      expect(searchResults[0]).toHaveProperty('metadata');
      
      // Calculator should be more similar to math query
      const calcResult = searchResults.find(r => r.metadata.toolName === 'calculator');
      const fileResult = searchResults.find(r => r.metadata.toolName === 'file_reader');
      
      expect(calcResult).toBeDefined();
      expect(fileResult).toBeDefined();
      expect(calcResult.score).toBeGreaterThan(fileResult.score);
    });

    test('should filter search results by metadata', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Insert tools with different modules
      const tools = [
        { name: 'math_calc', module: 'MathModule', text: 'Mathematical calculations' },
        { name: 'file_read', module: 'FileModule', text: 'Read file contents' },
        { name: 'math_stats', module: 'MathModule', text: 'Statistical analysis' }
      ];

      for (const tool of tools) {
        const embedding = await embeddingService.generateEmbedding(tool.text);
        await qdrantVectorDb.insert(testCollectionName, {
          vector: embedding,
          metadata: {
            toolName: tool.name,
            description: tool.text,
            moduleName: tool.module,
            perspectiveType: 'functionality'
          }
        });
      }

      // Search with module filter
      const queryEmbedding = await embeddingService.generateEmbedding('math operations');
      const filteredResults = await qdrantVectorDb.search(testCollectionName, queryEmbedding, {
        limit: 10,
        filter: { moduleName: 'MathModule' },
        withPayload: true
      });

      expect(filteredResults).toHaveLength(2);
      expect(filteredResults.every(r => r.metadata.moduleName === 'MathModule')).toBe(true);
    });

    test('should delete points by filter', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Insert multiple tools
      const tools = [
        { name: 'tool1', module: 'ModuleA' },
        { name: 'tool2', module: 'ModuleB' },
        { name: 'tool3', module: 'ModuleA' }
      ];

      for (const tool of tools) {
        const embedding = await embeddingService.generateEmbedding(`Tool ${tool.name}`);
        await qdrantVectorDb.insert(testCollectionName, {
          vector: embedding,
          metadata: {
            toolName: tool.name,
            moduleName: tool.module
          }
        });
      }

      // Verify 3 points inserted
      let stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(3);

      // Delete tools from ModuleA
      const deleted = await qdrantVectorDb.delete(testCollectionName, {
        moduleName: 'ModuleA'
      });

      expect(deleted).toBe(true);

      // Verify only ModuleB tool remains
      stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(1);

      // Search to verify only ModuleB tool remains
      const queryEmbedding = await embeddingService.generateEmbedding('tool');
      const remainingResults = await qdrantVectorDb.search(testCollectionName, queryEmbedding, {
        limit: 10,
        withPayload: true
      });

      expect(remainingResults).toHaveLength(1);
      expect(remainingResults[0].metadata.moduleName).toBe('ModuleB');
    });

    test('should clear entire collection', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Insert some test points
      for (let i = 0; i < 5; i++) {
        const embedding = await embeddingService.generateEmbedding(`Test tool ${i}`);
        await qdrantVectorDb.insert(testCollectionName, {
          vector: embedding,
          metadata: { toolName: `tool_${i}` }
        });
      }

      // Verify points exist
      let stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(5);

      // Clear collection
      const clearResult = await qdrantVectorDb.clear(testCollectionName);
      expect(clearResult.deletedCount).toBe(5);

      // Verify collection is empty
      stats = await qdrantVectorDb.getStatistics(testCollectionName);
      expect(stats.vectors_count).toBe(0);
    });
  });

  describe('VectorStore with QdrantVectorDatabase', () => {
    test('should initialize VectorStore with Qdrant backend', async () => {
      vectorStore = new VectorStore({
        embeddingClient: embeddingService,
        vectorDatabase: qdrantVectorDb,
        collectionName: testCollectionName
      });

      await vectorStore.initialize();

      // Verify collection was created
      const exists = await qdrantVectorDb.hasCollection(testCollectionName);
      expect(exists).toBe(true);
    });

    test('should index tool with real embeddings', async () => {
      vectorStore = new VectorStore({
        embeddingClient: embeddingService,
        vectorDatabase: qdrantVectorDb,
        collectionName: testCollectionName
      });

      await vectorStore.initialize();

      // Index a tool
      const tool = {
        name: 'json_parser',
        description: 'Parse JSON strings and convert to JavaScript objects',
        moduleName: 'UtilModule'
      };

      const result = await vectorStore.indexTool(tool);

      expect(result).toHaveProperty('id');
      expect(result.id).toContain('point_');

      // Verify tool was indexed
      const stats = await vectorStore.getStatistics();
      expect(stats.vectors_count).toBe(1);
    });

    test('should search for similar tools', async () => {
      vectorStore = new VectorStore({
        embeddingClient: embeddingService,
        vectorDatabase: qdrantVectorDb,
        collectionName: testCollectionName
      });

      await vectorStore.initialize();

      // Index multiple tools
      const tools = [
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          moduleName: 'MathModule'
        },
        {
          name: 'file_reader',
          description: 'Read files from filesystem',
          moduleName: 'FileModule'
        },
        {
          name: 'json_parser',
          description: 'Parse JSON data structures',
          moduleName: 'UtilModule'
        }
      ];

      for (const tool of tools) {
        await vectorStore.indexTool(tool);
      }

      // Search for math-related functionality
      const searchResults = await vectorStore.search('mathematical operations and arithmetic', {
        limit: 5,
        minScore: 0.3
      });

      expect(searchResults).toHaveLength(3);
      expect(searchResults[0]).toHaveProperty('toolName');
      expect(searchResults[0]).toHaveProperty('score');
      
      // Calculator should be most relevant
      expect(searchResults[0].toolName).toBe('calculator');
      expect(searchResults[0].score).toBeGreaterThan(0.5);
    });

    test('should handle batch indexing', async () => {
      vectorStore = new VectorStore({
        embeddingClient: embeddingService,
        vectorDatabase: qdrantVectorDb,
        collectionName: testCollectionName
      });

      await vectorStore.initialize();

      // Index tools in batch
      const tools = [
        { name: 'tool1', description: 'First tool functionality' },
        { name: 'tool2', description: 'Second tool capabilities' },
        { name: 'tool3', description: 'Third tool operations' }
      ];

      const results = await vectorStore.indexTools(tools);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result.id).toContain('point_');
      });

      // Verify all tools indexed
      const stats = await vectorStore.getStatistics();
      expect(stats.vectors_count).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection failures gracefully', async () => {
      // Create QdrantVectorDatabase with invalid URL
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      const badClient = new QdrantClient({ url: 'http://invalid-qdrant-url:6333' });
      const badQdrantDb = new QdrantVectorDatabase(badClient);

      // Should throw error on operation
      await expect(badQdrantDb.hasCollection('test')).rejects.toThrow();
    });

    test('should validate embedding dimensions', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Try to insert vector with wrong dimensions
      const wrongDimensionVector = new Array(384).fill(0.5); // Should be 768

      await expect(qdrantVectorDb.insert(testCollectionName, {
        vector: wrongDimensionVector,
        metadata: { toolName: 'test' }
      })).rejects.toThrow();
    });

    test('should handle invalid vector data', async () => {
      await qdrantVectorDb.createCollection(testCollectionName);

      // Try to insert non-array vector
      await expect(qdrantVectorDb.insert(testCollectionName, {
        vector: 'invalid-vector',
        metadata: { toolName: 'test' }
      })).rejects.toThrow('Vector is required and must be an array');

      // Try to insert null vector
      await expect(qdrantVectorDb.insert(testCollectionName, {
        vector: null,
        metadata: { toolName: 'test' }
      })).rejects.toThrow('Vector is required and must be an array');
    });
  });
});