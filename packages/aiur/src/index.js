#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from 'ws';

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
          text: "This is a template MCP server (version 1.0.0).\n\nIt serves as a template for building Claude integrations."
        }],
        isError: false,
      };
      
    case "hello":
      const userName = args.name || "World";
      return {
        content: [{
          type: "text",
          text: `Hello, ${userName}! This is a response from the template MCP server.`
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
    name: "template-mcp-server",
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

// WebSocket server for direct testing
function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', (ws) => {
    console.error('WebSocket client connected');
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'call_tool') {
          const result = await handleToolCall(message.name, message.args || {});
          ws.send(JSON.stringify({
            type: 'tool_result',
            id: message.id,
            result: result.content[0].text,
            error: result.isError
          }));
        } else if (message.type === 'list_tools') {
          ws.send(JSON.stringify({
            type: 'tools_list',
            id: message.id,
            tools: TOOLS
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    });
    
    ws.on('close', () => {
      console.error('WebSocket client disconnected');
    });
  });
  
  console.error('WebSocket server started on port 8080');
}

async function runServer() {
  // Start WebSocket server for direct testing
  startWebSocketServer();
  
  // Start stdio transport for Claude Code integration
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);

process.stdin.on("close", () => {
  console.error("Template MCP Server closed");
  server.close();
});