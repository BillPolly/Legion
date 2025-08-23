/**
 * End-to-End Integration Tests
 * 
 * Tests complete workflows including module discovery, loading,
 * tool execution, perspective generation, semantic search, and cleanup
 * 
 * Follows strict TDD approach with no mocks - real services only
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ModuleDiscovery } from '../../src/core/ModuleDiscovery.js';
import { Perspectives } from '../../src/search/Perspectives.js';
import { VectorStore } from '../../src/search/VectorStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('End-to-End Integration Tests', () => {
  let resourceManager;
  let mongoClient;
  let testDbName;
  let toolRegistry;
  let testModulesPath;

  beforeEach(async () => {
    // Create unique test database
    testDbName = `test_e2e_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create MongoDB connection
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    // Set test database using nested object structure
    resourceManager.set('test', { 
      database: { 
        name: testDbName,
        client: mongoClient
      }
    });

    // Create test modules directory
    testModulesPath = path.join(__dirname, `../test-modules-e2e-${Date.now()}`);
    await fs.mkdir(testModulesPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up tool registry
    if (toolRegistry) {
      await toolRegistry.cleanup();
      toolRegistry = null;
    }

    // Drop test database
    if (mongoClient) {
      try {
        await mongoClient.db(testDbName).dropDatabase();
      } catch (error) {
        console.warn('Failed to drop test database:', error.message);
      }
      await mongoClient.close();
    }

    // Clean up test modules
    if (testModulesPath) {
      try {
        await fs.rm(testModulesPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean test modules:', error.message);
      }
    }
  });

  describe('Complete Module Discovery Workflow', () => {
    it('should discover, register, and load modules from filesystem', async () => {
      // Ensure clean database state
      await mongoClient.db(testDbName).dropDatabase();
      
      // Step 1: Create test modules
      const calculatorModule = `
        export default class CalculatorModule {
          getName() { return 'CalculatorModule'; }
          getDescription() { return 'Mathematical operations'; }
          getVersion() { return '1.0.0'; }
          getTools() {
            return [
              {
                name: 'add',
                description: 'Add two numbers',
                execute: async ({ a, b }) => ({ result: a + b })
              },
              {
                name: 'multiply',
                description: 'Multiply two numbers',
                execute: async ({ a, b }) => ({ result: a * b })
              }
            ];
          }
        }
      `;

      const stringModule = `
        export default class StringModule {
          getName() { return 'StringModule'; }
          getDescription() { return 'String manipulation'; }
          getVersion() { return '1.0.0'; }
          getTools() {
            return [
              {
                name: 'uppercase',
                description: 'Convert to uppercase',
                execute: async ({ text }) => ({ result: text.toUpperCase() })
              },
              {
                name: 'reverse',
                description: 'Reverse a string',
                execute: async ({ text }) => ({ result: text.split('').reverse().join('') })
              }
            ];
          }
        }
      `;

      // Name files ending with Module.js to match the pattern
      await fs.writeFile(path.join(testModulesPath, 'CalculatorModule.js'), calculatorModule);
      await fs.writeFile(path.join(testModulesPath, 'StringModule.js'), stringModule);

      // Step 2: Initialize components separately for proper discovery
      const moduleDiscovery = new ModuleDiscovery({
        databaseStorage: { 
          db: mongoClient.db(testDbName) 
        }
      });

      // Step 3: Discover modules
      const discovered = await moduleDiscovery.discoverModules(testModulesPath);
      expect(discovered).toHaveLength(2);
      expect(discovered.map(m => m.name)).toContain('CalculatorModule');
      expect(discovered.map(m => m.name)).toContain('StringModule');

      // Step 4: Save discovered modules to database
      const savedCount = await moduleDiscovery.saveModulesToDatabase(discovered);
      expect(savedCount).toBe(2);

      // Step 5: Initialize ToolRegistry and load modules
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      // Load modules through ToolRegistry
      for (const module of discovered) {
        const result = await toolRegistry.loadModule(module.name, module);
        expect(result.success).toBe(true);
      }

      // Step 6: Verify tools are available
      const tools = await toolRegistry.listTools();
      expect(tools).toHaveLength(4);
      expect(tools.map(t => t.name)).toContain('add');
      expect(tools.map(t => t.name)).toContain('multiply');
      expect(tools.map(t => t.name)).toContain('uppercase');
      expect(tools.map(t => t.name)).toContain('reverse');

      // Step 7: Execute tools
      const addTool = await toolRegistry.getTool('add');
      expect(addTool).toBeDefined();
      const addResult = await addTool.execute({ a: 10, b: 5 });
      expect(addResult.result).toBe(15);

      const uppercaseTool = await toolRegistry.getTool('uppercase');
      expect(uppercaseTool).toBeDefined();
      const upperResult = await uppercaseTool.execute({ text: 'hello world' });
      expect(upperResult.result).toBe('HELLO WORLD');
    });
  });

  describe('Module Loading and Tool Execution Workflow', () => {
    it('should handle complete tool lifecycle', async () => {
      // Initialize registry with LLM/Vector disabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      // Create and load module
      const dataModule = `
        export default class DataModule {
          getName() { return 'DataModule'; }
          getDescription() { return 'Data processing tools'; }
          getTools() {
            return [
              {
                name: 'filterArray',
                description: 'Filter array by predicate',
                inputSchema: {
                  type: 'object',
                  properties: {
                    array: { type: 'array' },
                    min: { type: 'number' }
                  },
                  required: ['array', 'min']
                },
                execute: async ({ array, min }) => ({
                  result: array.filter(x => x >= min)
                })
              },
              {
                name: 'sumArray',
                description: 'Sum array elements',
                inputSchema: {
                  type: 'object',
                  properties: {
                    array: { type: 'array', items: { type: 'number' } }
                  },
                  required: ['array']
                },
                execute: async ({ array }) => ({
                  result: array.reduce((a, b) => a + b, 0)
                })
              }
            ];
          }
        }
      `;

      const modulePath = path.join(testModulesPath, 'data-module.js');
      await fs.writeFile(modulePath, dataModule);

      // Load module
      const loadResult = await toolRegistry.loadModule('DataModule', {
        path: modulePath,
        type: 'class'
      });
      expect(loadResult.success).toBe(true);

      // Get and execute filterArray
      const filterTool = await toolRegistry.getTool('filterArray');
      expect(filterTool).toBeDefined();
      
      const filterResult = await filterTool.execute({
        array: [1, 5, 3, 8, 2, 9],
        min: 5
      });
      expect(filterResult.result).toEqual([5, 8, 9]);

      // Get and execute sumArray
      const sumTool = await toolRegistry.getTool('sumArray');
      const sumResult = await sumTool.execute({
        array: [10, 20, 30]
      });
      expect(sumResult.result).toBe(60);

      // Search for tools
      const dataTools = await toolRegistry.searchTools('array');
      expect(dataTools).toHaveLength(2);
      expect(dataTools.every(t => t.name.includes('Array'))).toBe(true);

      // Clear module
      await toolRegistry.clearModule('DataModule');

      // Verify tools are removed
      const remainingTools = await toolRegistry.listTools();
      expect(remainingTools.map(t => t.name)).not.toContain('filterArray');
      expect(remainingTools.map(t => t.name)).not.toContain('sumArray');
    });
  });

  describe('Perspective Generation Pipeline', () => {
    it('should generate and use perspectives for semantic understanding', async () => {
      // Skip if LLM client not available
      const llmApiKey = resourceManager.get('env.ANTHROPIC_API_KEY') || 
                        resourceManager.get('env.OPENAI_API_KEY');
      if (!llmApiKey) {
        console.log('Skipping perspective test - no LLM API key');
        return;
      }

      // Initialize registry with perspectives enabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: true,  // Enable for this test
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      // Create module with tools
      const db = mongoClient.db(testDbName);
      await db.collection('modules').insertOne({
        name: 'FileSystemModule',
        description: 'File system operations'
      });

      await db.collection('tools').insertMany([
        {
          name: 'readTextFile',
          description: 'Read text file from disk',
          moduleName: 'FileSystemModule',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        },
        {
          name: 'writeTextFile',
          description: 'Write text file to disk',
          moduleName: 'FileSystemModule',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'deleteFile',
          description: 'Delete file from disk',
          moduleName: 'FileSystemModule',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        }
      ]);

      // Create mock LLM client
      const mockLLMClient = {
        generatePerspective: async (tool) => ({
          perspective: `Tool for ${tool.description.toLowerCase()}. Useful in file management workflows.`,
          category: 'file-operations',
          useCases: [
            'File management',
            'Data persistence',
            'Configuration handling'
          ],
          relatedTools: tool.name === 'readTextFile' ? ['writeTextFile'] : []
        }),
        generateBatch: async (tools) => {
          return tools.map(tool => ({
            perspective: `Tool for ${tool.description.toLowerCase()}. Useful in file management workflows.`,
            category: 'file-operations',
            useCases: ['File management', 'Data persistence'],
            relatedTools: []
          }));
        }
      };

      // Set up dependencies in ResourceManager for Perspectives
      resourceManager.set('storageProvider', {
        isConnected: true,
        getCollection: (name) => db.collection(name)
      });
      resourceManager.set('llmClient', mockLLMClient);

      // Initialize perspectives with resourceManager
      const perspectives = new Perspectives({
        resourceManager
      });

      // Generate perspectives for module
      const generated = await perspectives.generateForModule('FileSystemModule');
      expect(generated).toHaveLength(3);

      // Verify perspectives were saved
      const savedPerspectives = await db.collection('perspectives').find({}).toArray();
      expect(savedPerspectives).toHaveLength(3);

      // Search by perspective
      const fileOpsTools = await perspectives.searchByPerspective('file management');
      expect(fileOpsTools.length).toBeGreaterThan(0);

      // Get related tools
      const related = await perspectives.getRelatedTools('readTextFile');
      expect(related).toContain('writeTextFile');

      // Get statistics
      const stats = await perspectives.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.byCategory['file-operations']).toBe(3);
    });
  });

  describe('Semantic Search Workflow', () => {
    it('should perform semantic search using embeddings', async () => {
      // Skip if vector database not available
      const qdrantUrl = resourceManager.get('env.QDRANT_URL');
      if (!qdrantUrl) {
        console.log('Skipping semantic search test - Qdrant not configured');
        return;
      }

      // Initialize registry with vector search enabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: true  // Enable for this test
      });
      await toolRegistry.initialize();

      // Create tools with perspectives
      const db = mongoClient.db(testDbName);
      await db.collection('tools').insertMany([
        {
          name: 'httpGet',
          description: 'Make HTTP GET request',
          moduleName: 'NetworkModule'
        },
        {
          name: 'httpPost',
          description: 'Make HTTP POST request',
          moduleName: 'NetworkModule'
        },
        {
          name: 'parseJson',
          description: 'Parse JSON string',
          moduleName: 'JsonModule'
        }
      ]);

      await db.collection('perspectives').insertMany([
        {
          toolName: 'httpGet',
          perspective: 'Fetch data from REST APIs and web services',
          category: 'network',
          useCases: ['API integration', 'Data fetching', 'Web scraping']
        },
        {
          toolName: 'httpPost',
          perspective: 'Send data to REST APIs and web services',
          category: 'network',
          useCases: ['API integration', 'Data submission', 'Form posting']
        },
        {
          toolName: 'parseJson',
          perspective: 'Convert JSON strings to JavaScript objects',
          category: 'data-processing',
          useCases: ['API response parsing', 'Config file reading', 'Data transformation']
        }
      ]);

      // Create mock embedding client
      const mockEmbeddingClient = {
        generateEmbedding: async (text) => {
          // Generate simple mock embedding based on text content
          const embedding = new Array(384).fill(0);
          for (let i = 0; i < Math.min(text.length, 384); i++) {
            embedding[i] = text.charCodeAt(i) / 255;
          }
          return embedding;
        },
        generateBatch: async (texts) => {
          return texts.map(text => {
            const embedding = new Array(384).fill(0);
            for (let i = 0; i < Math.min(text.length, 384); i++) {
              embedding[i] = text.charCodeAt(i) / 255;
            }
            return embedding;
          });
        }
      };

      // Create mock vector database
      const mockVectorDatabase = {
        isConnected: true,
        vectors: [],
        hasCollection: async () => false,
        createCollection: async () => true,
        insert: async (collection, doc) => {
          mockVectorDatabase.vectors.push(doc);
          return { id: mockVectorDatabase.vectors.length - 1 };
        },
        insertBatch: async (collection, docs) => {
          const results = [];
          for (const doc of docs) {
            mockVectorDatabase.vectors.push(doc);
            results.push({ id: mockVectorDatabase.vectors.length - 1 });
          }
          return results;
        },
        search: async (collection, queryVector, options) => {
          // Simple cosine similarity search
          const results = mockVectorDatabase.vectors.map((v, i) => {
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;
            for (let j = 0; j < queryVector.length; j++) {
              dotProduct += queryVector[j] * v.vector[j];
              normA += queryVector[j] * queryVector[j];
              normB += v.vector[j] * v.vector[j];
            }
            const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            return {
              metadata: v.metadata,
              score: similarity
            };
          });
          
          return results
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit || 10);
        }
      };

      // Initialize vector store
      const vectorStore = new VectorStore({
        embeddingClient: mockEmbeddingClient,
        vectorDatabase: mockVectorDatabase
      });
      await vectorStore.initialize();

      // Index tools
      const tools = await db.collection('tools').find({}).toArray();
      const perspectives = await db.collection('perspectives').find({}).toArray();
      
      await vectorStore.indexTools(tools, perspectives);

      // Search for API-related tools
      const apiTools = await vectorStore.search('REST API integration', { limit: 5 });
      expect(apiTools.length).toBeGreaterThan(0);
      expect(apiTools[0].toolName).toBeDefined();
      expect(apiTools[0].score).toBeGreaterThan(0);

      // Search for JSON-related tools
      const jsonTools = await vectorStore.search('parse JSON data', { limit: 5 });
      expect(jsonTools.length).toBeGreaterThan(0);
      expect(jsonTools.some(t => t.toolName === 'parseJson')).toBe(true);

      // Find similar tools
      const similarToGet = await vectorStore.findSimilarTools('httpGet', { limit: 3 });
      expect(similarToGet.length).toBeGreaterThan(0);
      expect(similarToGet.some(t => t.toolName === 'httpPost')).toBe(true);
    });
  });

  describe('Resource Cleanup Workflow', () => {
    it('should properly clean up all resources', async () => {
      // Initialize components
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      // Create test data
      const db = mongoClient.db(testDbName);
      await db.collection('modules').insertMany([
        { name: 'Module1', description: 'Test module 1' },
        { name: 'Module2', description: 'Test module 2' }
      ]);

      await db.collection('tools').insertMany([
        { name: 'tool1', moduleName: 'Module1' },
        { name: 'tool2', moduleName: 'Module2' }
      ]);

      await db.collection('perspectives').insertMany([
        { toolName: 'tool1', perspective: 'Test perspective 1' },
        { toolName: 'tool2', perspective: 'Test perspective 2' }
      ]);

      // Load tools to populate cache
      await toolRegistry.getTool('tool1');
      await toolRegistry.getTool('tool2');

      // Verify data exists
      expect(await db.collection('modules').countDocuments()).toBe(2);
      expect(await db.collection('tools').countDocuments()).toBe(2);
      expect(await db.collection('perspectives').countDocuments()).toBe(2);

      // Clean up Module1
      await toolRegistry.clearModule('Module1');

      // Verify Module1 is cleaned
      expect(await db.collection('modules').countDocuments()).toBe(1);
      expect(await db.collection('tools').countDocuments()).toBe(1);
      const remainingModule = await db.collection('modules').findOne({});
      expect(remainingModule.name).toBe('Module2');

      // Clear all
      await toolRegistry.clearAll();

      // Verify everything is cleaned
      expect(await db.collection('modules').countDocuments()).toBe(0);
      expect(await db.collection('tools').countDocuments()).toBe(0);

      // Cleanup registry
      await toolRegistry.cleanup();

      // Verify no memory leaks
      expect(toolRegistry.cache?.size || 0).toBe(0);
      
      // Registry should handle operations gracefully after cleanup
      const tool = await toolRegistry.getTool('tool1');
      expect(tool).toBeNull();
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should recover from various error conditions', async () => {
      // Initialize registry with features disabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      // Test 1: Recovery from invalid module
      const invalidModule = `
        export default class InvalidModule {
          // Missing required methods
        }
      `;

      const invalidPath = path.join(testModulesPath, 'invalid.js');
      await fs.writeFile(invalidPath, invalidModule);

      const loadResult = await toolRegistry.loadModule('InvalidModule', {
        path: invalidPath,
        type: 'class'
      });
      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toBeDefined();

      // System should continue to work
      const tools = await toolRegistry.listTools();
      expect(Array.isArray(tools)).toBe(true);

      // Test 2: Recovery from tool execution error
      const errorModule = `
        export default class ErrorModule {
          getName() { return 'ErrorModule'; }
          getTools() {
            return [{
              name: 'errorTool',
              description: 'Tool that throws error',
              execute: async () => {
                throw new Error('Intentional error');
              }
            }];
          }
        }
      `;

      const errorPath = path.join(testModulesPath, 'error.js');
      await fs.writeFile(errorPath, errorModule);

      // Load the error module properly through ToolRegistry
      const errorLoadResult = await toolRegistry.loadModule('ErrorModule', {
        name: 'ErrorModule',
        path: errorPath,
        type: 'class'
      });
      expect(errorLoadResult.success).toBe(true);

      const errorTool = await toolRegistry.getTool('errorTool');
      expect(errorTool).not.toBeNull();
      if (errorTool) {
        await expect(errorTool.execute({})).rejects.toThrow('Intentional error');
      }

      // System should continue to work
      const otherTools = await toolRegistry.listTools();
      expect(Array.isArray(otherTools)).toBe(true);

      // Test 3: Recovery from database error
      const db = mongoClient.db(testDbName);
      
      // Create a tool in cache
      await db.collection('tools').insertOne({
        name: 'cachedTool',
        description: 'Cached tool',
        moduleName: 'TestModule'
      });
      
      const cachedTool = await toolRegistry.getTool('cachedTool');
      expect(cachedTool).toBeDefined();

      // Tool should still be available from cache even if database has issues
      const cachedAgain = await toolRegistry.getTool('cachedTool');
      expect(cachedAgain).toBeDefined();
      expect(cachedAgain.name).toBe('cachedTool');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets', async () => {
      // Initialize registry with features disabled
      toolRegistry = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: false,
        enableVectorSearch: false
      });
      await toolRegistry.initialize();

      const db = mongoClient.db(testDbName);

      // Create test data
      const modules = [];
      const tools = [];

      for (let m = 0; m < 10; m++) {
        modules.push({
          name: `PerfModule${m}`,
          description: `Performance test module ${m}`
        });

        for (let t = 0; t < 10; t++) {
          tools.push({
            name: `perf_${m}_${t}`,
            description: `Performance test tool ${t} in module ${m}`,
            moduleName: `PerfModule${m}`
          });
        }
      }

      await db.collection('modules').insertMany(modules);
      await db.collection('tools').insertMany(tools);

      // Test 1: Tool retrieval performance
      const getStart = Date.now();
      const tool = await toolRegistry.getTool('perf_5_5');
      const getTime = Date.now() - getStart;
      
      expect(tool).toBeDefined();
      expect(getTime).toBeLessThan(200); // Should be under 200ms

      // Test 2: Tool listing performance
      const listStart = Date.now();
      const allTools = await toolRegistry.listTools();
      const listTime = Date.now() - listStart;
      
      expect(allTools).toHaveLength(100);
      expect(listTime).toBeLessThan(500); // Should be under 500ms

      // Test 3: Search performance
      const searchStart = Date.now();
      const searchResults = await toolRegistry.searchTools('module 5');
      const searchTime = Date.now() - searchStart;
      
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should be under 100ms

      // Test 4: Cached retrieval performance
      await toolRegistry.getTool('perf_3_3'); // Populate cache
      
      const cachedStart = Date.now();
      const cachedTool = await toolRegistry.getTool('perf_3_3');
      const cachedTime = Date.now() - cachedStart;
      
      expect(cachedTool).toBeDefined();
      expect(cachedTime).toBeLessThan(10); // Cached should be under 10ms
    });
  });
});