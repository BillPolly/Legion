/**
 * Factory function for creating StaticServer instances via ResourceManager
 * 
 * This factory enables the ResourceManager to create StaticServer instances
 * with proper dependency injection and configuration validation.
 */

import { StaticServer } from './StaticServer.js';

/**
 * Factory function for StaticServer creation
 * Ensures singleton behavior - only one StaticServer per ResourceManager instance
 * @param {Object} config - Server configuration object
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<StaticServer>} Configured StaticServer instance
 */
export async function createStaticServer(config, resourceManager) {
  // Validate ResourceManager
  if (!resourceManager) {
    throw new Error('ResourceManager is required for StaticServer creation');
  }

  // Check if StaticServer already exists (singleton behavior)
  if (resourceManager.has('StaticServer')) {
    const existingServer = resourceManager.get('StaticServer');
    
    // Log warning if attempting to create with different config
    try {
      const logger = resourceManager.get('logger');
      logger.debug('StaticServer already exists, returning existing instance. Configuration ignored.');
    } catch (error) {
      // No logger available, silent operation
    }
    
    return existingServer;
  }

  // Merge configuration with environment variables if available
  const enhancedConfig = await enhanceConfigWithEnvironment(config, resourceManager);
  
  // Create and return StaticServer instance (will be registered by ResourceManager)
  return await StaticServer.create(enhancedConfig, resourceManager);
}

/**
 * Enhance configuration with environment variables from ResourceManager
 * @param {Object} config - Base configuration
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<Object>} Enhanced configuration
 */
export async function enhanceConfigWithEnvironment(config, resourceManager) {
  const enhancedConfig = { ...config };

  // Server configuration from environment
  if (resourceManager.has('env.PORT')) {
    enhancedConfig.server = {
      ...enhancedConfig.server,
      port: parseInt(resourceManager.get('env.PORT'), 10)
    };
  }

  if (resourceManager.has('env.HOST')) {
    enhancedConfig.server = {
      ...enhancedConfig.server,
      host: resourceManager.get('env.HOST')
    };
  }

  // CORS configuration from environment
  if (resourceManager.has('env.CORS_ORIGIN')) {
    enhancedConfig.security = {
      ...enhancedConfig.security,
      cors: {
        ...enhancedConfig.security?.cors,
        enabled: true,
        origin: resourceManager.get('env.CORS_ORIGIN')
      }
    };
  }

  // Static directory from environment
  if (resourceManager.has('env.STATIC_DIR')) {
    enhancedConfig.static = {
      ...enhancedConfig.static,
      publicDir: resourceManager.get('env.STATIC_DIR')
    };
  }

  // Logging configuration from environment
  if (resourceManager.has('env.LOG_LEVEL')) {
    enhancedConfig.logging = {
      ...enhancedConfig.logging,
      level: resourceManager.get('env.LOG_LEVEL')
    };
  }

  // Development/production environment handling
  if (resourceManager.has('env.NODE_ENV')) {
    const nodeEnv = resourceManager.get('env.NODE_ENV');
    
    // Adjust defaults based on environment
    if (nodeEnv === 'production') {
      enhancedConfig.static = {
        caching: true,
        compression: true,
        ...enhancedConfig.static
      };
      enhancedConfig.logging = {
        level: 'info',
        ...enhancedConfig.logging
      };
    } else if (nodeEnv === 'development') {
      enhancedConfig.static = {
        caching: false,
        ...enhancedConfig.static
      };
      enhancedConfig.logging = {
        level: 'debug',
        ...enhancedConfig.logging
      };
      enhancedConfig.security = {
        ...enhancedConfig.security,
        cors: {
          enabled: true,
          origin: '*',
          ...enhancedConfig.security?.cors
        }
      };
    }
  }

  return enhancedConfig;
}

/**
 * Create a quick static server with minimal configuration
 * Useful for simple file serving scenarios
 * @param {string} publicDir - Directory to serve static files from
 * @param {number} port - Port to listen on (default: 3000)
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<StaticServer>} Simple static server
 */
export async function createSimpleStaticServer(publicDir, port = 3000, resourceManager) {
  const config = {
    server: { port },
    static: { publicDir },
    security: {
      cors: { enabled: true, origin: '*' }
    },
    logging: { level: 'info' }
  };

  return await createStaticServer(config, resourceManager);
}

/**
 * Create a static server with WebSocket support
 * @param {Object} config - Base server configuration
 * @param {Function} wsHandler - WebSocket handler function
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<StaticServer>} StaticServer with WebSocket support
 */
export async function createStaticServerWithWebSocket(config, wsHandler, resourceManager) {
  const wsConfig = {
    ...config,
    websocket: {
      enabled: true,
      handler: wsHandler,
      ...config.websocket
    }
  };

  return await createStaticServer(wsConfig, resourceManager);
}

/**
 * Create a development server with hot reload support
 * (Placeholder for future hot reload functionality)
 * @param {Object} config - Base server configuration
 * @param {ResourceManager} resourceManager - Resource manager instance
 * @returns {Promise<StaticServer>} Development server
 */
export async function createDevelopmentServer(config, resourceManager) {
  const devConfig = {
    ...config,
    static: {
      caching: false,
      compression: false,
      ...config.static
    },
    security: {
      cors: { enabled: true, origin: '*' },
      ...config.security
    },
    logging: {
      level: 'debug',
      requests: true,
      ...config.logging
    }
  };

  return await createStaticServer(devConfig, resourceManager);
}

/**
 * Main factory function that ResourceManager will use
 * This is the primary interface for ResourceManager integration
 */
export default createStaticServer;

// Named exports already declared above