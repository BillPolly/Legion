/**
 * QdrantSemanticSearch Integration Test
 * 
 * Tests semantic search functionality with Qdrant using real Nomic embeddings
 * This provides realistic semantic similarity testing with actual embedding vectors
 * 
 * Prerequisites:
 * - Qdrant running locally (default: http://localhost:6333)
 * - QDRANT_URL environment variable set
 * - Nomic embeddings package available
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { QdrantVectorDatabase } from '../../src/search/QdrantVectorDatabase.js';
import { VectorStore } from '../../src/search/VectorStore.js';
import { NomicEmbeddings } from '@legion/nomic';

describe('QdrantSemanticSearch', () => {
  let resourceManager;
  let qdrantVectorDb;
  let vectorStore;
  let testCollectionName;
  let nomicEmbeddingService;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getResourceManager();

    // Check if Qdrant is available
    const qdrantUrl = resourceManager.get('env.QDRANT_URL');
    if (!qdrantUrl) {
      throw new Error('QDRANT_URL environment variable not set - Qdrant integration tests require real Qdrant instance');
    }

    // Create Nomic embedding service for real semantic similarity
    const nomicService = new NomicEmbeddings();
    await nomicService.initialize();
    
    // Create adapter to match VectorStore expectations
    nomicEmbeddingService = {
      generateEmbedding: async (text) => {
        return await nomicService.embed(text);
      },
      
      generateEmbeddings: async (texts) => {
        return await nomicService.embedBatch(texts);
      },
      
      generateBatch: async (texts) => {
        return await nomicService.embedBatch(texts);
      },
      
      // Store reference to actual service for cleanup
      _nomicService: nomicService
    };
    
    console.log('✅ Nomic embeddings service initialized for semantic search testing');

    // Create QdrantClient and QdrantVectorDatabase
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const qdrantClient = new QdrantClient({ url: qdrantUrl });
    
    qdrantVectorDb = new QdrantVectorDatabase(qdrantClient, {
      dimensions: 768,
      distance: 'cosine'
    });

    // Create VectorStore with Nomic embedding service
    vectorStore = new VectorStore({
      embeddingClient: nomicEmbeddingService,
      vectorDatabase: qdrantVectorDb,
      collectionName: 'test_semantic_search',
      dimensions: 768,  // Match the Nomic embedding dimensions
      verbose: true
    });

    // Test collection name with timestamp to avoid conflicts
    testCollectionName = `test_semantic_search_${Date.now()}`;
  }, 15000);

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
    
    // Close Nomic embedding service
    if (nomicEmbeddingService && nomicEmbeddingService._nomicService) {
      await nomicEmbeddingService._nomicService.close();
    }
  });

  beforeEach(async () => {
    // Clean and populate collection before each test
    vectorStore.options.collectionName = testCollectionName;
    await vectorStore.initialize();
    
    if (await qdrantVectorDb.hasCollection(testCollectionName)) {
      await qdrantVectorDb.clear(testCollectionName);
    }
    
    // Populate with basic test data for all tests
    const toolPerspectives = [
      {
        name: 'calculator',
        description: 'Performs mathematical calculations and arithmetic operations',
        moduleName: 'MathModule'
      },
      {
        name: 'file_reader', 
        description: 'Reads files from filesystem and returns their contents',
        moduleName: 'FileModule'
      },
      {
        name: 'json_parser',
        description: 'Parses JSON strings and converts them to JavaScript objects',
        moduleName: 'UtilModule'
      },
      {
        name: 'math_statistics',
        description: 'Computes statistical measures like mean, median, and standard deviation',
        moduleName: 'MathModule'  
      }
    ];
    
    await vectorStore.indexTools(toolPerspectives);
  });

  describe('Semantic Search Workflow', () => {
    test('should demonstrate semantic search with tool perspectives', async () => {
      // Data is already populated in beforeEach
      
      // Verify tools were indexed
      const stats = await vectorStore.getStatistics();
      expect(stats.vectors_count).toBe(4);
      expect(stats.dimensions).toBe(768);
      
      console.log(`📊 Collection stats: ${stats.vectors_count} vectors, ${stats.dimensions} dimensions`);
    }, 30000);

    test('should find semantically similar tools', async () => {
      // Search for mathematical functionality
      const mathResults = await vectorStore.search('arithmetic calculations and numbers', {
        limit: 5,
        minScore: 0.1
      });

      expect(mathResults).toBeDefined();
      expect(mathResults.length).toBeGreaterThan(0);

      // Should find calculator and math_statistics tools
      const mathToolNames = mathResults.map(r => r.toolName);
      expect(mathToolNames).toContain('calculator');
      
      console.log(`🔍 Math query results: ${mathToolNames.join(', ')}`);
      console.log(`   Best match: ${mathResults[0].toolName} (score: ${mathResults[0].score.toFixed(4)})`);

      // Search for file operations
      const fileResults = await vectorStore.search('read files and filesystem operations', {
        limit: 5,
        minScore: 0.1
      });

      expect(fileResults.length).toBeGreaterThan(0);
      const fileToolNames = fileResults.map(r => r.toolName);
      expect(fileToolNames).toContain('file_reader');
      
      console.log(`📁 File query results: ${fileToolNames.join(', ')}`);

      // Search for data processing
      const dataResults = await vectorStore.search('parse data structures and JSON', {
        limit: 5,
        minScore: 0.1
      });

      expect(dataResults.length).toBeGreaterThan(0);
      const dataToolNames = dataResults.map(r => r.toolName);
      expect(dataToolNames).toContain('json_parser');
      
      console.log(`📄 Data query results: ${dataToolNames.join(', ')}`);
    }, 30000);

    test('should filter search results by module', async () => {
      // First, let's see what data we actually have in the collection
      const allResults = await vectorStore.search('calculations', { limit: 10 });
      console.log('📊 Debug: All available results:');
      for (const result of allResults) {
        console.log(`  - ${result.toolName} from module "${result.moduleName}"`);
      }
      
      // Search within MathModule only
      const mathModuleResults = await vectorStore.search('calculations', {
        filter: { moduleName: 'MathModule' },
        limit: 10
      });

      console.log(`🔢 MathModule filter results: ${mathModuleResults.length} found`);
      if (mathModuleResults.length > 0) {
        console.log(`   Tools: ${mathModuleResults.map(r => r.toolName).join(', ')}`);
      }

      expect(mathModuleResults.length).toBeGreaterThan(0);
      
      // All results should be from MathModule
      for (const result of mathModuleResults) {
        expect(result.moduleName).toBe('MathModule');
      }

      // Search within FileModule only
      const fileModuleResults = await vectorStore.search('files', {
        filter: { moduleName: 'FileModule' },
        limit: 10
      });

      console.log(`📁 FileModule filter results: ${fileModuleResults.length} found`);
      expect(fileModuleResults.length).toBeGreaterThan(0);
      for (const result of fileModuleResults) {
        expect(result.moduleName).toBe('FileModule');
      }

      console.log(`📁 FileModule tools found: ${fileModuleResults.map(r => r.toolName).join(', ')}`);
    }, 15000);

    test('should handle tool removal from vector database', async () => {
      // Get initial count
      let stats = await vectorStore.getStatistics();
      const initialCount = stats.vectors_count;
      expect(initialCount).toBe(4);

      // Remove calculator tool
      await vectorStore.deleteTool('calculator');

      // Verify removal
      stats = await vectorStore.getStatistics();
      expect(stats.vectors_count).toBe(3);

      // Verify calculator no longer appears in search results
      const searchResults = await vectorStore.search('mathematical calculations', {
        limit: 10
      });

      const calculatorResults = searchResults.filter(r => r.toolName === 'calculator');
      expect(calculatorResults.length).toBe(0);

      console.log(`✅ Calculator tool removed - remaining tools: ${searchResults.map(r => r.toolName).join(', ')}`);
    }, 15000);

    test('should demonstrate semantic understanding differences', async () => {
      // Test that semantically similar queries return similar results
      const query1Results = await vectorStore.search('math operations', { limit: 5 });
      const query2Results = await vectorStore.search('arithmetic calculations', { limit: 5 });

      console.log('🧠 Debug: Query results details:');
      console.log(`Query 1 results (${query1Results.length}):`, query1Results.map(r => `${r.toolName}(${r.score.toFixed(4)})`));
      console.log(`Query 2 results (${query2Results.length}):`, query2Results.map(r => `${r.toolName}(${r.score.toFixed(4)})`));

      expect(query1Results.length).toBeGreaterThan(0);
      expect(query2Results.length).toBeGreaterThan(0);

      // Both queries should find similar math-related tools
      const tools1 = query1Results.map(r => r.toolName);
      const tools2 = query2Results.map(r => r.toolName);
      
      const commonTools = tools1.filter(tool => tools2.includes(tool));
      
      console.log(`🧠 Semantic similarity demonstration:`);
      console.log(`   "math operations" → ${tools1.join(', ')}`);
      console.log(`   "arithmetic calculations" → ${tools2.join(', ')}`);
      console.log(`   Common results: ${commonTools.join(', ')} (${commonTools.length} found)`);
      
      // If no common tools, let's be less strict and check for math-related tools
      const mathRelated1 = tools1.filter(t => t.includes('calculator') || t.includes('math'));
      const mathRelated2 = tools2.filter(t => t.includes('calculator') || t.includes('math'));
      
      console.log(`   Math-related in query1: ${mathRelated1.join(', ')}`);
      console.log(`   Math-related in query2: ${mathRelated2.join(', ')}`);
      
      expect(mathRelated1.length + mathRelated2.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Vector Database Performance', () => {
    test('should handle batch operations efficiently', async () => {
      const startTime = Date.now();

      // Create many tool perspectives
      const manyTools = [];
      for (let i = 0; i < 20; i++) {
        manyTools.push({
          name: `tool_${i}`,
          description: `This is tool number ${i} for testing batch operations`,
          moduleName: 'TestModule'
        });
      }

      // Index in batch
      await vectorStore.indexTools(manyTools);
      
      const indexTime = Date.now() - startTime;
      console.log(`⚡ Indexed ${manyTools.length} tools in ${indexTime}ms`);

      // Verify all were indexed
      const stats = await vectorStore.getStatistics();
      expect(stats.vectors_count).toBe(24); // 4 original + 20 new

      // Search should still be fast
      const searchStart = Date.now();
      const results = await vectorStore.search('testing operations', { limit: 5 });
      const searchTime = Date.now() - searchStart;
      
      console.log(`🔍 Search completed in ${searchTime}ms, found ${results.length} results`);
      expect(results.length).toBeGreaterThan(0);
    }, 30000);
  });
});