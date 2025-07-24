#!/usr/bin/env node
/**
 * Simple Node.js MCP server with SSE transport
 * Based on the official MCP TypeScript SDK
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

// Create MCP server
const server = new McpServer(
  {
    name: "My Node.js MCP Server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Add a simple tool
server.tool("greet", {
  name: z.string().describe("Name to greet"),
}, async ({ name }) => {
  return {
    content: [
      {
        type: "text",
        text: `Hello, ${name}! This is from a Node.js MCP server.`,
      },
    ],
  };
});

// Add another tool  
server.tool("calculate", {
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  a: z.number(),
  b: z.number(),
}, async ({ operation, a, b }) => {
  let result;
  switch (operation) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      result = b !== 0 ? a / b : "Error: Division by zero";
      break;
  }
  
  return {
    content: [
      {
        type: "text", 
        text: `${a} ${operation} ${b} = ${result}`,
      },
    ],
  };
});

// Create Express app
const app = express();
app.use(express.json());

let transport = null;

// SSE endpoint
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  transport = new SSEServerTransport("/messages", res);
  server.connect(transport);
});

// Messages endpoint
app.post("/messages", (req, res) => {
  if (transport) {
    transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "No SSE connection established" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", server: "Node.js MCP Server" });
});

const PORT = process.env.PORT || 8355;

app.listen(PORT, () => {
  console.log('\n🚀 MCP SSE Server started successfully!');
  console.log('=====================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('=====================================');
  console.log('Press Ctrl+C to stop the server\n');
});

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP server...');
  process.exit(0);
});