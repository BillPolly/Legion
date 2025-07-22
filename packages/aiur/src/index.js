#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Simple tools
const TOOLS = [
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
  }
];

async function handleToolCall(name, args) {
  switch (name) {
    case "about":
      return {
        content: [{
          type: "text",
          text: "Aiur MCP Server (version 1.0.0)\n\nAn MCP server for AI agent coordination in the jsEnvoy/Legion framework."
        }],
        isError: false,
      };
      
    case "hello":
      const userName = args.name || "World";
      return {
        content: [{
          type: "text",
          text: `Hello, ${userName}! This is Aiur, ready to coordinate your AI agents.`
        }],
        isError: false,
      };
      
    default:
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`
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