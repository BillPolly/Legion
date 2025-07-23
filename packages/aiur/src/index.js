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
import { PlanningTools } from './planning/PlanningTools.js';
import { PlanExecutor } from './planning/PlanExecutor.js';

// Initialize Aiur systems
const handleRegistry = new HandleRegistry();
const handleResolver = new HandleResolver(handleRegistry);
const toolRegistry = new ToolRegistry(handleRegistry);
const planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
const planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);

// Get comprehensive tools from our systems  
const comprehensiveTools = [
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
  },
  
  // Add our comprehensive planning tools
  ...Object.values(planningTools.getTools())
];

// Simple tools
const simpleTools = [
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
  }, {
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
  },
  
  // Add our comprehensive planning tools
  ...Object.values(planningTools.getTools())
];
const TOOLS = simpleTools;

async function handleToolCall(name, args) {
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
    
    // Route to our comprehensive planning tools
    const planningToolsMap = planningTools.getTools();
    if (planningToolsMap[name]) {
      const result = await planningToolsMap[name].execute(resolvedArgs);
      
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
      
      // Convert our tool result format to MCP format
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

// Setup request handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [],
}));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) =>
  handleToolCall(request.params.name, request.params.arguments ?? {})
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);

process.stdin.on("close", () => {
  console.error("Aiur MCP Server closed");
  server.close();
});