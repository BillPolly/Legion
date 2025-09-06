/**
 * Storage module exports
 * Provides pluggable storage abstraction for the Knowledge Graph
 */

// Core interfaces and base classes
export { ITripleStore, ITransaction } from './ITripleStore.js';

// Error classes
export { 
  StorageError, 
  ConnectionError, 
  TransactionError, 
  ValidationError, 
  CapacityError, 
  AuthenticationError, 
  NetworkError,
  isRetryableError 
} from './StorageError.js';

// Storage implementations
export { InMemoryTripleStore } from './InMemoryTripleStore.js';
export { FileSystemTripleStore } from './FileSystemTripleStore.js';
export { GitHubTripleStore } from './GitHubTripleStore.js';
export { SQLTripleStore } from './SQLTripleStore.js';
export { MongoTripleStore } from './MongoTripleStore.js';
export { GraphDBTripleStore } from './GraphDBTripleStore.js';
export { RemoteTripleStore } from './RemoteTripleStore.js';

// GitHub storage components
export { GitHubClient } from './GitHubClient.js';
export { ConflictResolver, ConflictUtils } from './ConflictResolver.js';

// Performance optimization components
export { LRUCache, CacheLayer, withCache } from './CacheLayer.js';
export { QueryOptimizer, withOptimization } from './QueryOptimizer.js';

// Configuration and factory
export { StorageConfig } from './StorageConfig.js';

// Import for convenience functions
import { StorageConfig } from './StorageConfig.js';

// Convenience function to create storage from config
export function createTripleStore(config) {
  return StorageConfig.createStore(config);
}

// Convenience function to create storage from environment
export function createTripleStoreFromEnv() {
  return StorageConfig.createFromEnvironment();
}
