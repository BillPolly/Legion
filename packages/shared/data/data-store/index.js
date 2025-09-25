// Data-Store - Reactive DataScript with Proxy Objects
// Main entry point

// Core data store functionality
export { DataStore, createDataStore } from './src/store.js';
export { Subscription } from './src/subscription.js';
export { ReactiveEngine } from './src/reactor.js';

// Dynamic schema evolution
export { DynamicDataStore, createDynamicDataStore } from './src/DynamicDataStore.js';
export { SchemaManager, createSchemaManager } from './src/SchemaManager.js';
export { SchemaEvolution, createSchemaEvolution } from './src/SchemaEvolution.js';
export { SchemaNotificationSystem, createSchemaNotificationSystem } from './src/SchemaNotificationSystem.js';
export { SchemaEvolutionDSL, createSchemaEvolutionDSL } from './src/SchemaEvolutionDSL.js';

// Re-export proxy classes from data-proxies package
export { 
  EntityProxy,
  CollectionProxy,
  StreamProxy,
  DataStoreProxy,
  DynamicEntityProxy,
  createDynamicEntityProxy
} from '@legion/data-proxies';