/**
 * DataStoreProxy Class
 * Phase 3: DataStoreProxy Wrapper Implementation
 * 
 * Wraps DataStore to provide proxy-returning query methods while maintaining
 * separation of concerns. DataStore handles storage logic, DataStoreProxy
 * handles proxy creation and management.
 * 
 * Key Features:
 * - All queries return appropriate proxy objects (StreamProxy, EntityProxy, CollectionProxy)
 * - Pass-through methods for non-query operations (createEntity, createEntities, db)
 * - Maintains backward compatibility (DataStore can still be used directly)
 * - Clean separation between storage and proxy concerns
 */

import { QueryTypeDetector } from './query-type-detector.js';
import { PropertyTypeDetector } from './property-type-detector.js';
import { StreamProxy } from './stream-proxy.js';
import { EntityProxy } from './proxy.js';
import { CollectionProxy } from './collection-proxy.js';

export class DataStoreProxy {
  constructor(dataStore) {
    // Validate DataStore instance
    if (!dataStore) {
      throw new Error('DataStore instance is required');
    }
    
    // Check if it's a valid DataStore instance
    if (!dataStore.query || typeof dataStore.query !== 'function' ||
        !dataStore.db || typeof dataStore.db !== 'function' ||
        !dataStore.createEntity || typeof dataStore.createEntity !== 'function') {
      throw new Error('Invalid DataStore instance');
    }
    
    // Store DataStore reference
    this.dataStore = dataStore;
    
    // Initialize type detectors
    this.queryTypeDetector = new QueryTypeDetector(dataStore);
    this.propertyTypeDetector = new PropertyTypeDetector(dataStore.schema || {});
    
    // Initialize proxy cache for singleton pattern
    // Note: Not freezing _proxyCache so we can add to it
    this._proxyCache = new Map();
    
    // Freeze properties but allow cache to be mutable
    Object.freeze(this.queryTypeDetector);
    Object.freeze(this.propertyTypeDetector);
    // Don't freeze the entire instance to allow cache updates
  }
  
  /**
   * Execute query and return appropriate proxy object
   * @param {Object} querySpec - DataScript query specification
   * @returns {StreamProxy|EntityProxy|CollectionProxy} Appropriate proxy for results
   */
  query(querySpec) {
    // Validate query spec
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!querySpec.find) {
      throw new Error('Query spec must have find clause');
    }
    
    if (!Array.isArray(querySpec.find) || querySpec.find.length === 0) {
      throw new Error('Find clause cannot be empty');
    }
    
    if (!querySpec.where) {
      throw new Error('Query spec must have where clause');
    }
    
    // Execute query using underlying DataStore
    const results = this.dataStore.query(querySpec);
    
    // Determine appropriate proxy type
    const proxyType = this.queryTypeDetector.detectProxyType(querySpec, results);
    
    // Create and return appropriate proxy
    return this._createProxy(proxyType, querySpec, results);
  }
  
  /**
   * Pass-through method for entity creation
   * @param {Object} entityData - Entity data to create
   * @returns {Object} Creation result from DataStore
   */
  createEntity(entityData) {
    return this.dataStore.createEntity(entityData);
  }
  
  /**
   * Pass-through method for batch entity creation
   * @param {Array} entitiesData - Array of entity data to create
   * @returns {Object} Creation result from DataStore
   */
  createEntities(entitiesData) {
    return this.dataStore.createEntities(entitiesData);
  }
  
  /**
   * Pass-through method for database access
   * @returns {Object} Current database state
   */
  db() {
    return this.dataStore.db();
  }
  
  /**
   * Get or create EntityProxy for given entity ID
   * @param {number} entityId - Entity ID
   * @returns {EntityProxy} EntityProxy instance for the entity
   */
  getProxy(entityId) {
    // Validate entity ID
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    // Check our cache first for singleton pattern
    if (this._proxyCache.has(entityId)) {
      return this._proxyCache.get(entityId);
    }
    
    // Try to get existing proxy from DataStore registry if it has one
    if (this.dataStore._getRegisteredProxy) {
      const existingProxy = this.dataStore._getRegisteredProxy(entityId);
      if (existingProxy) {
        // Cache it for future use
        this._proxyCache.set(entityId, existingProxy);
        return existingProxy;
      }
    }
    
    // Create new EntityProxy and cache it
    const newProxy = new EntityProxy(entityId, this.dataStore);
    this._proxyCache.set(entityId, newProxy);
    return newProxy;
  }
  
  /**
   * Create a StreamProxy with a given value and optional query specification
   * @param {*} value - The value for the StreamProxy
   * @param {Object} [querySpec] - Optional query specification for context
   * @returns {StreamProxy} New StreamProxy instance
   */
  createStreamProxy(value, querySpec = null) {
    // StreamProxy requires a querySpec, so provide a default if none given
    const defaultQuerySpec = querySpec || { 
      find: ['?value'], 
      where: [['?e', ':synthetic/value', '?value']]
    };
    return new StreamProxy(this.dataStore, value, defaultQuerySpec);
  }
  
  /**
   * Create an EntityProxy for a given entity ID
   * @param {number} entityId - Entity ID
   * @returns {EntityProxy} EntityProxy instance (uses caching via getProxy)
   */
  createEntityProxy(entityId) {
    return this.getProxy(entityId);
  }
  
  /**
   * Create a CollectionProxy with given items and optional query specification
   * @param {Array} items - Array of items for the collection
   * @param {Object} [querySpec] - Optional query specification for context
   * @returns {CollectionProxy} New CollectionProxy instance
   */
  createCollectionProxy(items, querySpec = null) {
    // CollectionProxy requires a querySpec, so provide a default if none given
    const defaultQuerySpec = querySpec || { 
      find: ['?item'], 
      where: [['?e', ':synthetic/items', '?item']]
    };
    return new CollectionProxy(this.dataStore, items, defaultQuerySpec, this);
  }
  
  /**
   * Create appropriate proxy based on type
   * @private
   * @param {string} proxyType - Type of proxy to create
   * @param {Object} querySpec - Query specification
   * @param {Array} results - Query results
   * @returns {StreamProxy|EntityProxy|CollectionProxy} Created proxy
   */
  _createProxy(proxyType, querySpec, results) {
    switch(proxyType) {
      case 'StreamProxy':
        // StreamProxy expects (store, currentValue, querySpec)
        // Need to extract the actual value from results
        let streamValue;
        
        // Check if this is an aggregate query (results is already a scalar)
        if (typeof results === 'number' || typeof results === 'string' || typeof results === 'boolean') {
          streamValue = results;
        } else if (Array.isArray(results)) {
          // For regular scalar queries, extract the value
          if (results.length === 0) {
            streamValue = results; // Empty array
          } else if (results.length === 1 && results[0].length === 1) {
            streamValue = results[0][0]; // Single value: [['Alice']] -> 'Alice'
          } else {
            streamValue = results; // Keep as array for multi-value results
          }
        } else {
          streamValue = results;
        }
        
        return new StreamProxy(this.dataStore, streamValue, querySpec);
        
      case 'EntityProxy':
        // For entity queries, results are arrays of entity IDs
        // Extract the first entity ID if available
        if (results.length > 0 && results[0].length > 0) {
          const entityId = results[0][0];
          // Use getProxy for singleton pattern
          return this.getProxy(entityId);
        } else {
          // Return an invalid EntityProxy for empty results
          // We need to use a special marker for "no entity"
          // Using -1 as a sentinel value for non-existent entities
          const invalidProxy = new EntityProxy(-1, this.dataStore);
          // Mark it as representing an empty query result
          invalidProxy._isEmpty = true;
          return invalidProxy;
        }
        
      case 'CollectionProxy':
        // CollectionProxy expects (store, currentItems, querySpec)
        return new CollectionProxy(this.dataStore, results, querySpec, this);
        
      default:
        throw new Error(`Unknown proxy type: ${proxyType}`);
    }
  }
}

/**
 * Convenience function to create a DataStoreProxy
 * @param {DataStore} dataStore - DataStore instance to wrap
 * @returns {DataStoreProxy} New DataStoreProxy instance
 */
export function createDataStoreProxy(dataStore) {
  return new DataStoreProxy(dataStore);
}