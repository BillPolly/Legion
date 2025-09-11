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
   * @param {Object} querySpec - DataScript query specification with optional update
   * @returns {StreamProxy|EntityProxy|CollectionProxy} Appropriate proxy for results
   */
  query(querySpec) {
    // Validate query spec
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    // Handle optional update field
    let tempids = null;
    if (querySpec.update) {
      const txResult = this._executeUpdate(querySpec.update);
      tempids = txResult.tempids;
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
    
    // Prepare query spec - remove update field and add appropriate findType for aggregates
    let processedQuerySpec = { ...querySpec };
    delete processedQuerySpec.update; // Remove update field from query
    
    // Bind tempids to query variables if needed
    if (tempids) {
      processedQuerySpec = this._bindTempids(processedQuerySpec, tempids);
    }
    
    // Automatically set findType for aggregate queries to get scalar results
    if (this.queryTypeDetector.isAggregateQuery(processedQuerySpec) && !processedQuerySpec.findType) {
      processedQuerySpec.findType = 'scalar';
    }
    
    // Execute query using underlying DataStore
    const results = this.dataStore.query(processedQuerySpec);
    
    // Determine appropriate proxy type
    const proxyType = this.queryTypeDetector.detectProxyType(processedQuerySpec, results);
    
    // Create and return appropriate proxy
    return this._createProxy(proxyType, processedQuerySpec, results);
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
    
    // Create new EntityProxy with dataStoreProxy reference and cache it
    const newProxy = new EntityProxy(entityId, this.dataStore, this);
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
    return new StreamProxy(this.dataStore, value, defaultQuerySpec, this);
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
   * Execute update transaction
   * @private
   * @param {Object|Array} updateSpec - Update specification
   * @returns {Object} Transaction result with tempids and dbAfter
   */
  _executeUpdate(updateSpec) {
    if (!updateSpec) {
      return { tempids: new Map(), dbAfter: this.dataStore.db() };
    }
    
    // Handle different update formats
    let txData;
    
    if (Array.isArray(updateSpec)) {
      // Direct transaction data - array of entities
      txData = updateSpec.map((item, index) => {
        // Clone the item to avoid mutation
        const processedItem = { ...item };
        
        // Handle entity ID properly - DataScript expects :db/id to be present for updates
        let entityId = processedItem[':db/id'];
        
        // If we have an existing entity ID (positive number), keep it for update
        if (typeof entityId === 'number' && entityId > 0) {
          // Keep the entity ID for updates to existing entities
          // DataScript will handle it correctly
        } else if (entityId === undefined || entityId === null) {
          // For new entities without an ID, add a tempid
          processedItem[':db/id'] = -(index + 1);
        } else if (typeof entityId === 'number' && entityId < 0) {
          // Already a tempid, keep it
        } else {
          // Invalid entity ID format
          throw new Error(`Invalid entity ID format: ${entityId}`);
        }
        
        // Replace ?new-N variables with actual tempids in reference attributes
        for (const [key, value] of Object.entries(processedItem)) {
          if (typeof value === 'string' && value.startsWith('?new-')) {
            const tempidNum = parseInt(value.substring(5), 10);
            if (!isNaN(tempidNum)) {
              processedItem[key] = -tempidNum; // Convert ?new-1 to -1
            }
          }
        }
        
        return processedItem;
      });
    } else if (typeof updateSpec === 'object') {
      // Single entity update
      const processedItem = { ...updateSpec };
      
      // Handle entity ID properly - DataScript expects :db/id to be present for updates
      let entityId = processedItem[':db/id'];
      
      // If we have an existing entity ID (positive number), keep it for update
      if (typeof entityId === 'number' && entityId > 0) {
        // Keep the entity ID for updates to existing entities
        // DataScript will handle it correctly
      } else if (entityId === undefined || entityId === null) {
        // For new entities without an ID, add a tempid
        processedItem[':db/id'] = -1;
      } else if (typeof entityId === 'number' && entityId < 0) {
        // Already a tempid, keep it
      } else {
        // Invalid entity ID format
        throw new Error(`Invalid entity ID format: ${entityId}`);
      }
      
      // Replace ?new-N variables in single entity
      for (const [key, value] of Object.entries(processedItem)) {
        if (typeof value === 'string' && value.startsWith('?new-')) {
          const tempidNum = parseInt(value.substring(5), 10);
          if (!isNaN(tempidNum)) {
            processedItem[key] = -tempidNum;
          }
        }
      }
      
      txData = [processedItem];
    } else {
      throw new Error('Update spec must be an object or array');
    }
    
    // Execute transaction using DataStore's conn
    const result = this.dataStore.conn.transact(txData);
    return {
      tempids: result.tempids,
      dbAfter: result.dbAfter,
      tx: result.tx
    };
  }
  
  /**
   * Bind tempids from transaction to query variables
   * @private
   * @param {Object} querySpec - Query specification
   * @param {Map} tempids - Map of tempids to entity IDs
   * @returns {Object} Query spec with tempids bound to variables
   */
  _bindTempids(querySpec, tempids) {
    if (!tempids || tempids.size === 0) {
      return querySpec;
    }
    
    // Deep clone the query spec to avoid mutations
    const processed = JSON.parse(JSON.stringify(querySpec));
    
    // Create replacer function for mapping ?new-N variables to tempids
    const replacer = (variable) => {
      if (typeof variable === 'string' && variable.startsWith('?new-')) {
        const tempidNum = parseInt(variable.substring(5), 10);
        if (!isNaN(tempidNum) && tempids.has(-tempidNum)) {
          return tempids.get(-tempidNum);
        }
      }
      return variable;
    };
    
    // Replace variables throughout the query structure
    this._replaceVariables(processed, replacer);
    
    return processed;
  }
  
  /**
   * Recursively replace variables in a query structure
   * @private
   * @param {*} obj - Object, array, or primitive to process
   * @param {Function} replacer - Function to replace variables
   */
  _replaceVariables(obj, replacer) {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'string') {
          obj[i] = replacer(obj[i]);
        } else if (typeof obj[i] === 'object' && obj[i] !== null) {
          this._replaceVariables(obj[i], replacer);
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = replacer(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          this._replaceVariables(obj[key], replacer);
        }
      }
    }
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
        
        return new StreamProxy(this.dataStore, streamValue, querySpec, this);
        
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
          const invalidProxy = new EntityProxy(-1, this.dataStore, this);
          // Mark it as representing an empty query result
          invalidProxy._isEmpty = true;
          return invalidProxy;
        }
        
      case 'CollectionProxy':
        // CollectionProxy expects (store, currentItems, querySpec, dataStoreProxy)
        // Special case: if results is empty array but we detect it should be a collection
        // (e.g., from an empty collection query), ensure we return CollectionProxy
        if (results.length === 0 && querySpec.find && querySpec.find.length === 1) {
          return new CollectionProxy(this.dataStore, [], querySpec, this);
        }
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