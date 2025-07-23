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
import { ErrorBroadcastService } from './core/ErrorBroadcastService.js';
import { LogManager } from './core/LogManager.js';

// Global variables for MCP server
let toolDefinitionProvider = null;
let handleResolver = null;
let globalErrorBroadcastService = null;

/**
 * Initialize all Aiur systems using ResourceManager pattern
 */
async function initializeAiurSystems() {
  let errorBroadcastService = null;
  
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

    // Add config to resource manager
    const config = {
      enableFileLogging: process.env.AIUR_ENABLE_FILE_LOGGING !== 'false',
      logDirectory: process.env.AIUR_LOG_DIRECTORY || './logs',
      logRetentionDays: parseInt(process.env.AIUR_LOG_RETENTION_DAYS) || 7,
      maxLogFileSize: parseInt(process.env.AIUR_MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024
    };
    resourceManager.register('config', config);

    // CRITICAL: Create ErrorBroadcastService first so it can catch all errors
    errorBroadcastService = await ErrorBroadcastService.create(resourceManager);
    
    // Create LogManager for file-based logging
    try {
      const logManager = await LogManager.create(resourceManager);
      errorBroadcastService.setLogManager(logManager);
      
      // Register LogManager for other components to use
      resourceManager.register('logManager', logManager);
      
      // Log startup
      await logManager.logInfo('Aiur MCP Server starting', {
        config,
        pid: process.pid,
        nodeVersion: process.version
      });
    } catch (logError) {
      console.error('Failed to initialize LogManager:', logError);
      // Continue without file logging
    }

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
    
    // Connect ErrorBroadcastService to WebDebugServer if it wasn't connected during creation
    if (!webDebugServer.errorBroadcastService && errorBroadcastService) {
      webDebugServer.connectErrorBroadcastService(errorBroadcastService);
    }

    // Create and register DebugTool to extend the ToolDefinitionProvider
    const debugTool = await DebugTool.create(resourceManager);
    
    // Add debug tools to the provider's tool list
    const debugToolDefinitions = debugTool.getToolDefinitions();
    provider._debugTools = debugToolDefinitions;
    provider.setDebugTool(debugTool);

    // Store globally for use in request handlers
    toolDefinitionProvider = provider;
    handleResolver = resolver;
    globalErrorBroadcastService = errorBroadcastService;

    console.error('Aiur systems initialized successfully');
    
    const stats = provider.getToolStatistics();
    console.error(`Loaded ${stats.total} tools (${stats.context} context, ${stats.modules} module) from ${stats.loadedModules} modules`);

  } catch (error) {
    console.error('Failed to initialize Aiur systems:', error);
    
    // Try to broadcast the error if service is available
    if (errorBroadcastService) {
      errorBroadcastService.captureError({
        error,
        errorType: 'system',
        severity: 'critical',
        source: 'initializeAiurSystems',
        context: {
          operation: 'system-initialization',
          phase: 'startup'
        }
      });
    }
    
    // Store the error service globally even if initialization failed
    if (errorBroadcastService) {
      globalErrorBroadcastService = errorBroadcastService;
    }
    
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
      const error = new Error(`Unknown tool: ${name}`);
      
      // Broadcast error if service is available
      if (globalErrorBroadcastService) {
        globalErrorBroadcastService.captureToolError(error, name, args);
      }
      
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
      // Broadcast error if service is available
      if (globalErrorBroadcastService) {
        globalErrorBroadcastService.captureError({
          error: resolutionError,
          errorType: 'tool-execution',
          severity: 'error',
          source: 'handleToolCall',
          context: {
            tool: name,
            operation: 'parameter-resolution',
            args
          }
        });
      }
      
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
    
    // Broadcast error if service is available
    if (globalErrorBroadcastService) {
      globalErrorBroadcastService.captureToolError(error, name, args);
    }
    
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
    
    // Try to broadcast the error before exiting
    if (globalErrorBroadcastService) {
      globalErrorBroadcastService.captureError({
        error,
        errorType: 'system',
        severity: 'critical',
        source: 'runServer',
        context: {
          operation: 'server-startup',
          phase: 'main'
        }
      });
      
      // Give some time for error to be broadcast
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    process.exit(1);
  }
}

// Note: Global error handlers are set up by ErrorBroadcastService in initializeAiurSystems()
// We only need to handle errors that occur before ErrorBroadcastService is initialized

// Start the server
runServer().catch((error) => {
  console.error('Failed to start server:', error);
  
  // If we have the error broadcast service, use it
  if (globalErrorBroadcastService) {
    globalErrorBroadcastService.captureError({
      error,
      errorType: 'system',
      severity: 'critical',
      source: 'main',
      context: {
        operation: 'server-start-catch'
      }
    });
  }
  
  process.exit(1);
});

// Handle graceful shutdown
process.stdin.on("close", async () => {
  console.error("Aiur MCP Server closed");
  server.close();
  
  // Close log manager if available
  try {
    const logManager = globalErrorBroadcastService?.logManager;
    if (logManager) {
      await logManager.shutdown();
    }
  } catch (error) {
    console.error('Error shutting down LogManager:', error);
  }
  
  if (globalErrorBroadcastService) {
    globalErrorBroadcastService.destroy();
  }
});