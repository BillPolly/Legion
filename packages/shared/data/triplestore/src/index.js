/**
 * @legion/triplestore - Universal triple store implementation for Legion framework
 * 
 * A comprehensive triple store library with multiple provider implementations,
 * unified DataSource interface, and full type preservation.
 * 
 * Features:
 * - Multiple providers: InMemory, FileSystem, DataScript
 * - Universal DataSource wrapper
 * - Type-preserving serialization
 * - Query subscriptions
 * - Schema validation
 * - Factory functions with presets
 * 
 * @example
 * import { createDefaultTripleStore } from '@legion/triplestore';
 * 
 * const store = createDefaultTripleStore({ type: 'memory' });
 * await store.addTriple('entity:1', 'name', 'Alice');
 * const results = await store.query('entity:1', null, null);
 * 
 * @example
 * import { createTripleStoreDataSource, createDataScriptTripleStore } from '@legion/triplestore';
 * 
 * const store = createDataScriptTripleStore({ schema: mySchema });
 * const dataSource = createTripleStoreDataSource(store);
 * 
 * await dataSource.update({
 *   operation: 'add',
 *   subject: 'person:1',
 *   predicate: 'name',
 *   object: 'Bob'
 * });
 */

// Core interfaces and classes
export { ITripleStore } from './core/ITripleStore.js';
export { TripleStoreDataSource } from './core/TripleStoreDataSource.js';
export { StorageError, ValidationError } from './core/StorageError.js';

// Provider implementations
export { InMemoryProvider } from './providers/InMemoryProvider.js';
export { FileSystemProvider } from './providers/FileSystemProvider.js';
export { DataScriptProvider } from './providers/DataScriptProvider.js';

// Factory functions
export {
  createInMemoryTripleStore,
  createFileSystemTripleStore,
  createDataScriptTripleStore,
  createTripleStoreDataSource,
  createDefaultTripleStore,
  TripleStorePresets
} from './factories/index.js';

// Utilities
export { TripleIndex } from './utils/TripleIndex.js';

// Default export - most common factory
export { createDefaultTripleStore as default } from './factories/index.js';