#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import Legion's ResourceManager
import { ResourceManager } from '@legion/module-loader';

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
let logManager = null;

/**
 * Centralized MCP response formatter
 * Ensures all tool responses follow proper MCP format
 */
function formatMCPResponse(data, isError = false) {
  // If data is already properly formatted, return as-is
  if (data && typeof data === 'object' && Array.isArray(data.content)) {
    return data;
  }
  
  // Convert data to proper JSON string (single encoding only)
  let textContent;
  if (typeof data === 'string') {
    textContent = data;
  } else if (typeof data === 'object') {
    textContent = JSON.stringify(data, null, 2);
  } else {
    textContent = String(data);
  }
  
  return {
    content: [{
      type: "text",
      text: textContent
    }],
    isError: Boolean(isError)
  };
}

// FIRST THING: Set up logging to file
async function setupLogging() {
  try {
    // Create LogManager directly with config
    const config = {
      enableFileLogging: process.env.AIUR_ENABLE_FILE_LOGGING !== 'false',
      logDirectory: process.env.AIUR_LOG_DIRECTORY || './logs',
      logRetentionDays: parseInt(process.env.AIUR_LOG_RETENTION_DAYS) || 7,
      maxLogFileSize: parseInt(process.env.AIUR_MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024
    };
    
    logManager = new LogManager(config);
    await logManager.initialize();
    
    // Log startup
    await logManager.logInfo('Aiur MCP Server starting', {
      config,
      pid: process.pid,
      nodeVersion: process.version
    });
    
    return logManager;
  } catch (error) {
    // Use stderr for critical startup error - logManager not available yet
    process.stderr.write(`Failed to setup logging: ${error.message}\n`);
    throw error;
  }
}

/**
 * Initialize all Aiur systems
 */
async function initializeAiurSystems() {
  let errorBroadcastService = null;
  
  try {
    // Create proper ResourceManager from Legion
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Add config to resource manager
    const config = {
      enableFileLogging: process.env.AIUR_ENABLE_FILE_LOGGING !== 'false',
      logDirectory: process.env.AIUR_LOG_DIRECTORY || './logs',
      logRetentionDays: parseInt(process.env.AIUR_LOG_RETENTION_DAYS) || 7,
      maxLogFileSize: parseInt(process.env.AIUR_MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024
    };
    resourceManager.register('config', config);
    
    // Register the already-created LogManager - ensure it's available
    if (logManager) {
      resourceManager.register('logManager', logManager);
    } else {
      // Create a minimal logManager if none exists
      const minimalLogManager = {
        logInfo: () => Promise.resolve(),
        logError: () => Promise.resolve(),
        logWarning: () => Promise.resolve()
      };
      resourceManager.register('logManager', minimalLogManager);
    }

    // CRITICAL: Create ErrorBroadcastService first so it can catch all errors
    errorBroadcastService = await ErrorBroadcastService.create(resourceManager);
    
    // Connect already-created LogManager to ErrorBroadcastService
    if (logManager) {
      errorBroadcastService.setLogManager(logManager);
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

    // Log to file only - stdout must remain clean for MCP protocol
    if (logManager) {
      await logManager.logInfo('Aiur systems initialized successfully', {
        source: 'initializeAiurSystems',
        operation: 'startup-complete'
      });
      
      const stats = provider.getToolStatistics();
      await logManager.logInfo(`Loaded ${stats.total} tools (${stats.context} context, ${stats.modules} module) from ${stats.loadedModules} modules`, {
        source: 'initializeAiurSystems',
        operation: 'tool-stats',
        totalTools: stats.total,
        contextTools: stats.context,
        moduleTools: stats.modules,
        loadedModules: stats.loadedModules
      });
    }

    // Auto-add current directory to context after all tools are loaded
    try {
      const currentDirectory = process.cwd();
      const result = await provider.executeTool('context_add', {
        name: 'current_directory',
        data: {
          path: currentDirectory,
          addedAt: new Date().toISOString(),
          source: 'aiur_startup'
        },
        description: 'Current working directory where Aiur MCP server was started'
      });
      
      if (!result.isError) {
        if (logManager) {
          await logManager.logInfo(`Added current directory to context: ${currentDirectory}`, {
            source: 'initializeAiurSystems',
            operation: 'add-directory-context',
            directory: currentDirectory
          });
        }
      } else {
        if (logManager) {
          await logManager.logError(new Error('Failed to add current directory to context'), {
            source: 'initializeAiurSystems',
            operation: 'add-directory-context-failed',
            directory: currentDirectory,
            errorDetails: result.content[0].text
          });
        }
      }
    } catch (contextError) {
      // Log but don't fail startup
      if (logManager) {
        await logManager.logError(contextError, {
          source: 'initializeAiurSystems',
          operation: 'add-current-directory-context',
          severity: 'warning'
        });
      }
    }

  } catch (error) {
    // Use stderr for critical initialization error
    process.stderr.write(`Failed to initialize Aiur systems: ${error.message}\n`);
    
    // Log to file if possible
    if (logManager) {
      await logManager.logError(error, {
        source: 'initializeAiurSystems',
        operation: 'system-initialization',
        phase: 'startup',
        severity: 'critical'
      });
    }
    
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
  // Log to file only - no console output to preserve MCP stdio protocol
  if (logManager) {
    await logManager.logInfo(`handleToolCall called for: ${name}`, {
      source: 'handleToolCall',
      operation: 'tool-call-start',
      tool: name
    });
  }
  
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
    let result;
    try {
      // Log tool execution start to file only
      if (logManager) {
        await logManager.logInfo(`Executing tool: ${name}`, {
          source: 'handleToolCall',
          operation: 'tool-execution-start',
          tool: name,
          argsProvided: Object.keys(resolvedArgs).length > 0
        });
      }
      
      result = await toolDefinitionProvider.executeTool(name, resolvedArgs);
      
      // Log successful completion to file only
      if (logManager) {
        await logManager.logInfo(`Tool ${name} execution completed successfully`, {
          source: 'handleToolCall',
          operation: 'tool-execution-success',
          tool: name
        });
      }
    } catch (toolExecutionError) {
      // Log to file only, no console output
      if (logManager) {
        await logManager.logError(toolExecutionError, {
          source: 'handleToolCall',
          operation: 'tool-execution',
          tool: name,
          args: resolvedArgs,
          severity: 'error'
        });
      }
      
      // Broadcast error if service is available
      if (globalErrorBroadcastService) {
        globalErrorBroadcastService.captureError({
          error: toolExecutionError,
          errorType: 'tool-execution',
          severity: 'error',
          source: 'handleToolCall',
          context: {
            tool: name,
            operation: 'tool-execution',
            args: resolvedArgs
          }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: `Error executing tool ${name}: ${toolExecutionError.message}`
        }],
        isError: true,
      };
    }

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
        // Log auto-save failure to file only
        if (logManager) {
          await logManager.logError(contextError, {
            source: 'handleToolCall',
            operation: 'auto-save-context-failed',
            tool: name
          });
        }
        // Don't fail the original request, just log the warning
      }
    }

    // Validate MCP response format before returning
    try {
      if (!result || typeof result !== 'object') {
        throw new Error('Result is not an object');
      }
      
      if (!Array.isArray(result.content)) {
        throw new Error('Result.content is not an array');
      }
      
      if (result.content.length === 0) {
        throw new Error('Result.content is empty');
      }
      
      for (let i = 0; i < result.content.length; i++) {
        const content = result.content[i];
        if (!content || typeof content !== 'object') {
          throw new Error(`Content[${i}] is not an object`);
        }
        if (!content.type || typeof content.type !== 'string') {
          throw new Error(`Content[${i}].type is missing or not a string`);
        }
        if (content.type === 'text' && (!content.text || typeof content.text !== 'string')) {
          throw new Error(`Content[${i}].text is missing or not a string for text type`);
        }
        
        // Check for double-encoded JSON (escaped quotes/newlines)
        if (content.type === 'text' && content.text.includes('\\n') && content.text.includes('\\"')) {
          throw new Error(`Content[${i}].text appears to be double-encoded JSON with escaped quotes/newlines`);
        }
      }
      
      // Log validation success to file only
      if (logManager) {
        await logManager.logInfo(`Valid MCP response for tool ${name}`, {
          source: 'handleToolCall',
          operation: 'response-validation',
          tool: name,
          isError: result.isError,
          contentCount: result.content.length,
          contentTypes: result.content.map(c => c.type),
          contentSizes: result.content.map(c => c.text?.length || 0)
        });
      }
      
    } catch (validationError) {
      // Log validation error to file only
      if (logManager) {
        await logManager.logError(validationError, {
          source: 'handleToolCall',
          operation: 'response-validation-failed',
          tool: name,
          rawResult: result
        });
      }
      
      // Try to auto-fix double-encoded JSON
      if (validationError.message.includes('double-encoded JSON')) {
        if (logManager) {
          await logManager.logInfo(`Attempting to fix double-encoded JSON for tool ${name}`, {
            source: 'handleToolCall',
            operation: 'auto-fix-encoding'
          });
        }
        try {
          const originalText = result.content[0].text;
          // Parse the double-encoded string to get the actual object
          const parsedText = JSON.parse(originalText);
          
          // Create properly formatted response
          const fixedResponse = formatMCPResponse(parsedText, result.isError);
          
          if (logManager) {
            await logManager.logInfo(`Successfully fixed double-encoded JSON for tool ${name}`, {
              source: 'handleToolCall',
              operation: 'auto-fix-success'
            });
          }
          return fixedResponse;
        } catch (fixError) {
          if (logManager) {
            await logManager.logError(fixError, {
              source: 'handleToolCall',
              operation: 'auto-fix-failed',
              tool: name
            });
          }
        }
      }
      
      // Return a properly formatted error response using centralized formatter
      return formatMCPResponse({
        success: false,
        error: `Invalid response format: ${validationError.message}`,
        originalError: result
      }, true);
    }
    
    return result;

  } catch (error) {
    // Log to file only - preserve MCP stdio protocol
    if (logManager) {
      await logManager.logError(error, {
        source: 'handleToolCall',
        operation: 'tool-execution-error',
        tool: name,
        severity: 'error'
      });
    }
    
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
    // FIRST: Setup logging before anything else
    await setupLogging();
    
    // THEN: Initialize all systems
    await initializeAiurSystems();
    
    // NOW set up request handlers - they will use the initialized systems
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitionProvider.getAllToolDefinitions(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Temporary debug to stderr to diagnose issue
      process.stderr.write(`MCP CallTool request received for: ${request.params.name}\n`);
      
      try {
        const result = await handleToolCall(request.params.name, request.params.arguments ?? {});
        process.stderr.write(`MCP CallTool request completed for: ${request.params.name}\n`);
        return result;
      } catch (error) {
        process.stderr.write(`MCP CallTool request failed for: ${request.params.name}: ${error.message}\n`);
        throw error;
      }
    }
    );
    
    // CRITICAL: Connect transport last
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Server is ready - this message to stderr is safe for MCP
    process.stderr.write("Aiur MCP Server started successfully\n");

  } catch (error) {
    // Log to file if possible
    if (logManager) {
      await logManager.logError(error, {
        source: 'runServer',
        operation: 'server-startup',
        phase: 'main',
        severity: 'critical'
      });
    }
    
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
runServer().catch(async (error) => {
  // Log to file if possible
  if (logManager) {
    await logManager.logError(error, {
      source: 'main',
      operation: 'server-start-catch',
      severity: 'critical'
    });
  }
  
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

// Add comprehensive process monitoring
process.on('uncaughtException', (error) => {
  // Use stderr for critical process errors - this is acceptable for MCP
  process.stderr.write(`UNCAUGHT EXCEPTION - Process will exit: ${error.message}\n`);
  if (logManager) {
    logManager.logError(error, {
      source: 'process',
      operation: 'uncaughtException',
      severity: 'critical'
    }).then(() => process.exit(1)).catch(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Use stderr for critical process errors
  process.stderr.write(`UNHANDLED REJECTION - Process may exit: ${reason}\n`);
  if (logManager) {
    logManager.logError(new Error(`Unhandled rejection: ${reason}`), {
      source: 'process',
      operation: 'unhandledRejection',
      severity: 'critical',
      promise: promise
    }).catch(() => {});
  }
});

process.on('SIGTERM', (signal) => {
  process.stderr.write('SIGTERM received, shutting down gracefully\n');
  process.exit(0);
});

process.on('SIGINT', (signal) => {
  process.stderr.write('SIGINT received, shutting down gracefully\n');
  process.exit(0);
});

process.on('exit', (code) => {
  process.stderr.write(`Process exiting with code: ${code}\n`);
});

// Handle graceful shutdown
process.stdin.on("close", async () => {
  process.stderr.write("Aiur MCP Server closed\n");
  server.close();
  
  // Close log manager if available
  try {
    const logManager = globalErrorBroadcastService?.logManager;
    if (logManager) {
      await logManager.shutdown();
    }
  } catch (error) {
    process.stderr.write(`Error shutting down LogManager: ${error.message}\n`);
  }
  
  if (globalErrorBroadcastService) {
    globalErrorBroadcastService.destroy();
  }
});