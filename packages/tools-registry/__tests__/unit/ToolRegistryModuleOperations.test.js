/**
 * Unit Tests for ToolRegistry Module-Specific Operations
 * 
 * Tests the new module-specific methods added to ToolRegistry:
 * - clearModule()
 * - clearAllModules() 
 * - loadModule()
 * - loadAllModules()
 * - verifyModule()
 */

import { jest } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

// Mock dependencies
const mockLoadingManager = {
  initialize: jest.fn(),
  clearForReload: jest.fn(),
  loadModules: jest.fn(),
  generatePerspectives: jest.fn(),
  indexVectors: jest.fn(),
  verifier: null,
  verbose: false
};

const mockVerifier = {
  verifyModule: jest.fn(),
  logResults: jest.fn(),
  verbose: false
};

const mockProvider = {
  cleanup: jest.fn()
};

const mockResourceManager = {
  initialize: jest.fn(),
  initialized: true
};

// Mock the imports
jest.unstable_mockModule('../../src/loading/LoadingManager.js', () => ({
  LoadingManager: jest.fn().mockImplementation(() => mockLoadingManager)
}));

jest.unstable_mockModule('../../src/verification/Verifier.js', () => ({
  Verifier: jest.fn().mockImplementation(() => mockVerifier)
}));

jest.unstable_mockModule('../../src/providers/MongoDBToolRegistryProvider.js', () => ({
  MongoDBToolRegistryProvider: {
    create: jest.fn().mockResolvedValue(mockProvider)
  }
}));

jest.unstable_mockModule('@legion/resource-manager', () => ({
  ResourceManager: {
    getInstance: jest.fn().mockReturnValue(mockResourceManager)
  }
}));

describe('ToolRegistry Module-Specific Operations', () => {
  let toolRegistry;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset singleton for each test
    ToolRegistry._instance = null;
    
    // Reset mock verbose state
    mockLoadingManager.verbose = false;
    mockVerifier.verbose = false;
    
    // Create fresh instance
    toolRegistry = new ToolRegistry({ _forceNew: true });
    toolRegistry.provider = mockProvider;
    toolRegistry.resourceManager = mockResourceManager;
    toolRegistry._loader = mockLoadingManager;
    toolRegistry.initialized = true;

    // Setup default mock responses
    mockLoadingManager.clearForReload.mockResolvedValue({
      totalCleared: 50
    });

    mockLoadingManager.loadModules.mockResolvedValue({
      modulesLoaded: 1,
      toolsAdded: 5
    });

    mockLoadingManager.generatePerspectives.mockResolvedValue({
      perspectivesGenerated: 15
    });

    mockLoadingManager.indexVectors.mockResolvedValue({
      perspectivesIndexed: 15
    });

    mockVerifier.verifyModule.mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
      counts: { tools: 5, perspectives: 15, vectors: 15 },
      ratios: { perspectivesPerTool: 3.0 },
      moduleName: 'TestModule',
      timestamp: new Date().toISOString()
    });

    // Set verifier on loading manager
    mockLoadingManager.verifier = mockVerifier;
  });

  afterEach(() => {
    ToolRegistry._instance = null;
  });

  describe('clearModule()', () => {
    test('should clear specific module with default options', async () => {
      const result = await toolRegistry.clearModule('TestModule');

      expect(mockLoadingManager.clearForReload).toHaveBeenCalledWith({
        clearVectors: true,
        clearModules: false,
        moduleFilter: 'TestModule'
      });

      expect(result).toEqual({
        moduleName: 'TestModule',
        recordsCleared: 50,
        success: true
      });
    });

    test('should clear specific module with verbose option', async () => {
      const result = await toolRegistry.clearModule('TestModule', { verbose: true });

      // The verbose setting is restored after the operation, so we check the result instead
      expect(result.moduleName).toBe('TestModule');
      expect(result.success).toBe(true);
      
      // The method should have been called, and console.log should show verbose output
      expect(mockLoadingManager.clearForReload).toHaveBeenCalledWith({
        clearVectors: true,
        clearModules: false,
        moduleFilter: 'TestModule'
      });
    });

    test('should throw error for invalid module name', async () => {
      await expect(toolRegistry.clearModule()).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.clearModule('')).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.clearModule(123)).rejects.toThrow('Module name is required and must be a string');
    });

    test('should restore original verbose setting after operation', async () => {
      mockLoadingManager.verbose = false;

      await toolRegistry.clearModule('TestModule', { verbose: true });

      expect(mockLoadingManager.verbose).toBe(false);
    });
  });

  describe('clearAllModules()', () => {
    test('should clear all modules with default options', async () => {
      const result = await toolRegistry.clearAllModules();

      expect(mockLoadingManager.clearForReload).toHaveBeenCalledWith({
        clearVectors: true,
        clearModules: false
      });

      expect(result).toEqual({
        moduleName: 'all',
        recordsCleared: 50,
        success: true
      });
    });

    test('should clear all modules with verbose option', async () => {
      const result = await toolRegistry.clearAllModules({ verbose: true });

      // The verbose setting is restored after the operation, so we check the result instead
      expect(result.moduleName).toBe('all');
      expect(result.success).toBe(true);
      
      // The method should have been called
      expect(mockLoadingManager.clearForReload).toHaveBeenCalledWith({
        clearVectors: true,
        clearModules: false
      });
    });
  });

  describe('loadModule()', () => {
    test('should load specific module with default options', async () => {
      const result = await toolRegistry.loadModule('TestModule');

      expect(mockLoadingManager.loadModules).toHaveBeenCalledWith({ module: 'TestModule' });
      expect(mockLoadingManager.generatePerspectives).toHaveBeenCalledWith({ module: 'TestModule' });
      expect(mockLoadingManager.indexVectors).not.toHaveBeenCalled(); // includeVectors defaults to false

      expect(result).toEqual({
        moduleName: 'TestModule',
        modulesLoaded: 1,
        toolsAdded: 5,
        perspectivesGenerated: 15,
        vectorsIndexed: 0,
        success: true
      });
    });

    test('should load specific module with perspectives disabled', async () => {
      const result = await toolRegistry.loadModule('TestModule', { 
        includePerspectives: false 
      });

      expect(mockLoadingManager.loadModules).toHaveBeenCalledWith({ module: 'TestModule' });
      expect(mockLoadingManager.generatePerspectives).not.toHaveBeenCalled();
      expect(mockLoadingManager.indexVectors).not.toHaveBeenCalled();

      expect(result.perspectivesGenerated).toBe(0);
      expect(result.vectorsIndexed).toBe(0);
    });

    test('should load specific module with vectors enabled', async () => {
      const result = await toolRegistry.loadModule('TestModule', { 
        includeVectors: true 
      });

      expect(mockLoadingManager.loadModules).toHaveBeenCalledWith({ module: 'TestModule' });
      expect(mockLoadingManager.generatePerspectives).toHaveBeenCalledWith({ module: 'TestModule' });
      expect(mockLoadingManager.indexVectors).toHaveBeenCalledWith({ module: 'TestModule' });

      expect(result.vectorsIndexed).toBe(15);
    });

    test('should throw error for invalid module name', async () => {
      await expect(toolRegistry.loadModule()).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.loadModule('')).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.loadModule(null)).rejects.toThrow('Module name is required and must be a string');
    });
  });

  describe('loadAllModules()', () => {
    test('should load all modules with default options', async () => {
      const result = await toolRegistry.loadAllModules();

      expect(mockLoadingManager.loadModules).toHaveBeenCalledWith({});
      expect(mockLoadingManager.generatePerspectives).toHaveBeenCalledWith({});
      expect(mockLoadingManager.indexVectors).not.toHaveBeenCalled();

      expect(result).toEqual({
        moduleName: 'all',
        modulesLoaded: 1,
        toolsAdded: 5,
        perspectivesGenerated: 15,
        vectorsIndexed: 0,
        success: true
      });
    });

    test('should load all modules with all options enabled', async () => {
      const result = await toolRegistry.loadAllModules({ 
        verbose: true,
        includePerspectives: true,
        includeVectors: true 
      });

      // The verbose setting is restored after the operation, so we check method calls
      expect(mockLoadingManager.loadModules).toHaveBeenCalledWith({});
      expect(mockLoadingManager.generatePerspectives).toHaveBeenCalledWith({});
      expect(mockLoadingManager.indexVectors).toHaveBeenCalledWith({});

      expect(result.vectorsIndexed).toBe(15);
    });
  });

  describe('verifyModule()', () => {
    test('should verify specific module with default options', async () => {
      const result = await toolRegistry.verifyModule('TestModule');

      expect(mockVerifier.verifyModule).toHaveBeenCalledWith('TestModule');
      expect(mockVerifier.verbose).toBe(false);

      expect(result).toEqual({
        success: true,
        errors: [],
        warnings: [],
        counts: { tools: 5, perspectives: 15, vectors: 15 },
        ratios: { perspectivesPerTool: 3.0 },
        moduleName: 'TestModule',
        timestamp: expect.any(String)
      });
    });

    test('should verify specific module with verbose option', async () => {
      const result = await toolRegistry.verifyModule('TestModule', { verbose: true });

      // The verbose setting is restored after the operation, so we check method calls
      expect(mockVerifier.verifyModule).toHaveBeenCalledWith('TestModule');
      expect(mockVerifier.logResults).toHaveBeenCalledWith(result);
    });

    test('should throw error for invalid module name', async () => {
      await expect(toolRegistry.verifyModule()).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.verifyModule('')).rejects.toThrow('Module name is required and must be a string');
      await expect(toolRegistry.verifyModule(42)).rejects.toThrow('Module name is required and must be a string');
    });

    test('should restore original verbose setting after verification', async () => {
      mockVerifier.verbose = false;

      await toolRegistry.verifyModule('TestModule', { verbose: true });

      expect(mockVerifier.verbose).toBe(false);
    });

    test('should handle verification failure', async () => {
      const failureResult = {
        success: false,
        errors: ['Module not found', 'Invalid tool count'],
        warnings: ['Missing perspectives'],
        counts: { tools: 0, perspectives: 0, vectors: 0 },
        ratios: { perspectivesPerTool: 0 },
        moduleName: 'TestModule',
        timestamp: new Date().toISOString()
      };

      mockVerifier.verifyModule.mockResolvedValueOnce(failureResult);

      const result = await toolRegistry.verifyModule('TestModule');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('getLoader() integration', () => {
    test('should create and initialize LoadingManager on first call', async () => {
      // Reset loader to test creation
      toolRegistry._loader = null;

      const loader = await toolRegistry.getLoader();

      expect(loader).toBe(mockLoadingManager);
      expect(mockLoadingManager.initialize).toHaveBeenCalled();
    });

    test('should reuse existing LoadingManager on subsequent calls', async () => {
      toolRegistry._loader = mockLoadingManager;

      const loader1 = await toolRegistry.getLoader();
      const loader2 = await toolRegistry.getLoader();

      expect(loader1).toBe(loader2);
      expect(mockLoadingManager.initialize).not.toHaveBeenCalled();
    });
  });

  describe('getVerifier() integration', () => {
    test('should create Verifier when not exists', async () => {
      mockLoadingManager.verifier = null;

      const verifier = await toolRegistry.getVerifier();

      expect(verifier).toBe(mockVerifier);
    });

    test('should reuse existing Verifier when exists', async () => {
      mockLoadingManager.verifier = mockVerifier;

      const verifier1 = await toolRegistry.getVerifier();
      const verifier2 = await toolRegistry.getVerifier();

      expect(verifier1).toBe(verifier2);
      expect(verifier1).toBe(mockVerifier);
    });
  });

  describe('Error handling', () => {
    test('should handle LoadingManager initialization failure', async () => {
      // Reset loader to test creation
      toolRegistry._loader = null;
      mockLoadingManager.initialize.mockRejectedValueOnce(new Error('Init failed'));

      // The getLoader method will create the loader and call initialize, which will fail
      await expect(toolRegistry.getLoader()).rejects.toThrow('Init failed');
    });

    test('should handle clearForReload failure', async () => {
      mockLoadingManager.clearForReload.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(toolRegistry.clearModule('TestModule')).rejects.toThrow('Clear failed');
    });

    test('should handle loadModules failure', async () => {
      mockLoadingManager.loadModules.mockRejectedValueOnce(new Error('Load failed'));

      await expect(toolRegistry.loadModule('TestModule')).rejects.toThrow('Load failed');
    });

    test('should handle verifyModule failure', async () => {
      mockVerifier.verifyModule.mockRejectedValueOnce(new Error('Verify failed'));

      await expect(toolRegistry.verifyModule('TestModule')).rejects.toThrow('Verify failed');
    });
  });

  describe('Singleton behavior', () => {
    test('should maintain singleton pattern across operations', () => {
      const registry1 = ToolRegistry.getInstance();
      const registry2 = ToolRegistry.getInstance();

      expect(registry1).toBe(registry2);
    });

    test('should allow force new instance for testing', () => {
      const registry1 = new ToolRegistry();
      const registry2 = new ToolRegistry({ _forceNew: true });

      expect(registry1).not.toBe(registry2);
    });
  });

  describe('Options validation and defaults', () => {
    test('should use correct default options for clearModule', async () => {
      await toolRegistry.clearModule('TestModule');

      expect(mockLoadingManager.clearForReload).toHaveBeenCalledWith({
        clearVectors: true,
        clearModules: false,
        moduleFilter: 'TestModule'
      });
    });

    test('should use correct default options for loadModule', async () => {
      await toolRegistry.loadModule('TestModule');

      // Should include perspectives by default, exclude vectors by default
      expect(mockLoadingManager.generatePerspectives).toHaveBeenCalled();
      expect(mockLoadingManager.indexVectors).not.toHaveBeenCalled();
    });

    test('should handle undefined options gracefully', async () => {
      await expect(toolRegistry.clearModule('TestModule', undefined)).resolves.toBeDefined();
      await expect(toolRegistry.loadModule('TestModule', undefined)).resolves.toBeDefined();
      await expect(toolRegistry.verifyModule('TestModule', undefined)).resolves.toBeDefined();
    });
  });
});