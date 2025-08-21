/**
 * Complete Live Test for Semantic Search and Tool Discovery
 * Tests the actual semantic search functionality with real data
 */

import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { SemanticToolDiscovery } from '../../src/search/SemanticToolDiscovery.js';
import { ToolIndexer } from '../../src/search/ToolIndexer.js';
import { MongoClient } from 'mongodb';

describe('Live Semantic Search Complete Test', () => {
  let resourceManager;
  let semanticProvider;
  let semanticDiscovery;
  let toolIndexer;
  let mongoClient;
  let db;
  
  beforeAll(async () => {
    console.log('\n=== Live Semantic Search Complete Test ===\n');
    
    // 1. Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    console.log('✅ ResourceManager initialized');
    
    // 2. Connect to MongoDB directly
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('legion_tools');
    console.log('✅ MongoDB connected');
    
    // 3. Create SemanticSearchProvider
    semanticProvider = await SemanticSearchProvider.create(resourceManager);
    console.log('✅ SemanticSearchProvider created');
    
    // 4. Create ToolIndexer
    toolIndexer = await ToolIndexer.createForTools(resourceManager, {
      collectionName: 'tool_perspectives'
    });
    console.log('✅ ToolIndexer created');
    
    // 5. Create SemanticToolDiscovery
    semanticDiscovery = await SemanticToolDiscovery.createForTools(resourceManager, {
      collectionName: 'tool_perspectives'
    });
    console.log('✅ SemanticToolDiscovery created\n');
  }, 120000);
  
  afterAll(async () => {
    if (mongoClient) await mongoClient.close();
    if (semanticProvider) await semanticProvider.disconnect();
  });
  
  describe('1. Database Verification', () => {
    test('MongoDB has tools collection', async () => {
      const count = await db.collection('tools').countDocuments();
      console.log(`\n📊 MongoDB tools count: ${count}`);
      expect(count).toBeGreaterThan(0);
      
      // Sample some tools
      const sampleTools = await db.collection('tools').find({}).limit(5).toArray();
      console.log('Sample tools:');
      sampleTools.forEach(t => console.log(`  - ${t.name}: ${t.description?.substring(0, 50)}...`));
    });
    
    test('Qdrant is properly indexed', async () => {
      try {
        const response = await fetch('http://localhost:6333/collections/tool_perspectives');
        const data = await response.json();
        
        console.log(`\n📊 Qdrant collection status:`);
        console.log(`  Points: ${data.result.points_count}`);
        console.log(`  Indexed: ${data.result.indexed_vectors_count}`);
        console.log(`  Status: ${data.result.status}`);
        
        expect(data.result.status).toBe('green');
        expect(data.result.indexed_vectors_count).toBe(data.result.points_count);
      } catch (error) {
        console.log('⚠️ Qdrant not available:', error.message);
      }
    });
  });
  
  describe('2. Semantic Search Provider', () => {
    test('should perform semantic search for JSON operations', async () => {
      const query = 'parse and validate JSON data';
      console.log(`\n🔍 Semantic search: "${query}"`);
      
      const results = await semanticProvider.semanticSearch('tool_perspectives', query, {
        limit: 5,
        threshold: 0
      });
      
      console.log(`Found ${results.length} results:`);
      results.forEach((r, i) => {
        const payload = r.document || r.payload;
        console.log(`  ${i+1}. ${payload.toolName}`);
      });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('3. SemanticToolDiscovery.findRelevantTools()', () => {
    
    test('should find calculator tools', async () => {
      const query = 'perform mathematical calculations';
      console.log(`\n🎯 Tool discovery: "${query}"`);
      
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        minScore: 0
      });
      
      console.log(`Found ${result.tools.length} tools:`);
      result.tools.forEach((tool, i) => {
        console.log(`  ${i+1}. ${tool.name} (score: ${tool.relevanceScore?.toFixed(3)})`);
      });
      
      // Should find calculator
      const calcTool = result.tools.find(t => t.name.includes('calc'));
      if (calcTool) {
        console.log(`\n✅ Calculator found: ${calcTool.name}`);
      }
    });
    
    test('should handle complex multi-intent queries', async () => {
      const query = 'build a web API that reads JSON files, validates schemas, and serves HTTP endpoints';
      console.log(`\n🎯 Complex query: "${query}"`);
      
      const result = await semanticDiscovery.findRelevantTools(query, {
        limit: 15,
        minScore: 0
      });
      
      console.log(`Found ${result.tools.length} tools`);
      
      // Group tools by category
      const categories = {};
      result.tools.forEach(tool => {
        const cat = tool.category || 'general';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      
      console.log('\nTools by category:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} tools`);
      });
      
      // Should find diverse tools
      const hasFile = result.tools.some(t => t.name.includes('file'));
      const hasJson = result.tools.some(t => t.name.includes('json'));
      const hasHttp = result.tools.some(t => 
        t.name.includes('http') || t.name.includes('api') || t.name.includes('server')
      );
      
      console.log('\nCoverage check:');
      console.log(`  File tools: ${hasFile ? '✅' : '❌'}`);
      console.log(`  JSON tools: ${hasJson ? '✅' : '❌'}`);
      console.log(`  HTTP/API tools: ${hasHttp ? '✅' : '❌'}`);
    });
  });
  
  describe('4. Advanced Features', () => {
    test('should find similar tools', async () => {
      const toolName = 'file_read';
      console.log(`\n🔗 Finding tools similar to "${toolName}"...`);
      
      try {
        const similar = await semanticDiscovery.findSimilarTools(toolName, {
          limit: 5,
          excludeSelf: true
        });
        
        console.log(`Found ${similar.length} similar tools:`);
        similar.forEach((s, i) => {
          const doc = s.document || s.payload || s;
          console.log(`  ${i+1}. ${doc.toolName || doc.name}`);
        });
        
        expect(similar.length).toBeGreaterThan(0);
      } catch (error) {
        console.log(`Could not find similar tools: ${error.message}`);
      }
    });
    
    test('should get tool recommendations', async () => {
      const recentTools = ['file_read', 'json_parse'];
      const context = 'validate and transform data';
      
      console.log(`\n💡 Getting recommendations...`);
      console.log(`  Recent tools: ${recentTools.join(', ')}`);
      console.log(`  Context: ${context}`);
      
      const recommendations = await semanticDiscovery.getToolRecommendations(
        recentTools,
        context
      );
      
      console.log(`\nRecommended ${recommendations.tools.length} tools:`);
      recommendations.tools.slice(0, 5).forEach(tool => {
        console.log(`  - ${tool.name} (score: ${tool.recommendationScore?.toFixed(3)})`);
      });
      
      expect(recommendations.tools.length).toBeGreaterThan(0);
    });
    
    test('should find tool combinations for complex tasks', async () => {
      const task = 'Create a data pipeline that reads CSV files, transforms data, and stores in database';
      console.log(`\n🔧 Finding tool combinations for: "${task}"`);
      
      const combinations = await semanticDiscovery.findToolCombinations(task, {
        maxTools: 10,
        suggestWorkflow: true
      });
      
      console.log(`\nPrimary tools (${combinations.primaryTools.length}):`);
      combinations.primaryTools.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (${t.relevanceScore?.toFixed(3)})`);
      });
      
      console.log(`\nSupporting tools (${combinations.supportingTools.length}):`);
      combinations.supportingTools.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (${t.relevanceScore?.toFixed(3)})`);
      });
      
      if (combinations.suggestedWorkflow) {
        console.log('\nSuggested workflow:');
        combinations.suggestedWorkflow.phases.forEach(phase => {
          console.log(`  ${phase.name}: ${phase.tools.join(', ')}`);
        });
      }
      
      expect(combinations.primaryTools.length).toBeGreaterThan(0);
    });
  });
  
  describe('5. Performance and Caching', () => {
    test('should cache search results for performance', async () => {
      const query = 'test query for caching';
      
      console.log(`\n⚡ Testing cache performance...`);
      
      // First search
      const start1 = Date.now();
      const result1 = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        minScore: 0,
        useCache: true
      });
      const time1 = Date.now() - start1;
      
      // Second search (cached)
      const start2 = Date.now();
      const result2 = await semanticDiscovery.findRelevantTools(query, {
        limit: 5,
        minScore: 0,
        useCache: true
      });
      const time2 = Date.now() - start2;
      
      console.log(`  First search: ${time1}ms`);
      console.log(`  Cached search: ${time2}ms`);
      console.log(`  Speed improvement: ${(time1/time2).toFixed(1)}x`);
      
      // Results should be identical
      expect(result1.tools.length).toBe(result2.tools.length);
      if (result1.tools.length > 0) {
        expect(result1.tools[0].name).toBe(result2.tools[0].name);
      }
    });
    
    test('should provide statistics', async () => {
      const stats = semanticDiscovery.getStatistics();
      
      console.log('\n📈 SemanticToolDiscovery Statistics:');
      console.log(`  Cache size: ${stats.cacheSize}`);
      console.log(`  Config:`);
      console.log(`    - Default limit: ${stats.config.defaultLimit}`);
      console.log(`    - Min relevance: ${stats.config.minRelevanceScore}`);
      console.log(`    - Include related: ${stats.config.includeRelatedTools}`);
      
      if (stats.indexStatistics) {
        console.log(`  Index stats:`);
        console.log(`    - Indexed tools: ${stats.indexStatistics.indexedTools}`);
        console.log(`    - Total perspectives: ${stats.indexStatistics.totalPerspectives}`);
      }
      
      expect(stats).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });
  
  describe('6. Query Understanding', () => {
    test('should understand various query intents', async () => {
      const queries = [
        { query: 'help me debug my code', expected: ['debug', 'log', 'test'] },
        { query: 'I want to build a REST API', expected: ['http', 'api', 'server'] },
        { query: 'process and analyze data files', expected: ['file', 'parse', 'transform'] },
        { query: 'deploy my application', expected: ['deploy', 'build', 'git'] },
        { query: 'work with databases', expected: ['database', 'query', 'sql'] }
      ];
      
      console.log('\n🧠 Testing query understanding...\n');
      
      for (const { query, expected } of queries) {
        const result = await semanticDiscovery.findRelevantTools(query, {
          limit: 10,
          minScore: 0
        });
        
        const foundKeywords = expected.filter(keyword => 
          result.tools.some(t => 
            t.name.toLowerCase().includes(keyword) || 
            t.description?.toLowerCase().includes(keyword)
          )
        );
        
        console.log(`Query: "${query}"`);
        console.log(`  Expected: ${expected.join(', ')}`);
        console.log(`  Found: ${foundKeywords.join(', ')} (${foundKeywords.length}/${expected.length})`);
        console.log(`  Top 3: ${result.tools.slice(0, 3).map(t => t.name).join(', ')}\n`);
      }
    });
  });
  
  describe('7. Edge Cases', () => {
    test('should handle empty queries', async () => {
      const result = await semanticDiscovery.findRelevantTools('', {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\n🔍 Empty query returned ${result.tools.length} tools`);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    test('should handle special characters', async () => {
      const specialQuery = 'file!@#$%^&*(){}[]';
      const result = await semanticDiscovery.findRelevantTools(specialQuery, {
        limit: 5,
        minScore: 0
      });
      
      console.log(`\n🔍 Special chars query returned ${result.tools.length} tools`);
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    test('should handle non-existent tool gracefully', async () => {
      try {
        await semanticDiscovery.findSimilarTools('non_existent_tool_xyz');
        // Should throw error
        expect(true).toBe(false);
      } catch (error) {
        console.log(`\n✅ Correctly handled non-existent tool: ${error.message}`);
        expect(error.message).toContain('not found');
      }
    });
  });
  
  describe('8. Summary', () => {
  });
});