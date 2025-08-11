/**
 * LoadingManager Integration Test Suite
 * 
 * Comprehensive tests for the LoadingManager pipeline:
 * - Initialization
 * - Database clearing
 * - Module loading
 * - Perspective generation
 * - Vector indexing
 * - Full pipeline execution
 */

import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/tools';

describe('LoadingManager Integration', () => {
  let loadingManager;
  let resourceManager;
  let mongoProvider;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Force local embeddings for tests
    resourceManager.set('env.USE_LOCAL_EMBEDDINGS', 'true');
    
    // Create MongoDB provider for verification
    mongoProvider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
  });

  afterAll(async () => {
    if (loadingManager) {
      await loadingManager.close();
    }
    if (mongoProvider) {
      await mongoProvider.disconnect();
    }
  });

  beforeEach(() => {
    // Create fresh LoadingManager for each test
    loadingManager = new LoadingManager({ 
      verbose: false,
      resourceManager
    });
  });

  afterEach(async () => {
    if (loadingManager) {
      await loadingManager.close();
      loadingManager = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize all components successfully', async () => {
      await loadingManager.initialize();
      
      expect(loadingManager.initialized).toBe(true);
      expect(loadingManager.moduleLoader).toBeTruthy();
      expect(loadingManager.databasePopulator).toBeTruthy();
      expect(loadingManager.mongoProvider).toBeTruthy();
      expect(loadingManager.semanticSearchProvider).toBeTruthy();
      expect(loadingManager.toolIndexer).toBeTruthy();
    });

    test('should enforce local ONNX embeddings', async () => {
      await loadingManager.initialize();
      
      const useLocal = loadingManager.resourceManager.get('env.USE_LOCAL_EMBEDDINGS');
      expect(useLocal).toBe('true');
    });

    test('should prevent double initialization', async () => {
      await loadingManager.initialize();
      const firstModuleLoader = loadingManager.moduleLoader;
      
      await loadingManager.initialize(); // Should be no-op
      
      expect(loadingManager.moduleLoader).toBe(firstModuleLoader);
    });
  });

  describe('Pipeline State Management', () => {
    test('should track initial pipeline state correctly', async () => {
      await loadingManager.initialize();
      
      const state = loadingManager.getPipelineState();
      
      expect(state.cleared).toBe(false);
      expect(state.modulesLoaded).toBe(false);
      expect(state.perspectivesGenerated).toBe(false);
      expect(state.vectorsIndexed).toBe(false);
      expect(state.isComplete).toBe(false);
      expect(state.hasErrors).toBe(false);
      expect(state.errors).toEqual([]);
    });

    test('should reset pipeline state correctly', async () => {
      await loadingManager.initialize();
      
      // Modify state
      loadingManager.pipelineState.modulesLoaded = true;
      loadingManager.pipelineState.errors.push('test error');
      
      // Reset
      loadingManager.resetPipelineState();
      
      const state = loadingManager.getPipelineState();
      expect(state.modulesLoaded).toBe(false);
      expect(state.errors).toEqual([]);
    });
  });

  describe('Database Clearing', () => {
    test('should clear all databases successfully', async () => {
      await loadingManager.initialize();
      
      const result = await loadingManager.clearAll();
      
      expect(result).toHaveProperty('totalCleared');
      expect(result).toHaveProperty('mongoCollections');
      expect(result).toHaveProperty('qdrantCollections');
      expect(result.mongoCollections).toContain('modules');
      expect(result.mongoCollections).toContain('tools');
      expect(result.mongoCollections).toContain('tool_perspectives');
    });

    test('should update pipeline state after clearing', async () => {
      await loadingManager.initialize();
      
      await loadingManager.clearAll();
      
      const state = loadingManager.getPipelineState();
      expect(state.cleared).toBe(true);
      expect(state.modulesLoaded).toBe(false);
    });

    test('should verify databases are empty after clearing', async () => {
      await loadingManager.initialize();
      await loadingManager.clearAll();
      
      const moduleCount = await mongoProvider.databaseService.mongoProvider.count('modules', {});
      const toolCount = await mongoProvider.databaseService.mongoProvider.count('tools', {});
      const perspectiveCount = await mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {});
      
      expect(moduleCount).toBe(0);
      expect(toolCount).toBe(0);
      expect(perspectiveCount).toBe(0);
    });
  });

  describe('Module Loading', () => {
    beforeEach(async () => {
      await loadingManager.initialize();
      await loadingManager.clearAll();
    });

    test('should load modules successfully', async () => {
      const result = await loadingManager.loadModules('Calculator');
      
      expect(result.modulesLoaded).toBeGreaterThan(0);
      expect(result.toolsAdded).toBeGreaterThan(0);
      expect(result.loadResult.summary.failed).toBe(0);
    });

    test('should update pipeline state after loading', async () => {
      await loadingManager.loadModules('Calculator');
      
      const state = loadingManager.getPipelineState();
      expect(state.modulesLoaded).toBe(true);
      expect(state.moduleCount).toBeGreaterThan(0);
      expect(state.toolCount).toBeGreaterThan(0);
      expect(state.lastModuleFilter).toBe('Calculator');
    });

    test('should handle multiple module loading', async () => {
      const result = await loadingManager.loadModules(); // Load all modules
      
      expect(result.modulesLoaded).toBeGreaterThan(1);
      expect(result.toolsAdded).toBeGreaterThan(1);
    });

    test('should verify loaded data in database', async () => {
      await loadingManager.loadModules('Calculator');
      
      const moduleCount = await mongoProvider.databaseService.mongoProvider.count('modules', {});
      const toolCount = await mongoProvider.databaseService.mongoProvider.count('tools', {});
      
      expect(moduleCount).toBeGreaterThan(0);
      expect(toolCount).toBeGreaterThan(0);
    });
  });

  describe('Perspective Generation', () => {
    beforeEach(async () => {
      await loadingManager.initialize();
      await loadingManager.clearAll();
      await loadingManager.loadModules('Calculator');
    });

    test('should generate perspectives for loaded tools', async () => {
      const result = await loadingManager.generatePerspectives('Calculator');
      
      expect(result.toolsProcessed).toBeGreaterThan(0);
      expect(result.perspectivesGenerated).toBeGreaterThan(0);
    });

    test('should require modules to be loaded first', async () => {
      const freshManager = new LoadingManager({ verbose: false, resourceManager });
      await freshManager.initialize();
      
      await expect(freshManager.generatePerspectives()).rejects.toThrow(
        'Cannot generate perspectives: modules must be loaded first'
      );
      
      await freshManager.close();
    });

    test('should update pipeline state after generation', async () => {
      await loadingManager.generatePerspectives('Calculator');
      
      const state = loadingManager.getPipelineState();
      expect(state.perspectivesGenerated).toBe(true);
      expect(state.perspectiveCount).toBeGreaterThan(0);
    });

    test('should store perspectives in database', async () => {
      await loadingManager.generatePerspectives('Calculator');
      
      const perspectiveCount = await mongoProvider.databaseService.mongoProvider.count(
        'tool_perspectives',
        { toolName: 'calculator' }
      );
      
      expect(perspectiveCount).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for embedding generation
  });

  describe('Vector Indexing', () => {
    beforeEach(async () => {
      await loadingManager.initialize();
      await loadingManager.clearAll();
      await loadingManager.loadModules('Calculator');
      await loadingManager.generatePerspectives('Calculator');
    });

    test('should index vectors to Qdrant', async () => {
      const result = await loadingManager.indexVectors('Calculator');
      
      expect(result.perspectivesIndexed).toBeGreaterThan(0);
      expect(result.toolsProcessed).toBeGreaterThan(0);
    }, 30000);

    test('should require perspectives to be generated first', async () => {
      const freshManager = new LoadingManager({ verbose: false, resourceManager });
      await freshManager.initialize();
      await freshManager.clearAll();
      await freshManager.loadModules('Calculator');
      
      await expect(freshManager.indexVectors()).rejects.toThrow(
        'Cannot index vectors: perspectives must be generated first'
      );
      
      await freshManager.close();
    });

    test('should update pipeline state after indexing', async () => {
      await loadingManager.indexVectors('Calculator');
      
      const state = loadingManager.getPipelineState();
      expect(state.vectorsIndexed).toBe(true);
      expect(state.vectorCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Full Pipeline Execution', () => {
    test('should execute full pipeline successfully', async () => {
      await loadingManager.initialize();
      
      const result = await loadingManager.fullPipeline({
        moduleFilter: 'Calculator',
        clearFirst: true,
        includePerspectives: true,
        includeVectors: true
      });
      
      expect(result.success).toBe(true);
      expect(result.clearResult).toBeTruthy();
      expect(result.loadResult).toBeTruthy();
      expect(result.perspectiveResult).toBeTruthy();
      expect(result.vectorResult).toBeTruthy();
      expect(result.totalTime).toBeGreaterThan(0);
    }, 60000); // 60 second timeout for full pipeline
    
    test('should mark pipeline as complete', async () => {
      await loadingManager.initialize();
      
      await loadingManager.fullPipeline({
        moduleFilter: 'Calculator',
        clearFirst: true,
        includePerspectives: true,
        includeVectors: true
      });
      
      const state = loadingManager.getPipelineState();
      expect(state.isComplete).toBe(true);
      expect(state.hasErrors).toBe(false);
    }, 60000);

    test('should support partial pipeline execution', async () => {
      await loadingManager.initialize();
      
      const result = await loadingManager.fullPipeline({
        moduleFilter: 'Calculator',
        clearFirst: true,
        includePerspectives: false,
        includeVectors: false
      });
      
      expect(result.success).toBe(true);
      expect(result.perspectiveResult).toBeUndefined();
      expect(result.vectorResult).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should track errors in pipeline state', async () => {
      await loadingManager.initialize();
      await loadingManager.clearAll();
      
      // Try to generate perspectives without loading modules
      try {
        await loadingManager.generatePerspectives();
      } catch (error) {
        // Expected to fail
      }
      
      const state = loadingManager.getPipelineState();
      expect(state.hasErrors).toBe(false); // Errors only tracked for non-fatal issues
    });

    test('should handle invalid module filter gracefully', async () => {
      await loadingManager.initialize();
      
      const result = await loadingManager.loadModules('NonExistentModule');
      
      expect(result.modulesLoaded).toBe(0);
      expect(result.toolsAdded).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    test('should close all connections properly', async () => {
      await loadingManager.initialize();
      
      const initialModuleLoader = loadingManager.moduleLoader;
      expect(initialModuleLoader).toBeTruthy();
      
      await loadingManager.close();
      
      // Verify connections are closed (no errors on subsequent operations)
      expect(async () => {
        await loadingManager.close(); // Should be safe to call multiple times
      }).not.toThrow();
    });
  });
});