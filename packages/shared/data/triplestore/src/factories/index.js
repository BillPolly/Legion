/**
 * Factory functions for creating triple store instances
 * 
 * These factories provide convenient ways to create properly configured
 * triple store implementations with sensible defaults.
 */

import { InMemoryProvider } from '../providers/InMemoryProvider.js';
import { FileSystemProvider } from '../providers/FileSystemProvider.js';
import { DataScriptProvider } from '../providers/DataScriptProvider.js';
import { TripleStoreDataSource } from '../core/TripleStoreDataSource.js';
import { ValidationError } from '../core/StorageError.js';
import path from 'path';

/**
 * Create an in-memory triple store
 * 
 * @param {Object} options - Configuration options
 * @param {Array<[subject, predicate, object]>} options.initialData - Initial triples to load
 * @returns {InMemoryProvider} - In-memory triple store instance
 * 
 * @example
 * const store = createInMemoryTripleStore();
 * await store.addTriple('entity:1', 'name', 'Alice');
 * 
 * @example
 * const store = createInMemoryTripleStore({
 *   initialData: [
 *     ['entity:1', 'name', 'Alice'],
 *     ['entity:1', 'age', 30]
 *   ]
 * });
 */
export function createInMemoryTripleStore(options = {}) {
  const provider = new InMemoryProvider();
  
  // Load initial data if provided
  if (options.initialData && Array.isArray(options.initialData)) {
    // We need to use async addTriple, so wrap in an async IIFE
    (async () => {
      for (const [subject, predicate, object] of options.initialData) {
        await provider.addTriple(subject, predicate, object);
      }
    })();
  }
  
  return provider;
}

/**
 * Create a filesystem-backed triple store
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.dataSource - Required DataSource to wrap
 * @param {string} options.filePath - Path to persistence file (default: './triplestore.json')
 * @param {boolean} options.autoSave - Auto-save on updates (default: true)
 * @param {number} options.saveDebounce - Debounce delay for saves in ms (default: 1000)
 * @returns {FileSystemProvider} - Filesystem-backed triple store instance
 * 
 * @example
 * const memoryStore = createInMemoryTripleStore();
 * const dataSource = createTripleStoreDataSource(memoryStore);
 * const fsStore = createFileSystemTripleStore({
 *   dataSource,
 *   filePath: './data/triples.json'
 * });
 */
export function createFileSystemTripleStore(options = {}) {
  if (!options.dataSource) {
    throw new ValidationError('dataSource is required for FileSystemProvider');
  }
  
  const filePath = options.filePath || path.join(process.cwd(), 'triplestore.json');
  
  const config = {
    autoSave: options.autoSave !== undefined ? options.autoSave : true,
    saveDebounce: options.saveDebounce || 1000,
    ...options
  };
  
  // FileSystemProvider expects dataSource and filePath as separate arguments
  return new FileSystemProvider(options.dataSource, filePath, config);
}

/**
 * Create a DataScript-backed triple store
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.schema - DataScript schema definition
 * @param {boolean} options.validateSchema - Validate schema on creation (default: false)
 * @returns {DataScriptProvider} - DataScript-backed triple store instance
 * 
 * @example
 * const store = createDataScriptTripleStore();
 * 
 * @example
 * const store = createDataScriptTripleStore({
 *   schema: {
 *     ':person/name': { ':db/cardinality': ':db.cardinality/one' },
 *     ':person/age': { ':db/cardinality': ':db.cardinality/one' },
 *     ':person/friends': { ':db/cardinality': ':db.cardinality/many' }
 *   },
 *   validateSchema: true
 * });
 */
export function createDataScriptTripleStore(options = {}) {
  return new DataScriptProvider(options);
}

/**
 * Create a DataSource wrapper for any triple store
 * 
 * @param {ITripleStore} tripleStore - The triple store to wrap
 * @returns {TripleStoreDataSource} - DataSource wrapper
 * 
 * @example
 * const store = createInMemoryTripleStore();
 * const dataSource = createTripleStoreDataSource(store);
 * 
 * // Now use DataSource interface
 * await dataSource.update({
 *   operation: 'add',
 *   subject: 'entity:1',
 *   predicate: 'name',
 *   object: 'Alice'
 * });
 */
export function createTripleStoreDataSource(tripleStore) {
  return new TripleStoreDataSource(tripleStore);
}

/**
 * Create a triple store with automatic provider selection
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.type - Provider type: 'memory', 'filesystem', 'datascript' (default: 'memory')
 * @param {boolean} options.asDataSource - Return as DataSource wrapper (default: false)
 * @param {...*} options.* - Additional options passed to the selected provider
 * @returns {ITripleStore|TripleStoreDataSource} - Triple store or DataSource wrapper
 * 
 * @example
 * // Default in-memory store
 * const store = createDefaultTripleStore();
 * 
 * @example
 * // DataScript with schema
 * const store = createDefaultTripleStore({
 *   type: 'datascript',
 *   schema: { ':person/name': { ':db/cardinality': ':db.cardinality/one' } }
 * });
 * 
 * @example
 * // As DataSource wrapper
 * const dataSource = createDefaultTripleStore({
 *   type: 'memory',
 *   asDataSource: true
 * });
 */
export function createDefaultTripleStore(options = {}) {
  const { type = 'memory', asDataSource = false, ...providerOptions } = options;
  
  let store;
  
  switch (type) {
    case 'memory':
    case 'inmemory':
    case 'in-memory':
      store = createInMemoryTripleStore(providerOptions);
      break;
      
    case 'filesystem':
    case 'file':
    case 'fs':
      store = createFileSystemTripleStore(providerOptions);
      break;
      
    case 'datascript':
    case 'ds':
      store = createDataScriptTripleStore(providerOptions);
      break;
      
    default:
      throw new ValidationError(`Unknown triple store type: ${type}`);
  }
  
  return asDataSource ? createTripleStoreDataSource(store) : store;
}

/**
 * Factory configuration presets for common use cases
 */
export const TripleStorePresets = {
  /**
   * Simple in-memory store for testing
   */
  testing: () => createInMemoryTripleStore(),
  
  /**
   * Persistent filesystem store with auto-save
   */
  persistent: (filePath = './data/triplestore.json') => {
    const memoryStore = createInMemoryTripleStore();
    const dataSource = createTripleStoreDataSource(memoryStore);
    return createFileSystemTripleStore({
      dataSource,
      filePath,
      autoSave: true,
      saveDebounce: 1000
    });
  },
  
  /**
   * DataScript store with common schema for knowledge graphs
   */
  knowledgeGraph: () => createDataScriptTripleStore({
    schema: {
      ':entity/id': { ':db/unique': ':db.unique/identity' },
      ':entity/type': { ':db/cardinality': ':db.cardinality/one' },
      ':entity/name': { ':db/cardinality': ':db.cardinality/one' },
      ':entity/description': { ':db/cardinality': ':db.cardinality/one' },
      ':entity/properties': { ':db/cardinality': ':db.cardinality/many' },
      ':entity/relations': { ':db/cardinality': ':db.cardinality/many' }
    }
  }),
  
  /**
   * RDF-compatible store for semantic web data
   */
  rdf: () => createDataScriptTripleStore({
    schema: {
      ':rdf/subject': { ':db/cardinality': ':db.cardinality/one' },
      ':rdf/predicate': { ':db/cardinality': ':db.cardinality/one' },
      ':rdf/object': { ':db/cardinality': ':db.cardinality/one' },
      ':rdf/context': { ':db/cardinality': ':db.cardinality/one' }
    }
  })
};