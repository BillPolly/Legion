/**
 * @legion/resource-manager - ResourceManager singleton
 * 
 * This is the foundation of the Legion framework.
 * ResourceManager is a singleton that auto-initializes and provides
 * centralized dependency injection for the entire system.
 */

// Main export - the singleton ResourceManager
export { ResourceManager } from './ResourceManager.js';

// DataSource exports
export { Neo4jDataSource } from './datasources/Neo4jDataSource.js';

// Handle exports
export { GraphDatabaseHandle } from './handles/GraphDatabaseHandle.js';
export { NodeHandle } from './handles/NodeHandle.js';

// DataSourceFactory for creating DataSources
export { DataSourceFactory } from './DataSourceFactory.js';

// Convenience function for getting the singleton
import { ResourceManager } from './ResourceManager.js';

/**
 * Get the singleton ResourceManager, initialized and ready to use
 * @returns {Promise<ResourceManager>} The initialized singleton instance
 */
export async function getResourceManager() {
  return ResourceManager.getResourceManager();
}

// Default export
export default ResourceManager;