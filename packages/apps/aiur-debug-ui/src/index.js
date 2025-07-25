/**
 * Main entry point for the Aiur Debug UI server
 * Now using ResourceManager pattern with StaticServer service
 */

import { ResourceManager } from '@legion/module-loader';
import { createWebSocketServer } from './server/websocket.js';
import { loadConfig, validateConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';

/**
 * Start the debug UI server using ResourceManager pattern
 */
async function main() {
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Load configuration
    const config = loadConfig();
    
    // Validate configuration
    const errors = validateConfig(config);
    if (errors.length > 0) {
      console.error('Configuration errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    // Create logger
    const logger = createLogger({
      level: config.logging.level,
      console: config.logging.console,
      file: config.logging.file
    });
    
    // Register logger in ResourceManager
    resourceManager.register('logger', logger);
    
    logger.info('Starting Aiur Debug UI server...');
    logger.info('Configuration loaded', {
      port: config.server.port,
      host: config.server.host,
      mcpUrl: config.mcp.defaultUrl,
      theme: config.ui.theme
    });
    
    // Create StaticServer using ResourceManager
    const server = await resourceManager.getOrCreate('StaticServer', {
      server: {
        port: config.server.port,
        host: config.server.host
      },
      static: {
        publicDir: './src/client',
        caching: true
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
                defaultUrl: config.mcp.defaultUrl,
                reconnectInterval: config.mcp.reconnectInterval,
                maxReconnectAttempts: config.mcp.maxReconnectAttempts
              },
              ui: {
                theme: config.ui.theme,
                autoConnect: config.ui.autoConnect
              }
            };
            res.json(clientConfig);
          }
        }
      },
      websocket: {
        enabled: true,
        path: '/ws',
        handler: (httpServer, wsConfig, wsLogger) => {
          return createWebSocketServer(httpServer, config, wsLogger);
        }
      },
      logging: {
        level: config.logging.level,
        requests: true
      }
    });
    
    // Start the server
    await server.start();
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await server.stop();
        logger.info('Server shutdown complete');
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
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
    logger.info('Aiur Debug UI server started successfully');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}