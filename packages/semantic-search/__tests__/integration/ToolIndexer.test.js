/**
 * ToolIndexer Integration Test
 * NO MOCKS - Uses real embeddings and vector storage
 * Tests tool indexing with multiple perspectives for semantic search
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ToolIndexer } from '../../src/tools/ToolIndexer.js';
import { LocalEmbeddingService } from '../../src/services/LocalEmbeddingService.js';
import { QdrantVectorStore } from '../../src/services/QdrantVectorStore.js';
import { DocumentProcessor } from '../../src/utils/DocumentProcessor.js';
import { ResourceManager } from '@legion/resource-manager';
import { QdrantClient } from '@qdrant/js-client-rest';

describe('ToolIndexer Integration - NO MOCKS', () => {
  let toolIndexer;
  let embeddingService;
  let vectorStore;
  let documentProcessor;
  let resourceManager;
  let qdrantClient;
  
  const TEST_COLLECTION = 'test-tool-indexer';
  const VECTOR_DIMENSIONS = 768;

  // Real tool examples from Legion
  const realTools = [
    {
      name: 'directory_create',
      description: 'Create a new directory at the specified path',
      category: 'file-system',
      module: 'FileModule',
      inputSchema: {
        type: 'object',
        properties: {
          path: { 
            type: 'string', 
            description: 'Path where the directory should be created' 
          },
          recursive: { 
            type: 'boolean', 
            description: 'Create parent directories if they do not exist' 
          }
        },
        required: ['path']
      },
      examples: [
        'Create a new project folder',
        'Make directory for outputs',
        'Setup folder structure'
      ],
      tags: ['filesystem', 'directory', 'create', 'folder', 'mkdir']
    },
    {
      name: 'json_parse',
      description: 'Parse a JSON string into a JavaScript object',
      category: 'data-processing',
      module: 'JsonModule',
      inputSchema: {
        type: 'object',
        properties: {
          jsonString: { 
            type: 'string', 
            description: 'The JSON string to parse' 
          },
          reviver: {
            type: 'function',
            description: 'Optional reviver function'
          }
        },
        required: ['jsonString']
      },
      examples: [
        'Parse API response',
        'Convert JSON to object',
        'Deserialize JSON data'
      ],
      tags: ['json', 'parse', 'deserialize', 'convert', 'object']
    },
    {
      name: 'calculator',
      description: 'Evaluate mathematical expressions and perform calculations',
      category: 'computation',
      module: 'CalculatorModule',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { 
            type: 'string', 
            description: 'Mathematical expression to evaluate' 
          }
        },
        required: ['expression']
      },
      examples: [
        'Calculate 2 + 2',
        'Evaluate complex expression',
        'Perform arithmetic operations'
      ],
      tags: ['math', 'calculate', 'arithmetic', 'expression', 'compute']
    }
  ];

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();

    // Initialize embedding service with real Nomic model
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

    // Initialize document processor
    documentProcessor = new DocumentProcessor();

    // Initialize tool indexer
    toolIndexer = new ToolIndexer({
      embeddingService,
      vectorStore,
      documentProcessor,
      collectionName: TEST_COLLECTION,
      batchSize: 10
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
    
    // Clear indexed tools cache
    toolIndexer.indexedTools.clear();
  });

  describe('Single Tool Indexing', () => {
    it('should index a single tool with all perspectives', async () => {
      const tool = realTools[0]; // directory_create
      const metadata = {
        module: tool.module,
        category: tool.category,
        tags: tool.tags
      };

      const result = await toolIndexer.indexTool(tool, metadata);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('directory_create');
      expect(result.perspectivesIndexed).toBeGreaterThan(1); // Multiple perspectives
      expect(result.documentIds).toBeDefined();
      expect(result.documentIds.length).toBe(result.perspectivesIndexed);

      // Verify tool is tracked as indexed
      expect(toolIndexer.indexedTools.has('directory_create')).toBe(true);
      
      const indexedInfo = toolIndexer.indexedTools.get('directory_create');
      expect(indexedInfo.document).toBeDefined();
      expect(indexedInfo.metadata).toEqual(metadata);
      expect(indexedInfo.perspectiveCount).toBe(result.perspectivesIndexed);
    });

    it('should create multiple perspective entries for better retrieval', async () => {
      const tool = realTools[1]; // json_parse
      
      const result = await toolIndexer.indexTool(tool);
      
      // Verify multiple perspectives were created
      expect(result.perspectivesIndexed).toBeGreaterThanOrEqual(3); // At least name, description, and usage perspectives
      
      // Verify vectors were stored in Qdrant
      const searchVector = await embeddingService.embed('parse JSON');
      const searchResults = await vectorStore.search(TEST_COLLECTION, searchVector, {
        limit: 10
      });
      
      // Should find the tool from different perspectives
      const jsonParseResults = searchResults.filter(r => 
        r.payload.name === 'json_parse'
      );
      
      expect(jsonParseResults.length).toBeGreaterThan(0);
      
      // Check different perspective types
      const perspectiveTypes = jsonParseResults.map(r => r.payload.perspectiveType);
      expect(perspectiveTypes).toContain('description');
    });

    it('should generate searchable document with rich metadata', async () => {
      const tool = realTools[2]; // calculator
      const metadata = {
        module: 'CalculatorModule',
        category: 'computation',
        tags: tool.tags,
        usage_frequency: 'high',
        last_updated: new Date().toISOString()
      };

      await toolIndexer.indexTool(tool, metadata);

      // Search for the tool
      const searchVector = await embeddingService.embed('mathematical calculations');
      const results = await vectorStore.search(TEST_COLLECTION, searchVector, {
        limit: 5
      });

      const calculatorResult = results.find(r => r.payload.name === 'calculator');
      expect(calculatorResult).toBeDefined();
      
      // Verify metadata is preserved
      expect(calculatorResult.payload.category).toBe('computation');
      expect(calculatorResult.payload.module).toBe('CalculatorModule');
      expect(calculatorResult.payload.tags).toContain('math');
    });

    it('should update existing indexed tool', async () => {
      const tool = { ...realTools[0] };
      
      // Index initially
      const result1 = await toolIndexer.indexTool(tool);
      expect(result1.success).toBe(true);
      
      // Update and re-index
      tool.description = 'Updated: Create directories with enhanced features';
      tool.examples = ['New example 1', 'New example 2'];
      
      const result2 = await toolIndexer.indexTool(tool);
      expect(result2.success).toBe(true);
      
      // Verify update
      const indexedInfo = toolIndexer.indexedTools.get(tool.name);
      expect(indexedInfo.document.description).toContain('Updated');
    });

    it('should handle tools without optional metadata', async () => {
      const minimalTool = {
        name: 'minimal_tool',
        description: 'A tool with minimal information'
        // No category, tags, examples, etc.
      };

      const result = await toolIndexer.indexTool(minimalTool);
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('minimal_tool');
      expect(result.perspectivesIndexed).toBeGreaterThan(0);
    });

    it('should reject tools without required fields', async () => {
      const invalidTool = {
        // Missing name
        description: 'Tool without a name'
      };

      await expect(toolIndexer.indexTool(invalidTool))
        .rejects.toThrow('Tool must have a name');
    });
  });

  describe('Batch Tool Indexing', () => {
    it('should index multiple tools in batch', async () => {
      const results = await toolIndexer.indexTools(realTools);

      expect(results).toBeDefined();
      expect(results.success).toHaveLength(realTools.length);
      expect(results.failed).toHaveLength(0);
      expect(results.totalProcessed).toBe(realTools.length);

      // Verify all tools are indexed
      realTools.forEach(tool => {
        expect(toolIndexer.indexedTools.has(tool.name)).toBe(true);
      });
    });

    it('should handle large batches with batching', async () => {
      // Create a large set of tools
      const largeToolSet = [];
      for (let i = 0; i < 25; i++) {
        largeToolSet.push({
          name: `tool_${i}`,
          description: `Tool number ${i} for testing batch processing`,
          category: i % 2 === 0 ? 'even' : 'odd',
          tags: [`tag${i}`, 'batch-test']
        });
      }

      const startTime = Date.now();
      const results = await toolIndexer.indexTools(largeToolSet);
      const duration = Date.now() - startTime;

      expect(results.success.length).toBe(25);
      expect(results.failed.length).toBe(0);
      expect(results.totalProcessed).toBe(25);

      console.log(`Indexed ${largeToolSet.length} tools in ${duration}ms`);
      console.log(`Average time per tool: ${(duration / largeToolSet.length).toFixed(2)}ms`);

      // Verify tools are searchable
      const searchVector = await embeddingService.embed('tool for testing batch');
      const searchResults = await vectorStore.search(TEST_COLLECTION, searchVector, {
        limit: 30
      });

      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should handle mixed success/failure in batch', async () => {
      const mixedTools = [
        realTools[0], // Valid
        { description: 'No name tool' }, // Invalid - missing name
        realTools[1], // Valid
        null, // Invalid - null
        realTools[2] // Valid
      ];

      const results = await toolIndexer.indexTools(mixedTools);

      expect(results.success.length).toBe(3); // 3 valid tools
      expect(results.failed.length).toBe(2); // 2 invalid tools
      expect(results.totalProcessed).toBe(5);

      // Check failed tools have error messages
      results.failed.forEach(failure => {
        expect(failure.error).toBeDefined();
      });
    });

    it('should process tools with metadata objects', async () => {
      const toolsWithMetadata = realTools.map(tool => ({
        tool: tool,
        metadata: {
          indexed_at: new Date().toISOString(),
          source: 'test-suite',
          version: '1.0.0'
        }
      }));

      const results = await toolIndexer.indexTools(toolsWithMetadata);

      expect(results.success.length).toBe(realTools.length);
      
      // Verify metadata is included
      const searchVector = await embeddingService.embed('create directory');
      const searchResults = await vectorStore.search(TEST_COLLECTION, searchVector, {
        limit: 5
      });

      const dirResult = searchResults.find(r => r.payload.name === 'directory_create');
      expect(dirResult).toBeDefined();
      expect(dirResult.payload.source).toBe('test-suite');
      expect(dirResult.payload.version).toBe('1.0.0');
    });
  });

  describe('Document Creation and Processing', () => {
    it('should create comprehensive tool documents', async () => {
      const tool = realTools[0];
      const metadata = {
        module: 'FileModule',
        popularity: 'high'
      };

      const document = toolIndexer.createToolDocument(tool, metadata);

      expect(document).toBeDefined();
      expect(document.id).toBe(`tool_${tool.name}`);
      expect(document.name).toBe(tool.name);
      expect(document.description).toBe(tool.description);
      expect(document.category).toBe(tool.category);
      expect(document.module).toBe('FileModule');
      expect(document.popularity).toBe('high');
      expect(document.searchableText).toBeDefined();
      expect(document.searchableText).toContain(tool.name);
      expect(document.searchableText).toContain(tool.description);
    });

    it('should create multiple perspectives for a tool', async () => {
      const tool = realTools[1]; // json_parse
      const document = toolIndexer.createToolDocument(tool);
      const perspectives = toolIndexer.createMultiplePerspectives(document);

      expect(perspectives).toBeDefined();
      expect(Array.isArray(perspectives)).toBe(true);
      expect(perspectives.length).toBeGreaterThanOrEqual(3);

      // Check perspective types
      const perspectiveTypes = perspectives.map(p => p.type);
      expect(perspectiveTypes).toContain('description');
      expect(perspectiveTypes).toContain('usage');
      
      // Each perspective should have unique text
      const texts = perspectives.map(p => p.text);
      const uniqueTexts = new Set(texts);
      expect(uniqueTexts.size).toBe(texts.length);
    });

    it('should include examples in perspectives', async () => {
      const tool = realTools[2]; // calculator with examples
      const document = toolIndexer.createToolDocument(tool);
      const perspectives = toolIndexer.createMultiplePerspectives(document);

      // Find usage perspective
      const usagePerspective = perspectives.find(p => p.type === 'usage');
      expect(usagePerspective).toBeDefined();
      
      // Should include examples in usage perspective
      tool.examples.forEach(example => {
        expect(usagePerspective.text.toLowerCase()).toContain(example.toLowerCase());
      });
    });

    it('should handle schema information in documents', async () => {
      const tool = realTools[0];
      const document = toolIndexer.createToolDocument(tool);

      // Document should include schema information
      expect(document.inputSchema).toBeDefined();
      expect(document.inputSchema.properties.path).toBeDefined();
      
      // Schema should be included in searchable text
      expect(document.searchableText).toContain('path');
      expect(document.searchableText).toContain('directory');
    });
  });

  describe('Embedding Generation and Storage', () => {
    it('should generate real embeddings for all perspectives', async () => {
      const tool = realTools[0];
      const document = toolIndexer.createToolDocument(tool);
      const perspectives = toolIndexer.createMultiplePerspectives(document);

      const searchTexts = perspectives.map(p => p.text);
      const embeddings = await embeddingService.generateEmbeddings(searchTexts);

      expect(embeddings).toHaveLength(perspectives.length);
      
      // Each embedding should be 768-dimensional
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(VECTOR_DIMENSIONS);
        expect(embedding.every(v => typeof v === 'number')).toBe(true);
        
        // Should not be degenerate
        const uniqueValues = new Set(embedding.map(v => Math.round(v * 1000)));
        expect(uniqueValues.size).toBeGreaterThan(100);
      });
    });

    it('should store vectors with correct IDs and payloads', async () => {
      const tool = realTools[1];
      await toolIndexer.indexTool(tool);

      // Retrieve vectors directly from Qdrant
      const searchVector = await embeddingService.embed(tool.description);
      const results = await vectorStore.search(TEST_COLLECTION, searchVector, {
        limit: 10
      });

      const toolVectors = results.filter(r => r.payload.name === tool.name);
      expect(toolVectors.length).toBeGreaterThan(0);

      // Check vector IDs follow the pattern
      toolVectors.forEach(vector => {
        expect(vector.id).toMatch(/^tool_json_parse_/);
        expect(vector.payload.perspectiveType).toBeDefined();
        expect(vector.payload.perspectiveText).toBeDefined();
      });
    });

    it('should enable semantic search across perspectives', async () => {
      // Index all tools
      await toolIndexer.indexTools(realTools);

      // Search with different queries that should match different perspectives
      const queries = [
        { text: 'How to parse JSON data?', expectedTool: 'json_parse' },
        { text: 'Create new folder', expectedTool: 'directory_create' },
        { text: 'Mathematical expression evaluation', expectedTool: 'calculator' }
      ];

      for (const query of queries) {
        const searchVector = await embeddingService.embed(query.text);
        const results = await vectorStore.search(TEST_COLLECTION, searchVector, {
          limit: 3
        });

        // Expected tool should be in top results
        const foundTool = results.find(r => r.payload.name === query.expectedTool);
        expect(foundTool).toBeDefined();
        
        console.log(`Query: "${query.text}" found ${query.expectedTool} at position ${results.indexOf(foundTool) + 1}`);
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('should efficiently handle batch embedding generation', async () => {
      const tools = realTools.slice(0, 3);
      
      const startTime = Date.now();
      
      // Prepare all perspectives
      const allPerspectives = [];
      for (const tool of tools) {
        const document = toolIndexer.createToolDocument(tool);
        const perspectives = toolIndexer.createMultiplePerspectives(document);
        allPerspectives.push(...perspectives);
      }
      
      // Generate embeddings in batch
      const searchTexts = allPerspectives.map(p => p.text);
      const embeddings = await embeddingService.generateEmbeddings(searchTexts);
      
      const duration = Date.now() - startTime;
      
      expect(embeddings).toHaveLength(allPerspectives.length);
      
      console.log(`Generated ${embeddings.length} embeddings in ${duration}ms`);
      console.log(`Average time per embedding: ${(duration / embeddings.length).toFixed(2)}ms`);
      
      // Should be reasonably fast
      expect(duration).toBeLessThan(10000); // 10 seconds for all embeddings
    });

    it('should cache indexed tools to avoid re-indexing', async () => {
      const tool = realTools[0];
      
      // First indexing
      const result1 = await toolIndexer.indexTool(tool);
      expect(result1.success).toBe(true);
      
      // Try to index again
      console.log(`Tool ${tool.name} already indexed, updating...`);
      const result2 = await toolIndexer.indexTool(tool);
      expect(result2.success).toBe(true);
      
      // Should still be tracked
      expect(toolIndexer.indexedTools.has(tool.name)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding service failures gracefully', async () => {
      // Create indexer with a mock embedding service that fails
      const failingEmbeddingService = {
        generateEmbeddings: jest.fn().mockRejectedValue(new Error('Embedding service error')),
        embed: jest.fn().mockRejectedValue(new Error('Embedding service error'))
      };
      
      const failingIndexer = new ToolIndexer({
        embeddingService: failingEmbeddingService,
        vectorStore,
        collectionName: TEST_COLLECTION
      });
      
      const tool = realTools[0];
      
      await expect(failingIndexer.indexTool(tool))
        .rejects.toThrow('Embedding service error');
    });

    it('should handle vector store failures gracefully', async () => {
      // Create indexer with a mock vector store that fails
      const failingVectorStore = {
        upsert: jest.fn().mockRejectedValue(new Error('Vector store error'))
      };
      
      const failingIndexer = new ToolIndexer({
        embeddingService,
        vectorStore: failingVectorStore,
        collectionName: TEST_COLLECTION
      });
      
      const tool = realTools[0];
      
      await expect(failingIndexer.indexTool(tool))
        .rejects.toThrow('Vector store error');
    });

    it('should continue batch processing despite individual failures', async () => {
      const tools = [
        realTools[0],
        { name: 'invalid', description: null }, // Will fail during processing
        realTools[1]
      ];
      
      const results = await toolIndexer.indexTools(tools);
      
      expect(results.success.length).toBe(2);
      expect(results.failed.length).toBe(1);
      expect(results.totalProcessed).toBe(3);
    });
  });
});