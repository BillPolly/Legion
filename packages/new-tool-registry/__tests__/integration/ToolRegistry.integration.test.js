/**
 * Integration tests for ToolRegistry
 * 
 * Tests real registry operations with actual MongoDB connection and modules
 * NO MOCKS - real implementation testing only
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry } from '../../src/core/ToolRegistry.js';
import { ModuleRegistry } from '../../src/core/ModuleRegistry.js';
import { DatabaseOperations } from '../../src/core/DatabaseOperations.js';
import { DatabaseStorage } from '../../src/core/DatabaseStorage.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ToolRegistry Integration', () => {
  let toolRegistry;
  let moduleRegistry;
  let databaseStorage;
  let databaseOperations;
  let resourceManager;
  let testDir;
  
  beforeAll(async () => {
    // Create ResourceManager instance
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create test directory for test modules
    testDir = path.join(__dirname, '../tmp/tool-registry-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create comprehensive test modules
    await fs.writeFile(
      path.join(testDir, 'CalculatorModule.js'),
      `
export default class CalculatorModule {
  getName() { return 'CalculatorModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Calculator module with math operations'; }
  getTools() {
    return [
      {
        name: 'add',
        description: 'Add two numbers',
        execute: (params) => ({ success: true, result: params.a + params.b }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'number' } 
          } 
        }
      },
      {
        name: 'multiply',
        description: 'Multiply two numbers',
        execute: (params) => ({ success: true, result: params.a * params.b }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'number' } 
          } 
        }
      },
      {
        name: 'divide',
        description: 'Divide two numbers',
        execute: (params) => {
          if (params.b === 0) {
            return { success: false, error: 'Division by zero' };
          }
          return { success: true, result: params.a / params.b };
        },
        inputSchema: { 
          type: 'object', 
          properties: { 
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['a', 'b']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'number' },
            error: { type: 'string' }
          } 
        }
      }
    ];
  }
}`
    );
    
    await fs.writeFile(
      path.join(testDir, 'StringModule.js'),
      `
export default class StringModule {
  getName() { return 'StringModule'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'String manipulation module'; }
  getTools() {
    return [
      {
        name: 'uppercase',
        description: 'Convert string to uppercase',
        execute: (params) => ({ success: true, result: params.text.toUpperCase() }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            text: { type: 'string' }
          },
          required: ['text']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'string' } 
          } 
        }
      },
      {
        name: 'lowercase',
        description: 'Convert string to lowercase',
        execute: (params) => ({ success: true, result: params.text.toLowerCase() }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            text: { type: 'string' }
          },
          required: ['text']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'string' } 
          } 
        }
      },
      {
        name: 'concat',
        description: 'Concatenate multiple strings',
        execute: (params) => ({ success: true, result: params.strings.join(params.separator || '') }),
        inputSchema: { 
          type: 'object', 
          properties: { 
            strings: { 
              type: 'array',
              items: { type: 'string' }
            },
            separator: { type: 'string' }
          },
          required: ['strings']
        },
        outputSchema: { 
          type: 'object', 
          properties: { 
            success: { type: 'boolean' },
            result: { type: 'string' } 
          } 
        }
      }
    ];
  }
}`
    );
    
    await fs.writeFile(
      path.join(testDir, 'TestModule.js'),
      `
export default class TestModule {
  getName() { return 'TestModule'; }
  getVersion() { return '2.0.0'; }
  getDescription() { return 'Test module for integration testing'; }
  getTools() {
    return [
      {
        name: 'test-tool',
        description: 'A test tool for integration testing',
        execute: (params) => ({ 
          success: true, 
          result: params,
          timestamp: new Date().toISOString()
        }),
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      }
    ];
  }
}`
    );
  });
  
  afterAll(async () => {
    // Close database connection
    if (databaseStorage) {
      await databaseStorage.close();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  beforeEach(async () => {
    // Create fresh database storage
    databaseStorage = new DatabaseStorage({ resourceManager });
    await databaseStorage.initialize();
    
    // Clear collections before each test
    try {
      await databaseStorage.clearCollection('modules');
      await databaseStorage.clearCollection('tools');
    } catch (error) {
      // Collections might not exist yet
    }
    
    // Create database operations
    databaseOperations = new DatabaseOperations({
      databaseStorage,
      resourceManager
    });
    
    // Create module registry
    moduleRegistry = new ModuleRegistry({
      databaseOperations,
      resourceManager,
      cacheEnabled: true,
      verbose: false
    });
    
    await moduleRegistry.initialize();
    
    // Create tool registry
    toolRegistry = new ToolRegistry({
      moduleRegistry,
      databaseStorage,
      cacheEnabled: true,
      verbose: false
    });
    
    await toolRegistry.initialize();
  });
  
  afterEach(async () => {
    if (toolRegistry) {
      await toolRegistry.shutdown();
    }
    if (moduleRegistry) {
      await moduleRegistry.shutdown();
    }
  });
  
  describe('Database Integration', () => {
    it('should connect to MongoDB and initialize', async () => {
      expect(databaseStorage.isConnected).toBe(true);
      expect(toolRegistry).toBeInstanceOf(ToolRegistry);
    });
    
    it('should create text index for tools collection', async () => {
      const toolsCollection = databaseStorage.getCollection('tools');
      const indexes = await toolsCollection.indexes();
      
      const textIndex = indexes.find(idx => idx.name === 'tool_text_index');
      expect(textIndex).toBeDefined();
    });
  });
  
  describe('Tool Loading', () => {
    beforeEach(async () => {
      // Pre-discover modules for testing
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should load a tool by name from database', async () => {
      const tool = await toolRegistry.getTool('add');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('add');
      expect(tool.description).toBe('Add two numbers');
      expect(tool.moduleName).toBe('CalculatorModule');
      expect(typeof tool.execute).toBe('function');
    });
    
    it('should execute a loaded tool', async () => {
      const tool = await toolRegistry.getTool('add');
      
      const result = tool.execute({ a: 5, b: 3 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(8);
    });
    
    it('should handle tool execution errors', async () => {
      const tool = await toolRegistry.getTool('divide');
      
      const result = tool.execute({ a: 10, b: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Division by zero');
    });
    
    it('should cache loaded tools', async () => {
      const tool1 = await toolRegistry.getTool('add');
      const tool2 = await toolRegistry.getTool('add');
      
      expect(tool1).toBe(tool2); // Same instance
      expect(toolRegistry.getCache().size).toBe(1);
    });
    
    it('should force reload when requested', async () => {
      const tool1 = await toolRegistry.getTool('add');
      const tool2 = await toolRegistry.getTool('add', { forceReload: true });
      
      // Should have same functionality
      expect(tool1.name).toBe(tool2.name);
      expect(tool1.execute({ a: 2, b: 3 })).toEqual(tool2.execute({ a: 2, b: 3 }));
    });
    
    it('should load multiple tools', async () => {
      const tools = await toolRegistry.getTools(['add', 'multiply', 'uppercase']);
      
      expect(tools).toHaveLength(3);
      expect(tools[0].name).toBe('add');
      expect(tools[1].name).toBe('multiply');
      expect(tools[2].name).toBe('uppercase');
      
      // All should have execute functions
      tools.forEach(tool => {
        expect(typeof tool.execute).toBe('function');
      });
    });
  });
  
  describe('Tool Discovery', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should get all tools from database', async () => {
      const tools = await toolRegistry.getAllTools();
      
      expect(tools.length).toBeGreaterThanOrEqual(7); // 3 + 3 + 1 tools
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('add');
      expect(toolNames).toContain('multiply');
      expect(toolNames).toContain('divide');
      expect(toolNames).toContain('uppercase');
      expect(toolNames).toContain('lowercase');
      expect(toolNames).toContain('concat');
      expect(toolNames).toContain('test-tool');
    });
    
    it('should find tools by pattern', async () => {
      const tools = await toolRegistry.findTools(/^(add|multiply|divide)$/);
      
      expect(tools).toHaveLength(3);
      tools.forEach(tool => {
        expect(tool.moduleName).toBe('CalculatorModule');
      });
    });
    
    it('should find tools by filter function', async () => {
      const tools = await toolRegistry.findTools(
        tool => tool.moduleName === 'StringModule'
      );
      
      expect(tools).toHaveLength(3);
      tools.forEach(tool => {
        expect(tool.moduleName).toBe('StringModule');
      });
    });
    
    it('should get tools by module', async () => {
      const tools = await toolRegistry.getToolsByModule('CalculatorModule');
      
      expect(tools).toHaveLength(3);
      expect(tools[0].moduleName).toBe('CalculatorModule');
      expect(tools[1].moduleName).toBe('CalculatorModule');
      expect(tools[2].moduleName).toBe('CalculatorModule');
    });
  });
  
  describe('Text Search', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should search tools by text query', async () => {
      const tools = await toolRegistry.searchTools('numbers');
      
      expect(tools.length).toBeGreaterThanOrEqual(2); // 'add' and 'multiply' mention numbers
      tools.forEach(tool => {
        expect(tool.description.toLowerCase()).toContain('number');
      });
    });
    
    it('should search tools with limit', async () => {
      const tools = await toolRegistry.searchTools('string', { limit: 2 });
      
      expect(tools.length).toBeLessThanOrEqual(2);
    });
    
    it('should return empty array for no matches', async () => {
      const tools = await toolRegistry.searchTools('nonexistentterm');
      
      expect(tools).toEqual([]);
    });
  });
  
  describe('Tool Management', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should check if tool exists', async () => {
      const exists1 = await toolRegistry.hasTool('add');
      const exists2 = await toolRegistry.hasTool('nonexistent');
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
    
    it('should refresh a tool', async () => {
      // Load tool initially
      const tool1 = await toolRegistry.getTool('add');
      expect(toolRegistry.getCache().has('add')).toBe(true);
      
      // Refresh tool
      const refreshed = await toolRegistry.refreshTool('add');
      
      expect(refreshed).toBeDefined();
      expect(refreshed.name).toBe('add');
      expect(typeof refreshed.execute).toBe('function');
      
      // Should still be cached after refresh
      expect(toolRegistry.getCache().has('add')).toBe(true);
    });
    
    it('should get tool metadata without execute function', async () => {
      const metadata = await toolRegistry.getToolMetadata('add');
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('add');
      expect(metadata.description).toBe('Add two numbers');
      expect(metadata.moduleName).toBe('CalculatorModule');
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.outputSchema).toBeDefined();
      expect(metadata.execute).toBeUndefined(); // No execute in metadata
    });
  });
  
  describe('Statistics', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should return correct statistics', async () => {
      // Load some tools to populate cache
      await toolRegistry.getTool('add');
      await toolRegistry.getTool('uppercase');
      
      const stats = await toolRegistry.getStatistics();
      
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('cached');
      expect(stats).toHaveProperty('byModule');
      
      expect(stats.total).toBe(7); // Total tools in database
      expect(stats.cached).toBe(2); // Tools in cache
      
      expect(stats.byModule).toHaveProperty('CalculatorModule', 3);
      expect(stats.byModule).toHaveProperty('StringModule', 3);
      expect(stats.byModule).toHaveProperty('TestModule', 1);
    });
  });
  
  describe('Cache Management', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should respect cache enabled setting', async () => {
      const tool1 = await toolRegistry.getTool('add');
      const tool2 = await toolRegistry.getTool('add');
      
      expect(tool1).toBe(tool2);
      expect(toolRegistry.getCache().size).toBe(1);
    });
    
    it('should work with cache disabled', async () => {
      const noCacheRegistry = new ToolRegistry({
        moduleRegistry,
        databaseStorage,
        cacheEnabled: false
      });
      
      await noCacheRegistry.initialize();
      
      await noCacheRegistry.getTool('add');
      await noCacheRegistry.getTool('add');
      
      // Cache should remain empty
      expect(noCacheRegistry.getCache().size).toBe(0);
      
      await noCacheRegistry.shutdown();
    });
    
    it('should clear cache', async () => {
      await toolRegistry.getTool('add');
      await toolRegistry.getTool('uppercase');
      expect(toolRegistry.getCache().size).toBe(2);
      
      toolRegistry.clearCache();
      expect(toolRegistry.getCache().size).toBe(0);
    });
  });
  
  describe('Event Handling', () => {
    beforeEach(async () => {
      await databaseOperations.discoverAndLoad(testDir);
    });
    
    it('should emit tool:loaded event', async () => {
      const loadedEvents = [];
      toolRegistry.on('tool:loaded', (event) => {
        loadedEvents.push(event);
      });
      
      await toolRegistry.getTool('add');
      
      expect(loadedEvents).toHaveLength(1);
      expect(loadedEvents[0].name).toBe('add');
      expect(loadedEvents[0].tool).toBeDefined();
    });
    
    it('should emit cache:cleared event', async () => {
      let cacheCleared = false;
      toolRegistry.on('cache:cleared', () => {
        cacheCleared = true;
      });
      
      toolRegistry.clearCache();
      
      expect(cacheCleared).toBe(true);
    });
    
    it('should emit registry:initialized event', async () => {
      const newRegistry = new ToolRegistry({
        moduleRegistry,
        databaseStorage
      });
      
      let initialized = false;
      newRegistry.on('registry:initialized', () => {
        initialized = true;
      });
      
      await newRegistry.initialize();
      
      expect(initialized).toBe(true);
      
      await newRegistry.shutdown();
    });
    
    it('should emit registry:shutdown event', async () => {
      const newRegistry = new ToolRegistry({
        moduleRegistry,
        databaseStorage
      });
      
      await newRegistry.initialize();
      
      let shutdownEmitted = false;
      newRegistry.on('registry:shutdown', () => {
        shutdownEmitted = true;
      });
      
      await newRegistry.shutdown();
      
      expect(shutdownEmitted).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle non-existent tools gracefully', async () => {
      const tool = await toolRegistry.getTool('nonexistent');
      
      expect(tool).toBeNull();
      
      // Registry should still be functional
      await databaseOperations.discoverAndLoad(testDir);
      const validTool = await toolRegistry.getTool('add');
      expect(validTool).toBeDefined();
    });
    
    it('should handle module loading errors gracefully', async () => {
      // Save a tool with non-existent module
      await databaseStorage.saveTool(
        { name: 'broken-tool', description: 'Broken tool' },
        'NonExistentModule'
      );
      
      const tool = await toolRegistry.getTool('broken-tool');
      
      expect(tool).toBeNull();
    });
    
    it('should handle tools missing from module gracefully', async () => {
      // Save a tool that doesn't exist in its module
      await databaseStorage.saveTool(
        { name: 'missing-tool', description: 'Missing tool' },
        'CalculatorModule'
      );
      
      // First load the module
      await databaseOperations.discoverAndLoad(testDir);
      
      const tool = await toolRegistry.getTool('missing-tool');
      
      expect(tool).toBeNull();
    });
  });
  
  describe('Performance', () => {
    it('should handle many tools efficiently', async () => {
      // Create many modules with tools
      const moduleCount = 10;
      const toolsPerModule = 5;
      
      for (let i = 0; i < moduleCount; i++) {
        const tools = [];
        for (let j = 0; j < toolsPerModule; j++) {
          tools.push(`
      {
        name: 'perf-tool-${i}-${j}',
        description: 'Performance test tool ${i}-${j}',
        execute: (params) => ({ success: true, id: '${i}-${j}' }),
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      }`);
        }
        
        const modulePath = path.join(testDir, `PerfModule${i}.js`);
        await fs.writeFile(
          modulePath,
          `
export default class PerfModule${i} {
  getName() { return 'PerfModule${i}'; }
  getVersion() { return '1.0.0'; }
  getDescription() { return 'Performance test module ${i}'; }
  getTools() {
    return [${tools.join(',')}];
  }
}`
        );
      }
      
      // Discover all modules
      const startDiscover = Date.now();
      await databaseOperations.discoverAndLoad(testDir);
      const discoverTime = Date.now() - startDiscover;
      
      console.log(`Discovery time for ${moduleCount + 3} modules: ${discoverTime}ms`);
      expect(discoverTime).toBeLessThan(15000); // Should be under 15 seconds
      
      // Load all tools
      const startLoad = Date.now();
      const allTools = await toolRegistry.getAllTools();
      const loadTime = Date.now() - startLoad;
      
      console.log(`Load time for ${allTools.length} tools: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // Should be under 10 seconds
      
      // Verify caching performance
      const startCached = Date.now();
      for (let i = 0; i < 20; i++) {
        await toolRegistry.getTool(`perf-tool-${i % moduleCount}-0`);
      }
      const cachedTime = Date.now() - startCached;
      
      console.log(`Cached retrieval time for 20 tools: ${cachedTime}ms`);
      expect(cachedTime).toBeLessThan(100); // Should be very fast from cache
    });
  });
  
  describe('Complete Workflow', () => {
    it('should handle complete tool lifecycle', async () => {
      // 1. Discover and load modules
      const discovery = await databaseOperations.discoverAndLoad(testDir);
      expect(discovery.discovered).toBeGreaterThanOrEqual(3);
      
      // 2. Get all tools
      const allTools = await toolRegistry.getAllTools();
      expect(allTools.length).toBeGreaterThanOrEqual(7);
      
      // 3. Search for specific tools
      const mathTools = await toolRegistry.searchTools('numbers');
      expect(mathTools.length).toBeGreaterThan(0);
      
      // 4. Load and execute a tool
      const addTool = await toolRegistry.getTool('add');
      const result = addTool.execute({ a: 10, b: 20 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
      
      // 5. Get statistics
      const stats = await toolRegistry.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(7);
      expect(stats.cached).toBeGreaterThan(0);
      
      // 6. Clear cache
      toolRegistry.clearCache();
      expect(toolRegistry.getCache().size).toBe(0);
      
      // 7. Tool should still be loadable after cache clear
      const addToolAgain = await toolRegistry.getTool('add');
      expect(addToolAgain).toBeDefined();
      expect(typeof addToolAgain.execute).toBe('function');
    });
  });
});