/**
 * Storage module exports - now using extracted packages
 * This file now acts as a facade for the extracted storage packages
 */

// Re-export from the new @legion/triplestore package
export { 
  ITripleStore,
  StorageError, 
  ValidationError,
  InMemoryProvider as InMemoryTripleStore,
  FileSystemProvider as FileSystemTripleStore
} from '@legion/triplestore';
export {
  createInMemoryTripleStore,
  createFileSystemTripleStore
} from '@legion/triplestore/factories';

// Keep these in main package for now (will extract in later phase)
export { GitHubTripleStore } from './GitHubTripleStore.js';
export { SQLTripleStore } from './SQLTripleStore.js';
export { MongoTripleStore } from './MongoTripleStore.js';
export { GraphDBTripleStore } from './GraphDBTripleStore.js';
export { RemoteTripleStore } from './RemoteTripleStore.js';

// GitHub storage components (keep for now)
export { GitHubClient } from './GitHubClient.js';
export { ConflictResolver, ConflictUtils } from './ConflictResolver.js';

// Performance optimization components (keep for now)
export { LRUCache, CacheLayer, withCache } from './CacheLayer.js';
export { QueryOptimizer, withOptimization } from './QueryOptimizer.js';

// Configuration and factory
export { StorageConfig } from './StorageConfig.js';

// Import for convenience functions
import { StorageConfig } from './StorageConfig.js';

// Convenience function to create storage from config
export async function createTripleStore(config) {
  return StorageConfig.createStore(config);
}

// Convenience function to create storage from environment
export async function createTripleStoreFromEnv() {
  return StorageConfig.createFromEnvironment();
}