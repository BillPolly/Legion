/**
 * ToolRegistry Unit Tests
 * 
 * Tests the core functionality of ToolRegistry class without database dependencies.
 * Uses mocks and stubs to isolate the unit under test.
 */

import { jest } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';

// Mock the MongoDB provider
const mockProvider = {
  initialize: jest.fn(),
  getTool: jest.fn(),
  getModule: jest.fn(),
  listTools: jest.fn(),
  searchTools: jest.fn()
};

// Mock ResourceManager
const mockResourceManager = {
  initialize: jest.fn(),
  get: jest.fn()
};

// Mock MongoDBToolRegistryProvider
jest.unstable_mockModule('../../src/providers/MongoDBToolRegistryProvider.js', () => ({
  MongoDBToolRegistryProvider: {
    create: jest.fn(() => Promise.resolve(mockProvider))
  }
}));

// Mock ResourceManager
jest.unstable_mockModule('../../src/ResourceManager.js', () => ({
  ResourceManager: jest.fn(() => mockResourceManager)
}));

describe('ToolRegistry Unit Tests', () => {
  let registry;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh registry instance
    registry = new ToolRegistry();
  });

  describe('Constructor', () => {
    test('should create instance with default options', () => {
      expect(registry).toBeInstanceOf(ToolRegistry);
      expect(registry.provider).toBeNull();
      expect(registry.resourceManager).toBeNull();
      expect(registry.initialized).toBe(false);
    });

    test('should accept custom provider and resource manager', () => {
      const customRegistry = new ToolRegistry({
        provider: mockProvider,
        resourceManager: mockResourceManager
      });

      expect(customRegistry.provider).toBe(mockProvider);
      expect(customRegistry.resourceManager).toBe(mockResourceManager);
    });
  });

  describe('Initialization', () => {
    test('should initialize with defaults', async () => {
      await registry.initialize();

      expect(registry.initialized).toBe(true);
      expect(registry.resourceManager).toBeDefined();
      expect(registry.provider).toBeDefined();
    });

    test('should not initialize twice', async () => {
      await registry.initialize();
      const provider1 = registry.provider;
      
      await registry.initialize();
      const provider2 = registry.provider;

      expect(provider1).toBe(provider2);
    });

    test('should use provided dependencies', async () => {
      const customRegistry = new ToolRegistry({
        provider: mockProvider,
        resourceManager: mockResourceManager
      });

      await customRegistry.initialize();

      expect(customRegistry.provider).toBe(mockProvider);
      expect(customRegistry.resourceManager).toBe(mockResourceManager);
    });
  });

  describe('Public API Methods', () => {
    beforeEach(async () => {
      registry = new ToolRegistry({ provider: mockProvider, resourceManager: mockResourceManager });
      await registry.initialize();
    });

    describe('getTool()', () => {
      test('should return null for invalid input', async () => {
        expect(await registry.getTool()).toBeNull();
        expect(await registry.getTool(null)).toBeNull();
        expect(await registry.getTool('')).toBeNull();
        expect(await registry.getTool(123)).toBeNull();
      });

      test('should return cached tool', async () => {
        const mockTool = { name: 'test_tool', execute: jest.fn() };
        registry.toolCache.set('test_tool', mockTool);

        const result = await registry.getTool('test_tool');

        expect(result).toBe(mockTool);
        expect(mockProvider.getTool).not.toHaveBeenCalled();
      });

      test('should handle tool not found', async () => {
        mockProvider.getTool.mockResolvedValue(null);

        const result = await registry.getTool('nonexistent_tool');

        expect(result).toBeNull();
        expect(mockProvider.getTool).toHaveBeenCalledWith('nonexistent_tool');
      });

      test('should track usage statistics', async () => {
        const mockTool = { name: 'test_tool', execute: jest.fn() };
        registry.toolCache.set('test_tool', mockTool);

        await registry.getTool('test_tool');
        await registry.getTool('test_tool');

        const stats = registry.getUsageStats();
        expect(stats.test_tool).toBe(2);
      });
    });

    describe('listTools()', () => {
      test('should delegate to provider', async () => {
        const mockTools = [
          { name: 'tool1', description: 'First tool' },
          { name: 'tool2', description: 'Second tool' }
        ];
        mockProvider.listTools.mockResolvedValue(mockTools);

        const result = await registry.listTools();

        expect(result).toBe(mockTools);
        expect(mockProvider.listTools).toHaveBeenCalledWith({});
      });

      test('should pass options to provider', async () => {
        const options = { limit: 10, module: 'Calculator' };
        mockProvider.listTools.mockResolvedValue([]);

        await registry.listTools(options);

        expect(mockProvider.listTools).toHaveBeenCalledWith(options);
      });
    });

    describe('searchTools()', () => {
      test('should use provider search if available', async () => {
        const mockResults = [{ name: 'calc_tool', description: 'Calculator tool' }];
        mockProvider.searchTools.mockResolvedValue(mockResults);

        const result = await registry.searchTools('calculator');

        expect(result).toBe(mockResults);
        expect(mockProvider.searchTools).toHaveBeenCalledWith('calculator', {});
      });

      test('should fallback to basic search', async () => {
        // Remove searchTools from provider
        delete mockProvider.searchTools;
        
        const mockTools = [
          { name: 'calculator', description: 'Math operations' },
          { name: 'file_reader', description: 'Read files' },
          { name: 'calc_helper', description: 'Calculator helper' }
        ];
        mockProvider.listTools.mockResolvedValue(mockTools);

        const result = await registry.searchTools('calc');

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('calculator');
        expect(result[1].name).toBe('calc_helper');
      });
    });
  });

  describe('Cache Management', () => {
    test('should clear caches', () => {
      registry.toolCache.set('tool1', { name: 'tool1' });
      registry.moduleCache.set('Module1', { name: 'Module1' });
      registry.usageStats.set('tool1', 5);

      registry.clearCache();

      expect(registry.toolCache.size).toBe(0);
      expect(registry.moduleCache.size).toBe(0);
      expect(registry.usageStats.size).toBe(0);
    });

    test('should track usage statistics correctly', async () => {
      const mockTool = { name: 'test_tool', execute: jest.fn() };
      registry.toolCache.set('test_tool', mockTool);

      await registry.getTool('test_tool');
      await registry.getTool('test_tool');
      await registry.getTool('test_tool');

      const stats = registry.getUsageStats();
      expect(stats).toEqual({ test_tool: 3 });
    });
  });

  describe('Database Population', () => {
    test('should populate database with default options', async () => {
      const mockDiscovery = {
        populateDatabase: jest.fn().mockResolvedValue({
          modulesAdded: 5,
          toolsAdded: 25
        })
      };

      // Mock the dynamic import
      jest.unstable_mockModule('../../src/discovery/ComprehensiveToolDiscovery.js', () => ({
        ComprehensiveToolDiscovery: jest.fn(() => mockDiscovery)
      }));

      const result = await registry.populateDatabase();

      expect(result.modulesAdded).toBe(5);
      expect(result.toolsAdded).toBe(25);
      expect(mockDiscovery.populateDatabase).toHaveBeenCalledWith({
        mode: 'clear',
        verbose: false,
        includeEmbeddings: false
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle provider initialization errors gracefully', async () => {
      // Create a new registry instance for this test
      const errorRegistry = new ToolRegistry();
      
      const { MongoDBToolRegistryProvider } = await import('../../src/providers/MongoDBToolRegistryProvider.js');
      MongoDBToolRegistryProvider.create.mockRejectedValueOnce(new Error('DB connection failed'));

      // Should throw the error
      await expect(errorRegistry.initialize()).rejects.toThrow('DB connection failed');
    });

    test('should handle tool retrieval errors gracefully', async () => {
      mockProvider.getTool.mockRejectedValue(new Error('Network error'));

      const result = await registry.getTool('some_tool');

      expect(result).toBeNull();
    });
  });
});