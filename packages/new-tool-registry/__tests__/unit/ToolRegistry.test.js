/**
 * Unit tests for ToolRegistry
 * 
 * Tests the registry that manages all tools in the system
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../src/core/ToolRegistry.js';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';

describe('ToolRegistry', () => {
  let toolRegistry;
  let mockModuleRegistry;
  let mockDatabaseStorage;
  let mockToolsCollection;
  
  beforeEach(() => {
    // Create mock tools collection
    mockToolsCollection = {
      find: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            name: 'test-tool',
            description: 'A test tool',
            moduleName: 'TestModule',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
          },
          {
            name: 'another-tool',
            description: 'Another test tool',
            moduleName: 'AnotherModule',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
          }
        ])
      }),
      findOne: jest.fn().mockResolvedValue({
        name: 'test-tool',
        description: 'A test tool',
        moduleName: 'TestModule',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      }),
      countDocuments: jest.fn().mockResolvedValue(10),
      createIndex: jest.fn().mockResolvedValue({ indexName: 'text_index' })
    };
    
    // Create mock database storage
    mockDatabaseStorage = {
      getCollection: jest.fn(() => mockToolsCollection),
      findTools: jest.fn().mockResolvedValue([
        { 
          name: 'test-tool', 
          description: 'A test tool',
          moduleName: 'TestModule',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' }
        },
        { 
          name: 'another-tool', 
          description: 'Another test tool',
          moduleName: 'AnotherModule',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' }
        }
      ]),
      findTool: jest.fn().mockImplementation(async (name) => {
        if (name === 'test-tool') {
          return { 
            name: 'test-tool', 
            description: 'A test tool',
            moduleName: 'TestModule',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
          };
        } else if (name === 'another-tool') {
          return { 
            name: 'another-tool', 
            description: 'Another test tool',
            moduleName: 'AnotherModule',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
          };
        }
        return null;
      })
    };
    
    // Create mock module registry
    mockModuleRegistry = {
      getModule: jest.fn().mockImplementation(async (moduleName) => {
        if (moduleName === 'TestModule') {
          return {
            getName: () => 'TestModule',
            getTools: () => [
              {
                name: 'test-tool',
                description: 'A test tool',
                execute: (params) => ({ success: true, result: params }),
                inputSchema: { type: 'object' },
                outputSchema: { type: 'object' }
              }
            ]
          };
        } else if (moduleName === 'AnotherModule') {
          return {
            getName: () => 'AnotherModule',
            getTools: () => [
              {
                name: 'another-tool',
                description: 'Another test tool',
                execute: (params) => ({ success: true, result: params }),
                inputSchema: { type: 'object' },
                outputSchema: { type: 'object' }
              }
            ]
          };
        }
        return null;
      }),
      hasModule: jest.fn().mockResolvedValue(true),
      reloadModule: jest.fn().mockResolvedValue({
        getName: () => 'TestModule',
        getTools: () => [
          {
            name: 'test-tool',
            description: 'A test tool',
            execute: (params) => ({ success: true, result: params }),
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
          }
        ]
      }),
      getAllModules: jest.fn().mockResolvedValue([
        {
          getName: () => 'TestModule',
          getTools: () => [{ name: 'test-tool' }]
        },
        {
          getName: () => 'AnotherModule',
          getTools: () => [{ name: 'another-tool' }]
        }
      ])
    };
    
    // Create tool registry instance
    toolRegistry = new ToolRegistry({
      moduleRegistry: mockModuleRegistry,
      databaseStorage: mockDatabaseStorage
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    if (toolRegistry) {
      toolRegistry.clearCache();
    }
  });
  
  describe('constructor', () => {
    it('should create a ToolRegistry instance', () => {
      expect(toolRegistry).toBeInstanceOf(ToolRegistry);
    });
    
    it('should initialize with empty cache', () => {
      expect(toolRegistry.getCache().size).toBe(0);
    });
    
    it('should accept options', () => {
      const registry = new ToolRegistry({
        cacheEnabled: false,
        verbose: true,
        moduleRegistry: mockModuleRegistry,
        databaseStorage: mockDatabaseStorage
      });
      
      expect(registry.options.cacheEnabled).toBe(false);
      expect(registry.options.verbose).toBe(true);
    });
  });
  
  describe('getTool', () => {
    it('should get a tool by name', async () => {
      const tool = await toolRegistry.getTool('test-tool');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('test-tool');
      expect(tool.description).toBe('A test tool');
      expect(typeof tool.execute).toBe('function');
    });
    
    it('should cache loaded tools', async () => {
      const tool1 = await toolRegistry.getTool('test-tool');
      const tool2 = await toolRegistry.getTool('test-tool');
      
      expect(tool1).toBe(tool2); // Same instance
      expect(mockDatabaseStorage.findTool).toHaveBeenCalledTimes(1);
    });
    
    it('should return null for non-existent tools', async () => {
      mockDatabaseStorage.findTool.mockResolvedValue(null);
      
      const tool = await toolRegistry.getTool('non-existent');
      
      expect(tool).toBeNull();
    });
    
    it('should bypass cache when forced', async () => {
      await toolRegistry.getTool('test-tool');
      await toolRegistry.getTool('test-tool', { forceReload: true });
      
      expect(mockDatabaseStorage.findTool).toHaveBeenCalledTimes(2);
    });
    
    it('should load execute function from module', async () => {
      const tool = await toolRegistry.getTool('test-tool');
      
      expect(tool.execute).toBeDefined();
      expect(typeof tool.execute).toBe('function');
      
      // Test execute function
      const result = tool.execute({ test: 'data' });
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ test: 'data' });
    });
  });
  
  describe('getTools', () => {
    it('should get multiple tools by names', async () => {
      const tools = await toolRegistry.getTools(['test-tool', 'another-tool']);
      
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('test-tool');
      expect(tools[1].name).toBe('another-tool');
    });
    
    it('should filter out non-existent tools', async () => {
      const tools = await toolRegistry.getTools(['test-tool', 'non-existent']);
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });
  });
  
  describe('getAllTools', () => {
    it('should get all tools from database', async () => {
      const tools = await toolRegistry.getAllTools();
      
      expect(tools).toHaveLength(2);
      expect(mockDatabaseStorage.findTools).toHaveBeenCalledWith({});
      expect(tools[0].name).toBe('test-tool');
      expect(tools[1].name).toBe('another-tool');
      expect(typeof tools[0].execute).toBe('function');
      expect(typeof tools[1].execute).toBe('function');
    });
    
    it('should cache all loaded tools', async () => {
      await toolRegistry.getAllTools();
      
      expect(toolRegistry.getCache().size).toBe(2);
      expect(toolRegistry.getCache().has('test-tool')).toBe(true);
      expect(toolRegistry.getCache().has('another-tool')).toBe(true);
    });
  });
  
  describe('findTools', () => {
    it('should find tools by pattern', async () => {
      const tools = await toolRegistry.findTools(/test.*/);
      
      expect(tools.length).toBeGreaterThanOrEqual(1);
      expect(tools[0].name).toMatch(/test.*/);
    });
    
    it('should find tools by filter function', async () => {
      const tools = await toolRegistry.findTools(
        tool => tool.moduleName === 'TestModule'
      );
      
      expect(tools.length).toBeGreaterThanOrEqual(1);
      expect(tools[0].moduleName).toBe('TestModule');
    });
  });
  
  describe('searchTools', () => {
    it('should search tools by text query', async () => {
      mockToolsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          { name: 'test-tool', description: 'A test tool' }
        ])
      });
      
      const tools = await toolRegistry.searchTools('test');
      
      expect(tools.length).toBeGreaterThanOrEqual(1);
      expect(mockToolsCollection.find).toHaveBeenCalledWith(
        expect.objectContaining({ $text: { $search: 'test' } })
      );
    });
    
    it('should limit search results', async () => {
      mockToolsCollection.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([
            { name: 'test-tool' }
          ])
        })
      });
      
      const tools = await toolRegistry.searchTools('test', { limit: 5 });
      
      expect(mockToolsCollection.find).toHaveBeenCalled();
    });
  });
  
  describe('getToolsByModule', () => {
    it('should get all tools from a specific module', async () => {
      mockDatabaseStorage.findTools.mockResolvedValueOnce([
        { 
          name: 'test-tool', 
          description: 'A test tool',
          moduleName: 'TestModule',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' }
        }
      ]);
      
      const tools = await toolRegistry.getToolsByModule('TestModule');
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(mockDatabaseStorage.findTools).toHaveBeenCalledWith({ moduleName: 'TestModule' });
    });
  });
  
  describe('hasTool', () => {
    it('should check if tool exists', async () => {
      const exists = await toolRegistry.hasTool('test-tool');
      
      expect(exists).toBe(true);
      expect(mockDatabaseStorage.findTool).toHaveBeenCalledWith('test-tool');
    });
    
    it('should return false for non-existent tools', async () => {
      mockDatabaseStorage.findTool.mockResolvedValue(null);
      
      const exists = await toolRegistry.hasTool('non-existent');
      
      expect(exists).toBe(false);
    });
  });
  
  describe('refreshTool', () => {
    it('should refresh a tool from its module', async () => {
      const tool = await toolRegistry.refreshTool('test-tool');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('test-tool');
      expect(mockModuleRegistry.getModule).toHaveBeenCalled();
    });
    
    it('should clear tool from cache before refreshing', async () => {
      await toolRegistry.getTool('test-tool');
      expect(toolRegistry.getCache().has('test-tool')).toBe(true);
      
      await toolRegistry.refreshTool('test-tool');
      
      // Should still be in cache after refresh
      expect(toolRegistry.getCache().has('test-tool')).toBe(true);
    });
  });
  
  describe('getStatistics', () => {
    it('should return tool statistics', async () => {
      const stats = await toolRegistry.getStatistics();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('cached');
      expect(stats).toHaveProperty('byModule');
      expect(stats.total).toBe(10);
      expect(stats.cached).toBe(0);
    });
  });
  
  describe('cache management', () => {
    it('should get cache contents', () => {
      const cache = toolRegistry.getCache();
      
      expect(cache).toBeInstanceOf(Map);
    });
    
    it('should clear cache', async () => {
      await toolRegistry.getTool('test-tool');
      expect(toolRegistry.getCache().size).toBe(1);
      
      toolRegistry.clearCache();
      expect(toolRegistry.getCache().size).toBe(0);
    });
    
    it('should respect cache disabled option', async () => {
      const registry = new ToolRegistry({
        cacheEnabled: false,
        moduleRegistry: mockModuleRegistry,
        databaseStorage: mockDatabaseStorage
      });
      
      await registry.getTool('test-tool');
      await registry.getTool('test-tool');
      
      expect(mockDatabaseStorage.findTool).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('getToolMetadata', () => {
    it('should get tool metadata without loading execute function', async () => {
      const metadata = await toolRegistry.getToolMetadata('test-tool');
      
      expect(metadata).toHaveProperty('name', 'test-tool');
      expect(metadata).toHaveProperty('moduleName', 'TestModule');
      expect(metadata.execute).toBeUndefined(); // No execute function in metadata
    });
    
    it('should return null for non-existent tools', async () => {
      mockDatabaseStorage.findTool.mockResolvedValue(null);
      
      const metadata = await toolRegistry.getToolMetadata('non-existent');
      
      expect(metadata).toBeNull();
    });
  });
  
  describe('initialization', () => {
    it('should initialize text search index', async () => {
      await toolRegistry.initialize();
      
      expect(mockToolsCollection.createIndex).toHaveBeenCalledWith(
        { name: 'text', description: 'text' },
        expect.any(Object)
      );
    });
  });
  
  describe('event handling', () => {
    it('should emit events on tool operations', async () => {
      const listener = jest.fn();
      toolRegistry.on('tool:loaded', listener);
      
      await toolRegistry.getTool('test-tool');
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        name: 'test-tool'
      }));
    });
  });
});