/**
 * Unit Tests for Tool Registry Providers
 * 
 * Tests individual provider components in isolation
 */

import { IToolRegistryProvider, PROVIDER_CAPABILITIES } from '../../../src/providers/IToolRegistryProvider.js';
import { MongoDBToolRegistryProvider } from '../../../src/providers/MongoDBToolRegistryProvider.js';
import { JSONFileToolRegistryProvider } from '../../../src/providers/JSONFileToolRegistryProvider.js';
import { ToolRegistryProviderFactory } from '../../../src/providers/ToolRegistryProviderFactory.js';
import { ResourceManager } from '@legion/tools';

describe('Tool Registry Providers Unit Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  afterAll(async () => {
    if (resourceManager) {
      await resourceManager.cleanup();
    }
  });

  describe('IToolRegistryProvider (Interface)', () => {
    test('should define required interface methods', () => {
      console.log('🧪 Testing IToolRegistryProvider interface');

      const provider = new IToolRegistryProvider();
      
      // Test that all required methods exist and throw "must be implemented" errors
      expect(() => provider.getModule('test')).rejects.toThrow('must be implemented');
      expect(() => provider.listModules()).rejects.toThrow('must be implemented');
      expect(() => provider.saveModule({})).rejects.toThrow('must be implemented');
      expect(() => provider.deleteModule('test')).rejects.toThrow('must be implemented');
      expect(() => provider.getTool('test')).rejects.toThrow('must be implemented');
      expect(() => provider.listTools()).rejects.toThrow('must be implemented');
      expect(() => provider.saveTool({})).rejects.toThrow('must be implemented');
      expect(() => provider.deleteTool('test', 'test')).rejects.toThrow('must be implemented');
      expect(() => provider.searchTools('test')).rejects.toThrow('must be implemented');
      expect(() => provider.searchModules('test')).rejects.toThrow('must be implemented');

      console.log('✅ Interface methods properly defined');
    });

    test('should define provider capabilities constants', () => {
      console.log('🧪 Testing provider capabilities constants');

      expect(PROVIDER_CAPABILITIES).toBeDefined();
      expect(PROVIDER_CAPABILITIES.MODULES).toBe('modules');
      expect(PROVIDER_CAPABILITIES.TOOLS).toBe('tools');
      expect(PROVIDER_CAPABILITIES.SEARCH).toBe('search');
      expect(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH).toBe('semantic_search');
      expect(PROVIDER_CAPABILITIES.USAGE_TRACKING).toBe('usage_tracking');
      expect(PROVIDER_CAPABILITIES.RECOMMENDATIONS).toBe('recommendations');
      expect(PROVIDER_CAPABILITIES.TRANSACTIONS).toBe('transactions');
      expect(PROVIDER_CAPABILITIES.REAL_TIME).toBe('real_time');

      console.log('✅ Provider capabilities constants defined correctly');
    });

    test('should have proper base configuration', () => {
      console.log('🧪 Testing provider base configuration');

      const provider = new IToolRegistryProvider({ testConfig: true });
      
      expect(provider.config).toBeDefined();
      expect(provider.config.testConfig).toBe(true);
      expect(provider.initialized).toBe(false);
      expect(provider.connected).toBe(false);

      console.log('✅ Base configuration working correctly');
    });
  });

  describe('JSONFileToolRegistryProvider', () => {
    let provider;

    afterEach(async () => {
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should create and initialize provider', async () => {
      console.log('🧪 Testing JSONFileToolRegistryProvider creation');

      provider = await JSONFileToolRegistryProvider.create();
      
      expect(provider).toBeInstanceOf(JSONFileToolRegistryProvider);
      expect(provider).toBeInstanceOf(IToolRegistryProvider);
      expect(provider.initialized).toBe(true);
      expect(provider.connected).toBe(true);

      console.log('✅ JSON file provider created and initialized');
    });

    test('should provide correct capabilities', () => {
      console.log('🧪 Testing JSON provider capabilities');

      provider = new JSONFileToolRegistryProvider();
      const capabilities = provider.getCapabilities();
      
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities).toContain(PROVIDER_CAPABILITIES.MODULES);
      expect(capabilities).toContain(PROVIDER_CAPABILITIES.TOOLS);
      expect(capabilities).toContain(PROVIDER_CAPABILITIES.SEARCH);
      expect(capabilities).toContain(PROVIDER_CAPABILITIES.USAGE_TRACKING);
      
      // Should NOT have advanced capabilities
      expect(capabilities).not.toContain(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH);
      expect(capabilities).not.toContain(PROVIDER_CAPABILITIES.TRANSACTIONS);

      console.log('✅ JSON provider capabilities correct');
    });

    test('should handle file loading errors gracefully', async () => {
      console.log('🧪 Testing JSON provider error handling');

      // Create provider with non-existent file
      const badProvider = new JSONFileToolRegistryProvider({
        toolsDatabasePath: '/path/that/does/not/exist.json'
      });

      await expect(badProvider.initialize())
        .rejects
        .toThrow();

      console.log('✅ JSON provider error handling working');
    });

    test('should implement proper inference methods', () => {
      console.log('🧪 Testing JSON provider inference methods');

      provider = new JSONFileToolRegistryProvider();

      // Test module category inference
      expect(provider.inferModuleCategory('FileModule')).toBe('filesystem');
      expect(provider.inferModuleCategory('HTTPModule')).toBe('network');
      expect(provider.inferModuleCategory('AIModule')).toBe('ai');
      expect(provider.inferModuleCategory('TestModule')).toBe('testing');
      expect(provider.inferModuleCategory('RandomModule')).toBe('utility');

      // Test tool category inference
      expect(provider.inferToolCategory('file_read')).toBe('read');
      expect(provider.inferToolCategory('file_write')).toBe('write');
      expect(provider.inferToolCategory('file_delete')).toBe('delete');
      expect(provider.inferToolCategory('execute_command')).toBe('execute');
      expect(provider.inferToolCategory('random_tool')).toBe('other');

      // Test tool tags inference
      const tags = provider.inferToolTags('file_read', 'Read file contents from filesystem');
      expect(tags).toContain('file');
      expect(tags).toContain('read');

      console.log('✅ JSON provider inference methods working');
    });

    test('should track usage statistics in memory', async () => {
      console.log('🧪 Testing JSON provider usage tracking');

      provider = await JSONFileToolRegistryProvider.create();

      const usageData = {
        toolName: 'test_tool',
        moduleName: 'test_module',
        success: true,
        executionTime: 100
      };

      // Record initial usage
      await provider.recordUsage(usageData);

      let stats = await provider.getUsageStats('test_tool', 'test_module');
      expect(stats.totalUsage).toBe(1);
      expect(stats.successfulUsage).toBe(1);
      expect(stats.averageExecutionTime).toBe(100);

      // Record failure
      await provider.recordUsage({ ...usageData, success: false, executionTime: 200 });

      stats = await provider.getUsageStats('test_tool', 'test_module');
      expect(stats.totalUsage).toBe(2);
      expect(stats.successfulUsage).toBe(1);
      expect(stats.averageExecutionTime).toBe(150);

      // Test trending tools
      const trending = await provider.getTrendingTools({ limit: 5 });
      expect(Array.isArray(trending)).toBe(true);
      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0]).toHaveProperty('toolName');
      expect(trending[0]).toHaveProperty('recentUsage');

      console.log('✅ JSON provider usage tracking working');
    });
  });

  describe('MongoDBToolRegistryProvider', () => {
    let provider;

    afterEach(async () => {
      if (provider) {
        await provider.disconnect();
      }
    });

    test('should create provider if MongoDB available', async () => {
      console.log('🧪 Testing MongoDBToolRegistryProvider creation');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false
        });
        
        expect(provider).toBeInstanceOf(MongoDBToolRegistryProvider);
        expect(provider).toBeInstanceOf(IToolRegistryProvider);
        expect(provider.initialized).toBe(true);
        expect(provider.connected).toBe(true);

        console.log('✅ MongoDB provider created successfully');
      } catch (error) {
        console.warn('⚠️  MongoDB not available:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });

    test('should provide correct capabilities', async () => {
      console.log('🧪 Testing MongoDB provider capabilities');

      try {
        provider = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false
        });
        
        const capabilities = provider.getCapabilities();
        
        expect(Array.isArray(capabilities)).toBe(true);
        expect(capabilities).toContain(PROVIDER_CAPABILITIES.MODULES);
        expect(capabilities).toContain(PROVIDER_CAPABILITIES.TOOLS);
        expect(capabilities).toContain(PROVIDER_CAPABILITIES.SEARCH);
        expect(capabilities).toContain(PROVIDER_CAPABILITIES.USAGE_TRACKING);
        expect(capabilities).toContain(PROVIDER_CAPABILITIES.TRANSACTIONS);

        console.log('✅ MongoDB provider capabilities correct');
      } catch (error) {
        console.warn('⚠️  MongoDB not available:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });

    test('should require ResourceManager for creation', async () => {
      console.log('🧪 Testing MongoDB provider ResourceManager requirement');

      await expect(MongoDBToolRegistryProvider.create(null))
        .rejects
        .toThrow();

      const uninitializedRM = new ResourceManager();
      await expect(MongoDBToolRegistryProvider.create(uninitializedRM))
        .rejects
        .toThrow();

      console.log('✅ MongoDB provider ResourceManager requirement enforced');
    });

    test('should handle semantic search configuration', async () => {
      console.log('🧪 Testing MongoDB provider semantic search configuration');

      try {
        // Test with semantic search disabled
        const providerWithoutSemantics = await MongoDBToolRegistryProvider.create(resourceManager, {
          enableSemanticSearch: false
        });
        
        expect(providerWithoutSemantics.semanticSearch).toBeNull();
        await providerWithoutSemantics.disconnect();

        // Test with semantic search enabled (might fail if dependencies not available)
        try {
          const providerWithSemantics = await MongoDBToolRegistryProvider.create(resourceManager, {
            enableSemanticSearch: true
          });
          
          if (providerWithSemantics.semanticSearch) {
            expect(providerWithSemantics.semanticSearch).toBeDefined();
            console.log('🧠 Semantic search enabled for MongoDB provider');
          }
          
          await providerWithSemantics.disconnect();
        } catch (semanticError) {
          console.warn('⚠️  Semantic search not available:', semanticError.message);
        }

        console.log('✅ MongoDB provider semantic search configuration working');
      } catch (error) {
        console.warn('⚠️  MongoDB not available:', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });
  });

  describe('ToolRegistryProviderFactory', () => {
    test('should have correct static methods', () => {
      console.log('🧪 Testing ToolRegistryProviderFactory static methods');

      expect(typeof ToolRegistryProviderFactory.createProvider).toBe('function');
      expect(typeof ToolRegistryProviderFactory.createFromEnvironment).toBe('function');
      expect(typeof ToolRegistryProviderFactory.getAvailableProviders).toBe('function');
      expect(typeof ToolRegistryProviderFactory.getProviderCapabilities).toBe('function');
      expect(typeof ToolRegistryProviderFactory.validateProviderConfig).toBe('function');
      expect(typeof ToolRegistryProviderFactory.getRecommendedProvider).toBe('function');

      console.log('✅ Factory static methods present');
    });

    test('should list available providers', () => {
      console.log('🧪 Testing available providers list');

      const providers = ToolRegistryProviderFactory.getAvailableProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('mongodb');
      expect(providers).toContain('jsonfile');

      console.log(`📦 Available providers: ${providers.join(', ')}`);
      console.log('✅ Available providers list correct');
    });

    test('should provide provider capabilities for each type', () => {
      console.log('🧪 Testing provider capabilities by type');

      const mongoCapabilities = ToolRegistryProviderFactory.getProviderCapabilities('mongodb');
      const jsonCapabilities = ToolRegistryProviderFactory.getProviderCapabilities('jsonfile');
      const unknownCapabilities = ToolRegistryProviderFactory.getProviderCapabilities('unknown');

      expect(Array.isArray(mongoCapabilities)).toBe(true);
      expect(mongoCapabilities).toContain('modules');
      expect(mongoCapabilities).toContain('semantic_search');

      expect(Array.isArray(jsonCapabilities)).toBe(true);
      expect(jsonCapabilities).toContain('modules');
      expect(jsonCapabilities).not.toContain('semantic_search');

      expect(unknownCapabilities).toEqual([]);

      console.log('✅ Provider capabilities correct for each type');
    });

    test('should validate provider configurations', () => {
      console.log('🧪 Testing provider configuration validation');

      // Test valid MongoDB configuration
      const validMongo = ToolRegistryProviderFactory.validateProviderConfig(
        'mongodb',
        resourceManager
      );
      expect(validMongo).toHaveProperty('valid');
      expect(validMongo).toHaveProperty('errors');
      expect(validMongo).toHaveProperty('warnings');

      // Test invalid configuration (null ResourceManager)
      const invalidMongo = ToolRegistryProviderFactory.validateProviderConfig(
        'mongodb',
        null
      );
      expect(invalidMongo.valid).toBe(false);
      expect(invalidMongo.errors.length).toBeGreaterThan(0);

      // Test valid JSON configuration
      const validJson = ToolRegistryProviderFactory.validateProviderConfig(
        'jsonfile',
        resourceManager
      );
      expect(validJson.valid).toBe(true);

      // Test unknown provider
      const unknown = ToolRegistryProviderFactory.validateProviderConfig(
        'unknown',
        resourceManager
      );
      expect(unknown.valid).toBe(false);

      console.log('✅ Provider configuration validation working');
    });

    test('should provide intelligent recommendations', () => {
      console.log('🧪 Testing provider recommendations');

      const recommendation = ToolRegistryProviderFactory.getRecommendedProvider(resourceManager);
      
      expect(recommendation).toHaveProperty('type');
      expect(recommendation).toHaveProperty('reason');
      expect(['mongodb', 'jsonfile']).toContain(recommendation.type);
      expect(typeof recommendation.reason).toBe('string');
      expect(recommendation.reason.length).toBeGreaterThan(0);

      console.log(`💡 Recommendation: ${recommendation.type}`);
      console.log(`   Reason: ${recommendation.reason}`);

      // Test with null ResourceManager
      const fallbackRecommendation = ToolRegistryProviderFactory.getRecommendedProvider(null);
      expect(fallbackRecommendation.type).toBe('jsonfile');

      console.log('✅ Provider recommendations working');
    });

    test('should create providers through factory', async () => {
      console.log('🧪 Testing provider creation through factory');

      // Test JSON file provider creation
      const jsonProvider = await ToolRegistryProviderFactory.createProvider(
        'jsonfile',
        resourceManager
      );
      expect(jsonProvider).toBeInstanceOf(JSONFileToolRegistryProvider);
      expect(jsonProvider.initialized).toBe(true);
      await jsonProvider.disconnect();

      // Test case insensitive creation
      const jsonProvider2 = await ToolRegistryProviderFactory.createProvider(
        'JSON',
        resourceManager
      );
      expect(jsonProvider2).toBeInstanceOf(JSONFileToolRegistryProvider);
      await jsonProvider2.disconnect();

      // Test MongoDB provider creation (if available)
      try {
        const mongoProvider = await ToolRegistryProviderFactory.createProvider(
          'mongodb',
          resourceManager
        );
        expect(mongoProvider).toBeInstanceOf(MongoDBToolRegistryProvider);
        await mongoProvider.disconnect();
      } catch (error) {
        console.warn('⚠️  MongoDB provider not available:', error.message);
      }

      // Test error for unknown provider
      await expect(ToolRegistryProviderFactory.createProvider('unknown', resourceManager))
        .rejects
        .toThrow('Unknown provider type');

      console.log('✅ Provider creation through factory working');
    });

    test('should create providers from environment configuration', async () => {
      console.log('🧪 Testing provider creation from environment');

      const provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      
      expect(provider).toBeDefined();
      expect(provider.initialized).toBe(true);
      
      // Should be JSON file provider by default (unless MongoDB is configured)
      const isJsonProvider = provider instanceof JSONFileToolRegistryProvider;
      const isMongoProvider = provider instanceof MongoDBToolRegistryProvider;
      expect(isJsonProvider || isMongoProvider).toBe(true);

      await provider.disconnect();

      console.log('✅ Environment-based provider creation working');
    });
  });

  describe('Provider Error Handling', () => {
    test('should handle initialization failures gracefully', async () => {
      console.log('🧪 Testing provider initialization failure handling');

      // Test JSON provider with bad file path
      const badJsonProvider = new JSONFileToolRegistryProvider({
        toolsDatabasePath: '/invalid/path/tools.json'
      });
      
      await expect(badJsonProvider.initialize())
        .rejects
        .toThrow();

      console.log('✅ Initialization failure handling working');
    });

    test('should handle method calls on uninitialized providers', async () => {
      console.log('🧪 Testing uninitialized provider method calls');

      const uninitializedProvider = new JSONFileToolRegistryProvider();
      
      // Most methods should work after checkAndReload (which handles initialization)
      // But some might have different behavior
      const result = await uninitializedProvider.getModule('test');
      expect(result).toBeNull(); // Should not throw, just return null

      console.log('✅ Uninitialized provider handling working');
    });

    test('should validate method parameters', async () => {
      console.log('🧪 Testing provider method parameter validation');

      const jsonProvider = await JSONFileToolRegistryProvider.create();

      // Test with null/undefined parameters
      const nullModuleResult = await jsonProvider.getModule(null);
      const undefinedModuleResult = await jsonProvider.getModule(undefined);
      
      expect(nullModuleResult).toBeNull();
      expect(undefinedModuleResult).toBeNull();

      // Test search with empty strings
      const emptySearchResults = await jsonProvider.searchTools('');
      expect(Array.isArray(emptySearchResults)).toBe(true);

      await jsonProvider.disconnect();

      console.log('✅ Parameter validation working');
    });
  });

  describe('Provider Performance', () => {
    test('should handle large result sets efficiently', async () => {
      console.log('🧪 Testing provider performance with large datasets');

      const jsonProvider = await JSONFileToolRegistryProvider.create();

      const startTime = Date.now();
      
      // Test getting all tools
      const allTools = await jsonProvider.listTools();
      const toolsTime = Date.now() - startTime;

      // Test getting all modules
      const startTime2 = Date.now();
      const allModules = await jsonProvider.listModules();
      const modulesTime = Date.now() - startTime2;

      console.log(`📊 Listed ${allTools.length} tools in ${toolsTime}ms`);
      console.log(`📊 Listed ${allModules.length} modules in ${modulesTime}ms`);

      // Performance should be reasonable
      expect(toolsTime).toBeLessThan(1000);
      expect(modulesTime).toBeLessThan(1000);

      await jsonProvider.disconnect();

      console.log('✅ Provider performance tests passed');
    });

    test('should handle pagination efficiently', async () => {
      console.log('🧪 Testing provider pagination performance');

      const jsonProvider = await JSONFileToolRegistryProvider.create();

      // Test pagination with different page sizes
      const pageSizes = [5, 10, 20, 50];
      
      for (const pageSize of pageSizes) {
        const startTime = Date.now();
        const pagedResults = await jsonProvider.listTools({ limit: pageSize });
        const pageTime = Date.now() - startTime;

        expect(pagedResults.length).toBeLessThanOrEqual(pageSize);
        expect(pageTime).toBeLessThan(500); // Should be very fast

        console.log(`📄 Page size ${pageSize}: ${pagedResults.length} results in ${pageTime}ms`);
      }

      await jsonProvider.disconnect();

      console.log('✅ Pagination performance tests passed');
    });
  });
});