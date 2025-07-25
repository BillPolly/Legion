/**
 * MCPServerFactory - ResourceManager factory functions for MCPServer
 * 
 * Provides factory functions for creating and managing MCPServer instances
 * through the ResourceManager. Ensures singleton behavior and proper
 * resource management for MCP servers across the polyrepo.
 */

import { MCPServer } from './MCPServer.js';

/**
 * Create or get existing MCPServer instance (singleton behavior)
 * @param {Object} config - Server configuration
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<MCPServer>} MCPServer instance
 */
export async function createMCPServer(config, resourceManager) {
  let logger;
  try {
    logger = resourceManager.get('logger');
  } catch (error) {
    // Create simple console logger if none available
    logger = {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.log
    };
  }

  // Check if MCPServer already exists (singleton behavior)
  // This check should happen before the factory is called by ResourceManager
  if (resourceManager.has('MCPServer')) {
    const existingServer = resourceManager.get('MCPServer');
    logger.debug('MCPServer already exists, returning existing instance. Configuration ignored.');
    return existingServer;
  }

  // Create new MCPServer instance
  logger.debug('Creating new MCPServer instance', {
    port: config?.server?.port || config?.port,
    host: config?.server?.host || config?.host,
    sessionMode: config?.session?.enableSessionMode !== false,
    tools: config?.tools ? Object.keys(config.tools).filter(key => config.tools[key] === true) : []
  });

  const server = await MCPServer.create(config, resourceManager);

  // Note: Don't register here if called via ResourceManager.getOrCreate() 
  // as ResourceManager handles registration automatically
  // Only register if called directly
  if (!resourceManager.has('MCPServer')) {
    resourceManager.register('MCPServer', server);
    logger.debug('MCPServer created and registered in ResourceManager');
  }

  return server;
}

/**
 * Get existing MCPServer instance or throw error
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {MCPServer} Existing MCPServer instance
 * @throws {Error} If no MCPServer instance exists
 */
export function getMCPServer(resourceManager) {
  if (!resourceManager.has('MCPServer')) {
    throw new Error('No MCPServer instance found. Call createMCPServer() first.');
  }
  
  return resourceManager.get('MCPServer');
}

/**
 * Stop and remove MCPServer from ResourceManager
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<void>}
 */
export async function stopMCPServer(resourceManager) {
  if (!resourceManager.has('MCPServer')) {
    return; // No server to stop
  }

  const server = resourceManager.get('MCPServer');
  
  // Stop the server gracefully
  await server.stop();
  
  // Remove from ResourceManager
  resourceManager.unregister('MCPServer');
}

/**
 * Get MCPServer status if it exists
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Object|null} Server status or null if no server exists
 */
export function getMCPServerStatus(resourceManager) {
  if (!resourceManager.has('MCPServer')) {
    return null;
  }

  const server = resourceManager.get('MCPServer');
  return server.getStatus();
}

/**
 * Create MCPServer with Aiur-specific configuration
 * @param {Object} config - Base configuration
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<MCPServer>} Configured Aiur MCPServer instance
 */
export async function createAiurMCPServer(config = {}, resourceManager) {
  const aiurConfig = {
    server: {
      port: parseInt(config.server?.port || config.port || process.env.AIUR_SERVER_PORT) || 8080,
      host: config.server?.host || config.host || process.env.AIUR_SERVER_HOST || 'localhost',
      timeout: config.server?.timeout || 30000,
      ...config.server
    },
    session: {
      enableSessionMode: true, // Aiur always uses sessions
      timeout: config.session?.timeout || parseInt(process.env.AIUR_SESSION_TIMEOUT) || 3600000,
      maxSessions: config.session?.maxSessions || 100,
      ...config.session
    },
    tools: {
      enableContext: true, // Aiur context management
      enablePlanning: true, // Aiur planning system
      enableFile: true, // Aiur file operations
      customTools: config.tools?.customTools || [],
      ...config.tools
    },
    logging: {
      level: config.logging?.level || process.env.AIUR_LOG_LEVEL || 'info',
      enableFile: config.logging?.enableFile !== false,
      directory: config.logging?.directory || process.env.AIUR_LOG_DIRECTORY || './logs',
      retentionDays: config.logging?.retentionDays || parseInt(process.env.AIUR_LOG_RETENTION_DAYS) || 7,
      maxFileSize: config.logging?.maxFileSize || parseInt(process.env.AIUR_MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024,
      ...config.logging
    },
    websocket: {
      path: config.websocket?.path || '/ws',
      maxConnections: config.websocket?.maxConnections || 1000,
      heartbeatInterval: config.websocket?.heartbeatInterval || 30000,
      ...config.websocket
    },
    ...config
  };

  return createMCPServer(aiurConfig, resourceManager);
}

export default {
  createMCPServer,
  getMCPServer,
  stopMCPServer,
  getMCPServerStatus,
  createAiurMCPServer
};