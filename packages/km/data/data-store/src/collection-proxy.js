/**
 * CollectionProxy Class
 * Represents query results with multiple items (collections)
 * Part of the unified proxy architecture where all queries return proxy objects
 * 
 * Provides:
 * - Array-like interface (indexing, iteration, length)
 * - Proxy methods (value(), query(), subscribe())
 * - Functional array methods (map, filter, forEach, etc.)
 */

import { q } from '../../datascript/index.js';

// Direct import - circular dependency will be resolved by ES modules
// Following the same pattern used in proxy.js
import { EntityProxy } from './proxy.js';
import { QueryTypeDetector } from './query-type-detector.js';
import { StreamProxy } from './stream-proxy.js';

export class CollectionProxy {
  constructor(store, currentItems, querySpec, dataStoreProxy = null) {
    // Validate required parameters
    if (!store) {
      throw new Error('CollectionProxy requires store parameter');
    }
    
    if (currentItems === undefined && arguments.length < 2) {
      throw new Error('CollectionProxy requires currentItems parameter');
    }
    
    if (!querySpec) {
      throw new Error('CollectionProxy requires querySpec parameter');
    }
    
    // Validate store is a proper DataStore instance
    if (!store.db || typeof store.db !== 'function') {
      throw new Error('CollectionProxy requires valid DataStore instance');
    }
    
    this.store = store;
    this.dataStoreProxy = dataStoreProxy;
    
    // Normalize currentItems to array and convert to EntityProxy if needed
    let items;
    if (Array.isArray(currentItems)) {
      items = [...currentItems]; // Shallow copy
    } else {
      items = [currentItems]; // Convert single item to array
    }
    
    // Convert entity IDs to EntityProxy instances if this is an entity query
    if (dataStoreProxy && querySpec && this._isEntityQuerySpec(querySpec)) {
      this._currentItems = items.map(item => {
        // Extract entity ID from result
        let entityId = null;
        if (typeof item === 'number') {
          entityId = item;
        } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'number') {
          entityId = item[0];
        }
        
        // If we have an entity ID, create EntityProxy
        if (entityId !== null) {
          try {
            const db = store.db();
            const entityData = db.entity(entityId);
            if (entityData && entityData.id === entityId) {
              return dataStoreProxy.getProxy(entityId);
            }
          } catch (error) {
            // Not a valid entity, keep original
          }
        }
        return item;
      });
    } else {
      this._currentItems = items;
    }
    
    // Deep copy querySpec to avoid mutations
    this._querySpec = JSON.parse(JSON.stringify(querySpec));
    
    // Initialize subscription management
    this._subscribers = new Set();
    this._subscriptionCleanup = null;
    
    // Set up proxy for array-like access
    this._setupArrayProxy();
    
    // Set up reactive subscription to underlying data changes
    this._setupReactiveSubscription();
    
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle numeric indices for array-like access
        if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) {
          const index = parseInt(prop, 10);
          return target._currentItems[index];
        }
        
        // Handle length property
        if (prop === 'length') {
          return target._currentItems.length;
        }
        
        // Handle Symbol.iterator for for...of loops
        if (prop === Symbol.iterator) {
          return function* () {
            for (let i = 0; i < target._currentItems.length; i++) {
              yield target._currentItems[i];
            }
          };
        }
        
        // Handle other properties normally
        return Reflect.get(target, prop, receiver);
      },
      
      has(target, prop) {
        // Support 'in' operator for indices
        if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) {
          const index = parseInt(prop, 10);
          return index >= 0 && index < target._currentItems.length;
        }
        
        return Reflect.has(target, prop);
      },
      
      ownKeys(target) {
        // Return array indices and regular properties
        const indices = Array.from({ length: target._currentItems.length }, (_, i) => String(i));
        const regularProps = Reflect.ownKeys(target);
        return [...indices, ...regularProps];
      },
      
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) {
          const index = parseInt(prop, 10);
          if (index >= 0 && index < target._currentItems.length) {
            return {
              enumerable: true,
              configurable: true,
              value: target._currentItems[index]
            };
          }
        }
        
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
  }

  /**
   * Get the query specification this proxy is bound to
   * @returns {Object} Query specification object
   */
  get querySpec() {
    return this._querySpec;
  }

  /**
   * Get current items as JavaScript array
   * Returns immutable copy for complex values
   */
  value() {
    return this._currentItems.map(item => {
      // Handle DataScript query results which can be:
      // 1. Entity IDs as numbers: 4
      // 2. Entity IDs in tuples: [4] 
      // 3. Multi-variable results: [4, "value"]
      // 4. Scalar values in tuples: ["Alice", 30] or [30]
      
      // Check if this is an entity query that should return EntityProxy objects
      const isEntityQuery = this._isEntityQuery();
      
      if (isEntityQuery) {
        let entityId = null;
        
        if (typeof item === 'number') {
          // Direct entity ID
          entityId = item;
        } else if (Array.isArray(item) && item.length >= 1 && typeof item[0] === 'number') {
          // Entity ID in tuple (most common case from DataScript queries)
          entityId = item[0];
        }
        
        // If we found an entity ID and have dataStoreProxy, create EntityProxy
        if (entityId !== null && this.dataStoreProxy) {
          try {
            // Verify it's a valid entity by checking if it exists
            const db = this.dataStoreProxy.dataStore.db();
            const entityData = db.entity(entityId);
            if (entityData && entityData.id === entityId) {
              return this.dataStoreProxy.getProxy(entityId);
            }
          } catch (error) {
            // Not a valid entity ID, fall through to deep copy
          }
        }
      }
      
      // For scalar queries or when not an entity, return deep copy
      return this._deepCopy(item);
    });
  }

  /**
   * Transform/filter the collection through additional querying
   * Returns appropriate proxy type based on query result
   */
  query(querySpec) {
    this._validateQuerySpec(querySpec);
    this._checkStoreAvailability();
    
    // Handle optional update field
    let tempids = null;
    if (querySpec.update) {
      // If we have a dataStoreProxy, use it to execute updates
      if (this.dataStoreProxy) {
        let processedUpdate = this._processCollectionReferences(querySpec.update);
        
        // If update is a single object (not array), we need to apply it to all matching entities
        if (!Array.isArray(processedUpdate) && typeof processedUpdate === 'object') {
          // First, run the query without update to find matching entities
          const queryWithoutUpdate = { ...querySpec };
          delete queryWithoutUpdate.update;
          
          // Bind collection item references in the query
          const boundQuery = this._bindCollectionItemReferences(queryWithoutUpdate);
          
          // Execute query to find matching entities
          const matchingResults = q(boundQuery, this.store.db());
          
          // Transform single object update to array of updates for each matching entity
          if (matchingResults && matchingResults.length > 0) {
            processedUpdate = matchingResults.map(result => {
              const entityId = Array.isArray(result) ? result[0] : result;
              return {
                ':db/id': entityId,
                ...processedUpdate
              };
            });
          }
        }
        
        const txResult = this.dataStoreProxy._executeUpdate(processedUpdate);
        tempids = txResult.tempids;
      } else {
        throw new Error('Cannot execute updates without dataStoreProxy');
      }
    }
    
    // Prepare query spec - remove update field if present
    let processedQuerySpec = { ...querySpec };
    delete processedQuerySpec.update;
    
    // Bind tempids to query variables if needed
    if (tempids && this.dataStoreProxy) {
      processedQuerySpec = this.dataStoreProxy._bindTempids(processedQuerySpec, tempids);
    }
    
    // Bind collection item references in the query
    processedQuerySpec = this._bindCollectionItemReferences(processedQuerySpec);
    
    // Bind collection context to query if needed
    const boundQuery = this._bindCollectionContext(processedQuerySpec);
    
    // Execute query
    const results = q(boundQuery, this.store.db());
    
    // Only filter results to collection if we're not creating new entities
    // If we had an update that created new entities (tempids), don't filter
    const shouldFilter = !tempids || tempids.size === 0;
    const filteredResults = shouldFilter ? this._filterResultsToCollection(results, processedQuerySpec) : results;
    
    // Determine appropriate proxy type for results
    const proxyType = this._determineProxyType(processedQuerySpec, filteredResults);
    
    // Handle different proxy types
    if (proxyType === 'CollectionProxy') {
      const items = this._extractCollectionFromResults(filteredResults, processedQuerySpec);
      return new CollectionProxy(this.store, items, processedQuerySpec, this.dataStoreProxy);
    } else if (proxyType === 'EntityProxy') {
      // Single entity result - return EntityProxy directly
      const entityId = this._extractValueFromResults(filteredResults);
      if (entityId !== null && entityId !== undefined && this.dataStoreProxy) {
        return this.dataStoreProxy.getProxy(entityId);
      } else if (entityId !== null && entityId !== undefined) {
        return new EntityProxy(entityId, this.store, this.dataStoreProxy);
      } else {
        // No result, return empty collection
        return new CollectionProxy(this.store, [], processedQuerySpec, this.dataStoreProxy);
      }
    } else {
      // StreamProxy for scalar values
      const value = this._extractValueFromResults(filteredResults);
      return new StreamProxy(this.store, value, processedQuerySpec, this.dataStoreProxy);
    }
  }

  /**
   * Subscribe to reactive updates of the collection
   * Returns unsubscribe function
   */
  subscribe(callback) {
    this._checkStoreAvailability();
    
    if (!callback) {
      throw new Error('Callback function is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }

  /**
   * Functional array methods
   */
  forEach(callback, thisArg) {
    this._currentItems.forEach(callback, thisArg);
  }

  map(callback, thisArg) {
    const mappedItems = this._currentItems.map(callback, thisArg);
    return new CollectionProxy(this.store, mappedItems, this._querySpec, this.dataStoreProxy);
  }

  filter(callback, thisArg) {
    const filteredItems = this._currentItems.filter(callback, thisArg);
    return new CollectionProxy(this.store, filteredItems, this._querySpec, this.dataStoreProxy);
  }

  reduce(callback, initialValue) {
    if (arguments.length >= 2) {
      return this._currentItems.reduce(callback, initialValue);
    } else {
      return this._currentItems.reduce(callback);
    }
  }

  find(callback, thisArg) {
    return this._currentItems.find(callback, thisArg);
  }

  some(callback, thisArg) {
    return this._currentItems.some(callback, thisArg);
  }

  every(callback, thisArg) {
    return this._currentItems.every(callback, thisArg);
  }

  includes(searchElement, fromIndex) {
    return this._currentItems.includes(searchElement, fromIndex);
  }

  slice(start, end) {
    const slicedItems = this._currentItems.slice(start, end);
    return new CollectionProxy(this.store, slicedItems, this._querySpec, this.dataStoreProxy);
  }

  /**
   * Collection-specific convenience methods
   */
  first() {
    return this._currentItems[0];
  }

  last() {
    return this._currentItems[this._currentItems.length - 1];
  }

  isEmpty() {
    return this._currentItems.length === 0;
  }

  /**
   * Set up array-like proxy behavior
   * @private
   */
  _setupArrayProxy() {
    // Length property is handled by the main proxy
    Object.defineProperty(this, 'length', {
      get: () => this._currentItems.length,
      enumerable: false,
      configurable: false
    });
  }

  /**
   * Set up reactive subscription to underlying data changes
   * @private
   */
  _setupReactiveSubscription() {
    if (!this.store.subscribe) {
      return; // Store doesn't support subscriptions
    }
    
    // Subscribe to changes that might affect our query
    this._subscriptionCleanup = this.store.subscribe(this._querySpec, (newResults) => {
      // Extract new collection from results
      const newItems = this._extractCollectionFromResults(newResults);
      
      // Only update if collection actually changed
      if (this._hasCollectionChanged(this._currentItems, newItems)) {
        this._currentItems = newItems;
        this._notifySubscribers(newItems);
      }
    });
  }

  /**
   * Validate query specification
   * @private
   */
  _validateQuerySpec(querySpec) {
    if (!querySpec) {
      throw new Error('Query spec is required');
    }
    
    if (!querySpec.find) {
      throw new Error('Query spec must have find clause');
    }
    
    if (!Array.isArray(querySpec.find) || querySpec.find.length === 0) {
      throw new Error('Query spec find clause cannot be empty');
    }
  }

  /**
   * Check if store is available for operations
   * @private
   */
  _checkStoreAvailability() {
    if (!this.store || !this.store.db) {
      throw new Error('DataStore is not available');
    }
    
    try {
      this.store.db();
    } catch (error) {
      throw new Error('Cannot subscribe: DataStore is not available');
    }
  }

  /**
   * Bind collection context variables in query spec
   * @private
   */
  _bindCollectionContext(querySpec) {
    // For collection queries, we execute the query normally but then filter results 
    // to only include items from this collection
    // Deep clone the query spec to avoid mutations (handle circular references)
    return this._deepCloneQuerySpec(querySpec);
  }
  
  /**
   * Deep clone a query spec safely (avoiding circular references)
   * @private
   */
  _deepCloneQuerySpec(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCloneQuerySpec(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this._deepCloneQuerySpec(obj[key]);
      }
    }
    
    return cloned;
  }
  
  /**
   * Process collection references in update spec (e.g., ?user-0, ?user-1)
   * @private
   */
  _processCollectionReferences(updateSpec) {
    if (!updateSpec) return updateSpec;
    
    // If updateSpec is a CollectionProxy, extract its value
    if (updateSpec instanceof CollectionProxy) {
      updateSpec = updateSpec.value();
    }
    
    const processValue = (value) => {
      // Handle various collection reference patterns: ?user-0, ?item-0, etc.
      if (typeof value === 'string' && value.startsWith('?') && value.includes('-')) {
        const match = value.match(/^\?[a-z]+-(\d+)$/);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index >= 0 && index < this._currentItems.length) {
            const item = this._currentItems[index];
            // Return entity ID if it's an EntityProxy
            if (item && typeof item === 'object' && typeof item.entityId === 'number') {
              return item.entityId;
            }
          }
        }
      }
      return value;
    };
    
    if (Array.isArray(updateSpec)) {
      return updateSpec.map(item => {
        if (typeof item === 'object' && item !== null) {
          const processed = {};
          for (const [key, value] of Object.entries(item)) {
            processed[key] = processValue(value);
          }
          return processed;
        }
        return item;
      });
    } else if (typeof updateSpec === 'object' && updateSpec !== null) {
      const processed = {};
      for (const [key, value] of Object.entries(updateSpec)) {
        processed[key] = processValue(value);
      }
      return processed;
    }
    
    return updateSpec;
  }
  
  /**
   * Bind collection item references in query spec (e.g., ?user-0)
   * @private
   */
  _bindCollectionItemReferences(querySpec) {
    if (!querySpec) return querySpec;
    
    const processed = this._deepCloneQuerySpec(querySpec);
    
    const replaceValue = (value) => {
      // Handle various collection reference patterns: ?user-0, ?item-0, etc.
      if (typeof value === 'string' && value.startsWith('?') && value.includes('-')) {
        const match = value.match(/^\?[a-z]+-(\d+)$/);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index >= 0 && index < this._currentItems.length) {
            const item = this._currentItems[index];
            if (item && typeof item === 'object' && typeof item.entityId === 'number') {
              return item.entityId;
            }
          }
        }
      }
      return value;
    };
    
    // Replace in where clauses
    if (processed.where) {
      processed.where = processed.where.map(clause => {
        if (Array.isArray(clause)) {
          return clause.map(replaceValue);
        }
        return clause;
      });
    }
    
    return processed;
  }

  /**
   * Filter query results to only include items that belong to this collection
   * @private
   */
  _filterResultsToCollection(results, querySpec) {
    if (!results || results.length === 0 || this._currentItems.length === 0) {
      return results;
    }

    // For cross-collection queries, we need smarter detection
    // Check if we're querying for the same type of entities as in our collection
    const findVariable = querySpec.find[0];
    const whereClause = querySpec.where || [];
    
    // Get the original query spec to understand what entities are in this collection
    const originalFindVariable = this._querySpec.find[0];
    
    // If we're finding a different variable than what's in our collection, it's likely cross-collection
    // For example: collection has ?user entities, but we're finding ?project entities
    if (findVariable !== originalFindVariable) {
      // This is likely a cross-collection query - don't filter
      return results;
    }

    // Build set of entity IDs in this collection for fast lookup
    const collectionEntityIds = new Set();
    for (const item of this._currentItems) {
      if (item && typeof item === 'object' && typeof item.entityId === 'number') {
        collectionEntityIds.add(item.entityId);
      } else if (typeof item === 'number') {
        collectionEntityIds.add(item);
      }
    }

    // If no entity IDs in collection, return all results
    if (collectionEntityIds.size === 0) {
      return results;
    }

    // Filter results based on query structure
    const findClause = querySpec.find;
    if (findClause.length === 1 && typeof findClause[0] === 'string' && findClause[0].startsWith('?')) {
      // Single variable query - filter based on whether the result entity is in our collection
      return results.filter(result => {
        const entityId = Array.isArray(result) ? result[0] : result;
        return typeof entityId === 'number' && collectionEntityIds.has(entityId);
      });
    }

    // For multi-variable queries, check if any variable represents entities in our collection
    // This is more complex and would need analysis of the query structure
    // For now, return all results
    return results;
  }

  /**
   * Replace variable occurrences in query structure
   * @private
   */
  _replaceVariableInQuery(obj, variable, value) {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] === variable) {
          obj[i] = value;
        } else if (typeof obj[i] === 'object') {
          this._replaceVariableInQuery(obj[i], variable, value);
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj[key] === variable) {
          obj[key] = value;
        } else if (typeof obj[key] === 'object') {
          this._replaceVariableInQuery(obj[key], variable, value);
        }
      }
    }
  }

  /**
   * Determine appropriate proxy type for query results
   * @private
   */
  _determineProxyType(querySpec, results) {
    const findClause = querySpec.find;
    
    // Single aggregate function → StreamProxy
    if (findClause.length === 1 && Array.isArray(findClause[0])) {
      return 'StreamProxy';
    }
    
    // For chained queries on collections, we need to be more careful
    // Check if we're dealing with entities or scalars
    if (results.length === 1 && findClause.length === 1 && typeof findClause[0] === 'string') {
      const firstResult = Array.isArray(results[0]) ? results[0][0] : results[0];
      
      // Check if the current collection contains entities
      const collectionHasEntities = this._currentItems.some(item => 
        item && typeof item === 'object' && typeof item.entityId === 'number'
      );
      
      if (collectionHasEntities) {
        // If collection has entities and result is an entity ID, keep as collection
        if (typeof firstResult === 'number') {
          try {
            const db = this.store.db();
            const entityData = db.entity(firstResult);
            if (entityData && entityData.id === firstResult) {
              return 'CollectionProxy'; // Keep entity results as collection
            }
          } catch (error) {
            // Not an entity
          }
        }
      } else {
        // Collection has scalars - single scalar result should be StreamProxy
        if (typeof firstResult !== 'number' || !this._isEntityId(firstResult)) {
          return 'StreamProxy';
        }
      }
    }
    
    // Use QueryTypeDetector for proper type detection
    // Import it dynamically to avoid circular dependencies
    const QueryTypeDetector = this._getQueryTypeDetector();
    if (QueryTypeDetector) {
      try {
        const detector = new QueryTypeDetector(this.store);
        return detector.detectProxyType(querySpec, results);
      } catch (error) {
        // Fall back to simple logic if detector fails
        console.warn('QueryTypeDetector failed, using fallback logic:', error.message);
      }
    }
    
    // Fallback logic: Check result count for single variable queries
    if (findClause.length === 1 && typeof findClause[0] === 'string') {
      // For single variable queries, return StreamProxy if single result, CollectionProxy if multiple
      if (results.length <= 1) {
        return 'StreamProxy';
      } else {
        return 'CollectionProxy';
      }
    }
    
    // Multiple variables → CollectionProxy
    return 'CollectionProxy';
  }
  
  /**
   * Check if a value is an entity ID
   * @private
   */
  _isEntityId(value) {
    if (typeof value !== 'number') return false;
    try {
      const db = this.store.db();
      const entityData = db.entity(value);
      return entityData && entityData.id === value;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get QueryTypeDetector class, handling circular dependency
   * @private
   */
  _getQueryTypeDetector() {
    // Use direct import since we've already imported it at the module level
    return QueryTypeDetector;
  }

  /**
   * Create appropriate proxy type synchronously
   * @private
   */
  async _createProxy(proxyType, querySpec, results) {
    if (proxyType === 'StreamProxy') {
      const value = this._extractValueFromResults(results);
      const { StreamProxy } = await import('./stream-proxy.js');
      return new StreamProxy(this.store, value, querySpec);
    }
    
    // For CollectionProxy - no circular import issue
    const items = this._extractCollectionFromResults(results, querySpec);
    return new CollectionProxy(this.store, items, querySpec);
  }

  /**
   * Extract single value from DataScript query results
   * @private
   */
  _extractValueFromResults(results) {
    if (!results || results.length === 0) {
      return null;
    }
    
    // Single result with single value
    if (results.length === 1 && results[0].length === 1) {
      return results[0][0];
    }
    
    // Multiple results or multiple values - return first value
    return results[0] ? results[0][0] : null;
  }

  /**
   * Extract collection from DataScript query results
   * @private
   */
  _extractCollectionFromResults(results, querySpec = null) {
    if (!results || results.length === 0) {
      return [];
    }
    
    // If querySpec provided, check if results should be EntityProxy instances
    if (querySpec && querySpec.find.length === 1 && results.length > 0) {
      const variable = querySpec.find[0];
      
      // Check if results are entity IDs by examining the first result
      const firstResult = Array.isArray(results[0]) ? results[0][0] : results[0];
      
      // If the result is a number and this is a single variable query,
      // it's likely an entity ID - check if it exists in the database
      if (typeof firstResult === 'number') {
        try {
          // Try to get entity data - if successful, it's an entity ID
          const db = this.store.db();
          const entityData = db.entity(firstResult);
          
          if (entityData && entityData.id === firstResult) {
            // Convert all results to EntityProxy instances
            return results.map(result => {
              const entityId = Array.isArray(result) ? result[0] : result;
              return new EntityProxy(entityId, this.store, this.dataStoreProxy);
            });
          }
        } catch (error) {
          // Not an entity ID, continue with scalar extraction
        }
      }
    }
    
    // Extract first value from each result tuple for non-entity queries
    return results.map(result => Array.isArray(result) ? result[0] : result);
  }

  /**
   * Check if collection has actually changed
   * @private
   */
  _hasCollectionChanged(oldItems, newItems) {
    // Handle null/undefined cases
    if (oldItems === null && newItems === null) return false;
    if (oldItems === undefined && newItems === undefined) return false;
    if (oldItems === null || newItems === null) return true;
    if (oldItems === undefined || newItems === undefined) return true;
    
    // Ensure both are arrays
    const oldArray = Array.isArray(oldItems) ? oldItems : [];
    const newArray = Array.isArray(newItems) ? newItems : [];
    
    if (oldArray.length !== newArray.length) {
      return true;
    }
    
    // Compare items using JSON serialization (simple but sufficient for MVP)
    for (let i = 0; i < oldArray.length; i++) {
      if (JSON.stringify(oldArray[i]) !== JSON.stringify(newArray[i])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Notify all subscribers of collection change
   * @private
   */
  _notifySubscribers(newItems) {
    this._subscribers.forEach(callback => {
      try {
        callback(newItems);
      } catch (error) {
        console.error('CollectionProxy subscriber callback error:', error);
      }
    });
  }

  /**
   * Create deep copy of value to maintain immutability
   * @private
   */
  _deepCopy(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle circular references
    if (seen.has(obj)) {
      return {}; // Return empty object for circular refs
    }
    seen.add(obj);
    
    // Handle Date objects specially
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    // Handle EntityProxy objects - don't deep copy them, they're already immutable wrappers
    // Check for EntityProxy by looking for key properties instead of constructor name
    if (obj && typeof obj === 'object' && 
        typeof obj.entityId === 'number' && 
        obj.store && 
        typeof obj.get === 'function' && 
        typeof obj.update === 'function') {
      return obj; // This is an EntityProxy
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCopy(item, seen));
    }
    
    const copy = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = this._deepCopy(obj[key], seen);
      }
    }
    
    return copy;
  }

  /**
   * Check if a query spec is an entity query
   * @private
   */
  _isEntityQuerySpec(querySpec) {
    if (!querySpec || !querySpec.find || !querySpec.where) {
      return false;
    }
    
    const findClause = querySpec.find;
    const whereClause = querySpec.where;
    
    // Must be a single variable query to potentially be an entity query
    if (findClause.length !== 1 || typeof findClause[0] !== 'string' || !findClause[0].startsWith('?')) {
      return false;
    }
    
    const variable = findClause[0];
    
    // Check if variable appears as entity (first position) in where clauses
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length >= 3 && clause[0] === variable) {
        return true; // Variable is used as entity, so it's an entity query
      }
    }
    
    return false; // Default to scalar query
  }
  
  /**
   * Check if this is an entity query that should return EntityProxy objects
   * @private
   */
  _isEntityQuery() {
    if (!this._querySpec || !this._querySpec.find || !this._querySpec.where) {
      return false;
    }
    
    const findClause = this._querySpec.find;
    const whereClause = this._querySpec.where;
    
    // Must be a single variable query to potentially be an entity query
    if (findClause.length !== 1 || typeof findClause[0] !== 'string' || !findClause[0].startsWith('?')) {
      return false;
    }
    
    const variable = findClause[0];
    
    // Check if variable appears as entity (first position) in where clauses
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length >= 3 && clause[0] === variable) {
        return true; // Variable is used as entity, so it's an entity query
      }
    }
    
    // Check if variable appears as value in reference attributes
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length === 3) {
        const [entity, attribute, value] = clause;
        if (value === variable) {
          // Check if the attribute is a reference type using schema
          if (this.dataStoreProxy && this.dataStoreProxy.dataStore.schema) {
            const schemaInfo = this.dataStoreProxy.dataStore.schema[attribute];
            if (schemaInfo && schemaInfo.valueType === 'ref') {
              return true; // Variable represents entity reference
            }
          }
        }
      }
    }
    
    return false; // Scalar query
  }

  /**
   * Clean up subscriptions and resources
   */
  destroy() {
    if (this._subscriptionCleanup) {
      this._subscriptionCleanup();
      this._subscriptionCleanup = null;
    }
    
    this._subscribers.clear();
  }
}