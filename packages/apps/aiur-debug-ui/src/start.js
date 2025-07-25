/**
 * Integrated Debug UI Start Script
 * 
 * Uses ResourceManager to:
 * 1. Auto-start Aiur MCP server if not running
 * 2. Start debug UI static server
 * 3. Ensure seamless WebSocket connectivity
 */

import { ResourceManager } from '@legion/module-loader';
import { createAiurMCPServer, getMCPServerStatus } from '@legion/module-loader/src/services/MCPServerFactory.js';
import { LogManager } from '@legion/aiur/src/server.js';
import { createWebSocketServer } from './server/websocket.js';
import { loadConfig, validateConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { WebSocket } from 'ws';

/**
 * Check if MCP server is running at given URL
 * @param {string} url - WebSocket URL to test
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<boolean>} True if server is reachable
 */
async function checkMcpServerRunning(url, timeout = 5000) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, timeout);
    
    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });
    
    ws.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Auto-start MCP server using ResourceManager
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} MCP server info
 */
async function ensureMcpServerRunning(resourceManager, config, logger) {
  const mcpUrl = config.mcp.defaultUrl;
  const portMatch = mcpUrl.match(/:(\d+)/);
  const mcpPort = portMatch ? parseInt(portMatch[1]) : 8080;
  const mcpHost = mcpUrl.includes('localhost') ? 'localhost' : '0.0.0.0';
  
  logger.info('Checking if MCP server is running...', { url: mcpUrl });
  
  // First check if server is already running
  const isRunning = await checkMcpServerRunning(mcpUrl);
  if (isRunning) {
    logger.info('MCP server already running, using existing instance');
    return {
      url: mcpUrl,
      port: mcpPort,
      host: mcpHost,
      autoStarted: false
    };
  }
  
  logger.info('MCP server not found, starting new instance...', { 
    port: mcpPort, 
    host: mcpHost 
  });
  
  // Configure MCP server with environment variables and config
  const mcpConfig = {
    server: {
      port: mcpPort,
      host: mcpHost,
      timeout: config.mcp.timeout || 30000
    },
    session: {
      enableSessionMode: true,
      timeout: config.mcp.sessionTimeout || 3600000,
      maxSessions: config.mcp.maxSessions || 100
    },
    tools: {
      enableContext: true,
      enablePlanning: true,
      enableFile: true,
      customTools: config.mcp.customTools || []
    },
    logging: {
      level: config.logging.level || 'info',
      enableFile: config.mcp.logging?.enableFile !== false,
      directory: config.mcp.logging?.directory || './logs',
      retentionDays: config.mcp.logging?.retentionDays || 7
    },
    websocket: {
      path: '/ws',
      maxConnections: config.mcp.maxConnections || 1000,
      heartbeatInterval: config.mcp.heartbeatInterval || 30000
    }
  };
  
  // Create and start MCP server
  const mcpServer = await createAiurMCPServer(mcpConfig, resourceManager);
  await mcpServer.start();
  
  logger.info('MCP server started successfully', {
    port: mcpPort,
    host: mcpHost,
    url: mcpUrl
  });
  
  return {
    url: mcpUrl,
    port: mcpPort,
    host: mcpHost,
    autoStarted: true,
    server: mcpServer
  };
}

/**
 * Main startup function
 */
async function main() {
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Load and validate configuration
    const config = loadConfig();
    const errors = validateConfig(config);
    if (errors.length > 0) {
      console.error('Configuration errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    // Create Winston logger for debug UI
    const logger = createLogger({
      level: config.logging.level,
      console: config.logging.console,
      file: config.logging.file
    });
    
    // Create LogManager for Aiur components
    const logManager = new LogManager({
      enableFileLogging: config.mcp.logging?.enableFile !== false,
      logDirectory: config.mcp.logging?.directory || './logs',
      logRetentionDays: config.mcp.logging?.retentionDays || 7,
      maxLogFileSize: 10 * 1024 * 1024
    });
    await logManager.initialize();
    
    // Register both loggers in ResourceManager
    resourceManager.register('logger', logger);           // For debug UI components
    resourceManager.register('logManager', logManager);   // For Aiur MCP components
    
    logger.info('Starting Aiur Debug UI with integrated MCP server...');
    logger.info('Configuration loaded', {
      debugPort: config.server.port,
      debugHost: config.server.host,
      mcpUrl: config.mcp.defaultUrl,
      autoStartMcp: config.mcp.autoStart !== false
    });
    
    // Ensure MCP server is running (auto-start if needed)
    let mcpServerInfo = null;
    if (config.mcp.autoStart !== false) {
      mcpServerInfo = await ensureMcpServerRunning(resourceManager, config, logger);
    } else {
      logger.info('MCP server auto-start disabled, will connect to external server');
      mcpServerInfo = {
        url: config.mcp.defaultUrl,
        autoStarted: false
      };
    }
    
    // Create StaticServer for debug UI with dynamic MCP URL
    const debugConfig = {
      server: {
        port: config.server.port,
        host: config.server.host
      },
      static: {
        publicDir: './src/client',
        caching: process.env.NODE_ENV === 'production'
      },
      security: {
        cors: config.cors,
        csp: true,
        headers: true
      },
      api: {
        endpoints: {
          '/api/config': (req, res) => {
            const clientConfig = {
              mcp: {
                defaultUrl: mcpServerInfo.url,
                reconnectInterval: config.mcp.reconnectInterval,
                maxReconnectAttempts: config.mcp.maxReconnectAttempts,
                autoStarted: mcpServerInfo.autoStarted
              },
              ui: {
                theme: config.ui.theme,
                autoConnect: config.ui.autoConnect
              },
              server: {
                port: config.server.port,
                host: config.server.host
              }
            };
            res.json(clientConfig);
          },
          '/api/health': (req, res) => {
            const mcpStatus = getMCPServerStatus(resourceManager);
            res.json({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
              mcp: {
                running: mcpStatus ? mcpStatus.running : false,
                url: mcpServerInfo.url,
                autoStarted: mcpServerInfo.autoStarted
              }
            });
          }
        }
      },
      websocket: {
        enabled: true,
        path: '/ws',
        handler: (httpServer, wsConfig, wsLogger) => {
          // Pass dynamic MCP URL to WebSocket server
          const wsConfigWithMcp = {
            ...config,
            mcp: {
              ...config.mcp,
              defaultUrl: mcpServerInfo.url
            }
          };
          return createWebSocketServer(httpServer, wsConfigWithMcp, wsLogger);
        }
      },
      logging: {
        level: config.logging.level,
        requests: config.logging.requests !== false
      }
    };
    
    // Create and start debug UI server
    const debugServer = await resourceManager.getOrCreate('StaticServer', debugConfig);
    await debugServer.start();
    
    const debugAddress = debugServer.getHttpServer().address();
    const debugUrl = `http://${debugAddress.address}:${debugAddress.port}`;
    
    logger.info('🎯 Aiur Debug UI started successfully!');
    logger.info('📊 Debug UI:', { url: debugUrl });
    logger.info('🔌 MCP Server:', { 
      url: mcpServerInfo.url, 
      autoStarted: mcpServerInfo.autoStarted 
    });
    logger.info('🌐 Open your browser to:', debugUrl);
    
    // Store server info for graceful shutdown
    const serverInfo = {
      debugServer,
      mcpServer: mcpServerInfo.server,
      mcpAutoStarted: mcpServerInfo.autoStarted,
      resourceManager,
      logger,
      logManager
    };
    
    // Setup graceful shutdown
    await setupGracefulShutdown(serverInfo);
    
  } catch (error) {
    console.error('Failed to start integrated debug UI:', error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handling
 * @param {Object} serverInfo - Server information object
 */
async function setupGracefulShutdown(serverInfo) {
  const { debugServer, mcpServer, mcpAutoStarted, resourceManager, logger, logManager } = serverInfo;
  
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      // Stop debug UI server
      if (debugServer) {
        logger.info('Stopping debug UI server...');
        await debugServer.stop();
      }
      
      // Stop MCP server only if we auto-started it
      if (mcpServer && mcpAutoStarted) {
        logger.info('Stopping auto-started MCP server...');
        await mcpServer.stop();
        resourceManager.unregister('MCPServer');
      } else if (mcpAutoStarted) {
        logger.info('MCP server was auto-started but reference lost, attempting cleanup...');
        try {
          const existingMcpServer = resourceManager.get('MCPServer');
          await existingMcpServer.stop();
          resourceManager.unregister('MCPServer');
        } catch (error) {
          logger.warn('Could not stop MCP server during cleanup:', error.message);
        }
      } else {
        logger.info('Leaving external MCP server running');
      }
      
      // Shutdown LogManager
      if (logManager) {
        await logManager.shutdown();
      }
      
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    await gracefulShutdown('UNHANDLED_REJECTION');
  });
}

// Start the integrated server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}