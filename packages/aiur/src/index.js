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
import { ToolRegistry } from './tools/ToolRegistry.js';
import { PlanningTools } from './planning/PlanningTools.js';
import { PlanExecutor } from './planning/PlanExecutor.js';

// Initialize Aiur systems
const handleRegistry = new HandleRegistry();
const toolRegistry = new ToolRegistry(handleRegistry);
const planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
const planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);

// Get comprehensive tools from our systems
const comprehensiveTools = [
  // Keep original about and hello tools for compatibility
  {
    name: "about",
    description: "Returns information about this MCP server",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "hello",
    description: "A simple greeting tool",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name to greet (optional)"
        }
      },
      required: []
    }
  },
  // Add our comprehensive tools
  ...Object.values(planningTools.getTools())
];

const TOOLS = comprehensiveTools;

async function handleToolCall(name, args) {
  try {
    // Handle original tools for compatibility
    if (name === "about") {
      return {
        content: [{
          type: "text",
          text: "Aiur MCP Server (version 1.0.0)\n\nAn MCP server for AI agent coordination in the jsEnvoy/Legion framework."
        }],
        isError: false,
      };
    }
    
    if (name === "hello") {
      const userName = args.name || "World";
      return {
        content: [{
          type: "text",
          text: `Hello, ${userName}! This is Aiur, ready to coordinate your AI agents.`
        }],
        isError: false,
      };
    }
    
    // Route to our comprehensive tools
    const planningToolsMap = planningTools.getTools();
    if (planningToolsMap[name]) {
      const result = await planningToolsMap[name].execute(args);
      
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