/**
 * End-to-End Tests for Provider-Based Tool Registry
 * 
 * Tests the complete system working together in realistic scenarios
 */

import { ResourceManager } from '@legion/tools';
import { ProviderBasedToolRegistry } from '../../src/integration/ProviderBasedToolRegistry.js';
import { ToolRegistryProviderFactory } from '../../src/providers/ToolRegistryProviderFactory.js';
import { SemanticToolSearch } from '../../src/semantic/SemanticToolSearch.js';
import { ToolRegistryMigration } from '../../src/migration/ToolRegistryMigration.js';
import fs from 'fs/promises';
import path from 'path';

describe('Provider-Based Tool Registry E2E Tests', () => {
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

  describe('Complete Workflow: JSON to MongoDB Migration', () => {
    test('should migrate from JSON file to MongoDB and provide semantic search', async () => {
      console.log('🧪 Testing complete JSON to MongoDB migration workflow');

      try {
        // Step 1: Create JSON file provider to read existing data
        console.log('📄 Step 1: Creating JSON file provider');
        const jsonProvider = await ToolRegistryProviderFactory.createProvider(
          'jsonfile',
          resourceManager
        );

        const jsonRegistry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

        // Get baseline data from JSON
        const originalModules = await jsonRegistry.listModules();
        const originalTools = await jsonRegistry.listTools();

        console.log(`📊 Baseline: ${originalModules.length} modules, ${originalTools.length} tools`);
        expect(originalModules.length).toBeGreaterThan(0);
        expect(originalTools.length).toBeGreaterThan(0);

        // Step 2: Create MongoDB provider (if available)
        console.log('🗄️  Step 2: Creating MongoDB provider');
        let mongoProvider;
        let mongoRegistry;
        
        try {
          mongoProvider = await ToolRegistryProviderFactory.createProvider(
            'mongodb',
            resourceManager,
            { enableSemanticSearch: false } // Disable for basic test
          );
          mongoRegistry = await ProviderBasedToolRegistry.create(resourceManager, mongoProvider);
        } catch (error) {
          console.warn('⚠️  MongoDB not available, skipping migration test:', error.message);
          await jsonRegistry.cleanup();
          await jsonProvider.disconnect();
          return;
        }

        // Step 3: Run migration
        console.log('🔄 Step 3: Running migration');
        const migration = new ToolRegistryMigration(resourceManager);
        
        const migrationResult = await migration.migrate({
          clearExisting: true,
          discoverRuntimeTools: false, // Skip discovery for faster test
          generateEmbeddings: false    // Skip embeddings for basic test
        });

        expect(migrationResult.success).toBe(true);
        expect(migrationResult.stats.modulesProcessed).toBeGreaterThan(0);
        expect(migrationResult.stats.toolsProcessed).toBeGreaterThan(0);

        console.log(`✅ Migrated: ${migrationResult.stats.modulesProcessed} modules, ${migrationResult.stats.toolsProcessed} tools`);

        // Step 4: Verify data in MongoDB
        console.log('🔍 Step 4: Verifying migrated data');
        const migratedModules = await mongoRegistry.listModules();
        const migratedTools = await mongoRegistry.listTools();

        expect(migratedModules.length).toBeGreaterThan(0);
        expect(migratedTools.length).toBeGreaterThan(0);

        // Should have similar number of items (might not be exact due to data transformation)
        expect(migratedModules.length).toBeGreaterThanOrEqual(Math.floor(originalModules.length * 0.8));
        expect(migratedTools.length).toBeGreaterThanOrEqual(Math.floor(originalTools.length * 0.8));

        // Step 5: Test CRUD operations on MongoDB
        console.log('⚙️  Step 5: Testing CRUD operations');
        
        // Create a test module
        const testModule = {
          name: `E2ETestModule_${Date.now()}`,
          description: 'End-to-end test module',
          version: '1.0.0',
          type: 'test',
          tags: ['e2e', 'test'],
          category: 'testing',
          status: 'active'
        };

        const savedModule = await mongoProvider.saveModule(testModule);
        expect(savedModule).toBeDefined();
        expect(savedModule._id).toBeDefined();

        // Create a test tool
        const testTool = {
          name: `e2e_test_tool_${Date.now()}`,
          moduleName: testModule.name,
          moduleId: savedModule._id,
          description: 'End-to-end test tool',
          category: 'test',
          tags: ['e2e', 'test'],
          status: 'active',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Test input' }
            }
          }
        };

        const savedTool = await mongoProvider.saveTool(testTool);
        expect(savedTool).toBeDefined();
        expect(savedTool._id).toBeDefined();

        // Test retrieval
        const retrievedModule = await mongoRegistry.getModule(testModule.name);
        const retrievedTool = await mongoRegistry.getTool(testTool.name);

        expect(retrievedModule).toBeDefined();
        expect(retrievedModule.name).toBe(testModule.name);
        expect(retrievedTool).toBeDefined();
        expect(retrievedTool.name).toBe(testTool.name);

        // Test searching
        const searchResults = await mongoRegistry.searchTools('e2e test');
        expect(searchResults.length).toBeGreaterThan(0);
        expect(searchResults.some(tool => tool.name === testTool.name)).toBe(true);

        // Cleanup test data
        await mongoProvider.deleteTool(testTool.name, testModule.name);
        await mongoProvider.deleteModule(testModule.name);

        // Verify deletion
        const deletedModule = await mongoRegistry.getModule(testModule.name);
        const deletedTool = await mongoRegistry.getTool(testTool.name);
        expect(deletedModule).toBeNull();
        expect(deletedTool).toBeNull();

        console.log('✅ CRUD operations verified');

        // Cleanup
        await jsonRegistry.cleanup();
        await jsonProvider.disconnect();
        await mongoRegistry.cleanup();
        await mongoProvider.disconnect();

        console.log('🎉 Complete migration workflow successful!');
      } catch (error) {
        console.warn('⚠️  Migration workflow test skipped:', error.message);
        expect(error.message).toMatch(/MongoDB|connection|semantic/);
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
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

    test('should handle developer workflow: search, execute, track usage', async () => {
      console.log('🧪 Testing developer workflow scenario');

      // Create registry (use JSON file provider for reliability)
      provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      // Step 1: Developer searches for file tools
      console.log('🔍 Step 1: Searching for file-related tools');
      const fileTools = await registry.searchTools('file', { limit: 10 });
      expect(Array.isArray(fileTools)).toBe(true);

      if (fileTools.length > 0) {
        console.log(`📄 Found ${fileTools.length} file-related tools`);
        
        // Step 2: Get detailed info about a specific tool
        const firstTool = fileTools[0];
        const toolDetails = await registry.getTool(firstTool.name);
        
        expect(toolDetails).toBeDefined();
        expect(toolDetails.name).toBe(firstTool.name);
        expect(toolDetails).toHaveProperty('description');
        expect(toolDetails).toHaveProperty('moduleName');

        console.log(`🔧 Tool details: ${toolDetails.name} - ${toolDetails.description}`);

        // Step 3: Record usage (simulate tool execution)
        const usageData = {
          toolName: toolDetails.name,
          moduleName: toolDetails.moduleName,
          success: true,
          executionTime: Math.floor(Math.random() * 1000) + 100,
          metadata: {
            scenario: 'e2e_test',
            timestamp: new Date().toISOString()
          }
        };

        await provider.recordUsage(usageData);

        // Step 4: Check usage statistics
        const stats = await provider.getUsageStats(toolDetails.name, toolDetails.moduleName);
        expect(stats).toBeDefined();
        expect(stats.totalUsage).toBeGreaterThan(0);

        console.log(`📊 Usage stats: ${stats.totalUsage} total uses, success rate: ${(stats.successfulUsage / stats.totalUsage * 100).toFixed(1)}%`);

        // Step 5: Get trending tools
        const trending = await provider.getTrendingTools({ limit: 5 });
        expect(Array.isArray(trending)).toBe(true);
        
        if (trending.length > 0) {
          console.log(`📈 Top trending tool: ${trending[0].toolName} (${trending[0].recentUsage} recent uses)`);
        }
      }

      console.log('✅ Developer workflow scenario completed');
    });

    test('should handle system administrator workflow: health checks, statistics, maintenance', async () => {
      console.log('🧪 Testing system administrator workflow');

      provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      // Step 1: Health check
      console.log('🏥 Step 1: Performing health check');
      const health = await provider.healthCheck();
      
      expect(health).toBeDefined();
      expect(['healthy', 'degraded', 'error']).toContain(health.status);
      expect(typeof health.initialized).toBe('boolean');
      expect(typeof health.connected).toBe('boolean');

      console.log(`🏥 Health: ${health.status} (initialized: ${health.initialized}, connected: ${health.connected})`);

      // Step 2: Get system statistics
      console.log('📊 Step 2: Getting system statistics');
      const stats = await registry.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.modules).toBe('number');
      expect(typeof stats.tools).toBe('number');

      console.log(`📊 System stats: ${stats.modules} modules, ${stats.tools} tools`);

      // Step 3: Performance test - concurrent operations
      console.log('⚡ Step 3: Performance testing with concurrent operations');
      const startTime = Date.now();
      
      const operations = [
        registry.listModules({ limit: 10 }),
        registry.listTools({ limit: 20 }),
        registry.searchTools('test', { limit: 5 }),
        registry.getStats()
      ];

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(4);
      results.forEach(result => expect(result).toBeDefined());

      console.log(`⚡ Completed ${operations.length} concurrent operations in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Step 4: Provider capabilities check
      console.log('🔧 Step 4: Checking provider capabilities');
      const capabilities = provider.getCapabilities();
      
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);

      console.log(`🔧 Provider capabilities: ${capabilities.join(', ')}`);

      console.log('✅ System administrator workflow completed');
    });

    test('should handle data scientist workflow: semantic search and recommendations', async () => {
      console.log('🧪 Testing data scientist workflow');

      try {
        // Try to create MongoDB provider with semantic search
        provider = await ToolRegistryProviderFactory.createProvider(
          'mongodb',
          resourceManager,
          { enableSemanticSearch: true }
        );
        registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

        // Create semantic search instance
        const semanticSearch = await SemanticToolSearch.create(resourceManager, provider);

        // Step 1: Natural language tool search
        console.log('🧠 Step 1: Natural language tool search');
        const nlSearchResults = await semanticSearch.searchTools(
          'read data from files and process JSON',
          { limit: 10 }
        );

        expect(Array.isArray(nlSearchResults)).toBe(true);
        
        if (nlSearchResults.length > 0) {
          console.log(`🧠 Found ${nlSearchResults.length} semantically similar tools`);
          
          const firstResult = nlSearchResults[0];
          expect(firstResult).toHaveProperty('_similarity');
          expect(typeof firstResult._similarity).toBe('number');
          expect(firstResult._similarity).toBeGreaterThan(0);

          console.log(`🎯 Top result: ${firstResult.name} (similarity: ${Math.round(firstResult._similarity * 100)}%)`);
        }

        // Step 2: Task-based recommendations
        console.log('🎯 Step 2: Getting task-based recommendations');
        const recommendations = await semanticSearch.recommendToolsForTask(
          'analyze data files and generate reports'
        );

        expect(recommendations).toHaveProperty('taskDescription');
        expect(recommendations).toHaveProperty('recommendations');
        expect(Array.isArray(recommendations.recommendations)).toBe(true);

        console.log(`🎯 Got ${recommendations.totalRecommendations} recommendations for data analysis task`);

        if (recommendations.recommendations.length > 0) {
          const topRec = recommendations.recommendations[0];
          expect(topRec).toHaveProperty('tool');
          expect(topRec).toHaveProperty('similarity');
          expect(topRec).toHaveProperty('reasoning');
          
          console.log(`💡 Top recommendation: ${topRec.tool.name} - ${topRec.reasoning}`);
        }

        // Step 3: Find similar tools
        if (nlSearchResults.length > 0) {
          console.log('🔍 Step 3: Finding similar tools');
          const referenceTool = nlSearchResults[0];
          
          const similarTools = await semanticSearch.findSimilarTools(
            referenceTool.name,
            referenceTool.moduleName,
            { limit: 5 }
          );

          expect(Array.isArray(similarTools)).toBe(true);
          console.log(`🔍 Found ${similarTools.length} tools similar to ${referenceTool.name}`);
        }

        // Step 4: Search statistics
        console.log('📊 Step 4: Getting search statistics');
        const searchStats = await semanticSearch.getSearchStats();
        
        expect(searchStats).toBeDefined();
        expect(typeof searchStats.toolsIndexed).toBe('number');

        console.log(`📊 Search stats: ${searchStats.toolsIndexed} tools indexed`);

        await semanticSearch.cleanup();
        console.log('✅ Data scientist workflow completed');
      } catch (error) {
        console.warn('⚠️  Semantic search workflow skipped:', error.message);
        expect(error.message).toMatch(/MongoDB|semantic|OpenAI|Qdrant/i);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should gracefully handle provider failures and fallbacks', async () => {
      console.log('🧪 Testing error recovery and resilience');

      // Step 1: Test with recommended provider
      console.log('🔄 Step 1: Testing with recommended provider');
      const recommendation = ToolRegistryProviderFactory.getRecommendedProvider(resourceManager);
      console.log(`💡 Recommended: ${recommendation.type} - ${recommendation.reason}`);

      let provider = await ToolRegistryProviderFactory.createProvider(
        recommendation.type,
        resourceManager
      );
      let registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      // Verify basic functionality
      const modules = await registry.listModules({ limit: 5 });
      const tools = await registry.listTools({ limit: 10 });

      expect(Array.isArray(modules)).toBe(true);
      expect(Array.isArray(tools)).toBe(true);

      console.log(`✅ Primary provider working: ${modules.length} modules, ${tools.length} tools`);

      await registry.cleanup();
      await provider.disconnect();

      // Step 2: Test fallback to JSON file provider
      console.log('📄 Step 2: Testing fallback to JSON file provider');
      const jsonProvider = await ToolRegistryProviderFactory.createProvider(
        'jsonfile',
        resourceManager
      );
      const jsonRegistry = await ProviderBasedToolRegistry.create(resourceManager, jsonProvider);

      // Verify fallback works
      const jsonModules = await jsonRegistry.listModules({ limit: 5 });
      const jsonTools = await jsonRegistry.listTools({ limit: 10 });

      expect(Array.isArray(jsonModules)).toBe(true);
      expect(Array.isArray(jsonTools)).toBe(true);

      console.log(`✅ Fallback provider working: ${jsonModules.length} modules, ${jsonTools.length} tools`);

      // Step 3: Test error handling with non-existent items
      console.log('🚫 Step 3: Testing error handling with non-existent items');
      const nonExistentModule = await jsonRegistry.getModule('NonExistentModule');
      const nonExistentTool = await jsonRegistry.getTool('non_existent_tool');

      expect(nonExistentModule).toBeNull();
      expect(nonExistentTool).toBeNull();

      // Empty search should return empty array, not error
      const emptySearch = await jsonRegistry.searchTools('xyzzynopenothing');
      expect(Array.isArray(emptySearch)).toBe(true);
      expect(emptySearch).toHaveLength(0);

      console.log('✅ Error handling verified');

      await jsonRegistry.cleanup();
      await jsonProvider.disconnect();

      console.log('🛡️ Resilience testing completed successfully');
    });
  });

  describe('Integration with Existing Tools Module System', () => {
    test('should work alongside existing ToolRegistry', async () => {
      console.log('🧪 Testing integration with existing tools module system');

      // This test ensures the new provider-based system can coexist with existing code
      
      // Step 1: Create provider-based registry
      const provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      const newRegistry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      // Step 2: Verify we can get the same tools through both systems
      const newTools = await newRegistry.listTools({ limit: 10 });
      expect(Array.isArray(newTools)).toBe(true);

      if (newTools.length > 0) {
        const firstTool = newTools[0];
        expect(firstTool).toHaveProperty('name');
        expect(firstTool).toHaveProperty('moduleName');
        expect(firstTool).toHaveProperty('description');

        // Test individual tool retrieval
        const retrievedTool = await newRegistry.getTool(firstTool.name);
        expect(retrievedTool).toBeDefined();
        expect(retrievedTool.name).toBe(firstTool.name);
      }

      // Step 3: Test filtering and searching
      const readTools = await newRegistry.searchTools('read', { limit: 5 });
      const writeTools = await newRegistry.searchTools('write', { limit: 5 });
      
      expect(Array.isArray(readTools)).toBe(true);
      expect(Array.isArray(writeTools)).toBe(true);

      console.log(`🔍 Search results: ${readTools.length} read tools, ${writeTools.length} write tools`);

      // Step 4: Test module operations
      const allModules = await newRegistry.listModules();
      expect(Array.isArray(allModules)).toBe(true);
      
      if (allModules.length > 0) {
        const firstModule = allModules[0];
        expect(firstModule).toHaveProperty('name');
        expect(firstModule).toHaveProperty('description');

        const moduleTools = await newRegistry.listTools({
          moduleName: firstModule.name,
          limit: 10
        });
        expect(Array.isArray(moduleTools)).toBe(true);
        
        console.log(`📦 Module ${firstModule.name} has ${moduleTools.length} tools`);
      }

      await newRegistry.cleanup();
      await provider.disconnect();

      console.log('✅ Integration testing completed');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large-scale operations efficiently', async () => {
      console.log('🧪 Testing performance and scalability');

      const provider = await ToolRegistryProviderFactory.createFromEnvironment(resourceManager);
      const registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

      // Test 1: Large batch retrieval
      console.log('📦 Test 1: Large batch retrieval');
      const startTime1 = Date.now();
      
      const allModules = await registry.listModules();
      const allTools = await registry.listTools();
      
      const batchTime = Date.now() - startTime1;
      
      console.log(`📊 Retrieved ${allModules.length} modules and ${allTools.length} tools in ${batchTime}ms`);
      expect(batchTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test 2: Concurrent operations
      console.log('⚡ Test 2: Concurrent operations');
      const startTime2 = Date.now();
      
      const concurrentOps = [
        registry.listModules({ limit: 20 }),
        registry.listTools({ limit: 50 }),
        registry.searchTools('file', { limit: 10 }),
        registry.searchTools('data', { limit: 10 }),
        registry.getStats(),
        provider.healthCheck()
      ];

      const results = await Promise.all(concurrentOps);
      const concurrentTime = Date.now() - startTime2;

      console.log(`⚡ Completed ${concurrentOps.length} concurrent operations in ${concurrentTime}ms`);
      expect(concurrentTime).toBeLessThan(5000);
      expect(results).toHaveLength(concurrentOps.length);
      results.forEach(result => expect(result).toBeDefined());

      // Test 3: Pagination performance
      console.log('📄 Test 3: Pagination performance');
      const pageSize = 10;
      const maxPages = Math.min(5, Math.ceil(allTools.length / pageSize));
      
      let paginationTime = 0;
      let totalRetrieved = 0;

      for (let page = 0; page < maxPages; page++) {
        const pageStart = Date.now();
        const pageTools = await registry.listTools({
          limit: pageSize,
          skip: page * pageSize
        });
        paginationTime += Date.now() - pageStart;
        totalRetrieved += pageTools.length;
        
        expect(pageTools.length).toBeLessThanOrEqual(pageSize);
      }

      console.log(`📄 Retrieved ${totalRetrieved} tools across ${maxPages} pages in ${paginationTime}ms`);
      expect(paginationTime / maxPages).toBeLessThan(1000); // Average page time should be < 1s

      // Test 4: Search performance
      console.log('🔍 Test 4: Search performance');
      const searchQueries = ['file', 'data', 'http', 'json', 'command'];
      const searchStart = Date.now();
      
      for (const query of searchQueries) {
        const searchResults = await registry.searchTools(query, { limit: 10 });
        expect(Array.isArray(searchResults)).toBe(true);
      }
      
      const searchTime = Date.now() - searchStart;
      console.log(`🔍 Completed ${searchQueries.length} searches in ${searchTime}ms`);
      expect(searchTime / searchQueries.length).toBeLessThan(500); // Average search < 500ms

      await registry.cleanup();
      await provider.disconnect();

      console.log('🚀 Performance testing completed successfully');
    });
  });

  describe('Data Consistency and Integrity', () => {
    test('should maintain data consistency across operations', async () => {
      console.log('🧪 Testing data consistency and integrity');

      try {
        // Use MongoDB provider for this test (supports transactions)
        const provider = await ToolRegistryProviderFactory.createProvider(
          'mongodb',
          resourceManager,
          { enableSemanticSearch: false }
        );
        const registry = await ProviderBasedToolRegistry.create(resourceManager, provider);

        // Test 1: Create related data
        console.log('🔗 Test 1: Creating related module and tools');
        const testModuleName = `ConsistencyTest_${Date.now()}`;
        
        const moduleData = {
          name: testModuleName,
          description: 'Consistency test module',
          version: '1.0.0',
          type: 'test',
          tags: ['consistency', 'test'],
          category: 'testing',
          status: 'active'
        };

        const savedModule = await provider.saveModule(moduleData);
        expect(savedModule).toBeDefined();
        expect(savedModule._id).toBeDefined();

        // Create multiple tools for this module
        const toolNames = ['tool_one', 'tool_two', 'tool_three'];
        const savedTools = [];

        for (const toolName of toolNames) {
          const toolData = {
            name: toolName,
            moduleName: testModuleName,
            moduleId: savedModule._id,
            description: `Test tool ${toolName}`,
            category: 'test',
            tags: ['consistency', 'test'],
            status: 'active'
          };

          const savedTool = await provider.saveTool(toolData);
          expect(savedTool).toBeDefined();
          expect(savedTool._id).toBeDefined();
          savedTools.push(savedTool);
        }

        console.log(`✅ Created module with ${toolNames.length} tools`);

        // Test 2: Verify referential integrity
        console.log('🔍 Test 2: Verifying referential integrity');
        
        const moduleTools = await registry.listTools({ 
          moduleName: testModuleName 
        });
        expect(moduleTools).toHaveLength(toolNames.length);

        for (const tool of moduleTools) {
          expect(tool.moduleName).toBe(testModuleName);
          expect(tool.moduleId).toBe(savedModule._id);
        }

        // Test 3: Update operations maintain consistency
        console.log('🔄 Test 3: Testing update consistency');
        
        const updatedModule = {
          ...savedModule,
          description: 'Updated consistency test module',
          version: '1.1.0'
        };

        const saveResult = await provider.saveModule(updatedModule);
        expect(saveResult.description).toBe(updatedModule.description);
        expect(saveResult.version).toBe(updatedModule.version);

        // Verify tools still reference correct module
        const toolsAfterUpdate = await registry.listTools({ 
          moduleName: testModuleName 
        });
        expect(toolsAfterUpdate).toHaveLength(toolNames.length);

        // Test 4: Search consistency
        console.log('🔍 Test 4: Testing search consistency');
        
        const searchResults = await registry.searchTools('consistency test');
        const ourTools = searchResults.filter(tool => 
          tool.moduleName === testModuleName
        );
        expect(ourTools.length).toBeGreaterThan(0);

        // Test 5: Cleanup and verify cascade behavior
        console.log('🧹 Test 5: Testing cleanup and cascading');
        
        // Delete tools first
        for (const toolName of toolNames) {
          const deleteResult = await provider.deleteTool(toolName, testModuleName);
          expect(deleteResult.success).toBe(true);
        }

        // Verify tools are gone
        const remainingTools = await registry.listTools({ 
          moduleName: testModuleName 
        });
        expect(remainingTools).toHaveLength(0);

        // Delete module
        const moduleDeleteResult = await provider.deleteModule(testModuleName);
        expect(moduleDeleteResult.success).toBe(true);

        // Verify module is gone
        const remainingModule = await registry.getModule(testModuleName);
        expect(remainingModule).toBeNull();

        await registry.cleanup();
        await provider.disconnect();

        console.log('✅ Data consistency testing completed');
      } catch (error) {
        console.warn('⚠️  Consistency test skipped (MongoDB required):', error.message);
        expect(error.message).toMatch(/MongoDB|connection/);
      }
    });
  });
});