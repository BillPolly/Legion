#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import our Aiur systems
import { HandleRegistry } from './handles/HandleRegistry.js';
import { HandleResolver } from './handles/HandleResolver.js';
import { ToolRegistry } from './tools/ToolRegistry.js';

// Import Legion module system for modules
import FileModule from '../../general-tools/src/file/FileModule.js';
import { PlanExecutorModule } from '@legion/plan-executor';
import { LLMPlannerModule } from '@legion/llm-planner';
import { LegionModuleAdapter } from './tools/LegionModuleAdapter.js';

// Initialize Aiur systems
const handleRegistry = new HandleRegistry();
const handleResolver = new HandleResolver(handleRegistry);
const toolRegistry = new ToolRegistry(handleRegistry);

// Initialize tools array with base tools
const TOOLS = [
  // Context management tools
  {
    name: "context_add",
    description: "Add data to the context for AI agents to reference",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name/key for the context data"
        },
        data: {
          description: "Context data to store (any type)"
        },
        description: {
          type: "string",
          description: "Optional description of what this context contains"
        }
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
        name: {
          type: "string",
          description: "Name of the context data to retrieve"
        }
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
        filter: {
          type: "string",
          description: "Optional filter pattern for context names"
        }
      }
    }
  }
  // Planning tools will be added dynamically from modules
];

async function handleToolCall(name, args) {
  console.error(`handleToolCall called for: ${name}`);
  console.error(`Available tools in registry:`, toolRegistry.getToolNames());
  
  try {
    // First, resolve any handle references in the arguments
    let resolvedArgs = args;
    try {
      resolvedArgs = handleResolver.resolveParameters(args);
    } catch (resolutionError) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Parameter resolution failed: ${resolutionError.message}`
          }, null, 2)
        }],
        isError: true,
      };
    }
    // Handle context management tools
    if (name === "context_add") {
      const contextName = `context_${resolvedArgs.name}`;
      const contextData = {
        data: resolvedArgs.data,
        description: resolvedArgs.description || `Context data: ${resolvedArgs.name}`,
        addedAt: new Date().toISOString(),
        type: 'context'
      };
      
      const handleId = handleRegistry.create(contextName, contextData);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Context '${resolvedArgs.name}' added successfully`,
            handleId,
            contextName: resolvedArgs.name
          }, null, 2)
        }],
        isError: false,
      };
    }
    
    if (name === "context_get") {
      const contextName = `context_${resolvedArgs.name}`;
      const handle = handleRegistry.getByName(contextName);
      
      if (!handle) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Context '${resolvedArgs.name}' not found`
            }, null, 2)
          }],
          isError: true,
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            name: resolvedArgs.name,
            data: handle.data.data,
            description: handle.data.description,
            addedAt: handle.data.addedAt
          }, null, 2)
        }],
        isError: false,
      };
    }
    
    if (name === "context_list") {
      const allHandles = handleRegistry.listHandles();
      const contextHandles = allHandles.filter(h => h.name.startsWith('context_'));
      
      let filteredHandles = contextHandles;
      if (resolvedArgs.filter) {
        const regex = new RegExp(resolvedArgs.filter, 'i');
        filteredHandles = contextHandles.filter(h => 
          regex.test(h.name.substring('context_'.length))
        );
      }
      
      const contexts = filteredHandles.map(h => ({
        name: h.name.substring('context_'.length),
        description: h.data.description,
        addedAt: h.data.addedAt,
        dataType: typeof h.data.data
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            contexts,
            total: contexts.length
          }, null, 2)
        }],
        isError: false,
      };
    }
    
    // Check if it's a dynamically loaded tool in the toolRegistry
    const registeredTool = toolRegistry.getTool(name);
    if (registeredTool) {
      console.error(`Found registered tool: ${name}`);
      let result;
      
      // Check if it's a multi-function tool
      if (registeredTool.functions) {
        // Find the specific function
        const func = registeredTool.functions.find(f => f.name === name);
        if (func) {
          result = await func.execute(resolvedArgs);
        } else {
          return {
            content: [{
              type: "text",
              text: `Function ${name} not found in multi-function tool`
            }],
            isError: true,
          };
        }
      } else if (registeredTool.execute) {
        // Single function tool
        result = await registeredTool.execute(resolvedArgs);
      } else {
        return {
          content: [{
            type: "text",
            text: `Tool ${name} has no execute method`
          }],
          isError: true,
        };
      }
      
      // Auto-save to context if saveAs is provided
      if (resolvedArgs.saveAs && result.success) {
        const contextName = `context_${resolvedArgs.saveAs}`;
        const contextData = {
          data: result,
          description: `Result from ${name} tool`,
          addedAt: new Date().toISOString(),
          type: 'context',
          sourceTool: name,
          sourceArgs: resolvedArgs
        };
        
        try {
          const contextHandle = handleRegistry.create(contextName, contextData);
          result.savedToContext = {
            contextName: resolvedArgs.saveAs,
            handleId: contextHandle,
            message: `Result saved to context as '${resolvedArgs.saveAs}'`
          };
        } catch (contextError) {
          result.contextWarning = `Failed to save to context: ${contextError.message}`;
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }],
        isError: !result.success,
      };
    }
    
    // If no tool found
    return {
      content: [{
        type: "text",
        text: `Unknown tool: ${name}`
      }],
      isError: true,
    };
    
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error executing tool ${name}: ${error.message}`
      }],
      isError: true,
    };
  }
}

const server = new Server(
  {
    name: "aiur",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

async function loadLegionModules() {
  try {
    // Create LegionModuleAdapter to bridge Legion tools to MCP
    const legionAdapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
    await legionAdapter.initialize();
    
    // Load modules using async factory pattern where available
    try {
      // Load LLMPlannerModule using async factory
      const llmPlannerModule = await LLMPlannerModule.create(legionAdapter.resourceManager);
      
      // Register the tools from the created module manually
      const tools = llmPlannerModule.getTools();
      for (const tool of tools) {
        const mcpTools = legionAdapter._convertToMCPTools(tool, llmPlannerModule);
        const toolsToRegister = Array.isArray(mcpTools) ? mcpTools : [mcpTools];
        for (const mcpTool of toolsToRegister) {
          toolRegistry.registerTool(mcpTool);
        }
      }
      
      legionAdapter.loadedModules.set(llmPlannerModule.name, llmPlannerModule);
      console.error(`Loaded module: ${llmPlannerModule.name}`);
    } catch (error) {
      console.error('Failed to load LLMPlannerModule:', error.message);
    }

    // Module configuration for other modules
    const moduleConfigs = [
      {
        module: PlanExecutorModule,
        dependencies: {
          // PlanExecutorModule uses resourceManager and moduleFactory from adapter
        }
      },
      {
        module: FileModule,
        dependencies: {
          basePath: process.cwd(),
          encoding: 'utf8',
          createDirectories: true,
          permissions: 0o755
        }
      }
      // Add more modules here as needed
    ];
    
    // Load each module
    for (const config of moduleConfigs) {
      try {
        const result = await legionAdapter.loadModule(config.module, config.dependencies);
        console.error(`Loaded module: ${result.moduleName}`);
      
      // Get all newly registered tools
      const registeredTools = toolRegistry.getAllTools();
      const newTools = registeredTools.filter(tool => 
        tool.tags && 
        tool.tags.includes('legion-module') &&
        !TOOLS.some(t => t.name === tool.name)
      );
      
      // Add each tool to TOOLS array for MCP listing
      newTools.forEach(tool => {
        TOOLS.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      });
      
      console.error(`Added ${newTools.length} tools from ${result.moduleName}:`, newTools.map(t => t.name));
      } catch (error) {
        console.error(`Failed to load module ${config.module.name}:`, error.message);
        // Continue loading other modules
      }
    }
    
    console.error(`Total tools available: ${TOOLS.length}`);
  } catch (error) {
    console.error('Failed to load modules:', error);
  }
}

async function runServer() {
  // CRITICAL: Load modules BEFORE setting up handlers
  await loadLegionModules();
  
  // NOW set up request handlers - they will capture the updated TOOLS array
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments ?? {})
  );
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);

process.stdin.on("close", () => {
  console.error("Aiur MCP Server closed");
  server.close();
});