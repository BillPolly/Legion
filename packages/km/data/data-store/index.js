// Data-Store - Reactive DataScript with Proxy Objects
// Main entry point

// Core data store functionality
export { DataStore, createDataStore } from './src/store.js';
export { Subscription } from './src/subscription.js';
export { ReactiveEngine } from './src/reactor.js';

// Re-export proxy classes from data-proxies package
export { 
  EntityProxy,
  CollectionProxy,
  StreamProxy,
  DataStoreProxy
} from '../data-proxies/src/index.js';