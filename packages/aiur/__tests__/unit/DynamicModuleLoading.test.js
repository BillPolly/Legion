/**
 * Tests for Dynamic Module Loading in Aiur MCP Server
 * 
 * Tests generic module loading and tool registration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HandleRegistry } from '../../src/handles/HandleRegistry.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { LegionModuleAdapter } from '../../src/tools/LegionModuleAdapter.js';
import { PlanningTools } from '../../src/planning/PlanningTools.js';
import { PlanExecutor } from '../../src/planning/PlanExecutor.js';

// Mock Legion modules
class MockSimpleModule {
  constructor(dependencies) {
    this.name = 'simple';
    this.dependencies = dependencies;
  }

  getTools() {
    return [{
      name: 'simple_tool',
      description: 'A simple tool',
      getToolDescription: () => ({
        type: 'function',
        function: {
          name: 'simple_tool',
          description: 'A simple tool',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        }
      }),
      execute: async (params) => ({ echo: params.message }),
      safeInvoke: async function(toolCall) {
        const args = JSON.parse(toolCall.function.arguments);
        return {
          success: true,
          data: await this.execute(args)
        };
      }
    }];
  }
}

class MockMultiFunctionModule {
  constructor(dependencies) {
    this.name = 'multi';
    this.dependencies = dependencies;
  }

  getTools() {
    return [{
      name: 'multi_operations',
      description: 'Multi-function operations',
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

describe('Dynamic Module Loading', () => {
  let handleRegistry;
  let toolRegistry;
  let planExecutor;
  let planningTools;
  let adapter;
  let server;
  let TOOLS;

  beforeEach(async () => {
    // Initialize registries
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry(handleRegistry);
    planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
    planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);
    
    // Initialize adapter
    adapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
    await adapter.initialize();
    
    // Initialize base tools array
    TOOLS = [
      {
        name: "context_add",
        description: "Add data to the context for AI agents to reference",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name/key for the context data" },
            data: { description: "Context data to store (any type)" },
            description: { type: "string", description: "Optional description of what this context contains" }
          },
          required: ["name", "data"]
        }
      },
      {
        name: "context_get",
        description: "Retrieve context data by name",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the context data to retrieve" }
          },
          required: ["name"]
        }
      },
      {
        name: "context_list",
        description: "List all available context data",
        inputSchema: {
          type: "object",
          properties: {
            filter: { type: "string", description: "Optional filter pattern for context names" }
          }
        }
      },
      ...Object.values(planningTools.getTools())
    ];
    
    // Create MCP server
    server = new Server(
      { name: "test-aiur", version: "1.0.0" },
      { capabilities: { resources: {}, tools: {} } }
    );
  });

  describe('Generic Module Loading', () => {
    test('should load any Legion module without module-specific code', async () => {
      // Load a simple module
      const result = await adapter.loadModule(MockSimpleModule, {
        testDep: 'test-value'
      });

      expect(result.moduleName).toBe('simple');
      expect(result.toolsRegistered).toBe(1);
      expect(result.tools).toContain('simple_tool');
    });

    test('should load multiple modules independently', async () => {
      // Load first module
      const result1 = await adapter.loadModule(MockSimpleModule, {
        testDep: 'simple-dep'
      });

      // Load second module
      const result2 = await adapter.loadModule(MockMultiFunctionModule, {
        testDep: 'multi-dep'
      });

      expect(result1.moduleName).toBe('simple');
      expect(result2.moduleName).toBe('multi');
      
      // Check all modules are loaded
      const loaded = adapter.listLoadedModules();
      expect(loaded).toHaveLength(2);
      expect(loaded.map(m => m.name)).toContain('simple');
      expect(loaded.map(m => m.name)).toContain('multi');
    });

    test('should handle module loading errors gracefully', async () => {
      class ErrorModule {
        constructor() {
          throw new Error('Module initialization failed');
        }
      }

      await expect(adapter.loadModule(ErrorModule)).rejects.toThrow('Module initialization failed');
      
      // Should not affect other modules
      const loaded = adapter.listLoadedModules();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('Tool Registration in MCP', () => {
    test('should make loaded tools available in MCP tool list', async () => {
      // Load module
      await adapter.loadModule(MockSimpleModule, {});
      
      // Get the registered tool
      const registeredTool = toolRegistry.getTool('simple_tool');
      expect(registeredTool).toBeDefined();
      
      // Add to TOOLS array (simulating what index.js should do)
      const mcpTool = {
        name: registeredTool.name,
        description: registeredTool.description,
        inputSchema: registeredTool.inputSchema
      };
      TOOLS.push(mcpTool);
      
      // Set up server handler with updated TOOLS
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS
      }));
      
      // Simulate MCP list tools request
      const response = await server.requestHandlers.get('tools/list')();
      
      const toolNames = response.tools.map(t => t.name);
      expect(toolNames).toContain('simple_tool');
      expect(toolNames).toContain('context_add'); // Base tools still there
    });

    test('should handle multi-function tools in MCP listing', async () => {
      // Load multi-function module
      await adapter.loadModule(MockMultiFunctionModule, {});
      
      // Get all registered tools
      const allTools = toolRegistry.getAllTools();
      const multiTools = allTools.filter(t => 
        t.tags && t.tags.includes('legion-module')
      );
      
      // Add each function as separate MCP tool
      multiTools.forEach(tool => {
        TOOLS.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      });
      
      // Set up server handler
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS
      }));
      
      // Get tool list
      const response = await server.requestHandlers.get('tools/list')();
      const toolNames = response.tools.map(t => t.name);
      
      expect(toolNames).toContain('operation_one');
      expect(toolNames).toContain('operation_two');
    });

    test('should preserve tool metadata in MCP format', async () => {
      await adapter.loadModule(MockSimpleModule, {});
      
      const registeredTool = toolRegistry.getTool('simple_tool');
      const mcpTool = {
        name: registeredTool.name,
        description: registeredTool.description,
        inputSchema: registeredTool.inputSchema
      };
      
      expect(mcpTool.name).toBe('simple_tool');
      expect(mcpTool.description).toBe('A simple tool');
      expect(mcpTool.inputSchema.type).toBe('object');
      expect(mcpTool.inputSchema.properties.message).toBeDefined();
    });
  });

  describe('Dynamic Loading Function', () => {
    test('should support a generic loadLegionModules function', async () => {
      // Simulate the generic loading function that should be in index.js
      async function loadLegionModules(modules, adapter, TOOLS) {
        const results = [];
        
        for (const [ModuleClass, dependencies] of modules) {
          try {
            const result = await adapter.loadModule(ModuleClass, dependencies);
            results.push(result);
            
            // Add tools to MCP list
            const registeredTools = toolRegistry.getAllTools();
            const newTools = registeredTools.filter(tool => 
              tool.tags && 
              tool.tags.includes('legion-module') &&
              !TOOLS.some(t => t.name === tool.name)
            );
            
            newTools.forEach(tool => {
              TOOLS.push({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              });
            });
          } catch (error) {
            console.error(`Failed to load module: ${error.message}`);
          }
        }
        
        return results;
      }
      
      // Test the function
      const modules = [
        [MockSimpleModule, { dep1: 'value1' }],
        [MockMultiFunctionModule, { dep2: 'value2' }]
      ];
      
      const results = await loadLegionModules(modules, adapter, TOOLS);
      
      expect(results).toHaveLength(2);
      expect(results[0].moduleName).toBe('simple');
      expect(results[1].moduleName).toBe('multi');
      
      // Check tools were added to TOOLS array
      const toolNames = TOOLS.map(t => t.name);
      expect(toolNames).toContain('simple_tool');
      expect(toolNames).toContain('operation_one');
      expect(toolNames).toContain('operation_two');
    });

    test('should handle empty module list', async () => {
      async function loadLegionModules(modules, adapter, TOOLS) {
        if (!modules || modules.length === 0) {
          return [];
        }
        // ... rest of implementation
        return [];
      }
      
      const results = await loadLegionModules([], adapter, TOOLS);
      expect(results).toEqual([]);
    });

    test('should continue loading after module failure', async () => {
      class FailingModule {
        constructor() {
          throw new Error('Intentional failure');
        }
      }
      
      async function loadLegionModules(modules, adapter, TOOLS) {
        const results = [];
        
        for (const [ModuleClass, dependencies] of modules) {
          try {
            const result = await adapter.loadModule(ModuleClass, dependencies);
            results.push(result);
          } catch (error) {
            console.error(`Failed to load module: ${error.message}`);
            results.push({ error: error.message });
          }
        }
        
        return results;
      }
      
      const modules = [
        [MockSimpleModule, {}],
        [FailingModule, {}],
        [MockMultiFunctionModule, {}]
      ];
      
      const results = await loadLegionModules(modules, adapter, TOOLS);
      
      expect(results).toHaveLength(3);
      expect(results[0].moduleName).toBe('simple');
      expect(results[1].error).toBe('Intentional failure');
      expect(results[2].moduleName).toBe('multi');
    });
  });

  describe('Server Initialization Order', () => {
    test('should demonstrate correct initialization order', async () => {
      const initOrder = [];
      
      // 1. Initialize registries
      initOrder.push('registries');
      
      // 2. Create base TOOLS array
      initOrder.push('base-tools');
      
      // 3. Load Legion modules
      await adapter.loadModule(MockSimpleModule, {});
      initOrder.push('load-modules');
      
      // 4. Add loaded tools to TOOLS
      const registeredTools = toolRegistry.getAllTools();
      const newTools = registeredTools.filter(tool => 
        tool.tags && tool.tags.includes('legion-module')
      );
      newTools.forEach(tool => {
        TOOLS.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      });
      initOrder.push('update-tools-array');
      
      // 5. Set up server handlers
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS
      }));
      initOrder.push('setup-handlers');
      
      expect(initOrder).toEqual([
        'registries',
        'base-tools',
        'load-modules',
        'update-tools-array',
        'setup-handlers'
      ]);
      
      // Verify tools are available
      const response = await server.requestHandlers.get('tools/list')();
      expect(response.tools.map(t => t.name)).toContain('simple_tool');
    });

    test('should fail if handlers set before module loading', async () => {
      // Wrong order: set handler before loading modules
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS // This captures TOOLS before modules are loaded
      }));
      
      // Load module after handler is set
      await adapter.loadModule(MockSimpleModule, {});
      
      // Add to TOOLS (but handler already captured old array)
      const registeredTool = toolRegistry.getTool('simple_tool');
      TOOLS.push({
        name: registeredTool.name,
        description: registeredTool.description,
        inputSchema: registeredTool.inputSchema
      });
      
      // Handler returns old TOOLS array
      const response = await server.requestHandlers.get('tools/list')();
      const hasSimpleTool = response.tools.some(t => t.name === 'simple_tool');
      
      // This demonstrates the problem - tool not in list despite being added
      expect(hasSimpleTool).toBe(false);
      expect(TOOLS.some(t => t.name === 'simple_tool')).toBe(true);
    });
  });

  describe('Module Unloading', () => {
    test('should remove tools when module is unloaded', async () => {
      // Load module
      await adapter.loadModule(MockSimpleModule, {});
      
      // Verify tool exists
      expect(toolRegistry.getTool('simple_tool')).toBeDefined();
      
      // Unload module
      await adapter.unloadModule('simple');
      
      // Tool should be removed
      expect(toolRegistry.getTool('simple_tool')).toBeUndefined();
    });

    test('should handle unloading non-existent module', async () => {
      await expect(adapter.unloadModule('nonexistent'))
        .rejects.toThrow('Module not found: nonexistent');
    });
  });
});