/**
 * @legion/storage - General-purpose storage package with provider architecture
 * 
 * 🚨 CRITICAL: ALL INITIALIZATION VIA RESOURCEMANAGER 🚨
 * ResourceManager automatically provides ALL .env variables including API keys, URLs, etc.
 * 
 * TWO USAGE PATTERNS:
 * 1. Direct Backend Usage: Other Legion packages use StorageProvider directly
 * 2. Actor-Based Usage: Frontend and distributed operations via Actor system
 * 
 * Main entry point exposing all public APIs for the storage system.
 */

// Core components
export { StorageProvider } from './StorageProvider.js';

// Base classes for providers and actors
export { Provider } from './core/Provider.js';
export { StorageActor } from './core/StorageActor.js';
export { Query } from './core/Query.js';
export { Transaction } from './core/Transaction.js';

// Built-in providers
export { MongoDBProvider } from './providers/mongodb/MongoDBProvider.js';
export { MemoryProvider } from './providers/memory/MemoryProvider.js';
export { SQLiteProvider } from './providers/sqlite/SQLiteProvider.js';

// Actor implementations
export { CollectionActor } from './actors/CollectionActor.js';
export { DocumentActor } from './actors/DocumentActor.js';
export { QueryActor } from './actors/QueryActor.js';

// Utilities
export { Serialization } from './utils/Serialization.js';
export { Validation } from './utils/Validation.js';

// MongoDB-specific exports
export { 
  MongoDBCollectionActor,
  MongoDBQuery,
  MongoDBConnection 
} from './providers/mongodb/index.js';