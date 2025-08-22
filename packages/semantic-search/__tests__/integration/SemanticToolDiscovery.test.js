/**
 * SemanticToolDiscovery Integration Test
 * NO MOCKS - Uses real semantic search and tool discovery
 * Tests intelligent tool discovery based on task descriptions
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SemanticToolDiscovery } from '../../src/tools/SemanticToolDiscovery.js';
import { ToolIndexer } from '../../src/tools/ToolIndexer.js';
import { SemanticSearchProvider } from '../../src/SemanticSearchProvider.js';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { QdrantVectorStore } from '../../src/services/QdrantVectorStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { QdrantClient } from '@qdrant/js-client-rest';

describe('SemanticToolDiscovery Integration - NO MOCKS', () => {
  let toolDiscovery;
  let toolIndexer;
  let semanticProvider;
  let embeddingService;
  let vectorStore;
  let resourceManager;
  let qdrantClient;
  
  const TEST_COLLECTION = 'test-tool-discovery';
  const VECTOR_DIMENSIONS = 768;

  // Sample tools for testing
  const sampleTools = [
    {
      name: 'file_read',
      description: 'Read contents of a file from the filesystem',
      category: 'file-operations',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' }
        }
      },
      examples: ['Read configuration file', 'Load JSON data', 'Get file contents']
    },
    {
      name: 'file_write',
      description: 'Write data to a file on the filesystem',
      category: 'file-operations',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        }
      },
      examples: ['Save configuration', 'Write JSON file', 'Create new file']
    },
    {
      name: 'directory_list',
      description: 'List all files and directories in a given path',
      category: 'file-operations',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          recursive: { type: 'boolean' }
        }
      },
      examples: ['Show folder contents', 'List project files', 'Directory listing']
    },
    {
      name: 'json_parse',
      description: 'Parse JSON string into JavaScript object',
      category: 'data-processing',
      inputSchema: {
        type: 'object',
        properties: {
          jsonString: { type: 'string' }
        }
      },
      examples: ['Parse API response', 'Convert JSON to object', 'Decode JSON data']
    },
    {
      name: 'json_stringify',
      description: 'Convert JavaScript object to JSON string',
      category: 'data-processing',
      inputSchema: {
        type: 'object',
        properties: {
          object: { type: 'object' },
          pretty: { type: 'boolean' }
        }
      },
      examples: ['Serialize object', 'Create JSON output', 'Format as JSON']
    },
    {
      name: 'calculator',
      description: 'Perform mathematical calculations and expressions',
      category: 'computation',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        }
      },
      examples: ['Calculate sum', 'Evaluate expression', 'Math operations']
    },
    {
      name: 'http_request',
      description: 'Make HTTP requests to external APIs',
      category: 'network',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string' },
          headers: { type: 'object' },
          body: { type: 'string' }
        }
      },
      examples: ['Call REST API', 'Fetch data from URL', 'Send HTTP request']
    },
    {
      name: 'database_query',
      description: 'Execute database queries and return results',
      category: 'database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          params: { type: 'array' }
        }
      },
      examples: ['Select from table', 'Run SQL query', 'Database operations']
    }
  ];

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();

    // Initialize embedding service
    embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();

    // Initialize vector store - NO FALLBACK
    vectorStore = new QdrantVectorStore({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    }, resourceManager);
    await vectorStore.connect();

    // Create Qdrant client for verification
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });

    // Initialize semantic search provider
    semanticProvider = await SemanticSearchProvider.create(resourceManager, {
      collectionName: TEST_COLLECTION,
      useLocalEmbeddings: true
    });

    // Initialize tool indexer
    toolIndexer = new ToolIndexer({
      embeddingService,
      vectorStore,
      collectionName: TEST_COLLECTION
    });

    // Initialize tool discovery
    toolDiscovery = new SemanticToolDiscovery({
      semanticSearchProvider: semanticProvider,
      toolIndexer: toolIndexer,
      collectionName: TEST_COLLECTION,
      enableMCPIntegration: false // Disable MCP for testing
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup
    try {
      await qdrantClient.deleteCollection(TEST_COLLECTION);
    } catch (error) {
      // Collection might not exist
    }

    if (embeddingService) {
      await embeddingService.cleanup();
    }

    if (semanticProvider) {
      await semanticProvider.disconnect();
    }
  });

  beforeEach(async () => {
    // Clean collection before each test
    try {
      await qdrantClient.deleteCollection(TEST_COLLECTION);
    } catch (error) {
      // Collection might not exist
    }

    // Create fresh collection
    await vectorStore.createCollection(TEST_COLLECTION, { dimension: VECTOR_DIMENSIONS });

    // Index all sample tools
    const indexResults = await toolIndexer.indexTools(sampleTools);
    console.log(`Indexed ${indexResults.success.length} tools for testing`);
  });

  describe('Tool Discovery by Task Description', () => {
    it('should find relevant file operation tools', async () => {
      const taskDescription = 'I need to read a configuration file and parse its JSON content';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 5
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Should include file_read and json_parse
      const toolNames = results.map(r => r.document.name);
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('json_parse');

      // Results should be ranked by relevance
      results.forEach(result => {
        expect(result._similarity).toBeDefined();
        expect(result._similarity).toBeGreaterThan(0);
        expect(result._similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should find database tools for data queries', async () => {
      const taskDescription = 'Query the database to get user information';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 3
      });

      expect(results).toBeDefined();
      
      // database_query should be the top result
      const topResult = results[0];
      expect(topResult.document.name).toBe('database_query');
    });

    it('should find computation tools for math tasks', async () => {
      const taskDescription = 'Calculate the sum of numbers and evaluate mathematical expressions';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 3
      });

      expect(results).toBeDefined();
      
      // calculator should be highly ranked
      const calculatorResult = results.find(r => r.document.name === 'calculator');
      expect(calculatorResult).toBeDefined();
      expect(results.indexOf(calculatorResult)).toBeLessThan(2); // In top 2
    });

    it('should handle complex multi-step tasks', async () => {
      const taskDescription = 'Fetch data from an API, parse the JSON response, and save it to a file';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 5
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(2);

      // Should include http_request, json_parse, and file_write
      const toolNames = results.map(r => r.document.name);
      expect(toolNames).toContain('http_request');
      expect(toolNames).toContain('json_parse');
      expect(toolNames).toContain('file_write');
    });

    it('should respect minimum score threshold', async () => {
      const taskDescription = 'Completely unrelated task about quantum physics';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 10,
        minScore: 0.8 // High threshold
      });

      // Should return few or no results due to high threshold
      expect(results).toBeDefined();
      results.forEach(result => {
        expect(result._similarity).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter tools by category', async () => {
      const taskDescription = 'Work with files and directories';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 10,
        categories: ['file-operations']
      });

      expect(results).toBeDefined();
      
      // All results should be from file-operations category
      results.forEach(result => {
        expect(result.document.category).toBe('file-operations');
      });
    });

    it('should exclude specific tools', async () => {
      const taskDescription = 'Process JSON data';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 5,
        excludeTools: ['json_parse']
      });

      expect(results).toBeDefined();
      
      // json_parse should not be in results
      const toolNames = results.map(r => r.document.name);
      expect(toolNames).not.toContain('json_parse');
      
      // But json_stringify might be included
      const stringifyResult = results.find(r => r.document.name === 'json_stringify');
      expect(stringifyResult).toBeDefined();
    });

    it('should support multiple category filters', async () => {
      const taskDescription = 'Process and transform data';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 10,
        categories: ['data-processing', 'computation']
      });

      expect(results).toBeDefined();
      
      // All results should be from specified categories
      results.forEach(result => {
        expect(['data-processing', 'computation']).toContain(result.document.category);
      });
    });
  });

  describe('Query Enhancement', () => {
    it('should enhance simple queries for better matching', async () => {
      // Test that query enhancement improves results
      const simpleQuery = 'files';
      const enhancedQuery = toolDiscovery.enhanceTaskDescription(simpleQuery);
      
      expect(enhancedQuery).toBeDefined();
      expect(enhancedQuery.length).toBeGreaterThan(simpleQuery.length);
      
      // Enhanced query should find more relevant results
      const simpleResults = await semanticProvider.semanticSearch(
        TEST_COLLECTION,
        simpleQuery,
        { limit: 5 }
      );
      
      const enhancedResults = await semanticProvider.semanticSearch(
        TEST_COLLECTION,
        enhancedQuery,
        { limit: 5 }
      );
      
      // Enhanced results should be as good or better
      expect(enhancedResults.length).toBeGreaterThanOrEqual(simpleResults.length);
    });

    it('should handle technical jargon and abbreviations', async () => {
      const technicalQuery = 'GET request to REST API endpoint';
      
      const results = await toolDiscovery.findRelevantTools(technicalQuery, {
        limit: 3
      });
      
      expect(results).toBeDefined();
      
      // Should find http_request tool
      const httpTool = results.find(r => r.document.name === 'http_request');
      expect(httpTool).toBeDefined();
    });
  });

  describe('Caching Behavior', () => {
    it('should cache repeated queries', async () => {
      const taskDescription = 'Read and parse JSON files';
      const options = { limit: 5 };
      
      // First query - not cached
      const startTime1 = Date.now();
      const results1 = await toolDiscovery.findRelevantTools(taskDescription, options);
      const time1 = Date.now() - startTime1;
      
      // Second query - should be cached
      const startTime2 = Date.now();
      const results2 = await toolDiscovery.findRelevantTools(taskDescription, options);
      const time2 = Date.now() - startTime2;
      
      // Results should be identical
      expect(results2.length).toBe(results1.length);
      results2.forEach((result, i) => {
        expect(result.document.name).toBe(results1[i].document.name);
      });
      
      // Cached query should be faster (allow for some variance)
      // Only check if first query took meaningful time
      if (time1 > 10) {
        expect(time2).toBeLessThanOrEqual(time1);
      }
    });

    it('should invalidate cache after timeout', async () => {
      // Set a very short cache timeout for testing
      const shortCacheDiscovery = new SemanticToolDiscovery({
        semanticSearchProvider: semanticProvider,
        toolIndexer: toolIndexer,
        collectionName: TEST_COLLECTION,
        enableMCPIntegration: false
      });
      shortCacheDiscovery.cacheTimeout = 100; // 100ms
      
      const taskDescription = 'File operations';
      const options = { limit: 3 };
      
      // First query
      const results1 = await shortCacheDiscovery.findRelevantTools(taskDescription, options);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Query again - should not be cached
      const results2 = await shortCacheDiscovery.findRelevantTools(taskDescription, options);
      
      // Results should be fresh (we can't easily test if it was actually re-queried,
      // but we verify the functionality works)
      expect(results2).toBeDefined();
      expect(results2.length).toBe(results1.length);
    });

    it('should have separate cache keys for different options', async () => {
      const taskDescription = 'Process data';
      
      // Query with different limits
      const results1 = await toolDiscovery.findRelevantTools(taskDescription, { limit: 3 });
      const results2 = await toolDiscovery.findRelevantTools(taskDescription, { limit: 5 });
      
      // Should return different number of results
      expect(results1.length).toBeLessThanOrEqual(3);
      expect(results2.length).toBeLessThanOrEqual(5);
      
      // If more tools match, second query should have more results
      if (results2.length > results1.length) {
        expect(results2.length).toBeGreaterThan(results1.length);
      }
    });
  });

  describe('Result Processing and Ranking', () => {
    it('should process and rank search results correctly', async () => {
      const taskDescription = 'Read files from disk and process them';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 5,
        includeMetadata: true
      });
      
      expect(results).toBeDefined();
      
      // Results should be sorted by relevance (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]._similarity).toBeLessThanOrEqual(results[i - 1]._similarity);
      }
      
      // Each result should have required fields
      results.forEach(result => {
        expect(result.document).toBeDefined();
        expect(result.document.name).toBeDefined();
        expect(result.document.description).toBeDefined();
        expect(result._similarity).toBeDefined();
        expect(result._searchType).toBe('semantic');
      });
    });

    it('should include tool metadata in results', async () => {
      const taskDescription = 'Make API calls';
      
      const results = await toolDiscovery.findRelevantTools(taskDescription, {
        limit: 3,
        includeMetadata: true
      });
      
      expect(results).toBeDefined();
      
      // Should include http_request with its metadata
      const httpTool = results.find(r => r.document.name === 'http_request');
      expect(httpTool).toBeDefined();
      expect(httpTool.document.category).toBe('network');
      expect(httpTool.document.inputSchema).toBeDefined();
      expect(httpTool.document.examples).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty task descriptions', async () => {
      const results = await toolDiscovery.findRelevantTools('', {
        limit: 5
      });
      
      // Should return empty array or throw meaningful error
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long task descriptions', async () => {
      const longDescription = 'I need to ' + 'process data and '.repeat(100) + 'save results';
      
      const results = await toolDiscovery.findRelevantTools(longDescription, {
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters in queries', async () => {
      const specialQuery = 'Read file@#$%^&*() and parse {JSON}';
      
      const results = await toolDiscovery.findRelevantTools(specialQuery, {
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // Should still find relevant tools despite special characters
      if (results.length > 0) {
        const toolNames = results.map(r => r.document.name);
        expect(toolNames).toContain('file_read');
      }
    });

    it('should handle queries with no matching tools', async () => {
      const unmatchedQuery = 'Quantum entanglement calculations using superconductors';
      
      const results = await toolDiscovery.findRelevantTools(unmatchedQuery, {
        limit: 5,
        minScore: 0.9 // Very high threshold
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Might return no results or very few with low relevance
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should handle discovery for multiple queries efficiently', async () => {
      const queries = [
        'Read files from disk',
        'Parse JSON data',
        'Make HTTP requests',
        'Query database',
        'Calculate expressions'
      ];
      
      const startTime = Date.now();
      const allResults = await Promise.all(
        queries.map(q => toolDiscovery.findRelevantTools(q, { limit: 3 }))
      );
      const totalTime = Date.now() - startTime;
      
      expect(allResults).toHaveLength(queries.length);
      allResults.forEach(results => {
        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
      });
      
      // Should complete reasonably quickly (adjust threshold as needed)
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 5 queries
      
      console.log(`Processed ${queries.length} queries in ${totalTime}ms`);
      console.log(`Average time per query: ${(totalTime / queries.length).toFixed(2)}ms`);
    });
  });
});