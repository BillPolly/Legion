/**
 * Simple tests for LegionModuleAdapter without mocking module-loader
 * 
 * Tests core functionality using real classes
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { LegionModuleAdapter } from '../../../src/tools/LegionModuleAdapter.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

// Create test module classes
class TestSingleToolModule {
  constructor(dependencies) {
    this.name = 'test-single';
    this.dependencies = dependencies;
  }

  getTools() {
    return [{
      name: 'single_tool',
      description: 'A single function tool',
      getToolDescription: () => ({
        type: 'function',
        function: {
          name: 'single_tool',
          description: 'A single function tool',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        }
      }),
      safeInvoke: async (toolCall) => {
        const args = JSON.parse(toolCall.function.arguments);
        return {
          success: true,
          data: { echo: args.message }
        };
      }
    }];
  }
}

class TestMultiToolModule {
  constructor(dependencies) {
    this.name = 'test-multi';
    this.dependencies = dependencies;
  }

  getTools() {
    return [{
      name: 'multi_operations',
      description: 'Multi-function operations',
      getToolDescription: () => ({
        type: 'function',
        function: {
          name: 'multi_operations',
          description: 'Multi-function operations',
          parameters: { type: 'object' }
        }
      }),
      getAllToolDescriptions: () => [
        {
          type: 'function',
          function: {
            name: 'operation_one',
            description: 'First operation',
            parameters: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              },
              required: ['value']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'operation_two',
            description: 'Second operation',
            parameters: {
              type: 'object',
              properties: {
                count: { type: 'number' }
              },
              required: ['count']
            }
          }
        }
      ],
      safeInvoke: async function(toolCall) {
        const args = JSON.parse(toolCall.function.arguments);
        const funcName = toolCall.function.name;
        
        if (funcName === 'operation_one') {
          return {
            success: true,
            data: { result: args.value.toUpperCase() }
          };
        } else if (funcName === 'operation_two') {
          return {
            success: true,
            data: { result: args.count * 2 }
          };
        }
        
        return {
          success: false,
          error: `Unknown function: ${funcName}`
        };
      }
    }];
  }
}

describe('LegionModuleAdapter Simple Tests', () => {
  let toolRegistry;
  let handleRegistry;
  let adapter;

  beforeEach(async () => {
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    adapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
    await adapter.initialize();
  });

  describe('Single Function Tool', () => {
    test('should load and register single-function tool', async () => {
      const result = await adapter.loadModule(TestSingleToolModule, {
        testDep: 'test-value'
      });

      expect(result.moduleName).toBe('test-single');
      expect(result.toolsRegistered).toBe(1);
      expect(result.tools).toContain('single_tool');
      
      // Verify tool was registered in ToolRegistry
      const tool = toolRegistry.getTool('single_tool');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('single_tool');
      expect(tool.inputSchema).toBeDefined();
    });

    test('should execute single-function tool', async () => {
      await adapter.loadModule(TestSingleToolModule, {});
      
      const tool = toolRegistry.getTool('single_tool');
      const result = await tool.execute({ message: 'Hello Aiur!' });
      
      expect(result.success).toBe(true);
      expect(result.echo).toBe('Hello Aiur!');
    });
  });

  describe('Multi-Function Tool', () => {
    test('should load and register multi-function tool as separate functions', async () => {
      const result = await adapter.loadModule(TestMultiToolModule, {});

      expect(result.moduleName).toBe('test-multi');
      expect(result.toolsRegistered).toBe(1);
      expect(result.tools).toContain('multi_operations');
      
      // Check that individual functions are registered
      const tool1 = toolRegistry.getTool('operation_one');
      const tool2 = toolRegistry.getTool('operation_two');
      
      expect(tool1).toBeDefined();
      expect(tool2).toBeDefined();
      expect(tool1.name).toBe('operation_one');
      expect(tool2.name).toBe('operation_two');
    });

    test('should execute multi-function tool functions', async () => {
      await adapter.loadModule(TestMultiToolModule, {});
      
      // Test first function
      const tool1 = toolRegistry.getTool('operation_one');
      const result1 = await tool1.execute({ value: 'hello' });
      
      expect(result1.success).toBe(true);
      expect(result1.result).toBe('HELLO');
      
      // Test second function
      const tool2 = toolRegistry.getTool('operation_two');
      const result2 = await tool2.execute({ count: 5 });
      
      expect(result2.success).toBe(true);
      expect(result2.result).toBe(10);
    });
  });

  describe('Module Management', () => {
    test('should list loaded modules', async () => {
      await adapter.loadModule(TestSingleToolModule, {});
      await adapter.loadModule(TestMultiToolModule, {});
      
      const modules = adapter.listLoadedModules();
      
      expect(modules).toHaveLength(2);
      expect(modules.map(m => m.name)).toContain('test-single');
      expect(modules.map(m => m.name)).toContain('test-multi');
    });
  });

  describe('Tool Registration in MCP Format', () => {
    test('should convert tools to MCP format', async () => {
      await adapter.loadModule(TestSingleToolModule, {});
      
      const tool = toolRegistry.getTool('single_tool');
      
      // Check MCP-compatible properties
      expect(tool.name).toBe('single_tool');
      expect(tool.description).toBe('A single function tool');
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      });
      expect(tool.category).toBe('legion');
      expect(tool.tags).toContain('imported');
      expect(tool.tags).toContain('legion-module');
      expect(typeof tool.execute).toBe('function');
    });

    test('should add correct tags for multi-function tools', async () => {
      await adapter.loadModule(TestMultiToolModule, {});
      
      const tool1 = toolRegistry.getTool('operation_one');
      
      expect(tool1.tags).toContain('imported');
      expect(tool1.tags).toContain('legion-module');
      expect(tool1.tags).toContain('multi_operations'); // Original tool name
    });
  });
});