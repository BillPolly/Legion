/**
 * Configuration module using ResourceManager singleton
 * Follows the design: NO direct process.env access, only ResourceManager
 */

import { ResourceManager } from '@legion/resource-manager';

let resourceManager = null;

/**
 * Initialize configuration with ResourceManager singleton
 * @returns {ResourceManager} The initialized ResourceManager instance
 */
export async function initializeConfig() {
  // Get singleton instance (auto-initializes on first call)
  resourceManager = await ResourceManager.getInstance();
  return resourceManager;
}

/**
 * Get configuration from ResourceManager
 * Must call initializeConfig() first
 * @returns {Object} Configuration object
 */
export function getConfig() {
  if (!resourceManager) {
    throw new Error('Configuration not initialized. Call initializeConfig() first.');
  }

  return {
    // Port comes from route registration, not env
    host: 'localhost', // Always localhost for now
    
    // Get from ResourceManager with defaults
    env: resourceManager.get('env.NODE_ENV') || 'development',
    logLevel: resourceManager.get('env.LOG_LEVEL') || 'info',
    
    // Parse CORS origins
    corsOrigins: resourceManager.get('env.CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
    
    // Required for package discovery
    monorepoRoot: resourceManager.get('env.MONOREPO_ROOT')
  };
}

/**
 * Get the ResourceManager instance
 * @returns {ResourceManager|null} The ResourceManager instance or null if not initialized
 */
export function getResourceManager() {
  return resourceManager;
}