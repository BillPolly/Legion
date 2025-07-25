/**
 * Main entry point for the Aiur Debug UI server
 */

import { config as dotenvConfig } from 'dotenv';
import { loadConfig, validateConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { createServer } from './server/index.js';

// Load environment variables
dotenvConfig();

/**
 * Start the debug UI server
 */
async function main() {
  try {
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
    
    logger.info('Starting Aiur Debug UI server...');
    logger.info('Configuration loaded', {
      port: config.server.port,
      host: config.server.host,
      mcpUrl: config.mcp.defaultUrl,
      theme: config.ui.theme
    });
    
    // Create and start server
    const server = await createServer(config, logger);
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await server.close();
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