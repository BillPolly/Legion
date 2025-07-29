#!/usr/bin/env node

/**
 * Aiur MCP Bridge - stdio MCP server that connects to Aiur WebSocket server
 * 
 * This bridge allows MCP clients (like Claude) to connect to the Aiur server
 * via the Model Context Protocol over stdio. It translates between MCP and
 * Aiur's WebSocket protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { WebSocketClient } from './client/WebSocketClient.js';
import { ServerManager } from './client/ServerManager.js';
import { LogManager } from './core/LogManager.js';

// Global variables
let wsClient = null;
let serverManager = null;
let logManager = null;
let isShuttingDown = false;

/**
 * FIRST THING: Set up logging to file (from oldIndex.js)
 */
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
    await logManager.logInfo('Aiur MCP Client starting', {
      config,
      pid: process.pid,
      nodeVersion: process.version
    });
    
    return logManager;
  } catch (error) {
    // Critical error - can't continue without logging
    throw error;
  }
}

/**
 * Format conversion utilities (matching oldIndex.js pattern)
 */
class FormatConverter {
  /**
   * Convert Legion format to MCP format
   * Legion: {success: true, data: {...}, message: "..."}
   * MCP: {content: [{type: "text", text: "JSON string"}], isError: false}
   */
  static legionToMcp(legionResult) {
    // Handle error cases
    if (!legionResult.success) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: legionResult.error,
            code: legionResult.code
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Handle success cases
    const responseData = {
      success: true,
      ...legionResult
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(responseData, null, 2)
      }],
      isError: false
    };
  }
  
  /**
   * Convert MCP tools/list response
   */
  static legionToolsListToMcp(legionResult) {
    // The response from the server is already in MCP format
    if (legionResult && Array.isArray(legionResult.tools)) {
      return { tools: legionResult.tools };
    }
    
    // Handle legacy format if needed
    if (legionResult && legionResult.success && legionResult.data && Array.isArray(legionResult.data.tools)) {
      return { tools: legionResult.data.tools };
    }
    
    return { tools: [] };
  }
  
  /**
   * Convert MCP resources/list response
   */
  static legionResourcesListToMcp(legionResult) {
    // The response from the server is already in MCP format
    if (legionResult && Array.isArray(legionResult.resources)) {
      return { resources: legionResult.resources };
    }
    
    // Handle legacy format if needed
    if (legionResult && legionResult.success && legionResult.data && Array.isArray(legionResult.data.resources)) {
      return { resources: legionResult.data.resources };
    }
    
    return { resources: [] };
  }
}

/**
 * Initialize server management and connection
 */
async function initializeServerConnection() {
  // Configure server manager
  const autoLaunch = process.env.AIUR_AUTO_LAUNCH_SERVER !== 'false';
  const independent = process.env.AIUR_SERVER_INDEPENDENT !== 'false';
  
  serverManager = new ServerManager({
    host: process.env.AIUR_SERVER_HOST || 'localhost',
    port: parseInt(process.env.AIUR_SERVER_PORT) || 8080,
    autoLaunch,
    independent,
    verbose: false, // Never verbose in MCP mode
    maxStartupTime: parseInt(process.env.AIUR_SERVER_LAUNCH_TIMEOUT) || 30000
  });

  // Log initialization
  await logManager.logInfo('Initializing server connection', {
    source: 'initializeServerConnection',
    operation: 'init',
    autoLaunch,
    independent
  });
  
  // Ensure server is running (detect or launch)
  const serverResult = await serverManager.ensureServerRunning();
  
  if (serverResult.launched) {
    await logManager.logInfo('Server auto-launched', {
      source: 'initializeServerConnection',
      operation: 'server-launch',
      pid: serverResult.launchInfo.pid
    });
  } else {
    await logManager.logInfo('Connected to existing server', {
      source: 'initializeServerConnection',
      operation: 'server-connect'
    });
  }

  // Initialize WebSocket connection
  wsClient = new WebSocketClient({
    url: serverResult.connectionUrl,
    reconnectInterval: 1000,
    maxReconnectInterval: 10000,
    requestTimeout: 60000
  });
  
  // Set up event handlers
  wsClient.on('connected', () => {
    logManager.logInfo('WebSocket connected', {
      source: 'WebSocketClient',
      operation: 'connected'
    });
  });
  
  wsClient.on('disconnected', () => {
    logManager.logWarning('WebSocket disconnected', {
      source: 'WebSocketClient',
      operation: 'disconnected'
    });
  });
  
  wsClient.on('session_created', (info) => {
    logManager.logInfo('Session created', {
      source: 'WebSocketClient',
      operation: 'session-created',
      sessionId: info.sessionId
    });
  });
  
  wsClient.on('reconnecting', (info) => {
    logManager.logWarning('WebSocket reconnecting', {
      source: 'WebSocketClient',
      operation: 'reconnecting',
      attempt: info.attempt
    });
  });
  
  wsClient.on('error', (error) => {
    logManager.logError(error, {
      source: 'WebSocketClient',
      operation: 'error'
    });
  });
  
  // Connect to server
  await wsClient.connect();
  
  return serverResult;
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
 * Main server initialization
 */
async function runServer() {
  try {
    // FIRST: Setup logging before anything else (matching oldIndex.js)
    await setupLogging();
    
    // Initialize server connection with auto-detection/launch
    const serverResult = await initializeServerConnection();
    
    // Set up MCP request handlers with format conversion
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        await logManager.logInfo('Handling resources/list request', {
          source: 'MCP',
          operation: 'resources-list'
        });
        
        const legionResult = await wsClient.sendMcpRequest('resources/list');
        return FormatConverter.legionResourcesListToMcp(legionResult);
      } catch (error) {
        await logManager.logError(error, {
          source: 'MCP',
          operation: 'resources-list-error'
        });
        return { resources: [] };
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        await logManager.logInfo('Handling tools/list request', {
          source: 'MCP',
          operation: 'tools-list'
        });
        
        const legionResult = await wsClient.sendMcpRequest('tools/list');
        const result = FormatConverter.legionToolsListToMcp(legionResult);
        
        await logManager.logInfo('Tools list response', {
          source: 'MCP',
          operation: 'tools-list-response',
          toolCount: result.tools.length
        });
        
        return result;
      } catch (error) {
        await logManager.logError(error, {
          source: 'MCP',
          operation: 'tools-list-error'
        });
        return { tools: [] };
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        await logManager.logInfo(`Handling tool call: ${request.params.name}`, {
          source: 'MCP',
          operation: 'tool-call',
          tool: request.params.name
        });
        
        const result = await wsClient.sendMcpRequest('tools/call', request.params);
        
        // The response from the server is already in MCP format
        // Check if it has the expected MCP structure
        if (result && result.content && Array.isArray(result.content)) {
          await logManager.logInfo(`Tool call completed: ${request.params.name}`, {
            source: 'MCP',
            operation: 'tool-call-complete',
            tool: request.params.name,
            isError: result.isError || false
          });
          
          return result;
        }
        
        // Fallback: try to convert from Legion format if needed
        const convertedResult = FormatConverter.legionToMcp(result);
        
        await logManager.logInfo(`Tool call completed: ${request.params.name}`, {
          source: 'MCP',
          operation: 'tool-call-complete',
          tool: request.params.name,
          isError: convertedResult.isError
        });
        
        return convertedResult;
      } catch (error) {
        await logManager.logError(error, {
          source: 'MCP',
          operation: 'tool-call-error',
          tool: request.params.name
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              code: 'STUB_ERROR'
            }, null, 2)
          }],
          isError: true
        };
      }
    });
    
    // Connect MCP transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    await logManager.logInfo('MCP client ready', {
      source: 'runServer',
      operation: 'ready'
    });
    
    // Set up keep-alive ping
    setInterval(() => {
      if (wsClient && wsClient.isConnected()) {
        wsClient.ping();
      }
    }, 30000); // Ping every 30 seconds

  } catch (error) {
    if (logManager) {
      await logManager.logError(error, {
        source: 'runServer',
        operation: 'startup-error',
        severity: 'critical'
      });
    }
    
    // Try to show server status for debugging
    if (serverManager && logManager) {
      try {
        const status = await serverManager.getServerStatus();
        await logManager.logError(new Error('Server status on startup failure'), {
          source: 'runServer',
          operation: 'server-status-check',
          status: status.summary
        });
      } catch (statusError) {
        // Ignore status check errors
      }
    }
    
    await cleanup();
    process.exit(1);
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  if (logManager) {
    await logManager.logInfo('Cleaning up', {
      source: 'cleanup',
      operation: 'shutdown'
    });
  }
  
  // Disconnect WebSocket
  if (wsClient) {
    wsClient.disconnect();
  }
  
  // Close log manager if available
  try {
    if (logManager) {
      await logManager.shutdown();
    }
  } catch (error) {
    // Can't log this error - logManager is shutting down
  }
}

/**
 * Handle graceful shutdown signal
 */
async function handleShutdownSignal(signal) {
  if (logManager) {
    await logManager.logInfo(`${signal} received`, {
      source: 'signal',
      operation: signal
    });
  }
  
  const shouldStopServer = process.env.AIUR_STOP_SERVER_ON_EXIT === 'true';
  
  if (shouldStopServer && serverManager) {
    try {
      await serverManager.stopServer();
      if (logManager) {
        await logManager.logInfo('Server stopped', {
          source: 'signal',
          operation: 'server-stop'
        });
      }
    } catch (error) {
      if (logManager) {
        await logManager.logError(error, {
          source: 'signal',
          operation: 'server-stop-error'
        });
      }
    }
  } else {
    if (logManager) {
      await logManager.logInfo('Leaving server running independently', {
        source: 'signal',
        operation: 'server-persist'
      });
    }
  }
  
  await cleanup();
  process.exit(0);
}

// Handle process signals
process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
process.on('SIGINT', () => handleShutdownSignal('SIGINT'));

// Handle graceful shutdown
process.stdin.on('close', async () => {
  if (logManager) {
    await logManager.logInfo('stdin closed', {
      source: 'stdin',
      operation: 'close'
    });
  }
  
  server.close();
  await cleanup();
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  if (logManager) {
    await logManager.logError(error, {
      source: 'process',
      operation: 'uncaughtException',
      severity: 'critical'
    });
  }
  
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  if (logManager) {
    await logManager.logError(new Error(`Unhandled rejection: ${reason}`), {
      source: 'process',
      operation: 'unhandledRejection',
      severity: 'critical'
    });
  }
  
  await cleanup();
  process.exit(1);
});

// Start the server
runServer().catch(async (error) => {
  if (logManager) {
    await logManager.logError(error, {
      source: 'main',
      operation: 'fatal-error',
      severity: 'critical'
    });
  }
  
  await cleanup();
  process.exit(1);
});