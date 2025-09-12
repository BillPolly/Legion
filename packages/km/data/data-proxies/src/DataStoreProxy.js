/**
 * DataStoreProxy - Factory proxy for creating appropriate proxy types based on query characteristics
 * 
 * Refactored to extend Handle from @legion/km-data-handle for universal base functionality.
 * Acts as the main entry point for the proxy system, providing:
 * - Factory methods for creating EntityProxy, StreamProxy, and CollectionProxy instances
 * - Auto-detection of appropriate proxy type based on query characteristics
 * - Direct access to store operations when needed
 * - Centralized subscription and memory management
 */

import { Handle } from '../../handle/src/index.js';
import { EntityProxy } from './EntityProxy.js';
import { StreamProxy } from './StreamProxy.js';
import { CollectionProxy } from './CollectionProxy.js';
import { ProxyTypeDetector } from './ProxyTypeDetector.js';
import { DataStoreResourceManager } from './DataStoreResourceManager.js';

export class DataStoreProxy extends Handle {
  constructor(store, options = {}) {
    // Validate store first
    if (!store) {
      throw new Error('DataStore is required');
    }
    
    if (typeof store.query !== 'function') {
      throw new Error('DataStore is required');
    }
    
    // Create DataStoreResourceManager to wrap the store
    const resourceManager = new DataStoreResourceManager(store);
    super(resourceManager);
    
    // Keep reference to store for backward compatibility
    this.store = store;
    this.options = options;
    
    // Initialize proxy type detector with ResourceManager
    this.detector = new ProxyTypeDetector(resourceManager);
    
    // Cache for entity proxies (singleton pattern)
    this._entityProxies = new Map();
  }
  
  /**
   * Create EntityProxy for specific entity
   * @param {number} entityId - Entity ID
   * @returns {EntityProxy} Entity proxy for the specified entity
   */
  entity(entityId) {
    this._validateNotDestroyed();
    
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    // Check cache first
    if (this._entityProxies.has(entityId)) {
      const proxy = this._entityProxies.get(entityId);
      if (!proxy.isDestroyed()) {
        return proxy;
      }
      // Remove destroyed proxy from cache
      this._entityProxies.delete(entityId);
    }
    
    // Create new entity proxy
    const entityProxy = new EntityProxy(this.resourceManager, entityId, this.options);
    this._entityProxies.set(entityId, entityProxy);
    
    return entityProxy;
  }
  
  /**
   * Create StreamProxy for query result streaming
   * @param {Object} querySpec - Query specification with find and where clauses
   * @returns {StreamProxy} Stream proxy for continuous query monitoring
   */
  stream(querySpec) {
    this._validateNotDestroyed();
    
    // Use inherited validation method with "Query" context for stream error messages
    this._validateQuerySpec(querySpec, 'Query');
    
    return new StreamProxy(this.resourceManager, querySpec);
  }
  
  /**
   * Create CollectionProxy for entity collections
   * @param {Object} collectionSpec - Collection specification with find, where, and entityKey
   * @returns {CollectionProxy} Collection proxy for entity collection operations
   */
  collection(collectionSpec) {
    this._validateNotDestroyed();
    
    // Use inherited validation method
    this._validateQuerySpec(collectionSpec, 'Collection specification');
    
    if (!collectionSpec.entityKey) {
      throw new Error('Collection specification must have entityKey');
    }
    
    // Create CollectionProxy with options
    return new CollectionProxy(this.resourceManager, collectionSpec, this.options);
  }
  
  /**
   * Auto-detect appropriate proxy type and create proxy
   * @param {Object} querySpec - Query specification for type detection
   * @returns {EntityProxy|StreamProxy|CollectionProxy} Appropriate proxy type
   */
  query(querySpec) {
    this._validateNotDestroyed();
    
    // Use inherited validation method with "Query" context for auto-detection error messages
    this._validateQuerySpec(querySpec, 'Query');
    
    // Check for direct entity ID in query (entity query detection)
    // Only create EntityProxy if querying for entity attributes (find: ['?attr', '?value'])
    const entityId = this._extractEntityId(querySpec);
    if (entityId !== null && this._isEntityAttributeQuery(querySpec)) {
      return this.entity(entityId);
    }
    
    // Use ProxyTypeDetector to determine appropriate proxy type
    const detection = this.detector.detectProxyType(querySpec);
    
    switch (detection.type) {
      case 'EntityProxy':
        // This case shouldn't happen since we checked for entity ID above
        return this.stream(querySpec);
        
      case 'CollectionProxy':
        // Check if this is actually a single-entity collection query
        const entityKey = this._detectEntityKey(querySpec);
        if (entityKey && querySpec.find.length === 1 && querySpec.find[0] === entityKey) {
          // This is a collection query - entities only in find clause
          const collectionSpec = {
            ...querySpec,
            entityKey: entityKey
          };
          return this.collection(collectionSpec);
        }
        // Fall back to stream for multi-attribute queries
        return this.stream(querySpec);
        
      case 'StreamProxy':
      default:
        // Default to StreamProxy for complex or ambiguous queries
        return this.stream(querySpec);
    }
  }
  
  /**
   * Execute query directly on store without proxy wrapper
   * @param {Object} querySpec - Query specification
   * @returns {Array} Raw query results from store
   */
  queryStore(querySpec) {
    this._validateNotDestroyed();
    
    // Use inherited validation method
    this._validateQuerySpec(querySpec);
    
    // Execute query directly on store
    return this.store.query(querySpec);
  }
  
  /**
   * Update entity directly on store without proxy wrapper
   * @param {number} entityId - Entity ID to update
   * @param {Object} updateData - Update data
   * @returns {Object} Update result with success status
   */
  updateStore(entityId, updateData) {
    this._validateNotDestroyed();
    
    // Validate entity ID
    if (entityId === null || entityId === undefined) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    // Validate update data - match test expectations
    if (!updateData) {
      throw new Error('Update data is required');
    }
    
    if (typeof updateData !== 'object') {
      throw new Error('Update data must be an object');
    }
    
    try {
      // Execute update
      const result = this.store.updateEntity(entityId, updateData);
      
      // Return success wrapper with store result
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Execute query-with-update pattern
   * Updates are executed FIRST, then query sees the updated state
   * @param {Object} spec - Query-with-update specification
   * @returns {EntityProxy|StreamProxy|CollectionProxy} Appropriate proxy for query results
   */
  queryWithUpdate(spec) {
    this._validateNotDestroyed();
    
    if (!spec) {
      throw new Error('Query-with-update specification is required');
    }
    
    if (typeof spec !== 'object') {
      throw new Error('Query-with-update specification must be an object');
    }
    
    // Execute query-with-update on store
    const result = this.store.queryWithUpdate(spec);
    
    // Create appropriate proxy based on query results
    // Check if this is an entity query (single entity result)
    if (result.results.length === 1 && 
        Array.isArray(result.results[0]) && 
        result.results[0].length === 1 &&
        typeof result.results[0][0] === 'number') {
      // Single entity result - create EntityProxy
      return this.entity(result.results[0][0]);
    }
    
    // Check if this is a collection query (multiple entities)
    const entityKey = this._detectEntityKey({ find: spec.find, where: spec.where });
    if (entityKey && spec.find.length === 1 && spec.find[0] === entityKey) {
      // Collection of entities - create CollectionProxy
      const collectionSpec = {
        find: spec.find,
        where: spec.where,
        entityKey: entityKey
      };
      return this.collection(collectionSpec);
    }
    
    // Default to StreamProxy for all other cases
    return this.stream({
      find: spec.find,
      where: spec.where
    });
  }
  
  /**
   * Create global subscription
   * @param {Object} querySpec - Query specification
   * @param {Function} callback - Callback function for updates
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    
    // Validate parameters
    this._validateQuerySpec(querySpec);
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription through resourceManager
    const resourceSubscription = this.resourceManager.subscribe(querySpec, callback);
    
    // Create wrapper subscription that integrates with Handle's subscription tracking
    const wrapperSubscription = {
      id: resourceSubscription.id,
      unsubscribe: () => {
        this._subscriptions.delete(wrapperSubscription);
        resourceSubscription.unsubscribe();
      }
    };
    
    // Track subscription for cleanup
    this._subscriptions.add(wrapperSubscription);
    
    return wrapperSubscription;
  }
  
  /**
   * Get proxy statistics
   * @returns {Object} Proxy statistics and memory usage
   */
  getStats() {
    this._validateNotDestroyed();
    
    return {
      entityProxies: this._entityProxies.size,
      subscriptions: this._subscriptions.size
    };
  }
  
  
  /**
   * Destroy factory proxy and cleanup all resources
   */
  destroy() {
    if (!this.isDestroyed()) {
      // Destroy all cached entity proxies
      for (const entityProxy of this._entityProxies.values()) {
        if (typeof entityProxy.destroy === 'function') {
          entityProxy.destroy();
        }
      }
      this._entityProxies.clear();
      
      // Call parent destroy for subscription cleanup
      super.destroy();
    }
  }
  
  /**
   * Extract entity ID from query where clause
   * @param {Object} querySpec - Query specification
   * @returns {number|null} Entity ID if found, null otherwise
   * @private
   */
  _extractEntityId(querySpec) {
    const whereClause = querySpec.where;
    
    for (const pattern of whereClause) {
      if (Array.isArray(pattern) && pattern.length >= 3) {
        const entity = pattern[0];
        // If first element is a number, it's likely an entity ID
        if (typeof entity === 'number') {
          return entity;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if query is for entity attributes (not specific values)
   * @param {Object} querySpec - Query specification
   * @returns {boolean} True if this is an entity attribute query
   * @private
   */
  _isEntityAttributeQuery(querySpec) {
    const findClause = querySpec.find;
    const whereClause = querySpec.where;
    
    // Entity attribute queries ask for ALL attributes of an entity
    // Pattern: find: ['?attr', '?value'] where: [[entityId, '?attr', '?value']]
    if (findClause.length === 2) {
      const [var1, var2] = findClause;
      // Both should be variables
      if (typeof var1 === 'string' && var1.startsWith('?') &&
          typeof var2 === 'string' && var2.startsWith('?')) {
        // Check if where clause has pattern [entityId, ?attr, ?value]
        return whereClause.some(pattern => {
          if (Array.isArray(pattern) && pattern.length === 3) {
            const [entity, attr, value] = pattern;
            return typeof entity === 'number' && attr === var1 && value === var2;
          }
          return false;
        });
      }
    }
    
    return false;
  }
  
  /**
   * Detect entity key from query find clause
   * @param {Object} querySpec - Query specification  
   * @returns {string|null} Entity key if detected, null otherwise
   * @private
   */
  _detectEntityKey(querySpec) {
    const findClause = querySpec.find;
    const whereClause = querySpec.where;
    
    // Look for variables in find clause that appear as entity in where clause
    for (const variable of findClause) {
      if (typeof variable === 'string' && variable.startsWith('?')) {
        // Check if this variable appears as entity (first position) in where patterns
        const isEntityVariable = whereClause.some(pattern => {
          return Array.isArray(pattern) && pattern.length >= 3 && pattern[0] === variable;
        });
        
        if (isEntityVariable) {
          return variable;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Validate query specification
   * @param {Object} querySpec - Query specification to validate
   * @param {string} [context] - Context description for error messages
   * @throws {Error} If query specification is invalid
   * @private
   */
  _validateQuerySpec(querySpec, context = 'Query specification') {
    if (!querySpec) {
      // Use specific error message based on context
      if (context === 'Query') {
        throw new Error('Query specification is required');
      } else {
        throw new Error(`${context} is required`);
      }
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    // Validate query structure - use context-aware messages that match test expectations
    if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
      throw new Error(`${context} must have find clause`);
    }
    
    if (!querySpec.where) {
      throw new Error(`${context} must have where clause`);
    }
    
    if (!Array.isArray(querySpec.where)) {
      throw new Error('Where clause must be an array');
    }
  }
}