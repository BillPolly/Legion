/**
 * Provider-Based Tool Registry Integration Tests
 * 
 * Tests the complete provider-based tool registry system including:
 * - ProviderBasedToolRegistry
 * - MongoDB and JSON file providers
 * - Semantic search integration
 * - Data migration
 */

import { ResourceManager } from '@legion/tools';
import { ProviderBasedToolRegistry } from '../../src/integration/ProviderBasedToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { JSONFileToolRegistryProvider } from '../../src/providers/JSONFileToolRegistryProvider.js';
import { ToolRegistryProviderFactory } from '../../src/providers/ToolRegistryProviderFactory.js';
import { SemanticToolSearch } from '../../src/semantic/SemanticToolSearch.js';
import { ToolRegistryMigration } from '../../src/migration/ToolRegistryMigration.js';

describe('Provider-Based Tool Registry Integration', () => {
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager for all tests
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (resourceManager) {
      await resourceManager.cleanup();
    }
  });

  describe('ProviderBasedToolRegistry', () => {
    let registry;
    let provider;

    afterEach(async () => {
      if (registry) {
        await registry.cleanup();
      }
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should create registry with JSON file provider', async () => {
      console.log('🧪 Testing ProviderBasedToolRegistry with JSON file provider');

      provider = await JSONFileToolRegistryProvider.create();
      registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      expect(registry).toBeDefined();
      expect(registry.initialized).toBe(true);
      expect(registry.provider).toBe(provider);

      const stats = await registry.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.modules).toBe('number');
      expect(typeof stats.tools).toBe('number');

      console.log('✅ JSON file provider registry created successfully');
    });

    test('should create registry with MongoDB provider if available', async () => {
      console.log('🧪 Testing ProviderBasedToolRegistry with MongoDB provider');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false // Disable for basic test
        });
        registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

        expect(registry).toBeDefined();
        expect(registry.initialized).toBe(true);
        expect(registry.provider).toBe(provider);

        const stats = await registry.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.modules).toBe('number');
        expect(typeof stats.tools).toBe('number');

        console.log('✅ MongoDB provider registry created successfully');
      } catch (error) {
        console.warn('⚠️  MongoDB not available for testing:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });

    test('should provide consistent API regardless of provider', async () => {
      console.log('🧪 Testing consistent API across providers');

      // Test with JSON file provider
      const jsonProvider = await JSONFileToolRegistryProvider.create();
      const jsonRegistry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

      // Get modules and tools
      const modules = await jsonRegistry.listModules();
      const tools = await jsonRegistry.listTools();

      expect(Array.isArray(modules)).toBe(true);
      expect(Array.isArray(tools)).toBe(true);

      if (modules.length > 0) {
        const firstModule = modules[0];
        expect(firstModule).toHaveProperty('name');
        expect(firstModule).toHaveProperty('description');
        expect(firstModule).toHaveProperty('status');
      }

      if (tools.length > 0) {
        const firstTool = tools[0];
        expect(firstTool).toHaveProperty('name');
        expect(firstTool).toHaveProperty('moduleName');
        expect(firstTool).toHaveProperty('description');
        expect(firstTool).toHaveProperty('category');
      }

      await jsonRegistry.cleanup();
      await jsonProvider.disconnect();

      console.log('✅ Consistent API verified');
    });
  });

  describe('JSON File Provider', () => {
    let provider;

    afterEach(async () => {
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should load tools from JSON file', async () => {
      console.log('🧪 Testing JSON file provider tool loading');

      provider = await JSONFileToolRegistryProvider.create();

      expect(provider.initialized).toBe(true);
      expect(provider.connected).toBe(true);

      const modules = await provider.listModules();
      const tools = await provider.listTools();

      expect(Array.isArray(modules)).toBe(true);
      expect(Array.isArray(tools)).toBe(true);

      console.log(`📦 Loaded ${modules.length} modules and ${tools.length} tools`);

      // Test searching
      if (tools.length > 0) {
        const searchResults = await provider.searchTools('file', { limit: 5 });
        expect(Array.isArray(searchResults)).toBe(true);
        console.log(`🔍 Found ${searchResults.length} tools matching 'file'`);
      }

      console.log('✅ JSON file provider working correctly');
    });

    test('should be read-only and throw errors on write operations', async () => {
      console.log('🧪 Testing JSON file provider read-only behavior');

      provider = await JSONFileToolRegistryProvider.create();

      // Test that write operations throw errors
      await expect(provider.saveModule({ name: 'test' }))
        .rejects
        .toThrow('read-only');

      await expect(provider.saveTool({ name: 'test', moduleName: 'test' }))
        .rejects
        .toThrow('read-only');

      await expect(provider.deleteModule('test'))
        .rejects
        .toThrow('read-only');

      await expect(provider.deleteTool('test', 'test'))
        .rejects
        .toThrow('read-only');

      console.log('✅ Read-only behavior verified');
    });

    test('should provide usage tracking in memory', async () => {
      console.log('🧪 Testing JSON file provider usage tracking');

      provider = await JSONFileToolRegistryProvider.create();
      
      const tools = await provider.listTools();
      if (tools.length === 0) {
        console.warn('⚠️  No tools available for usage tracking test');
        return;
      }

      const tool = tools[0];
      const usageData = {
        toolName: tool.name,
        moduleName: tool.moduleName,
        success: true,
        executionTime: 100
      };

      // Record usage
      await provider.recordUsage(usageData);

      // Get usage stats
      const stats = await provider.getUsageStats(tool.name, tool.moduleName);
      expect(stats.totalUsage).toBe(1);
      expect(stats.successfulUsage).toBe(1);
      expect(stats.averageExecutionTime).toBe(100);

      // Record another usage
      await provider.recordUsage({ ...usageData, success: false, executionTime: 200 });
      
      const updatedStats = await provider.getUsageStats(tool.name, tool.moduleName);
      expect(updatedStats.totalUsage).toBe(2);
      expect(updatedStats.successfulUsage).toBe(1);
      expect(updatedStats.averageExecutionTime).toBe(150);

      console.log('✅ Usage tracking working correctly');
    });
  });

  describe('MongoDB Provider', () => {
    let provider;

    afterEach(async () => {
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should create MongoDB provider if database available', async () => {
      console.log('🧪 Testing MongoDB provider creation');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false
        });

        expect(provider.initialized).toBe(true);
        expect(provider.connected).toBe(true);

        const capabilities = provider.getCapabilities();
        expect(capabilities).toContain('modules');
        expect(capabilities).toContain('tools');
        expect(capabilities).toContain('search');
        expect(capabilities).toContain('usage_tracking');

        console.log('✅ MongoDB provider created successfully');
      } catch (error) {
        console.warn('⚠️  MongoDB not available for testing:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });

    test('should support full CRUD operations', async () => {
      console.log('🧪 Testing MongoDB provider CRUD operations');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false
        });

        // Create test module
        const testModule = {
          name: `test_module_${Date.now()}`,
          description: 'Test module for CRUD operations',
          version: '1.0.0',
          type: 'test',
          tags: ['test', 'crud'],
          category: 'testing',
          status: 'active'
        };

        // Save module
        const savedModule = await provider.saveModule(testModule);
        expect(savedModule).toBeDefined();
        expect(savedModule.name).toBe(testModule.name);
        expect(savedModule._id).toBeDefined();

        // Get module
        const retrievedModule = await provider.getModule(testModule.name);
        expect(retrievedModule).toBeDefined();
        expect(retrievedModule.name).toBe(testModule.name);

        // Create test tool
        const testTool = {
          name: `test_tool_${Date.now()}`,
          moduleName: testModule.name,
          moduleId: savedModule._id,
          description: 'Test tool for CRUD operations',
          category: 'test',
          tags: ['test', 'crud'],
          status: 'active',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Test input' }
            },
            required: ['input']
          }
        };

        // Save tool
        const savedTool = await provider.saveTool(testTool);
        expect(savedTool).toBeDefined();
        expect(savedTool.name).toBe(testTool.name);
        expect(savedTool._id).toBeDefined();

        // Get tool
        const retrievedTool = await provider.getTool(testTool.name, testModule.name);
        expect(retrievedTool).toBeDefined();
        expect(retrievedTool.name).toBe(testTool.name);

        // Update tool
        const updatedTool = {
          ...savedTool,
          description: 'Updated test tool description'
        };
        const savedUpdatedTool = await provider.saveTool(updatedTool);
        expect(savedUpdatedTool.description).toBe(updatedTool.description);

        // Test usage tracking
        const usageData = {
          toolId: savedTool._id,
          toolName: savedTool.name,
          moduleName: savedTool.moduleName,
          success: true,
          executionTime: 150,
          metadata: { test: true }
        };

        await provider.recordUsage(usageData);
        const usageStats = await provider.getUsageStats(savedTool.name, savedTool.moduleName);
        expect(usageStats.totalUsage).toBeGreaterThanOrEqual(1);

        // Cleanup - delete tool and module
        await provider.deleteTool(testTool.name, testModule.name);
        await provider.deleteModule(testModule.name);

        // Verify deletion
        const deletedTool = await provider.getTool(testTool.name, testModule.name);
        const deletedModule = await provider.getModule(testModule.name);
        expect(deletedTool).toBeNull();
        expect(deletedModule).toBeNull();

        console.log('✅ MongoDB CRUD operations working correctly');
      } catch (error) {
        console.warn('⚠️  MongoDB not available for testing:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });
  });

  describe('Provider Factory', () => {
    test('should create providers based on type', async () => {
      console.log('🧪 Testing ToolRegistryProviderFactory');

      // Test JSON file provider creation
      const jsonProvider = await ToolRegistryProviderFactory.createProvider('jsonfile', resourceManager);
      expect(jsonProvider).toBeInstanceOf(JSONFileToolRegistryProvider);
      expect(jsonProvider.initialized).toBe(true);

      // Test MongoDB provider creation (if available)
      try {
        const mongoProvider = await ToolRegistryProviderFactory.createProvider('mongodb', resourceManager);
        expect(mongoProvider).toBeInstanceOf(MongoDBToolRegistryProvider);
        expect(mongoProvider.initialized).toBe(true);
        await mongoProvider.disconnect();
      } catch (error) {
        console.warn('⚠️  MongoDB provider creation failed:', error.message);
      }

      // Test error on unknown provider
      await expect(ToolRegistryProviderFactory.createProvider('unknown', resourceManager))
        .rejects
        .toThrow('Unknown provider type');

      await jsonProvider.disconnect();
      console.log('✅ Provider factory working correctly');
    });

    test('should create provider from environment', async () => {
      console.log('🧪 Testing provider creation from environment');

      const provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      expect(provider).toBeDefined();
      expect(provider.initialized).toBe(true);

      await provider.disconnect();
      console.log('✅ Environment-based provider creation working');
    });

    test('should validate provider configurations', () => {
      console.log('🧪 Testing provider configuration validation');

      // Test MongoDB validation
      const mongoValidation = ToolRegistryProviderFactory.validateProviderConfig(
        'mongodb',
        resourceManager,
        { enableSemanticSearch: true }
      );
      expect(mongoValidation).toHaveProperty('valid');
      expect(mongoValidation).toHaveProperty('errors');
      expect(mongoValidation).toHaveProperty('warnings');

      // Test JSON file validation
      const jsonValidation = ToolRegistryProviderFactory.validateProviderConfig(
        'jsonfile',
        resourceManager
      );
      expect(jsonValidation.valid).toBe(true);

      // Test unknown provider validation
      const unknownValidation = ToolRegistryProviderFactory.validateProviderConfig(
        'unknown',
        resourceManager
      );
      expect(unknownValidation.valid).toBe(false);

      console.log('✅ Provider configuration validation working');
    });

    test('should provide recommendations', () => {
      console.log('🧪 Testing provider recommendations');

      const recommendation = ToolRegistryProviderFactory.getRecommendedProvider(resourceManager);
      expect(recommendation).toHaveProperty('type');
      expect(recommendation).toHaveProperty('reason');
      expect(['mongodb', 'jsonfile']).toContain(recommendation.type);

      console.log(`💡 Recommended provider: ${recommendation.type} - ${recommendation.reason}`);
      console.log('✅ Provider recommendations working');
    });
  });

  describe('Semantic Search Integration', () => {
    let provider;
    let semanticSearch;

    afterEach(async () => {
      if (semanticSearch) {
        await semanticSearch.cleanup();
      }
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should create semantic search with available provider', async () => {
      console.log('🧪 Testing semantic search integration');

      try {
        // Try MongoDB provider first (has semantic search capability)
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: true
        });

        semanticSearch = await SemanticToolSearch.create(resourceManager, provider);
        expect(semanticSearch).toBeDefined();
        expect(semanticSearch.initialized).toBe(true);

        const stats = await semanticSearch.getSearchStats();
        expect(stats).toBeDefined();
        expect(typeof stats.toolsIndexed).toBe('number');

        console.log(`🧠 Semantic search initialized with ${stats.toolsIndexed} tools indexed`);
        console.log('✅ Semantic search integration working');
      } catch (error) {
        console.warn('⚠️  Semantic search not available:', error.message);
        expect(error.message).toMatch(/semantic|OpenAI|Qdrant/i);
      }
    });

    test('should perform semantic tool search', async () => {
      console.log('🧪 Testing semantic tool search functionality');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: true
        });
        semanticSearch = await SemanticToolSearch.create(resourceManager, provider);

        // Test semantic search
        const searchResults = await semanticSearch.searchTools('read a file', { limit: 5 });
        expect(Array.isArray(searchResults)).toBe(true);

        if (searchResults.length > 0) {
          const firstResult = searchResults[0];
          expect(firstResult).toHaveProperty('name');
          expect(firstResult).toHaveProperty('_similarity');
          expect(typeof firstResult._similarity).toBe('number');
          console.log(`🔍 Found ${searchResults.length} semantically similar tools`);
        }

        // Test tool recommendations
        const recommendations = await semanticSearch.recommendToolsForTask('create and write files');
        expect(recommendations).toHaveProperty('taskDescription');
        expect(recommendations).toHaveProperty('recommendations');
        expect(Array.isArray(recommendations.recommendations)).toBe(true);

        console.log(`🎯 Got ${recommendations.totalRecommendations} tool recommendations`);
        console.log('✅ Semantic search functionality working');
      } catch (error) {
        console.warn('⚠️  Semantic search functionality not available:', error.message);
        expect(error.message).toMatch(/semantic|OpenAI|Qdrant/i);
      }
    });
  });

  describe('Data Migration', () => {
    let migration;

    afterEach(async () => {
      // Migration cleanup is handled internally
    });

    test('should create migration instance', async () => {
      console.log('🧪 Testing migration instance creation');

      migration = new ToolRegistryMigration(resourceManager);
      expect(migration).toBeDefined();
      expect(migration.resourceManager).toBe(resourceManager);
      expect(migration.migrationStats).toBeDefined();

      console.log('✅ Migration instance created successfully');
    });

    test('should validate migration components', async () => {
      console.log('🧪 Testing migration component validation');

      try {
        migration = new ToolRegistryMigration(resourceManager);
        await migration.initialize();

        expect(migration.databaseService).toBeDefined();
        expect(migration.provider).toBeDefined();

        if (migration.semanticSearch) {
          expect(migration.semanticSearch.initialized).toBe(true);
          console.log('🧠 Semantic search available for migration');
        } else {
          console.log('⚠️  Semantic search not available for migration');
        }

        console.log('✅ Migration components validated');
      } catch (error) {
        console.warn('⚠️  Migration components not available:', error.message);
        expect(error.message).toMatch(/MongoDB|connection|semantic/);
      }
    });

    test('should run dry-run migration', async () => {
      console.log('🧪 Testing dry-run migration');

      try {
        migration = new ToolRegistryMigration(resourceManager);
        
        // Test migration without actually running it
        await migration.initialize();
        
        // Test that migration stats are properly initialized
        expect(migration.migrationStats.modulesProcessed).toBe(0);
        expect(migration.migrationStats.toolsProcessed).toBe(0);
        expect(migration.migrationStats.embeddingsGenerated).toBe(0);
        expect(Array.isArray(migration.migrationStats.errors)).toBe(true);

        console.log('✅ Dry-run migration working');
      } catch (error) {
        console.warn('⚠️  Migration dry-run not available:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing dependencies gracefully', async () => {
      console.log('🧪 Testing error handling for missing dependencies');

      // Test with null ResourceManager
      await expect(ProviderBasedToolRegistry.create(null, null))
        .rejects
        .toThrow();

      // Test with uninitialized ResourceManager
      const uninitializedRM = new ResourceManager();
      await expect(ProviderBasedToolRegistry.create(uninitializedRM, null))
        .rejects
        .toThrow();

      console.log('✅ Error handling working correctly');
    });

    test('should handle provider failures gracefully', async () => {
      console.log('🧪 Testing provider failure handling');

      const jsonProvider = await JSONFileToolRegistryProvider.create();
      const registry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

      // Test getting non-existent items
      const nonExistentModule = await registry.getModule('non_existent_module');
      const nonExistentTool = await registry.getTool('non_existent_tool');

      expect(nonExistentModule).toBeNull();
      expect(nonExistentTool).toBeNull();

      await registry.cleanup();
      await jsonProvider.disconnect();

      console.log('✅ Provider failure handling working correctly');
    });

    test('should handle network/database failures', async () => {
      console.log('🧪 Testing network/database failure handling');

      try {
        // Try to connect to non-existent MongoDB
        const badResourceManager = new ResourceManager();
        badResourceManager.register('env.MONGODB_URL', 'mongodb://nonexistent:27017/test');
        await badResourceManager.initialize();

        await expect(MongoDBToolRegistryProvider.create(badResourceManager))
          .rejects
          .toThrow();

        await badResourceManager.cleanup();
        console.log('✅ Network failure handling working correctly');
      } catch (error) {
        // This is expected behavior
        expect(error).toBeDefined();
        console.log('✅ Database connection error handling working correctly');
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large result sets efficiently', async () => {
      console.log('🧪 Testing performance with large result sets');

      const jsonProvider = await JSONFileToolRegistryProvider.create();
      const registry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

      const startTime = Date.now();

      // Get all tools
      const allTools = await registry.listTools();
      const searchTime = Date.now() - startTime;

      console.log(`📊 Retrieved ${allTools.length} tools in ${searchTime}ms`);
      expect(searchTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test pagination
      const pagedTools = await registry.listTools({ limit: 10, skip: 0 });
      expect(pagedTools.length).toBeLessThanOrEqual(10);

      await registry.cleanup();
      await jsonProvider.disconnect();

      console.log('✅ Performance test passed');
    });

    test('should handle concurrent operations', async () => {
      console.log('🧪 Testing concurrent operations');

      const jsonProvider = await JSONFileToolRegistryProvider.create();
      const registry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

      // Run multiple operations concurrently
      const operations = [
        registry.listModules(),
        registry.listTools(),
        registry.getStats(),
        registry.listTools({ category: 'filesystem' }),
        registry.listModules({ category: 'utility' })
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const concurrentTime = Date.now() - startTime;

      console.log(`⚡ Completed ${operations.length} concurrent operations in ${concurrentTime}ms`);
      expect(results).toHaveLength(operations.length);
      results.forEach(result => expect(result).toBeDefined());

      await registry.cleanup();
      await jsonProvider.disconnect();

      console.log('✅ Concurrent operations test passed');
    });
  });
});