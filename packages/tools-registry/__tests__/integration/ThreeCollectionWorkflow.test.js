/**
 * Three Collection Workflow Integration Tests
 * 
 * Tests the complete 3-collection architecture workflow:
 * - perspective_types collection with predefined perspective definitions
 * - tools collection with tool metadata
 * - tool_perspectives collection with generated perspectives for each tool x type
 * 
 * Validates the end-to-end flow of generating ALL perspective types
 * for a tool in ONE LLM call and storing with proper relationships.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { Perspectives } from '../../src/search/Perspectives.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('Three Collection Architecture Integration', () => {
  let resourceManager;
  let mongoClient;
  let db;
  let testDbName;
  let perspectives;
  let databaseStorage;

  beforeEach(async () => {
    testDbName = `test_3collection_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    resourceManager = await ResourceManager.getResourceManager();
    
    // Connect to MongoDB
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(testDbName);
    
    // Create database storage with real db instance
    databaseStorage = new DatabaseStorage({ db });
    await databaseStorage.initialize();
    
    // Set up resource manager dependencies
    resourceManager.set('databaseStorage', databaseStorage);
    resourceManager.set('llmClient', {
      sendMessage: async (prompt) => {
        // Mock LLM response for multi-perspective generation
        return JSON.stringify([
          { content: 'Functional perspective: Tool performs mathematical operations' },
          { content: 'Usage perspective: Use when you need arithmetic calculations' },
          { content: 'Troubleshooting perspective: Common issues include invalid number inputs' }
        ]);
      }
    });
    
    // Create perspectives instance
    perspectives = new Perspectives({
      resourceManager,
      options: { verbose: false }
    });
    await perspectives.initialize();
  });

  afterEach(async () => {
    if (mongoClient) {
      try {
        await db.dropDatabase();
        await mongoClient.close();
      } catch (error) {
        console.warn('Database cleanup failed:', error.message);
      }
    }
  });

  describe('Database Initialization and Seeding', () => {
    it('should initialize all three collections with proper structure', async () => {
      // Verify perspective_types collection has default types
      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes.length).toBeGreaterThan(0);
      
      // Verify each type has required fields
      for (const type of perspectiveTypes) {
        expect(type).toHaveProperty('_id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('prompt_template');
        expect(type).toHaveProperty('category');
        expect(type).toHaveProperty('order');
        expect(type).toHaveProperty('enabled');
        expect(type.enabled).toBe(true);
      }

      // Verify collections exist but are empty initially
      const tools = await db.collection('tools').find({}).toArray();
      expect(tools).toHaveLength(0);
      
      const toolPerspectives = await db.collection('tool_perspectives').find({}).toArray();
      expect(toolPerspectives).toHaveLength(0);
    });

    it('should have seeded default perspective types with valid templates', async () => {
      const types = await db.collection('perspective_types').find({}).toArray();
      
      // Should have at least the core perspective types
      const typeNames = types.map(t => t.name);
      expect(typeNames).toContain('input_perspective');
      expect(typeNames).toContain('definition_perspective');
      expect(typeNames).toContain('keyword_perspective');
      expect(typeNames).toContain('use_case_perspective');

      // Verify templates contain placeholder
      for (const type of types) {
        expect(type.prompt_template).toContain('{toolName}');
      }
    });
  });

  describe('Single LLM Call Generation', () => {
    it('should generate all perspective types in one LLM call', async () => {
      // Create a test tool
      const testTool = {
        name: 'calculator',
        description: 'Performs basic arithmetic calculations',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] }
          },
          required: ['a', 'b', 'operation']
        }
      };

      // Save tool to database
      await databaseStorage.saveTool(testTool, 'MathModule');

      // Generate perspectives - should use single LLM call
      const generatedPerspectives = await perspectives.generatePerspectivesForTool('calculator');

      // Verify all perspectives were generated
      expect(Array.isArray(generatedPerspectives)).toBe(true);
      expect(generatedPerspectives.length).toBeGreaterThan(0);

      // Each perspective should have the new structure
      for (const perspective of generatedPerspectives) {
        expect(perspective).toHaveProperty('tool_name', 'calculator');
        expect(perspective).toHaveProperty('tool_id');
        expect(perspective).toHaveProperty('perspective_type_name');
        expect(perspective).toHaveProperty('perspective_type_id');
        expect(perspective).toHaveProperty('content');
        expect(perspective).toHaveProperty('keywords');
        expect(perspective).toHaveProperty('generated_at');
        expect(perspective).toHaveProperty('llm_model');
        expect(perspective).toHaveProperty('batch_id');
        expect(Array.isArray(perspective.keywords)).toBe(true);
      }

      // Verify perspectives were saved to database
      const savedPerspectives = await db.collection('tool_perspectives')
        .find({ tool_name: 'calculator' })
        .toArray();
      
      expect(savedPerspectives.length).toBe(generatedPerspectives.length);
    });

    it('should create perspectives with foreign key relationships', async () => {
      // Create test tool
      const testTool = {
        name: 'file_reader',
        description: 'Reads files from the filesystem'
      };

      await databaseStorage.saveTool(testTool, 'FileModule');

      // Generate perspectives
      await perspectives.generatePerspectivesForTool('file_reader');

      // Verify relationships exist
      const toolDoc = await db.collection('tools').findOne({ name: 'file_reader' });
      expect(toolDoc).toBeDefined();

      const perspectiveTypes = await db.collection('perspective_types').find({}).toArray();
      expect(perspectiveTypes.length).toBeGreaterThan(0);

      const toolPerspectives = await db.collection('tool_perspectives')
        .find({ tool_name: 'file_reader' })
        .toArray();

      // Verify each perspective references valid tool and type
      for (const perspective of toolPerspectives) {
        expect(perspective.tool_id).toEqual(toolDoc._id);
        
        const referencedType = perspectiveTypes.find(t => 
          t._id.toString() === perspective.perspective_type_id.toString()
        );
        expect(referencedType).toBeDefined();
        expect(perspective.perspective_type_name).toBe(referencedType.name);
      }
    });

    it('should generate perspectives with unique batch_id for tracking', async () => {
      // Create multiple tools
      const tools = [
        { name: 'tool1', description: 'First test tool' },
        { name: 'tool2', description: 'Second test tool' }
      ];

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'TestModule');
      }

      // Generate perspectives for each tool
      const results = [];
      for (const tool of tools) {
        const toolPerspectives = await perspectives.generatePerspectivesForTool(tool.name);
        results.push(...toolPerspectives);
      }

      // Each tool's perspectives should have same batch_id within tool, different between tools
      const tool1Perspectives = results.filter(p => p.tool_name === 'tool1');
      const tool2Perspectives = results.filter(p => p.tool_name === 'tool2');

      // Within same tool, all perspectives should have same batch_id
      const tool1BatchIds = [...new Set(tool1Perspectives.map(p => p.batch_id))];
      expect(tool1BatchIds).toHaveLength(1);

      const tool2BatchIds = [...new Set(tool2Perspectives.map(p => p.batch_id))];
      expect(tool2BatchIds).toHaveLength(1);

      // Between tools, batch_ids should be different
      expect(tool1BatchIds[0]).not.toBe(tool2BatchIds[0]);
    });
  });

  describe('Perspective Retrieval and Search', () => {
    it('should retrieve all perspectives for a tool', async () => {
      // Setup test tool and generate perspectives
      await databaseStorage.saveTool({ 
        name: 'json_parser', 
        description: 'Parse JSON strings' 
      }, 'JsonModule');

      await perspectives.generatePerspectivesForTool('json_parser');

      // Retrieve perspectives using new API
      const retrievedPerspectives = await perspectives.getToolPerspectives('json_parser');

      expect(Array.isArray(retrievedPerspectives)).toBe(true);
      expect(retrievedPerspectives.length).toBeGreaterThan(0);

      // Each perspective should have complete data
      for (const perspective of retrievedPerspectives) {
        expect(perspective.tool_name).toBe('json_parser');
        expect(perspective.content).toBeDefined();
        expect(perspective.perspective_type_name).toBeDefined();
        expect(Array.isArray(perspective.keywords)).toBe(true);
      }
    });

    it('should support semantic search across perspective content', async () => {
      // Create tools with different purposes
      const tools = [
        { name: 'file_writer', description: 'Write files to disk' },
        { name: 'http_client', description: 'Make HTTP requests' },
        { name: 'data_validator', description: 'Validate data structures' }
      ];

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'TestModule');
        await perspectives.generatePerspectivesForTool(tool.name);
      }

      // Search for file-related tools
      const fileResults = await perspectives.searchByPerspective('file');
      expect(fileResults.length).toBeGreaterThan(0);
      expect(fileResults.some(r => r.tool_name === 'file_writer')).toBe(true);

      // Search for network-related tools
      const networkResults = await perspectives.searchByPerspective('HTTP');
      expect(networkResults.length).toBeGreaterThan(0);
      expect(networkResults.some(r => r.tool_name === 'http_client')).toBe(true);
    });

    it('should support backward compatibility with deprecated methods', async () => {
      // Setup test tool
      await databaseStorage.saveTool({
        name: 'test_tool',
        description: 'Tool for testing backward compatibility'
      }, 'TestModule');

      await perspectives.generatePerspectivesForTool('test_tool');

      // Test deprecated getPerspective method
      const singlePerspective = await perspectives.getPerspective('test_tool');
      expect(singlePerspective).toBeDefined();
      expect(singlePerspective.tool_name).toBe('test_tool');

      // Test deprecated clearModule method
      const clearResult = await perspectives.clearModule('TestModule');
      expect(typeof clearResult).toBe('number');
    });
  });

  describe('Module Management', () => {
    it('should generate perspectives for entire modules efficiently', async () => {
      // Create module with multiple tools
      const moduleTools = [
        { name: 'encrypt', description: 'Encrypt data' },
        { name: 'decrypt', description: 'Decrypt data' },
        { name: 'hash', description: 'Generate hash' },
        { name: 'verify', description: 'Verify signature' }
      ];

      for (const tool of moduleTools) {
        await databaseStorage.saveTool(tool, 'CryptoModule');
      }

      // Generate perspectives for entire module
      const moduleResults = await perspectives.generateForModule('CryptoModule');

      // Should generate perspectives for all tools
      expect(moduleResults.length).toBeGreaterThanOrEqual(moduleTools.length);

      // Verify each tool has perspectives
      for (const tool of moduleTools) {
        const toolPerspectives = moduleResults.filter(r => r.tool_name === tool.name);
        expect(toolPerspectives.length).toBeGreaterThan(0);
      }
    });

    it('should clear module perspectives correctly', async () => {
      // Setup module with tools and perspectives
      const tools = [
        { name: 'tool_a', description: 'Tool A' },
        { name: 'tool_b', description: 'Tool B' }
      ];

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'ClearTestModule');
        await perspectives.generatePerspectivesForTool(tool.name);
      }

      // Verify perspectives exist
      let perspectiveCount = await db.collection('tool_perspectives')
        .countDocuments({ tool_name: { $in: ['tool_a', 'tool_b'] } });
      expect(perspectiveCount).toBeGreaterThan(0);

      // Clear module perspectives
      const deletedCount = await perspectives.clearModulePerspectives('ClearTestModule');
      expect(deletedCount).toBe(perspectiveCount);

      // Verify perspectives are cleared
      perspectiveCount = await db.collection('tool_perspectives')
        .countDocuments({ tool_name: { $in: ['tool_a', 'tool_b'] } });
      expect(perspectiveCount).toBe(0);

      // But tools should still exist
      const toolCount = await db.collection('tools')
        .countDocuments({ name: { $in: ['tool_a', 'tool_b'] } });
      expect(toolCount).toBe(2);
    });
  });

  describe('Statistics and Analytics', () => {
    it('should provide comprehensive perspective statistics', async () => {
      // Create diverse set of tools and perspectives
      const tools = [
        { name: 'math_add', description: 'Add numbers' },
        { name: 'math_sub', description: 'Subtract numbers' },
        { name: 'string_concat', description: 'Concatenate strings' },
        { name: 'array_sort', description: 'Sort arrays' }
      ];

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'UtilsModule');
        await perspectives.generatePerspectivesForTool(tool.name);
      }

      // Get statistics
      const stats = await perspectives.getStatistics();

      // Verify statistics structure
      expect(stats).toHaveProperty('total');
      expect(stats.total).toBeGreaterThan(0);
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('byModule');

      // Should have module statistics
      expect(stats.byModule).toHaveProperty('UtilsModule');
      expect(stats.byModule.UtilsModule).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tools with missing or invalid data gracefully', async () => {
      // Create tool with minimal data
      await databaseStorage.saveTool({
        name: 'minimal_tool',
        description: ''  // Empty description
      }, 'MinimalModule');

      // Should still generate perspectives
      const results = await perspectives.generatePerspectivesForTool('minimal_tool');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Each perspective should have fallback content
      for (const perspective of results) {
        expect(perspective.content).toBeDefined();
        expect(typeof perspective.content).toBe('string');
        expect(perspective.content.length).toBeGreaterThan(0);
      }
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      // Create perspectives instance with LLM that returns invalid JSON
      const badLLMClient = {
        sendMessage: async () => 'This is not valid JSON response'
      };

      resourceManager.set('llmClient', badLLMClient);

      const errorPerspectives = new Perspectives({
        resourceManager,
        options: { verbose: false }
      });
      await errorPerspectives.initialize();

      await databaseStorage.saveTool({
        name: 'error_test_tool',
        description: 'Tool for testing error handling'
      }, 'ErrorModule');

      // Should fall back to default perspectives
      const results = await errorPerspectives.generatePerspectivesForTool('error_test_tool');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Should have fallback content
      for (const result of results) {
        expect(result.content).toContain('Auto-generated perspective');
      }
    });

    it('should handle non-existent tools appropriately', async () => {
      // Try to generate perspectives for non-existent tool
      await expect(perspectives.generatePerspectivesForTool('non_existent_tool'))
        .rejects
        .toThrow(/Tool not found/);

      // Try to retrieve perspectives for non-existent tool
      const emptyResults = await perspectives.getToolPerspectives('non_existent_tool');
      expect(Array.isArray(emptyResults)).toBe(true);
      expect(emptyResults).toHaveLength(0);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should efficiently handle batch operations', async () => {
      // Create multiple tools
      const batchSize = 5;
      const tools = Array.from({ length: batchSize }, (_, i) => ({
        name: `batch_tool_${i}`,
        description: `Batch test tool ${i}`
      }));

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'BatchModule');
      }

      // Measure batch generation time
      const startTime = Date.now();
      const results = await perspectives.generateForModule('BatchModule');
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
      expect(results.length).toBeGreaterThanOrEqual(batchSize);

      // All tools should have perspectives
      const toolNames = results.map(r => r.tool_name);
      for (let i = 0; i < batchSize; i++) {
        expect(toolNames).toContain(`batch_tool_${i}`);
      }
    });

    it('should cache and reuse existing perspectives efficiently', async () => {
      // Create tool and generate perspectives
      await databaseStorage.saveTool({
        name: 'cache_test_tool',
        description: 'Tool for testing perspective caching'
      }, 'CacheModule');

      // First call should generate new perspectives
      const startTime1 = Date.now();
      const firstResults = await perspectives.generatePerspectivesForTool('cache_test_tool');
      const duration1 = Date.now() - startTime1;

      // Second call should use existing perspectives (faster)
      const startTime2 = Date.now();
      const secondResults = await perspectives.generatePerspectivesForTool('cache_test_tool');
      const duration2 = Date.now() - startTime2;

      // Should return same data
      expect(secondResults).toHaveLength(firstResults.length);
      
      // Second call should be faster (using existing data)
      expect(duration2).toBeLessThan(duration1);

      // Content should be identical
      for (let i = 0; i < firstResults.length; i++) {
        expect(secondResults[i].content).toBe(firstResults[i].content);
      }
    });
  });
});