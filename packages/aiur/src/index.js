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

// Import modular components
import { ToolDefinitionProvider } from './core/ToolDefinitionProvider.js';
import { DebugTool } from './debug/DebugTool.js';
import { WebDebugServer } from './debug/WebDebugServer.js';

// Global variables for MCP server
let toolDefinitionProvider = null;
let handleResolver = null;

/**
 * Initialize all Aiur systems using ResourceManager pattern
 */
async function initializeAiurSystems() {
  try {
    // Create basic ResourceManager-like object for dependency injection
    const resourceManager = {
      resources: new Map(),
      
      get(key) {
        const value = this.resources.get(key);
        if (!value) throw new Error(`Resource '${key}' not found`);
        return value;
      },
      
      register(key, value) {
        this.resources.set(key, value);
      }
    };

    // Initialize core Aiur systems
    const handleRegistry = new HandleRegistry();
    const toolRegistry = new ToolRegistry(handleRegistry);
    const resolver = new HandleResolver(handleRegistry);

    // Register systems in ResourceManager
    resourceManager.register('handleRegistry', handleRegistry);
    resourceManager.register('toolRegistry', toolRegistry);
    resourceManager.register('handleResolver', resolver);

    // Create and initialize ToolDefinitionProvider
    const provider = await ToolDefinitionProvider.create(resourceManager);
    await provider.initialize();

    // Register ToolDefinitionProvider and its contextManager for debug tools
    resourceManager.register('toolDefinitionProvider', provider);
    resourceManager.register('contextManager', provider.contextManager);
    
    // Create mock monitoring system if it doesn't exist
    const monitoringSystem = {
      on: () => {},
      recordMetric: () => {},
      getDashboardData: () => ({ systemHealth: { score: 95 } })
    };
    resourceManager.register('monitoringSystem', monitoringSystem);

    // Create WebDebugServer with all dependencies available
    const webDebugServer = await WebDebugServer.create(resourceManager);
    resourceManager.register('webDebugServer', webDebugServer);

    // Create and register DebugTool to extend the ToolDefinitionProvider
    const debugTool = await DebugTool.create(resourceManager);
    
    // Add debug tools to the provider's tool list
    const debugToolDefinitions = debugTool.getToolDefinitions();
    provider._debugTools = debugToolDefinitions;
    provider.setDebugTool(debugTool);

    // Store globally for use in request handlers
    toolDefinitionProvider = provider;
    handleResolver = resolver;

    console.error('Aiur systems initialized successfully');
    
    const stats = provider.getToolStatistics();
    console.error(`Loaded ${stats.total} tools (${stats.context} context, ${stats.modules} module) from ${stats.loadedModules} modules`);

  } catch (error) {
    console.error('Failed to initialize Aiur systems:', error);
    throw error;
  }
}

/**
 * Handle tool execution with parameter resolution and auto-save
 */
async function handleToolCall(name, args) {
  console.error(`handleToolCall called for: ${name}`);
  
  try {
    // Check if tool exists
    if (!toolDefinitionProvider.toolExists(name)) {
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`
        }],
        isError: true,
      };
    }

    // Resolve any handle references in the arguments
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

    // Execute the tool through the provider
    const result = await toolDefinitionProvider.executeTool(name, resolvedArgs);

    // Auto-save to context if saveAs is provided and execution was successful
    if (resolvedArgs.saveAs && !result.isError) {
      try {
        // Parse the result to check if it was successful
        const resultData = JSON.parse(result.content[0].text);
        
        if (resultData.success) {
          const contextName = `context_${resolvedArgs.saveAs}`;
          const contextData = {
            data: resultData,
            description: `Result from ${name} tool`,
            addedAt: new Date().toISOString(),
            type: 'context',
            sourceTool: name,
            sourceArgs: resolvedArgs
          };
          
          // Use context manager to save the result
          const contextResult = await toolDefinitionProvider.contextManager.executeContextTool('context_add', {
            name: resolvedArgs.saveAs,
            data: resultData,
            description: contextData.description
          });

          // Add save confirmation to result
          if (!contextResult.isError) {
            resultData.savedToContext = {
              contextName: resolvedArgs.saveAs,
              message: `Result saved to context as '${resolvedArgs.saveAs}'`
            };
            
            // Update the result content
            result.content[0].text = JSON.stringify(resultData, null, 2);
          } else {
            resultData.contextWarning = `Failed to save to context: ${contextResult.content[0].text}`;
            result.content[0].text = JSON.stringify(resultData, null, 2);
          }
        }
      } catch (contextError) {
        console.error('Auto-save to context failed:', contextError);
        // Don't fail the original request, just log the warning
      }
    }

    return result;

  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [{
        type: "text",
        text: `Error executing tool ${name}: ${error.message}`
      }],
      isError: true,
    };
  }
}

/**
 * Create and configure the MCP server
 */
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

/**
 * Main server initialization and startup
 * CRITICAL: This sequence must be preserved for MCP connection stability
 */
async function runServer() {
  try {
    // CRITICAL: Initialize all systems BEFORE setting up request handlers
    await initializeAiurSystems();
    
    // NOW set up request handlers - they will use the initialized systems
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitionProvider.getAllToolDefinitions(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      handleToolCall(request.params.name, request.params.arguments ?? {})
    );
    
    // CRITICAL: Connect transport last
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("Aiur MCP Server started successfully");

  } catch (error) {
    console.error("Failed to start Aiur MCP Server:", error);
    process.exit(1);
  }
}

// Start the server
runServer().catch(console.error);

// Handle graceful shutdown
process.stdin.on("close", () => {
  console.error("Aiur MCP Server closed");
  server.close();
});