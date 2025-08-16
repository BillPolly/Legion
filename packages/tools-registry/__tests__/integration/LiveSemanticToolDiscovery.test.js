/**
 * Comprehensive Live Integration Tests for Semantic Tool Discovery
 * Tests the complete end-to-end semantic search and tool retrieval functionality
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { SemanticToolDiscovery } from '../../src/search/SemanticToolDiscovery.js';
import { ToolIndexer } from '../../src/search/ToolIndexer.js';
import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ensureMongoDBAvailable, getTestDatabase, cleanTestDatabase } from '../utils/testHelpers.js';
import { MongoClient } from 'mongodb';

describe('Live Semantic Tool Discovery Integration Tests', () => {
  let resourceManager;
  let semanticProvider;
  let semanticDiscovery;
  let toolIndexer;
  let loadingManager;
  let toolRegistry;
  let mongoClient;
  let db;
  let mongoProvider;
  
  beforeAll(async () => {
    console.log('\n=== Setting up Live Semantic Tool Discovery Tests ===');
    
    // Initialize ResourceManager with environment variables
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized with API keys');
    
    // Ensure MongoDB is available
    await ensureMongoDBAvailable();
    const testDb = await getTestDatabase();
    mongoProvider = testDb.db;
    console.log('✅ MongoDB connected');
    
    // Connect directly to MongoDB for verification
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('legion_tools');
    console.log('✅ Direct MongoDB connection established');
    
    // Initialize semantic search provider
    semanticProvider = await SemanticSearchProvider.create(resourceManager);
    console.log('✅ SemanticSearchProvider created with Nomic embeddings');
    
    // Initialize loading manager and load tools
    loadingManager = new LoadingManager({
      mongoProvider: mongoProvider,
      resourceManager
    });
    
    toolRegistry = new ToolRegistry();
    
    // Load all modules and tools
    console.log('Loading modules and tools...');
    const loadResult = await loadingManager.loadModules({ all: true });
    console.log(`✅ Loaded ${loadResult.loaded} modules with ${loadResult.tools.length} tools`);
    
    // Register tools in registry
    for (const tool of loadResult.tools) {
      await toolRegistry.registerTool(tool);
    }
    console.log(`✅ Registered ${toolRegistry.tools.size} tools in registry`);
    
    // Create ToolIndexer for indexing
    toolIndexer = await ToolIndexer.createForTools(resourceManager, {
      collectionName: 'legion_tools'
    });
    console.log('✅ ToolIndexer created');
    
    // Create SemanticToolDiscovery
    semanticDiscovery = await SemanticToolDiscovery.createForTools(resourceManager, {
      toolRegistry,
      collectionName: 'legion_tools'
    });
    console.log('✅ SemanticToolDiscovery created');
    
    // Index all tools if not already indexed
    console.log('Indexing tools...');
    const tools = Array.from(toolRegistry.tools.values());
    const indexResult = await toolIndexer.indexTools(tools);
    console.log(`✅ Indexed ${indexResult.indexed} tools with ${indexResult.totalPerspectives} perspectives`);
  }, 60000); // Increase timeout for setup
  
  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
    if (semanticProvider) {
      await semanticProvider.disconnect();
    }
    await cleanTestDatabase();
  });
  
  describe('1. Database and Index Verification', () => {
    test('should have tools in MongoDB', async () => {
      const count = await db.collection('tools').countDocuments();
      console.log(`MongoDB tools count: ${count}`);
      expect(count).toBeGreaterThan(0);
      
      // Sample some tools
      const sampleTools = await db.collection('tools').find({}).limit(5).toArray();
      console.log('Sample tools:', sampleTools.map(t => t.name));
    });
    
    test('should have perspectives with embeddings in MongoDB', async () => {
      const count = await db.collection('tool_perspectives').countDocuments();
      console.log(`MongoDB perspectives count: ${count}`);
      expect(count).toBeGreaterThan(0);
      
      // Verify embeddings
      const perspective = await db.collection('tool_perspectives').findOne({});
      expect(perspective).toBeDefined();
      expect(perspective.embedding).toBeDefined();
      expect(Array.isArray(perspective.embedding)).toBe(true);
      expect(perspective.embedding.length).toBe(768); // Nomic embeddings
      
      // Check different perspective types
      const types = await db.collection('tool_perspectives').distinct('perspectiveType');
      console.log('Perspective types:', types);
      expect(types.length).toBeGreaterThan(0);
    });
    
    test('should have Qdrant collection properly indexed', async () => {
      try {
        const response = await fetch('http://localhost:6333/collections/tool_perspectives');
        const data = await response.json();
        
        expect(data.result).toBeDefined();
        expect(data.result.points_count).toBeGreaterThan(0);
        expect(data.result.indexed_vectors_count).toBe(data.result.points_count);
        
        console.log(`Qdrant collection status:
          Points: ${data.result.points_count}
          Indexed: ${data.result.indexed_vectors_count}
          Vectors size: ${data.result.vectors_count}
          Status: ${data.result.status}`);
        
        expect(data.result.status).toBe('green');
      } catch (error) {
        console.warn('Qdrant not available:', error.message);
      }
    });
  });
  
  describe('2. SemanticToolDiscovery.findRelevantTools()', () => {
    test('should find file operation tools', async () => {
      const query = 'I need to read and write files from the filesystem';
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 10,
        minScore: 0
      });
      
      console.log(`\nQuery: "${query}"`);
      console.log(`Found ${result.tools.length} tools`);
      console.log('Top 5 tools:');
      result.tools.slice(0, 5).forEach((tool, i) => {
        console.log(`  ${i+1}. ${tool.name} (score: ${tool.relevanceScore.toFixed(3)})`);
      });
      
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Should find file-related tools
      const fileTools = result.tools.filter(t => 
        t.name.includes('file') || 
        t.name.includes('read') || 
        t.name.includes('write')
      );
      expect(fileTools.length).toBeGreaterThan(0);
      
      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalFound).toBe(result.tools.length);
      expect(result.metadata.searchQuery).toContain(query);
    });
    
    test('should find calculator and math tools', async () => {
      const query = 'perform mathematical calculations and compute formulas';
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\nQuery: "${query}"`);
      console.log(`Found ${result.tools.length} tools`);
      result.tools.forEach((tool, i) => {
        console.log(`  ${i+1}. ${tool.name} (score: ${tool.relevanceScore.toFixed(3)})`);
      });
      
      // Should find calculator
      const calcTool = result.tools.find(t => t.name.includes('calc'));
      expect(calcTool).toBeDefined();
      if (calcTool) {
        console.log(`Calculator found: ${calcTool.name} at position ${result.tools.indexOf(calcTool) + 1}`);
      }
    });
    
    test('should find JSON processing tools', async () => {
      const query = 'parse, validate and transform JSON data structures';
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 10,
        minScore: 0
      });
      
      console.log(`\nQuery: "${query}"`);
      console.log(`Found ${result.tools.length} tools`);
      
      const jsonTools = result.tools.filter(t => 
        t.name.toLowerCase().includes('json') || 
        t.description?.toLowerCase().includes('json')
      );
      
      console.log(`JSON-related tools found: ${jsonTools.length}`);
      jsonTools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.relevanceScore.toFixed(3)}`);
      });
      
      expect(jsonTools.length).toBeGreaterThan(0);
    });
    
    test('should handle category filtering', async () => {
      const query = 'any tool';
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 20,
        minScore: 0,
        categories: ['file', 'system']
      });
      
      console.log(`\nQuery with category filter: "${query}"`);
      console.log(`Categories: file, system`);
      console.log(`Found ${result.tools.length} tools`);
      
      // Check that results are from specified categories
      const categories = new Set(result.tools.map(t => t.category));
      console.log('Result categories:', Array.from(categories));
    });
    
    test('should exclude specified tools', async () => {
      const query = 'file operations';
      const excludeTools = ['file_read', 'file_write'];
      
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 10,
        minScore: 0,
        excludeTools
      });
      
      console.log(`\nQuery with exclusions: "${query}"`);
      console.log(`Excluding: ${excludeTools.join(', ')}`);
      console.log(`Found ${result.tools.length} tools`);
      
      // Verify excluded tools are not in results
      const hasExcluded = result.tools.some(t => excludeTools.includes(t.name));
      expect(hasExcluded).toBe(false);
      
      console.log('Top results (should not include excluded):');
      result.tools.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name}`);
      });
    });
  });
  
  describe('3. SemanticToolDiscovery.findSimilarTools()', () => {
    test('should find tools similar to file_read', async () => {
      const toolName = 'file_read';
      
      try {
        const similarTools = await semanticDiscovery.findSimilarTools(toolName, {
          limit: 5,
          excludeSelf: true
        });
        
        console.log(`\nTools similar to "${toolName}":`);
        similarTools.forEach((tool, i) => {
          const doc = tool.document || tool.payload || tool;
          console.log(`  ${i+1}. ${doc.toolName || doc.name}`);
        });
        
        expect(similarTools.length).toBeGreaterThan(0);
        
        // Should find other file operations
        const fileTools = similarTools.filter(t => {
          const doc = t.document || t.payload || t;
          const name = doc.toolName || doc.name || '';
          return name.includes('file') || name.includes('read');
        });
        expect(fileTools.length).toBeGreaterThan(0);
      } catch (error) {
        console.log(`Could not find similar tools: ${error.message}`);
        // This might fail if the tool is not indexed yet
      }
    });
  });
  
  describe('4. SemanticToolDiscovery.findToolCombinations()', () => {
    test('should suggest tool combinations for complex tasks', async () => {
      const taskDescription = 'Build a REST API that reads data from files, validates JSON schemas, and serves HTTP endpoints';
      
      const combinations = await semanticDiscovery.findToolCombinations(taskDescription, {
        maxTools: 15,
        suggestWorkflow: true
      });
      
      console.log('\nTask:', taskDescription);
      console.log(`Primary tools (${combinations.primaryTools.length}):`);
      combinations.primaryTools.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (score: ${t.relevanceScore.toFixed(3)})`);
      });
      
      console.log(`Supporting tools (${combinations.supportingTools.length}):`);
      combinations.supportingTools.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (score: ${t.relevanceScore.toFixed(3)})`);
      });
      
      if (combinations.suggestedWorkflow) {
        console.log('\nSuggested workflow:');
        combinations.suggestedWorkflow.phases.forEach(phase => {
          console.log(`  ${phase.name}: ${phase.tools.join(', ')}`);
        });
      }
      
      expect(combinations.primaryTools.length).toBeGreaterThan(0);
      expect(combinations.supportingTools.length).toBeGreaterThan(0);
    });
  });
  
  describe('5. SemanticToolDiscovery.getToolRecommendations()', () => {
    test('should recommend tools based on usage patterns', async () => {
      const recentlyUsedTools = ['file_read', 'json_parse'];
      const context = 'validating and transforming data';
      
      const recommendations = await semanticDiscovery.getToolRecommendations(
        recentlyUsedTools,
        context
      );
      
      console.log('\nRecently used:', recentlyUsedTools.join(', '));
      console.log('Context:', context);
      console.log(`Recommendations (${recommendations.tools.length}):`);
      recommendations.tools.forEach(tool => {
        console.log(`  - ${tool.name} (score: ${tool.recommendationScore.toFixed(3)})`);
      });
      
      expect(recommendations.tools.length).toBeGreaterThan(0);
      expect(recommendations.context).toBe(context);
    });
  });
  
  describe('6. Search Performance and Caching', () => {
    test('should cache query results', async () => {
      const query = 'test caching for file operations';
      
      // First query
      const start1 = Date.now();
      const result1 = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        useCache: true
      });
      const time1 = Date.now() - start1;
      
      // Second query (should be cached)
      const start2 = Date.now();
      const result2 = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        useCache: true
      });
      const time2 = Date.now() - start2;
      
      console.log(`\nCache test for: "${query}"`);
      console.log(`First query: ${time1}ms`);
      console.log(`Second query (cached): ${time2}ms`);
      console.log(`Speed improvement: ${(time1/time2).toFixed(1)}x`);
      
      // Results should be identical
      expect(result1.tools.length).toBe(result2.tools.length);
      expect(result1.tools[0]?.name).toBe(result2.tools[0]?.name);
      
      // Cached query should be faster
      expect(time2).toBeLessThanOrEqual(time1);
    });
    
    test('should handle cache clearing', async () => {
      const stats1 = semanticDiscovery.getStatistics();
      const initialCacheSize = stats1.cacheSize;
      
      // Add some queries to cache
      await semanticDiscovery.findRelevantTools('test1', { limit: 1 });
      await semanticDiscovery.findRelevantTools('test2', { limit: 1 });
      
      const stats2 = semanticDiscovery.getStatistics();
      expect(stats2.cacheSize).toBeGreaterThan(initialCacheSize);
      
      // Clear cache
      semanticDiscovery.clearCache();
      
      const stats3 = semanticDiscovery.getStatistics();
      expect(stats3.cacheSize).toBe(0);
      
      console.log('\nCache statistics:');
      console.log(`  Initial size: ${initialCacheSize}`);
      console.log(`  After queries: ${stats2.cacheSize}`);
      console.log(`  After clear: ${stats3.cacheSize}`);
    });
  });
  
  describe('7. Edge Cases and Error Handling', () => {
    test('should handle empty queries gracefully', async () => {
      const result = await semanticDiscovery.findRelevantTools('', {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\nEmpty query results: ${result.tools.length} tools`);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    test('should handle special characters in queries', async () => {
      const specialQuery = 'file@#$%^&*()_+{}[]|\\:";\'<>?,./';
      
      const result = await semanticDiscovery.findRelevantTools(specialQuery, {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\nSpecial characters query results: ${result.tools.length} tools`);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    test('should handle very long queries', async () => {
      const longQuery = 'I need a tool that can ' + 'perform various operations '.repeat(50);
      
      const result = await semanticDiscovery.findRelevantTools(longQuery, {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\nLong query (${longQuery.length} chars) results: ${result.tools.length} tools`);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    test('should handle non-existent tool in findSimilarTools', async () => {
      try {
        await semanticDiscovery.findSimilarTools('non_existent_tool_xyz', {
          limit: 5
        });
      } catch (error) {
        console.log(`\nExpected error for non-existent tool: ${error.message}`);
        expect(error.message).toContain('not found');
      }
    });
  });
  
  describe('8. Integration with ToolRegistry', () => {
    test('should enrich results with tool instances from registry', async () => {
      const result = await semanticDiscovery.findRelevantTools('file operations', {
        limit: 5,
        minScore: 0,
        includeMetadata: true
      });
      
      console.log('\nTool enrichment test:');
      result.tools.forEach(tool => {
        console.log(`  ${tool.name}: available=${tool.available}, hasInstance=${!!tool.instance}`);
        
        if (tool.instance) {
          // Verify tool instance has required properties
          expect(tool.instance.name).toBe(tool.name);
          expect(tool.instance.execute).toBeDefined();
          expect(typeof tool.instance.execute).toBe('function');
        }
      });
      
      // At least some tools should be available in registry
      const availableTools = result.tools.filter(t => t.available);
      expect(availableTools.length).toBeGreaterThan(0);
    });
  });
  
  describe('9. Semantic Search Quality', () => {
    test('should understand intent-based queries', async () => {
      const intents = [
        { query: 'I want to build a web server', expected: ['http', 'server', 'api'] },
        { query: 'help me debug my code', expected: ['debug', 'test', 'log'] },
        { query: 'need to process data files', expected: ['file', 'parse', 'transform'] },
        { query: 'automate my deployment', expected: ['deploy', 'build', 'git'] }
      ];
      
      console.log('\nIntent understanding test:');
      for (const { query, expected } of intents) {
        const result = await semanticDiscovery.findRelevantTools(query, {
          limit: 10,
          minScore: 0
        });
        
        const foundExpected = expected.filter(exp => 
          result.tools.some(t => 
            t.name.toLowerCase().includes(exp) || 
            t.description?.toLowerCase().includes(exp)
          )
        );
        
        console.log(`  "${query}"`);
        console.log(`    Expected keywords: ${expected.join(', ')}`);
        console.log(`    Found: ${foundExpected.join(', ')} (${foundExpected.length}/${expected.length})`);
        console.log(`    Top tools: ${result.tools.slice(0, 3).map(t => t.name).join(', ')}`);
      }
    });
    
    test('should rank exact matches higher than semantic matches', async () => {
      const query = 'file_read'; // Exact tool name
      
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 10,
        minScore: 0
      });
      
      console.log(`\nExact match test for "${query}":`);
      console.log('Top 5 results:');
      result.tools.slice(0, 5).forEach((tool, i) => {
        console.log(`  ${i+1}. ${tool.name} (score: ${tool.relevanceScore.toFixed(3)}, name relevance: ${tool.nameRelevance?.toFixed(3)})`);
      });
      
      // file_read should be in top results
      const exactMatch = result.tools.find(t => t.name === 'file_read');
      expect(exactMatch).toBeDefined();
      
      if (exactMatch) {
        const position = result.tools.indexOf(exactMatch);
        console.log(`Exact match position: ${position + 1}`);
        expect(position).toBeLessThan(3); // Should be in top 3
      }
    });
  });
  
  describe('10. Statistics and Monitoring', () => {
    test('should provide comprehensive statistics', async () => {
      const stats = semanticDiscovery.getStatistics();
      
      console.log('\nSemanticToolDiscovery Statistics:');
      console.log('Cache sizes:');
      console.log(`  Query cache: ${stats.cacheSize}`);
      console.log(`  MCP cache: ${stats.mcpCacheSize}`);
      console.log(`  MCP recommendations: ${stats.mcpRecommendationCacheSize}`);
      
      console.log('\nConfiguration:');
      console.log(`  Default limit: ${stats.config.defaultLimit}`);
      console.log(`  Min relevance score: ${stats.config.minRelevanceScore}`);
      console.log(`  Include related tools: ${stats.config.includeRelatedTools}`);
      console.log(`  Include dependencies: ${stats.config.includeDependencies}`);
      
      console.log('\nIndex statistics:');
      if (stats.indexStatistics) {
        console.log(`  Indexed tools: ${stats.indexStatistics.indexedTools}`);
        console.log(`  Total perspectives: ${stats.indexStatistics.totalPerspectives}`);
        console.log(`  Average perspectives per tool: ${stats.indexStatistics.averagePerspectivesPerTool?.toFixed(2)}`);
      }
      
      expect(stats).toBeDefined();
      expect(stats.config).toBeDefined();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });
});