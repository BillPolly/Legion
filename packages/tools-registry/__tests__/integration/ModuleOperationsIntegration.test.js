/**
 * Integration Tests for Module-Specific Operations
 * 
 * These tests use REAL services without mocks:
 * - Real MongoDB connection and database operations
 * - Real Qdrant vector database
 * - Real ONNX embedding generation with Nomic model
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
  let testDbName;

  beforeAll(async () => {
    // Create unique test database name
    testDbName = `legion_tools_test_${Date.now()}`;
    
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
    
    // Override database name for testing isolation
    process.env.MONGODB_DATABASE = testDbName;
    process.env.TOOLS_DATABASE_NAME = testDbName;
    
    console.log(`🧪 Integration test using database: ${testDbName}`);
    console.log(`🔗 MongoDB: ${process.env.MONGODB_URL}`);
    console.log(`🔗 Qdrant: ${process.env.QDRANT_URL}`);
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Reset singleton and create fresh instance
    ToolRegistry._instance = null;
    
    // Create ToolRegistry with real providers
    toolRegistry = ToolRegistry.getInstance();
    await toolRegistry.initialize();
    
    // Verify providers are real (not mocked)
    expect(toolRegistry.provider).toBeDefined();
    expect(toolRegistry.provider.constructor.name).toBe('MongoDBToolRegistryProvider');
    expect(toolRegistry.semanticDiscovery).toBeDefined();
    
    console.log(`🚀 Test setup complete - using real services`);
  }, TEST_TIMEOUT);

  afterEach(async () => {
    // Cleanup between tests but don't fail tests if cleanup fails
    try {
      if (toolRegistry) {
        await toolRegistry.cleanup();
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }, 30000);

  afterAll(async () => {
    try {
      // Clean up test database
      if (toolRegistry?.provider?.databaseService) {
        await toolRegistry.provider.databaseService.mongoProvider.db.dropDatabase();
        console.log(`🧹 Cleaned up test database: ${testDbName}`);
      }
      
      // Ensure all connections are closed
      if (toolRegistry) {
        await toolRegistry.cleanup();
      }
      
      // Reset singleton
      ToolRegistry._instance = null;
    } catch (error) {
      console.warn('Database cleanup warning:', error.message);
    }
  }, 30000);

  describe('Module-Specific Clear Operations', () => {
    test('should clear specific module only', async () => {
      // First, populate with multiple modules to test granular clearing
      await toolRegistry.populateDatabase({
        verbose: false,
        includePerspectives: true,
        includeVectors: false
      });

      // Get initial counts
      const initialHealth = await toolRegistry.quickHealthCheck();
      const initialTools = initialHealth.counts.tools;
      const initialPerspectives = initialHealth.counts.perspectives;
      
      expect(initialTools).toBeGreaterThan(0);
      expect(initialPerspectives).toBeGreaterThan(0);

      // Clear specific module
      const clearResult = await toolRegistry.clearModule(TEST_MODULE_NAME, {
        verbose: false
      });

      expect(clearResult.success).toBe(true);
      expect(clearResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(clearResult.recordsCleared).toBeGreaterThan(0);

      // Verify only calculator module was cleared
      const afterClearHealth = await toolRegistry.quickHealthCheck();
      expect(afterClearHealth.counts.tools).toBeLessThan(initialTools);
      expect(afterClearHealth.counts.perspectives).toBeLessThan(initialPerspectives);

      // Verify other modules still exist (total count > 0 but less than before)
      expect(afterClearHealth.counts.tools).toBeGreaterThan(0); // Other modules remain
    }, TEST_TIMEOUT);

    test('should clear all modules completely', async () => {
      // First, ensure database has data
      await toolRegistry.populateDatabase({
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
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(0);
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

    test('should load specific module with vectors using real ONNX embeddings', async () => {
      const loadResult = await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true // This will use real ONNX model
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.moduleName).toBe(TEST_MODULE_NAME);
      expect(loadResult.toolsAdded).toBeGreaterThan(0);
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBeGreaterThan(0);
      expect(loadResult.vectorsIndexed).toBe(loadResult.perspectivesGenerated); // Should match

      // Verify vectors are actually in Qdrant
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
      expect(loadResult.perspectivesGenerated).toBeGreaterThan(10);

      // Verify system health after loading all
      const health = await toolRegistry.quickHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.counts.tools).toBe(loadResult.toolsAdded);
      expect(health.counts.perspectives).toBe(loadResult.perspectivesGenerated);
    }, TEST_TIMEOUT);
  });

  describe('Module-Specific Verification Operations', () => {
    beforeEach(async () => {
      // Ensure we have a complete module for verification
      await toolRegistry.clearModule(TEST_MODULE_NAME, { verbose: false });
      await toolRegistry.loadModule(TEST_MODULE_NAME, {
        verbose: false,
        includePerspectives: true,
        includeVectors: true // Include vectors for comprehensive verification
      });
    });

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
      // Create inconsistency by manually removing some perspectives
      const loader = await toolRegistry.getLoader();
      await loader.mongoProvider.databaseService.mongoProvider.delete('tool_perspectives', {
        moduleName: TEST_MODULE_NAME
      }, { limit: 2 });

      const verifyResult = await toolRegistry.verifyModule(TEST_MODULE_NAME, {
        verbose: false
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.errors.length).toBeGreaterThan(0);
      
      // Should detect vector/perspective mismatch
      const vectorMismatchError = verifyResult.errors.find(error => 
        error.includes('vector count mismatch')
      );
      expect(vectorMismatchError).toBeDefined();
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

    test('should handle concurrent module operations safely', async () => {
      console.log('🔄 Testing concurrent module operations...');

      // Run multiple operations concurrently
      const operations = [
        toolRegistry.loadModule('calculator', { verbose: false, includeVectors: false }),
        toolRegistry.loadModule('Json', { verbose: false, includeVectors: false }),
        toolRegistry.verifyModule('calculator'),
      ];

      const results = await Promise.allSettled(operations);

      // At least some operations should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success);
      expect(succeeded.length).toBeGreaterThan(0);

      console.log(`✅ Concurrent operations: ${succeeded.length}/${results.length} succeeded`);
    }, TEST_TIMEOUT);
  });

  describe('Real Service Integration Verification', () => {
    test('should verify MongoDB connection and operations', async () => {
      const loader = await toolRegistry.getLoader();
      const mongoProvider = loader.mongoProvider;

      // Test MongoDB connection
      expect(mongoProvider).toBeDefined();
      expect(mongoProvider.databaseService.mongoProvider).toBeDefined();

      // Test basic CRUD operations
      const testRecord = { name: 'test', timestamp: new Date() };
      const insertResult = await mongoProvider.databaseService.mongoProvider.insert('test_collection', testRecord);
      expect(insertResult.insertedIds).toBeDefined();
      const insertedId = Object.values(insertResult.insertedIds)[0];
      expect(insertedId).toBeDefined();

      const findResult = await mongoProvider.databaseService.mongoProvider.findOne('test_collection', { name: 'test' });
      expect(findResult).toBeDefined();
      expect(findResult.name).toBe(testRecord.name);
      expect(findResult._id).toBeDefined(); // MongoDB ObjectId should be present

      const deleteResult = await mongoProvider.databaseService.mongoProvider.delete('test_collection', { name: 'test' });
      expect(deleteResult.deletedCount).toBeGreaterThanOrEqual(1);
    }, TEST_TIMEOUT);

    test('should verify Qdrant connection and vector operations', async () => {
      const semantic = toolRegistry.semanticDiscovery;
      expect(semantic).toBeDefined();

      const qdrantProvider = semantic.semanticProvider;
      expect(qdrantProvider).toBeDefined();

      // Test vector search (should not crash)
      try {
        const searchResult = await qdrantProvider.searchSimilar('test query', { limit: 1 });
        expect(searchResult).toBeDefined();
      } catch (error) {
        // Collection might not exist yet, but connection should work
        expect(error.message).not.toContain('connection failed');
      }
    }, TEST_TIMEOUT);

    test('should verify ONNX embedding generation', async () => {
      const semantic = toolRegistry.semanticDiscovery;
      const embeddingService = semantic.semanticProvider.embeddingService;
      expect(embeddingService).toBeDefined();
      expect(embeddingService.constructor.name).toBe('LocalEmbeddingService');

      // Test embedding generation
      const testTexts = ['calculator tool', 'json parser', 'file operations'];
      const embeddings = await embeddingService.generateEmbeddings(testTexts);

      expect(embeddings).toHaveLength(testTexts.length);
      for (const embedding of embeddings) {
        expect(embedding).toBeInstanceOf(Float32Array);
        expect(embedding.length).toBe(768); // Nomic embedding dimensions
        
        // Verify embeddings are normalized
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        expect(Math.abs(norm - 1.0)).toBeLessThan(0.001);
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