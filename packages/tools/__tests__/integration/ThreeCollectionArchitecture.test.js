/**
 * Integration test for 3-collection architecture
 * Tests the complete pipeline: indexing -> storage -> retrieval
 */

import { ResourceManager } from '@legion/tools';
import { ToolIndexer, SemanticToolDiscovery } from '../../src/search/index.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { StorageProvider } from '@legion/storage';

describe('3-Collection Architecture Integration', () => {
  let resourceManager;
  let provider;
  let storageProvider;
  let mongoProvider;
  let toolIndexer;
  let toolDiscovery;
  let calculatorTool;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create MongoDB provider
    provider = await MongoDBToolRegistryProvider.create(resourceManager, { 
      enableSemanticSearch: false 
    });

    // Get direct MongoDB access
    storageProvider = await StorageProvider.create(resourceManager);
    mongoProvider = storageProvider.getProvider('mongodb');

    // Ensure tool_perspectives collection exists
    const collections = await mongoProvider.listCollections();
    if (!collections.includes('tool_perspectives')) {
      await mongoProvider.db.createCollection('tool_perspectives');
    }

    // Get Calculator tool from database
    calculatorTool = await provider.getTool('calculator');
    expect(calculatorTool).toBeTruthy();

    // Create ToolIndexer and SemanticToolDiscovery
    toolIndexer = await ToolIndexer.createForTools(resourceManager);
    toolDiscovery = await SemanticToolDiscovery.createForTools(resourceManager);
  });

  afterAll(async () => {
    if (provider) await provider.disconnect();
  });

  describe('Tool Indexing with Perspectives', () => {
    let indexResult;

    test('should index Calculator tool with multiple perspectives', async () => {
      const calculatorToolForIndexing = {
        name: calculatorTool.name,
        description: calculatorTool.description,
        category: calculatorTool.category || 'utility',
        inputSchema: calculatorTool.inputSchema,
        examples: calculatorTool.examples || []
      };

      indexResult = await toolIndexer.indexTool(
        calculatorToolForIndexing, 
        { 
          category: 'math',
          tags: ['calculator', 'math', 'arithmetic'],
          module: 'Calculator' 
        },
        calculatorTool._id
      );

      expect(indexResult.success).toBe(true);
      expect(indexResult.perspectivesIndexed).toBeGreaterThan(0);
      expect(indexResult.perspectiveIds).toHaveLength(indexResult.perspectivesIndexed);
      expect(indexResult.embeddingIds).toHaveLength(indexResult.perspectivesIndexed);
    });

    test('should store perspectives in MongoDB tool_perspectives collection', async () => {
      const perspectiveCount = await mongoProvider.count('tool_perspectives', { 
        toolId: calculatorTool._id 
      });

      expect(perspectiveCount).toBe(indexResult.perspectivesIndexed);

      // Get sample perspectives
      const perspectives = await mongoProvider.find('tool_perspectives', 
        { toolId: calculatorTool._id }, 
        { limit: 5 }
      );

      expect(perspectives.length).toBeGreaterThan(0);
      
      // Validate perspective structure
      const perspective = perspectives[0];
      expect(perspective).toHaveProperty('toolId');
      expect(perspective).toHaveProperty('toolName');
      expect(perspective).toHaveProperty('perspectiveType');
      expect(perspective).toHaveProperty('perspectiveText');
      expect(perspective).toHaveProperty('embeddingId');
      expect(perspective.toolId.toString()).toBe(calculatorTool._id.toString());
      expect(perspective.toolName).toBe(calculatorTool.name);
    });

    test('should have different perspective types', async () => {
      const perspectives = await mongoProvider.find('tool_perspectives', 
        { toolId: calculatorTool._id }
      );

      const perspectiveTypes = perspectives.map(p => p.perspectiveType);
      const uniqueTypes = [...new Set(perspectiveTypes)];
      
      expect(uniqueTypes.length).toBeGreaterThan(1);
      expect(uniqueTypes).toContain('name');
      expect(uniqueTypes).toContain('description');
    });
  });

  describe('Semantic Search with 3-Collection Architecture', () => {
    test('should find Calculator tool with math-related queries', async () => {
      const queries = [
        'calculate numbers',
        'math operations',
        'arithmetic calculations'
      ];

      for (const query of queries) {
        const results = await toolDiscovery.findRelevantTools(query, {
          limit: 5,
          includeMetadata: true
        });

        expect(results).toHaveProperty('tools');
        expect(Array.isArray(results.tools)).toBe(true);
        
        if (results.tools.length > 0) {
          const calculatorFound = results.tools.some(tool => 
            tool.name === 'calculator'
          );
          expect(calculatorFound).toBe(true);

          const calculatorResult = results.tools.find(tool => 
            tool.name === 'calculator'
          );
          expect(calculatorResult.relevanceScore).toBeGreaterThan(0);
          expect(calculatorResult.perspectiveMatches).toBeGreaterThan(0);
          expect(calculatorResult).toHaveProperty('bestPerspective');
        }
      }
    });

    test('should return enriched tool data from MongoDB', async () => {
      const results = await toolDiscovery.findRelevantTools('calculate', {
        limit: 3,
        includeMetadata: true
      });

      expect(results.tools.length).toBeGreaterThan(0);
      
      const tool = results.tools.find(t => t.name === 'calculator');
      expect(tool).toBeTruthy();
      expect(tool.description).toBe(calculatorTool.description);
      expect(tool.metadata).toBeTruthy();
      expect(tool.toolId).toBe(calculatorTool._id.toString());
    });
  });

  describe('Collection Integrity', () => {
    test('should maintain referential integrity between collections', async () => {
      // Get tool from tools collection
      const toolInDB = await mongoProvider.findOne('tools', { _id: calculatorTool._id });
      expect(toolInDB).toBeTruthy();

      // Get perspectives from tool_perspectives collection
      const perspectives = await mongoProvider.find('tool_perspectives', { 
        toolId: calculatorTool._id 
      });
      expect(perspectives.length).toBeGreaterThan(0);

      // Verify all perspectives correctly reference the tool
      for (const perspective of perspectives) {
        expect(perspective.toolId.toString()).toBe(calculatorTool._id.toString());
        expect(perspective.toolName).toBe(calculatorTool.name);
        expect(perspective.embeddingId).toBeTruthy();
      }
    });

    test('should have minimal payloads in vector database', async () => {
      // This test verifies that vector search returns minimal payloads
      // We can't directly query the vector DB, but we can verify the search results
      const searchResults = await toolDiscovery.semanticSearchProvider.semanticSearch(
        'legion_tools',
        'calculator',
        { limit: 5 }
      );

      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify vector results have minimal payload structure
      const result = searchResults[0];
      const payload = result.document || result.payload;
      
      expect(payload).toHaveProperty('toolId');
      expect(payload).toHaveProperty('perspectiveId'); 
      expect(payload).toHaveProperty('toolName');
      expect(payload).toHaveProperty('perspectiveType');
      
      // Should NOT have full tool data
      expect(payload).not.toHaveProperty('inputSchema');
      expect(payload).not.toHaveProperty('examples');
    });
  });

  describe('Performance and Storage Efficiency', () => {
    test('should store glosses separately for easy inspection', async () => {
      const perspectives = await mongoProvider.find('tool_perspectives', { 
        toolId: calculatorTool._id 
      });

      // Verify we can easily query and inspect perspectives
      const descriptionPerspectives = perspectives.filter(p => 
        p.perspectiveType === 'description'
      );
      expect(descriptionPerspectives.length).toBeGreaterThan(0);

      const namePerspectives = perspectives.filter(p => 
        p.perspectiveType === 'name'
      );
      expect(namePerspectives.length).toBeGreaterThan(0);

      // Verify perspective text is meaningful
      for (const perspective of perspectives.slice(0, 3)) {
        expect(perspective.perspectiveText).toBeTruthy();
        expect(perspective.perspectiveText.length).toBeGreaterThan(0);
      }
    });

    test('should maintain search performance with distributed data', async () => {
      const startTime = Date.now();
      
      const results = await toolDiscovery.findRelevantTools('mathematical computation', {
        limit: 10,
        includeMetadata: true
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Search should complete reasonably quickly even with 3-collection lookups
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(results.tools.length).toBeGreaterThan(0);
    });
  });
});