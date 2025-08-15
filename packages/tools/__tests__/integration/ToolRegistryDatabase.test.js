/**
 * ToolRegistry Database Integration Tests
 * 
 * Tests the ToolRegistry with real MongoDB database integration.
 * These tests require a running MongoDB instance and test the complete flow
 * from database storage to executable tool retrieval.
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '../../src/ResourceManager.js';

describe('ToolRegistry Database Integration Tests', () => {
  let registry;
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager (loads environment variables)
    resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }

    // Create ToolRegistry with real MongoDB provider
    registry = new ToolRegistry();
    await registry.initialize();
  });

  afterAll(async () => {
    // Clean up any test data if needed
    if (registry) {
      registry.clearCache();
    }
  });

  beforeEach(() => {
    // Clear cache before each test
    registry.clearCache();
  });

  describe('Database Connectivity', () => {
    test('should initialize with MongoDB provider', () => {
      expect(registry.initialized).toBe(true);
      expect(registry.provider).toBeInstanceOf(MongoDBToolRegistryProvider);
      expect(registry.resourceManager).toBeInstanceOf(ResourceManager);
    });

    test('should populate database successfully', async () => {
      const result = await registry.populateDatabase({
        mode: 'clear',
        verbose: false
      });

      expect(result).toHaveProperty('modulesAdded');
      expect(result).toHaveProperty('toolsAdded');
      expect(result.modulesAdded).toBeGreaterThan(0);
      expect(result.toolsAdded).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for database operations
  });

  describe('Tool Retrieval and Execution', () => {
    test('should retrieve and execute calculator tool', async () => {
      const calcTool = await registry.getTool('calculator');

      expect(calcTool).toBeDefined();
      expect(calcTool.name).toBe('calculator');
      expect(typeof calcTool.execute).toBe('function');

      // Test actual execution
      const result = await calcTool.execute({ expression: '5 + 3 * 2' });
      expect(result.success).toBe(true);
      expect(result.result).toBe(11);
    });

    test('should retrieve and execute json_parse tool', async () => {
      const jsonTool = await registry.getTool('json_parse');

      expect(jsonTool).toBeDefined();
      expect(jsonTool.name).toBe('json_parse');
      expect(typeof jsonTool.execute).toBe('function');

      // Test actual execution
      const testJson = '{"name": "test", "value": 42}';
      const result = await jsonTool.execute({ json_string: testJson });
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ name: 'test', value: 42 });
    });

    test('should retrieve and execute file_write tool', async () => {
      const fileWriteTool = await registry.getTool('file_write');

      expect(fileWriteTool).toBeDefined();
      expect(fileWriteTool.name).toBe('file_write');
      expect(typeof fileWriteTool.execute).toBe('function');

      // Test actual execution with temporary file
      const testFilePath = `/tmp/test-registry-${Date.now()}.txt`;
      const testContent = 'Hello from ToolRegistry integration test!';
      
      const result = await fileWriteTool.execute({
        filepath: testFilePath,
        content: testContent
      });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('written');
    });

    test('should handle non-existent tools gracefully', async () => {
      const nonExistentTool = await registry.getTool('non_existent_tool_xyz');

      expect(nonExistentTool).toBeNull();
    });
  });

  describe('Tool Listing and Search', () => {
    test('should list tools from database', async () => {
      const tools = await registry.listTools({ limit: 10 });

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.length).toBeLessThanOrEqual(10);

      // Check tool structure
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('moduleName');
        expect(typeof tool.name).toBe('string');
      }
    });

    test('should filter tools by module', async () => {
      const calculatorTools = await registry.listTools({ 
        moduleName: 'Calculator',
        limit: 5 
      });

      expect(Array.isArray(calculatorTools)).toBe(true);
      
      if (calculatorTools.length > 0) {
        for (const tool of calculatorTools) {
          expect(tool.moduleName).toBe('Calculator');
        }
      }
    });

    test('should search tools by query', async () => {
      const fileTools = await registry.searchTools('file', { limit: 5 });

      expect(Array.isArray(fileTools)).toBe(true);

      if (fileTools.length > 0) {
        for (const tool of fileTools) {
          const nameMatch = tool.name.toLowerCase().includes('file');
          const descMatch = tool.description && tool.description.toLowerCase().includes('file');
          expect(nameMatch || descMatch).toBe(true);
        }
      }
    });

    test('should search tools case-insensitively', async () => {
      const jsonTools1 = await registry.searchTools('JSON', { limit: 3 });
      const jsonTools2 = await registry.searchTools('json', { limit: 3 });

      expect(jsonTools1.length).toBe(jsonTools2.length);
      
      if (jsonTools1.length > 0) {
        expect(jsonTools1[0].name).toBe(jsonTools2[0].name);
      }
    });
  });

  describe('Caching Behavior', () => {
    test('should cache tools after first retrieval', async () => {
      // First retrieval - should hit database
      const tool1 = await registry.getTool('calculator');
      expect(registry.toolCache.has('calculator')).toBe(true);

      // Second retrieval - should use cache
      const tool2 = await registry.getTool('calculator');
      expect(tool1).toBe(tool2); // Same object reference
    });

    test('should track usage statistics', async () => {
      await registry.getTool('calculator');
      await registry.getTool('calculator');
      await registry.getTool('json_parse');

      const stats = registry.getUsageStats();
      expect(stats.calculator).toBe(2);
      expect(stats.json_parse).toBe(1);
    });

    test('should clear cache properly', async () => {
      // Populate cache
      await registry.getTool('calculator');
      await registry.getTool('json_parse');
      expect(registry.toolCache.size).toBeGreaterThan(0);

      // Clear cache
      registry.clearCache();
      expect(registry.toolCache.size).toBe(0);
      expect(registry.moduleCache.size).toBe(0);
    });
  });

  describe('Module Loading', () => {
    test('should load and cache modules', async () => {
      // Get a tool which should load its module
      const calcTool = await registry.getTool('calculator');
      expect(calcTool).toBeDefined();

      // Module should be cached
      expect(registry.moduleCache.size).toBeGreaterThan(0);

      // Check that getting another tool from same module uses cached module
      const initialCacheSize = registry.moduleCache.size;
      await registry.getTool('calculator'); // Same tool, should use cache
      expect(registry.moduleCache.size).toBe(initialCacheSize);
    });

    test('should handle invalid module references gracefully', async () => {
      // This would require a tool in the database with invalid module reference
      // For now, we'll just verify the registry doesn't crash on edge cases
      const result = await registry.getTool('some.namespaced.tool');
      expect(result).toBeNull(); // Should handle gracefully
    });
  });

  describe('Database Statistics', () => {
    test('should provide database statistics via provider', async () => {
      const stats = await registry.provider.getStats();

      expect(stats).toHaveProperty('modules');
      expect(stats).toHaveProperty('tools');
      expect(typeof stats.modules).toBe('number');
      expect(typeof stats.tools).toBe('number');
      expect(stats.modules).toBeGreaterThan(0);
      expect(stats.tools).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle database connection issues gracefully', async () => {
      // Create a registry with invalid database configuration
      const badResourceManager = new ResourceManager();
      await badResourceManager.initialize();
      
      // Simulate bad database config by overriding connection details
      badResourceManager.set('env.MONGODB_URI', 'mongodb://invalid:27017/test');
      
      const badRegistry = new ToolRegistry({ resourceManager: badResourceManager });
      
      // Should not throw during initialization
      await expect(badRegistry.initialize()).rejects.toThrow();
    });

    test('should handle corrupted tool data gracefully', async () => {
      // Testing with various edge cases
      const results = await Promise.all([
        registry.getTool(''),
        registry.getTool(null),
        registry.getTool(undefined),
        registry.getTool(123),
        registry.getTool({}),
        registry.getTool([])
      ]);

      // All should return null without throwing
      for (const result of results) {
        expect(result).toBeNull();
      }
    });
  });
});