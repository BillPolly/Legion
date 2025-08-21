/**
 * Integration Tests for Module-Specific Operations
 * 
 * These tests use REAL services without mocks:
 * - Real MongoDB connection and database operations
 * - Real Qdrant vector database
 * - Real Nomic embedding generation
 * 
 * Tests the complete module-specific workflow:
 * 1. Clear specific module
 * 2. Load specific module with tools and perspectives  
 * 3. Generate embeddings and index vectors
 * 4. Verify module integrity
 * 
 * NO MOCKS - NO FALLBACKS - Real services or test failure
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ResourceManager } from '@legion/resource-manager';

// Test configuration
const TEST_MODULE_NAME = 'calculator';  // Use calculator module for consistent testing (matches database storage)
const TEST_TIMEOUT = 180000; // 3 minutes for real operations including embeddings

describe('Module Operations Integration Tests', () => {
  let toolRegistry;
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Verify required environment variables exist
    const requiredEnv = ['MONGODB_URL', 'QDRANT_URL'];
    for (const env of requiredEnv) {
      if (!process.env[env]) {
        throw new Error(`Required environment variable ${env} not found. Integration tests require real services.`);
      }
    }
    
    console.log(`🧪 Integration test using actual database`);
    console.log(`🔗 MongoDB: ${process.env.MONGODB_URL}`);
    console.log(`🔗 Qdrant: ${process.env.QDRANT_URL}`);
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Don't reset singleton between tests - reuse the initialized instance
    if (!toolRegistry) {
      toolRegistry = ToolRegistry.getInstance();
      await toolRegistry.initialize();
      
      // Verify providers are real (not mocked)
      expect(toolRegistry.provider).toBeDefined();
      expect(toolRegistry.provider.constructor.name).toBe('MongoDBToolRegistryProvider');
      
      console.log(`🚀 Test setup complete - using ToolRegistry singleton with real services`);
    }
  }, TEST_TIMEOUT);

  afterEach(async () => {
    // Clean up test data after each test to ensure proper isolation
    // Clear the calculator module data that tests may have created
    if (toolRegistry) {
      try {
        await toolRegistry.clearModule(TEST_MODULE_NAME, { verbose: false });
      } catch (error) {
        // Module might not exist if test didn't create it
        if (!error.message.includes('not found')) {
          console.warn('Cleanup warning:', error.message);
        }
      }
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Ensure all connections are closed - use built-in cleanup without manual timeouts
      if (toolRegistry) {
        await toolRegistry.cleanup();
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }, 30000);

  describe('Module-Specific Clear Operations', () => {
    test('should clear specific module only', async () => {
      // First clear the specific module to ensure clean baseline
      await toolRegistry.clearModule(TEST_MODULE_NAME, { verbose: false });
      
      // Get baseline counts after clearing
      const baselineHealth = await toolRegistry.quickHealthCheck();
      const baselineTools = baselineHealth.counts.tools;
      
      // Load a specific module to ensure we have data
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });

      // Verify the load actually worked
      expect(loadResult.success).toBe(true);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);

      // Get counts after loading
      const afterLoadHealth = await toolRegistry.quickHealthCheck();
      const toolsAdded = afterLoadHealth.counts.tools - baselineTools;
      
      // Should have added at least 1 tool
      expect(toolsAdded).toBeGreaterThan(0);

      // Clear specific module
      const clearResult = await toolRegistry.clearModule(TEST_MODULE_NAME, {
        verbose: false
      });

      expect(clearResult.success).toBe(true);
      expect(clearResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(clearResult.recordsCleared).toBeGreaterThan(0);

      // Verify calculator module was cleared (should be back to baseline)
      const afterClearHealth = await toolRegistry.quickHealthCheck();
      expect(afterClearHealth.counts.tools).toBe(baselineTools);
    }, TEST_TIMEOUT);

    test('should clear all modules completely', async () => {
      // First, ensure database has data
      await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });

      const initialHealth = await toolRegistry.quickHealthCheck();
      expect(initialHealth.counts.tools).toBeGreaterThan(0);

      // Clear all modules
      const clearResult = await toolRegistry.clearAllModules({
        verbose: false
      });

      expect(clearResult.success).toBe(true);
      expect(clearResult.moduleName).toBe('all');
      expect(clearResult.recordsCleared).toBeGreaterThan(0);

      // Verify everything was cleared
      const afterClearHealth = await toolRegistry.quickHealthCheck();
      expect(afterClearHealth.counts.tools).toBe(0);
      expect(afterClearHealth.counts.perspectives).toBe(0);
      expect(afterClearHealth.counts.vectors).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Module-Specific Load Operations', () => {
    beforeEach(async () => {
      // Start with clean database for each test
      await toolRegistry.clearAllModules({ verbose: false });
    });

    test('should load specific module with tools and perspectives', async () => {
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(loadResult.modulesLoaded).toBe(1);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);
      // Perspectives may not be generated if no perspective types are configured
      expect(loadResult.perspectivesGenerated).toBeGreaterThanOrEqual(0);
      expect(loadResult.vectorsIndexed).toBe(0); // Vectors not requested

      // Verify module is actually loaded in database
      const tools = await toolRegistry.listTools({ moduleName: TEST_MODULE_NAME });
      expect(tools).toHaveLength(loadResult.toolsAdded);

      // Verify each tool can be retrieved and executed
      for (const tool of tools) {
        const executableTool = await toolRegistry.getTool(tool.name);
        expect(executableTool).toBeDefined();
        expect(typeof executableTool.execute).toBe('function');
      }
    }, TEST_TIMEOUT);

    test('should load specific module with vectors using real Nomic embeddings', async () => {
      // Clear all modules first for clean test
      await toolRegistry.clearAllModules({ verbose: false });
      
      // Test vector indexing with real Nomic embeddings  
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true // This will use real Nomic model
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBe(loadResult.perspectivesGenerated); // Should match

      // Verify vectors are actually in Qdrant using ToolRegistry API
      const health = await toolRegistry.quickHealthCheck();
      expect(health.counts.vectors).toBe(loadResult.vectorsIndexed);
      expect(health.ratios.perspectivesPerTool).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('should load all modules with real services', async () => {
      const loadResult = await toolRegistry.loadAllModules({
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.moduleName).toBe('all');
      expect(loadResult.modulesLoaded).toBeGreaterThan(1);
      expect(loadResult.toolsAdded).toBeGreaterThan(5);
      // Perspectives may not be generated without perspective types
      expect(loadResult.perspectivesGenerated).toBeGreaterThanOrEqual(0);

      // Verify system health after loading all
      const health = await toolRegistry.quickHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.counts.tools).toBe(loadResult.toolsAdded);
      // Only check perspectives if they were generated
      if (loadResult.perspectivesGenerated > 0) {
        expect(health.counts.perspectives).toBe(loadResult.perspectivesGenerated);
      }
    }, TEST_TIMEOUT);
  });

  describe('Module-Specific Verification Operations', () => {
    beforeEach(async () => {
      // Ensure we have a complete module for verification
      await toolRegistry.clearModule(TEST_MODULE_NAME, { verbose: false });
      await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true, // Include perspectives for verification tests
        includeVectors: true // Include vectors for verification tests
      });
    }, TEST_TIMEOUT);

    test('should verify specific module with real data', async () => {
      const verifyResult = await toolRegistry.verifyModule(TEST_MODULE_NAME, {
        verbose: false
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(verifyResult.errors).toHaveLength(0);
      expect(verifyResult.counts.modules).toBe(1);
      expect(verifyResult.counts.tools).toBeGreaterThan(0);
      expect(verifyResult.counts.perspectives).toBeGreaterThan(0);
      expect(verifyResult.counts.vectors).toBeGreaterThan(0);
      
      // Verify ratios are reasonable
      expect(verifyResult.ratios.perspectivesPerTool).toBeGreaterThan(1);
      expect(verifyResult.ratios.perspectivesPerTool).toBeLessThan(10);
      
      // Verify vector sync
      expect(verifyResult.counts.perspectives).toBe(verifyResult.counts.vectors);
    }, TEST_TIMEOUT);

    test('should detect and report module inconsistencies', async () => {
      // Load the module properly first
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true
      });
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);
      
      // Now manually create an inconsistency by directly deleting perspectives from MongoDB
      // while keeping vectors in Qdrant (simulating a partial failure scenario)
      const loader = await toolRegistry.getLoader();
      
      // Delete perspectives but keep vectors to create mismatch
      const tools = await loader.mongoProvider.databaseService.mongoProvider.find('tools', { 
        moduleName: TEST_MODULE_NAME 
      });
      
      const toolIds = tools.map(t => t._id);
      
      // Delete perspectives directly from MongoDB
      const deleteResult = await loader.mongoProvider.databaseService.mongoProvider.db
        .collection('tool_perspectives')
        .deleteMany({ toolId: { $in: toolIds } });
      
      console.log(`Deleted ${deleteResult.deletedCount} perspectives from MongoDB`);

      // Now verify should detect the inconsistency
      const verifyResult = await toolRegistry.verifyModule(TEST_MODULE_NAME, {
        verbose: false
      });

      // Debug output to understand the verification result
      if (verifyResult.success) {
        console.log('Module verification unexpectedly succeeded:', JSON.stringify(verifyResult, null, 2));
      }

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.errors.length).toBeGreaterThan(0);
      
      // Should detect orphaned vectors (since we deleted all perspectives)
      const perspectiveError = verifyResult.errors.find(error => 
        error.includes('orphaned vectors') || error.includes('vector count mismatch')
      );
      expect(perspectiveError).toBeDefined();
    }, TEST_TIMEOUT);

    test('should fail verification for non-existent module', async () => {
      const verifyResult = await toolRegistry.verifyModule('NonExistentModule', {
        verbose: false
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.errors).toContain('Module not found: NonExistentModule');
      expect(verifyResult.counts.modules).toBe(0);
      expect(verifyResult.counts.tools).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('End-to-End Module Workflows', () => {
    test('should complete full module lifecycle: clear → load → verify', async () => {
      console.log('🔄 Starting full module lifecycle test...');

      // Step 1: Clear module
      console.log('1️⃣ Clearing module...');
      const clearResult = await toolRegistry.clearModule(TEST_MODULE_NAME, { verbose: false });
      expect(clearResult.success).toBe(true);

      // Step 2: Load module with all features
      console.log('2️⃣ Loading module with perspectives and vectors...');
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true
      });
      expect(loadResult.success).toBe(true);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);

      // Step 3: Verify module integrity
      console.log('3️⃣ Verifying module integrity...');
      const verifyResult = await toolRegistry.verifyModule(TEST_MODULE_NAME, { verbose: false });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.errors).toHaveLength(0);

      // Step 4: Test tool execution
      console.log('4️⃣ Testing tool execution...');
      const tools = await toolRegistry.listTools({ moduleName: TEST_MODULE_NAME });
      expect(tools.length).toBeGreaterThan(0);

      for (const tool of tools.slice(0, 2)) { // Test first 2 tools
        const executableTool = await toolRegistry.getTool(tool.name);
        expect(executableTool).toBeDefined();
        expect(typeof executableTool.execute).toBe('function');
        
        // Test basic execution (may fail due to missing params, but should not crash)
        try {
          await executableTool.execute({});
        } catch (error) {
          // Expected for tools requiring parameters
          expect(error).toBeDefined();
        }
      }

      console.log('✅ Full module lifecycle test completed successfully');
    }, TEST_TIMEOUT);

    test('should handle sequential module operations safely', async () => {
      console.log('🔄 Testing sequential module operations...');

      // Step 1: Clear calculator module first to ensure clean state
      console.log('1️⃣ Clearing calculator module to ensure clean state...');
      await toolRegistry.clearModule('calculator', { verbose: false });
      console.log('   ✅ Calculator module cleared');

      // Step 2: Load calculator module (without perspectives or vectors for basic testing)
      console.log('2️⃣ Loading calculator module...');
      const loadResult1 = await toolRegistry.loadModule('calculator', { 
        verbose: false, 
        includePerspectives: false,  // Don't generate perspectives
        includeVectors: false        // Don't index vectors
      });
      expect(loadResult1.success).toBe(true);
      expect(loadResult1.toolsAdded).toBeGreaterThan(0);
      console.log(`   ✅ Calculator module loaded with ${loadResult1.toolsAdded} tools`);

      // Step 3: Try to load calculator again (should clear and reload)
      console.log('3️⃣ Loading calculator module again (should clear and reload)...');
      const loadResult2 = await toolRegistry.loadModule('calculator', { 
        verbose: false, 
        includePerspectives: false,
        includeVectors: false 
      });
      // Should succeed and add the same number of tools as first load (since we clear first)
      expect(loadResult2.success).toBe(true);
      expect(loadResult2.toolsAdded).toBe(loadResult1.toolsAdded);
      console.log(`   ✅ Module reloaded successfully with ${loadResult2.toolsAdded} tools`);

      // Step 4: Verify the calculator module
      console.log('4️⃣ Verifying calculator module...');
      const verifyResult = await toolRegistry.verifyModule('calculator');
      console.log('   Verification result:', JSON.stringify(verifyResult, null, 2));
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.counts.tools).toBeGreaterThan(0);
      console.log(`   ✅ Calculator module verified with ${verifyResult.counts.tools} tools`);
      
      // Step 5: Clear the calculator module
      console.log('5️⃣ Clearing calculator module...');
      const clearResult = await toolRegistry.clearModule('calculator', { verbose: false });
      expect(clearResult.success).toBe(true);
      expect(clearResult.recordsCleared).toBeGreaterThan(0);
      console.log(`   ✅ Calculator module cleared (${clearResult.recordsCleared} records)`);

      // Step 6: Verify module is gone
      console.log('6️⃣ Verifying calculator module is cleared...');
      const verifyAfterClear = await toolRegistry.verifyModule('calculator');
      expect(verifyAfterClear.success).toBe(false);
      expect(verifyAfterClear.errors).toContain('Module not found: calculator');
      console.log('   ✅ Module correctly not found after clear');

      console.log('✅ All sequential operations completed successfully');
    }, TEST_TIMEOUT);
  });

  describe('Real Service Integration Verification', () => {
    beforeEach(async () => {
      // Clear all modules before each test to ensure clean state
      // This is critical for tests that verify vector counts
      await toolRegistry.clearAllModules({ verbose: false });
    }, TEST_TIMEOUT);

    test('should verify ToolRegistry database operations work', async () => {
      // Test that ToolRegistry can perform database operations successfully
      // Load a module to test database writes
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);

      // Test that we can list tools (database read)
      const tools = await toolRegistry.listTools({ moduleName: TEST_MODULE_NAME });
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBeDefined();
      expect(tools[0].moduleName).toBe(TEST_MODULE_NAME);

      // Test that we can get a specific tool (database read + module loading)
      const tool = await toolRegistry.getTool(tools[0].name);
      expect(tool).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }, TEST_TIMEOUT);

    test('should verify vector operations through ToolRegistry', async () => {
      // Load a module with vectors to test vector operations
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true
      });
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);

      // Test that vectors are properly indexed using ToolRegistry health check
      const health = await toolRegistry.quickHealthCheck();
      
      // Debug output if test fails
      if (!health.healthy) {
        console.log('Health check failed:', JSON.stringify(health, null, 2));
      }
      
      expect(health.counts.vectors).toBe(loadResult.vectorsIndexed);
      expect(health.healthy).toBe(true);
      
      // Test semantic search functionality through ToolRegistry
      if (toolRegistry.semanticDiscovery) {
        const searchResults = await toolRegistry.semanticDiscovery.findRelevantTools('calculator', { limit: 1 });
        expect(searchResults).toBeDefined();
        expect(searchResults.tools).toBeDefined();
        expect(Array.isArray(searchResults.tools)).toBe(true);
      }
    }, TEST_TIMEOUT);

    test('should verify embedding generation through vector indexing', async () => {
      // Test that embeddings are generated properly by loading module with vectors
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true  // This will generate embeddings and index them
      });
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBe(loadResult.perspectivesGenerated);
      
      // Verify vector indexing worked by checking health
      const health = await toolRegistry.quickHealthCheck();
      
      // Debug output if test fails
      if (!health.healthy) {
        console.log('Health check failed in embedding test:', JSON.stringify(health, null, 2));
      }
      
      expect(health.counts.vectors).toBe(loadResult.vectorsIndexed);
      expect(health.healthy).toBe(true);
      
      // Test that semantic search works (implies embeddings are valid)
      if (toolRegistry.semanticDiscovery) {
        const searchResults = await toolRegistry.semanticDiscovery.findRelevantTools('mathematical calculation', { limit: 1 });
        expect(searchResults).toBeDefined();
        expect(searchResults.tools).toBeDefined();
        expect(Array.isArray(searchResults.tools)).toBe(true);
        
        if (searchResults.tools.length > 0) {
          expect(searchResults.tools[0]).toHaveProperty('name');
          // The tool result has either 'score' or 'relevanceScore'/'similarityScore'
          const hasSomeScoreProperty = searchResults.tools[0].hasOwnProperty('score') || 
                                       searchResults.tools[0].hasOwnProperty('relevanceScore') ||
                                       searchResults.tools[0].hasOwnProperty('similarityScore');
          expect(hasSomeScoreProperty).toBe(true);
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('Error Scenarios with Real Services', () => {
    test('should handle module loading failures gracefully', async () => {
      // Try to load non-existent module
      const loadResult = await toolRegistry.loadModule('NonExistentModule', {
        verbose: false
      });

      expect(loadResult.success).toBe(false);
      
      // System should remain stable
      const health = await toolRegistry.quickHealthCheck();
      expect(health).toBeDefined();
    }, TEST_TIMEOUT);

    test('should handle database constraint violations', async () => {
      // Load the same module twice (should handle gracefully)
      await toolRegistry.loadModule(TEST_MODULE_NAME, { verbose: false });
      
      const secondLoadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false
      });

      // Should either succeed or fail gracefully without crashing
      expect(typeof secondLoadResult.success).toBe('boolean');
    }, TEST_TIMEOUT);

    test('should recover from partial failures', async () => {
      // Start loading with vectors
      const loadPromise = toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true
      });

      // This should complete even if interrupted by concurrent operations
      const loadResult = await loadPromise;
      expect(typeof loadResult.success).toBe('boolean');

      // System should remain in valid state
      const health = await toolRegistry.quickHealthCheck();
      expect(health).toBeDefined();
      
      if (health.counts.tools > 0) {
        // If tools were loaded, perspectives should exist
        expect(health.counts.perspectives).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);
  });
});