/**
 * Tests for ToolLoader class
 * 
 * Tests dynamic tool loading from Legion modules
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ToolLoader } from '../../../src/tools/ToolLoader.js';
import { MCPToolAdapter } from '../../../src/tools/MCPToolAdapter.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';
import { HandleResolver } from '../../../src/handles/HandleResolver.js';

describe('ToolLoader', () => {
  let handleRegistry;
  let handleResolver;
  let adapter;
  let toolLoader;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
    handleResolver = new HandleResolver(handleRegistry);
    adapter = new MCPToolAdapter(handleRegistry, handleResolver);
    toolLoader = new ToolLoader(adapter);
  });

  describe('Basic Tool Discovery', () => {
    test('should initialize with empty tool registry', () => {
      expect(toolLoader.getLoadedTools()).toEqual([]);
      expect(toolLoader.getToolCount()).toBe(0);
    });

    test('should load tools from module object', () => {
      const mockModule = {
        name: 'test-module',
        tools: [
          {
            name: 'tool1',
            description: 'First test tool',
            execute: async (params) => ({ result: 'tool1' })
          },
          {
            name: 'tool2',
            description: 'Second test tool',
            execute: async (params) => ({ result: 'tool2' })
          }
        ]
      };

      toolLoader.loadFromModule(mockModule);

      expect(toolLoader.getToolCount()).toBe(2);
      const tools = toolLoader.getLoadedTools();
      expect(tools.map(t => t.name)).toContain('tool1');
      expect(tools.map(t => t.name)).toContain('tool2');
    });

    test('should load tools from array', () => {
      const mockTools = [
        {
          name: 'array-tool1',
          execute: async () => ({ success: true })
        },
        {
          name: 'array-tool2',
          execute: async () => ({ success: true })
        }
      ];

      toolLoader.loadFromArray(mockTools);

      expect(toolLoader.getToolCount()).toBe(2);
      expect(toolLoader.hasTool('array-tool1')).toBe(true);
      expect(toolLoader.hasTool('array-tool2')).toBe(true);
    });

    test('should handle duplicate tool names', async () => {
      const tool1 = { name: 'duplicate', execute: async () => ({ version: 1 }) };
      const tool2 = { name: 'duplicate', execute: async () => ({ version: 2 }) };

      toolLoader.loadFromArray([tool1]);
      expect(toolLoader.getToolCount()).toBe(1);

      // Loading duplicate should replace by default
      toolLoader.loadFromArray([tool2]);
      expect(toolLoader.getToolCount()).toBe(1);

      const tool = toolLoader.getTool('duplicate');
      const result = await tool.execute({});
      expect(result.version).toBe(2);
    });

    test('should prevent overwrite when configured', () => {
      const safeLoader = new ToolLoader(adapter, { allowOverwrite: false });
      
      const tool1 = { name: 'protected', execute: async () => ({ version: 1 }) };
      const tool2 = { name: 'protected', execute: async () => ({ version: 2 }) };

      safeLoader.loadFromArray([tool1]);
      
      expect(() => {
        safeLoader.loadFromArray([tool2]);
      }).toThrow('Tool already exists: protected');

      expect(safeLoader.getToolCount()).toBe(1);
    });
  });

  describe('Tool Registration and Retrieval', () => {
    beforeEach(() => {
      const mockTools = [
        {
          name: 'calculator',
          description: 'Basic math operations',
          category: 'math',
          execute: async (params) => ({ result: params.a + params.b })
        },
        {
          name: 'string-utils',
          description: 'String manipulation utilities',
          category: 'text',
          execute: async (params) => ({ result: params.text.toUpperCase() })
        }
      ];

      toolLoader.loadFromArray(mockTools);
    });

    test('should retrieve tool by name', () => {
      const tool = toolLoader.getTool('calculator');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('calculator');
    });

    test('should return null for non-existent tool', () => {
      const tool = toolLoader.getTool('nonExistent');
      expect(tool).toBeNull();
    });

    test('should check tool existence', () => {
      expect(toolLoader.hasTool('calculator')).toBe(true);
      expect(toolLoader.hasTool('string-utils')).toBe(true);
      expect(toolLoader.hasTool('nonExistent')).toBe(false);
    });

    test('should list all loaded tools', () => {
      const tools = toolLoader.getLoadedTools();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('calculator');
      expect(tools.map(t => t.name)).toContain('string-utils');
    });

    test('should filter tools by category', () => {
      const mathTools = toolLoader.getToolsByCategory('math');
      expect(mathTools).toHaveLength(1);
      expect(mathTools[0].name).toBe('calculator');

      const textTools = toolLoader.getToolsByCategory('text');
      expect(textTools).toHaveLength(1);
      expect(textTools[0].name).toBe('string-utils');

      const unknownTools = toolLoader.getToolsByCategory('unknown');
      expect(unknownTools).toHaveLength(0);
    });
  });

  describe('Tool Metadata and Search', () => {
    beforeEach(() => {
      const mockTools = [
        {
          name: 'file-reader',
          description: 'Read file contents',
          category: 'file',
          tags: ['io', 'read', 'file'],
          execute: async (params) => ({ content: 'file content' })
        },
        {
          name: 'file-writer',
          description: 'Write data to files',
          category: 'file',
          tags: ['io', 'write', 'file'],
          execute: async (params) => ({ written: true })
        },
        {
          name: 'http-get',
          description: 'Make HTTP GET requests',
          category: 'network',
          tags: ['http', 'web', 'get'],
          execute: async (params) => ({ data: 'response' })
        }
      ];

      toolLoader.loadFromArray(mockTools);
    });

    test('should search tools by name pattern', () => {
      const fileTools = toolLoader.searchTools({ namePattern: /^file-/ });
      expect(fileTools).toHaveLength(2);
      expect(fileTools.map(t => t.name)).toContain('file-reader');
      expect(fileTools.map(t => t.name)).toContain('file-writer');
    });

    test('should search tools by description keywords', () => {
      const readTools = toolLoader.searchTools({ descriptionKeywords: ['read'] });
      expect(readTools).toHaveLength(1);
      expect(readTools[0].name).toBe('file-reader');
    });

    test('should search tools by tags', () => {
      const ioTools = toolLoader.searchTools({ tags: ['io'] });
      expect(ioTools).toHaveLength(2);

      const webTools = toolLoader.searchTools({ tags: ['web'] });
      expect(webTools).toHaveLength(1);
      expect(webTools[0].name).toBe('http-get');
    });

    test('should search tools by category', () => {
      const fileTools = toolLoader.searchTools({ category: 'file' });
      expect(fileTools).toHaveLength(2);

      const networkTools = toolLoader.searchTools({ category: 'network' });
      expect(networkTools).toHaveLength(1);
      expect(networkTools[0].name).toBe('http-get');
    });

    test('should combine search criteria', () => {
      const writeFileTools = toolLoader.searchTools({
        category: 'file',
        tags: ['write']
      });
      expect(writeFileTools).toHaveLength(1);
      expect(writeFileTools[0].name).toBe('file-writer');
    });

    test('should return empty array for no matches', () => {
      const noMatches = toolLoader.searchTools({ category: 'unknown' });
      expect(noMatches).toHaveLength(0);
    });
  });

  describe('Tool Execution Integration', () => {
    beforeEach(() => {
      handleRegistry.create('testData', { value: 42, name: 'test' });

      const mockTools = [
        {
          name: 'echo-tool',
          execute: async (params) => ({ echo: params.message })
        },
        {
          name: 'handle-tool',
          execute: async (params) => ({ processed: params.data })
        }
      ];

      toolLoader.loadFromArray(mockTools);
    });

    test('should execute loaded tool directly', async () => {
      const tool = toolLoader.getTool('echo-tool');
      const result = await tool.execute({ message: 'hello' });

      expect(result.success).toBe(true);
      expect(result.echo).toBe('hello');
    });

    test('should resolve handles in tool execution', async () => {
      const tool = toolLoader.getTool('handle-tool');
      const result = await tool.execute({ data: '@testData' });

      expect(result.success).toBe(true);
      expect(result.processed).toEqual({ value: 42, name: 'test' });
    });

    test('should execute tool by name', async () => {
      const result = await toolLoader.executeTool('echo-tool', { message: 'by name' });

      expect(result.success).toBe(true);
      expect(result.echo).toBe('by name');
    });

    test('should handle tool execution errors', async () => {
      const result = await toolLoader.executeTool('nonExistent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found: nonExistent');
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      const mockTools = [
        { name: 'tool1', execute: async () => ({ result: 1 }) },
        { name: 'tool2', execute: async () => ({ result: 2 }) },
        { name: 'tool3', execute: async () => ({ result: 3 }) }
      ];

      toolLoader.loadFromArray(mockTools);
    });

    test('should unload specific tool', () => {
      expect(toolLoader.hasTool('tool2')).toBe(true);
      
      const unloaded = toolLoader.unloadTool('tool2');
      expect(unloaded).toBe(true);
      expect(toolLoader.hasTool('tool2')).toBe(false);
      expect(toolLoader.getToolCount()).toBe(2);
    });

    test('should return false when unloading non-existent tool', () => {
      const unloaded = toolLoader.unloadTool('nonExistent');
      expect(unloaded).toBe(false);
      expect(toolLoader.getToolCount()).toBe(3);
    });

    test('should clear all tools', () => {
      expect(toolLoader.getToolCount()).toBe(3);
      
      toolLoader.clear();
      expect(toolLoader.getToolCount()).toBe(0);
      expect(toolLoader.getLoadedTools()).toEqual([]);
    });

    test('should reload tools from source', () => {
      const newTools = [
        { name: 'new-tool1', execute: async () => ({ result: 'new1' }) },
        { name: 'new-tool2', execute: async () => ({ result: 'new2' }) }
      ];

      toolLoader.reload(newTools);

      expect(toolLoader.getToolCount()).toBe(2);
      expect(toolLoader.hasTool('tool1')).toBe(false); // Old tools gone
      expect(toolLoader.hasTool('new-tool1')).toBe(true);
      expect(toolLoader.hasTool('new-tool2')).toBe(true);
    });
  });

  describe('Error Handling and Validation', () => {
    test('should handle invalid tool objects', () => {
      const invalidTools = [
        { name: 'no-execute' },
        { execute: async () => ({}) }, // No name
        null,
        undefined,
        'not-an-object'
      ];

      expect(() => {
        toolLoader.loadFromArray(invalidTools);
      }).toThrow();

      expect(toolLoader.getToolCount()).toBe(0);
    });

    test('should handle module loading errors', () => {
      const invalidModule = {
        name: 'invalid-module',
        tools: 'not-an-array'
      };

      expect(() => {
        toolLoader.loadFromModule(invalidModule);
      }).toThrow('Module tools must be an array');
    });

    test('should validate tool compatibility', () => {
      const compatibilityReport = toolLoader.validateToolCompatibility({
        name: 'test-tool',
        execute: async () => ({ success: true })
      });

      expect(compatibilityReport.compatible).toBe(true);
      expect(compatibilityReport.issues).toHaveLength(0);
    });

    test('should report compatibility issues', () => {
      const compatibilityReport = toolLoader.validateToolCompatibility({
        name: 'incomplete-tool'
        // Missing execute function
      });

      expect(compatibilityReport.compatible).toBe(false);
      expect(compatibilityReport.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      const mockTools = [
        { 
          name: 'stats-tool1', 
          category: 'test', 
          execute: async () => ({ result: 1 }) 
        },
        { 
          name: 'stats-tool2', 
          category: 'test', 
          execute: async () => ({ result: 2 }) 
        },
        { 
          name: 'stats-tool3', 
          category: 'util', 
          execute: async () => ({ result: 3 }) 
        }
      ];

      toolLoader.loadFromArray(mockTools);
    });

    test('should provide tool statistics', () => {
      const stats = toolLoader.getStatistics();

      expect(stats.totalTools).toBe(3);
      expect(stats.categoryCounts).toEqual({ test: 2, util: 1 });
      expect(stats.toolNames).toContain('stats-tool1');
      expect(stats.toolNames).toContain('stats-tool2');
      expect(stats.toolNames).toContain('stats-tool3');
    });

    test('should track tool usage', async () => {
      await toolLoader.executeTool('stats-tool1', {});
      await toolLoader.executeTool('stats-tool1', {});
      await toolLoader.executeTool('stats-tool2', {});

      const stats = toolLoader.getStatistics();

      expect(stats.executionCounts).toBeDefined();
      expect(stats.executionCounts['stats-tool1']).toBe(2);
      expect(stats.executionCounts['stats-tool2']).toBe(1);
      expect(stats.executionCounts['stats-tool3']).toBe(0);
    });

    test('should provide health information', () => {
      const health = toolLoader.getHealthInfo();

      expect(health.status).toBe('healthy');
      expect(health.toolsLoaded).toBe(3);
      expect(health.adapterStatus).toBe('operational');
    });
  });
});