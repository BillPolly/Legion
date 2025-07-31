/**
 * Singleton ResourceManager instance and getter
 */

import { ResourceManager } from './ResourceManager.js';

// Singleton instance
let resourceManagerInstance = null;

/**
 * Get the singleton ResourceManager instance
 * @returns {Promise<ResourceManager>} The initialized ResourceManager instance
 */
export async function getResourceManager() {
  if (!resourceManagerInstance) {
    resourceManagerInstance = new ResourceManager();
    await resourceManagerInstance.initialize();
  }
  return resourceManagerInstance;
}

/**
 * Reset the singleton instance (mainly for testing)
 * @private
 */
export function _resetResourceManager() {
  resourceManagerInstance = null;
}