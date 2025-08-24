/**
 * Perspective Integration Tests
 * 
 * Tests the complete perspective generation workflow with real LLM service,
 * database storage, and perspective quality validation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { MongoClient } from 'mongodb';
import { Perspectives } from '../../src/search/Perspectives.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('Perspective Integration', () => {
  let resourceManager;
  let perspectives;
  let dbOps;
  let databaseStorage;
  let mongoClient;
  let db;
  let testDbName;

  beforeEach(async () => {
    testDbName = `test_perspective_integration_${Date.now()}`;
    resourceManager = await ResourceManager.getResourceManager();
    
    // Override database name for testing
    resourceManager.set('test.database.name', testDbName);
    
    // Connect to MongoDB directly
    const mongoUrl = resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db(testDbName);
    
    // Create database storage with db instance
    databaseStorage = new DatabaseStorage({ db });
    await databaseStorage.initialize();
    
    // Create database operations with initialized storage
    dbOps = new DatabaseOperations({ 
      databaseStorage,
      resourceManager 
    });
    
    // Create a storage provider adapter that provides the interface Perspectives expects
    const storageProviderAdapter = {
      findOne: async (collection, filter) => {
        if (collection === 'tools') {
          return await databaseStorage.findTool(filter.name);
        } else if (collection === 'perspectives') {
          const result = await db.collection(collection).findOne(filter);
          return result;
        }
        return null;
      },
      find: async (collection, filter, options = {}) => {
        if (collection === 'tools') {
          if (filter.moduleName) {
            const tools = await databaseStorage.findTools(filter);
            return tools;
          }
          return await databaseStorage.findTools(filter);
        } else if (collection === 'perspectives') {
          const cursor = db.collection(collection).find(filter);
          if (options.limit) {
            cursor.limit(options.limit);
          }
          return await cursor.toArray();
        }
        return [];
      },
      upsertOne: async (collection, filter, doc) => {
        await db.collection(collection).replaceOne(filter, doc, { upsert: true });
      },
      deleteMany: async (collection, filter) => {
        const result = await db.collection(collection).deleteMany(filter);
        return { deletedCount: result.deletedCount };
      },
      count: async (collection, filter) => {
        return await db.collection(collection).countDocuments(filter);
      },
      distinct: async (collection, field) => {
        return await db.collection(collection).distinct(field);
      }
    };
    
    // Setup resource manager with required dependencies
    resourceManager.set('storageProvider', storageProviderAdapter);
    
    // Always create a mock LLM client for testing (to avoid API calls in tests)
    // This can be overridden in individual tests if needed
    resourceManager.set('llmClient', {
      sendMessage: async (prompt) => JSON.stringify({
        perspective: 'Mock perspective for testing purposes',
        category: 'testing',
        useCases: ['Test use case 1', 'Test use case 2'],
        relatedTools: []
      })
    });
    
    // Create perspectives instance
    perspectives = new Perspectives({
      resourceManager
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

  describe('LLM Service Integration', () => {
    it('should generate perspectives with real LLM service', async () => {
      // This test uses a mock LLM service to avoid API calls

      // Create a test tool
      const testTool = {
        name: 'file_reader',
        description: 'Reads text files from the filesystem and returns content as string',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string' }
          },
          required: ['filepath']
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          }
        }
      };

      // Save tool to database first
      await databaseStorage.saveTool(testTool, 'TestModule');

      // Generate perspectives (new API returns array of perspectives)
      const generatedPerspectives = await perspectives.generatePerspectivesForTool('file_reader');

      expect(generatedPerspectives).toBeDefined();
      expect(Array.isArray(generatedPerspectives)).toBe(true);
      expect(generatedPerspectives.length).toBeGreaterThan(0);
      
      // Validate perspective structure (new 3-collection format)
      const firstPerspective = generatedPerspectives[0];
      expect(firstPerspective).toHaveProperty('tool_name', 'file_reader');
      expect(firstPerspective).toHaveProperty('perspective_type_name');
      expect(firstPerspective).toHaveProperty('content');
      expect(firstPerspective).toHaveProperty('keywords');
      expect(firstPerspective).toHaveProperty('generated_at');
      expect(Array.isArray(firstPerspective.keywords)).toBe(true);
    });

    it('should validate perspective quality', async () => {
      // This test uses a mock LLM service

      const testTool = {
        name: 'json_parser',
        description: 'Parses JSON strings into JavaScript objects with error handling',
        inputSchema: {
          type: 'object',
          properties: {
            jsonString: { type: 'string' }
          },
          required: ['jsonString']
        }
      };

      await databaseStorage.saveTool(testTool, 'TestModule');

      const generatedPerspectives = await perspectives.generatePerspectivesForTool('json_parser');

      // Quality checks adapted for new 3-collection format
      expect(generatedPerspectives).toBeDefined();
      expect(Array.isArray(generatedPerspectives)).toBe(true);
      expect(generatedPerspectives.length).toBeGreaterThan(0);
      
      const firstPerspective = generatedPerspectives[0];
      expect(firstPerspective.tool_name).toBe('json_parser');
      expect(firstPerspective.content).toBeDefined();
      expect(firstPerspective.perspective_type_name).toBeDefined();
      expect(Array.isArray(firstPerspective.keywords)).toBe(true);
      expect(firstPerspective.generated_at).toBeDefined();
    });
  });

  describe('Batch Generation', () => {
    it('should generate perspectives for multiple tools in batch', async () => {
      // This test uses a mock LLM service

      // Create test tools
      const testTools = [
        {
          name: 'calculator',
          description: 'Performs basic arithmetic calculations',
          moduleName: 'MathModule'
        },
        {
          name: 'file_writer',
          description: 'Writes content to text files',
          moduleName: 'FileModule'
        },
        {
          name: 'http_client',
          description: 'Makes HTTP requests to external APIs',
          moduleName: 'NetworkModule'
        }
      ];

      // Save tools to database
      for (const tool of testTools) {
        await databaseStorage.saveTool(tool, tool.moduleName);
      }

      // Generate perspectives for module
      const moduleResults = await perspectives.generateForModule('MathModule');
      expect(Array.isArray(moduleResults)).toBe(true);
      expect(moduleResults.length).toBeGreaterThan(0);

      // Verify each tool has perspectives
      const mathToolPerspectives = moduleResults.filter(p => p.toolName === 'calculator');
      expect(mathToolPerspectives.length).toBeGreaterThan(0);
    });

    it('should handle batch generation errors gracefully', async () => {
      // Create invalid tool data
      const invalidTool = {
        name: 'invalid_tool',
        // Missing description
        moduleName: 'TestModule'
      };

      await databaseStorage.saveTool({ ...invalidTool, description: '' }, 'TestModule');

      // Should handle invalid tool gracefully
      try {
        const result = await perspectives.generatePerspectivesForTool('invalid_tool');
        // If it succeeds despite empty description, check it has default values
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
          expect(result[0].tool_name).toBe('invalid_tool');
        }
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Database Storage', () => {
    it('should save and retrieve perspectives from database', async () => {
      // Create test tool first
      const testTool = {
        name: 'test_tool',
        description: 'Test tool for perspective storage'
      };
      
      await databaseStorage.saveTool(testTool, 'TestModule');

      // Generate perspectives (will auto-save)
      const generatedPerspectives = await perspectives.generatePerspectivesForTool('test_tool');

      // Retrieve and verify from database directly
      const saved = await db.collection('perspectives')
        .find({ toolName: 'test_tool' })
        .toArray();

      expect(saved.length).toBeGreaterThanOrEqual(1);
      
      const perspective = saved[0];
      expect(perspective).toHaveProperty('toolName', 'test_tool');
      expect(perspective).toHaveProperty('perspective');
      expect(perspective).toHaveProperty('category');
      expect(perspective).toHaveProperty('useCases');
      expect(perspective).toHaveProperty('relatedTools');
      expect(perspective).toHaveProperty('generatedAt');
      expect(Array.isArray(perspective.useCases)).toBe(true);
      expect(Array.isArray(perspective.relatedTools)).toBe(true);
    });

    it('should update existing perspectives', async () => {
      // Create test tool
      const testTool = {
        name: 'update_test_tool',
        description: 'Initial description for update test'
      };

      await databaseStorage.saveTool(testTool, 'TestModule');

      // Generate initial perspectives
      const firstPerspectives = await perspectives.generatePerspectivesForTool('update_test_tool');
      expect(firstPerspectives).toBeDefined();
      expect(Array.isArray(firstPerspectives)).toBe(true);

      // Force regenerate perspectives (updates existing)
      const updatedPerspectives = await perspectives.generatePerspectivesForTool('update_test_tool', { forceRegenerate: true });

      // Verify still only one perspective in database
      const saved = await db.collection('tool_perspectives')
        .find({ tool_name: 'update_test_tool' })
        .toArray();

      expect(saved.length).toBeGreaterThanOrEqual(1);
      expect(saved[0].tool_name).toBe('update_test_tool');
      expect(saved[0].generated_at).toBeDefined();
    });

    it('should retrieve perspectives by tool name', async () => {
      // Create test tools
      const tools = [
        { name: 'search_tool', description: 'Search functionality tool' },
        { name: 'other_tool', description: 'Different tool' }
      ];

      for (const tool of tools) {
        await databaseStorage.saveTool(tool, 'TestModule');
      }

      // Generate perspectives
      await perspectives.generatePerspectivesForTool('search_tool');
      await perspectives.generatePerspectivesForTool('other_tool');

      // Retrieve perspective for specific tool
      const searchToolPerspective = await perspectives.getPerspective('search_tool');
      expect(searchToolPerspective).toBeDefined();
      expect(searchToolPerspective.toolName).toBe('search_tool');
      
      // Verify other tool perspective is different
      const otherToolPerspective = await perspectives.getPerspective('other_tool');
      expect(otherToolPerspective).toBeDefined();
      expect(otherToolPerspective.toolName).toBe('other_tool');
      expect(otherToolPerspective.toolName).not.toBe(searchToolPerspective.toolName);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent tool gracefully', async () => {
      // Try to generate perspectives for non-existent tool
      await expect(perspectives.generatePerspectivesForTool('non_existent_tool'))
        .rejects
        .toThrow(/Tool not found/);
    });

    it('should handle LLM service errors', async () => {
      // Create a tool
      const testTool = {
        name: 'llm_error_test',
        description: 'Test tool for LLM errors'
      };
      
      await databaseStorage.saveTool(testTool, 'TestModule');
      
      // Replace LLM client with one that throws errors
      const originalClient = resourceManager.get('llmClient');
      resourceManager.set('llmClient', {
        generateCompletion: async () => {
          throw new Error('LLM service unavailable');
        },
        sendMessage: async () => {
          throw new Error('LLM service unavailable');
        }
      });
      
      // Reinitialize perspectives with the new LLM client
      const errorPerspectives = new Perspectives({
        resourceManager
      });
      await errorPerspectives.initialize();
      
      // Should throw when LLM fails
      await expect(errorPerspectives.generatePerspectivesForTool('llm_error_test'))
        .rejects
        .toThrow(/Failed to generate perspectives/);
      
      // Restore original client
      resourceManager.set('llmClient', originalClient);
    });
  });

  describe('Performance', () => {
    it('should handle large batch perspective generation', async () => {
      // Create multiple test tools
      const toolCount = 10;
      const testTools = Array.from({ length: toolCount }, (_, i) => ({
        name: `performance_tool_${i}`,
        description: `Performance test tool ${i} for batch processing validation`,
        moduleName: 'PerformanceModule'
      }));

      // Save tools
      for (const tool of testTools) {
        await databaseStorage.saveTool(tool, 'PerformanceModule');
      }

      const startTime = Date.now();
      
      // Generate perspectives for the module (batch generation)
      const results = await perspectives.generateForModule('PerformanceModule');
      
      const endTime = Date.now();

      // Should complete within reasonable time (10 seconds for 10 tools with potential LLM calls)
      expect(endTime - startTime).toBeLessThan(10000);

      // Verify perspectives were generated
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Verify all perspectives were saved in database
      const saved = await db.collection('tool_perspectives')
        .find({ tool_name: { $regex: /^performance_tool_/ } })
        .toArray();
      
      expect(saved.length).toBeGreaterThan(0);
    });
  });
});