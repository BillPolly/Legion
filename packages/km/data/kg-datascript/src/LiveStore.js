import { createConn } from '../../datascript/src/core/conn.js';

/**
 * LiveStore - Manages live objects with DataScript backing
 * All operations work with actual objects, not IDs
 * Provides add/remove operations and transaction support
 */
export class LiveStore {
  constructor(dataScriptCore, identityManager) {
    if (!dataScriptCore) {
      throw new Error('DataScript core is required');
    }
    if (!identityManager) {
      throw new Error('Identity manager is required');
    }
    
    this._core = dataScriptCore;
    this._identityManager = identityManager;
    this._inTransaction = false;
    this._transactionOps = [];
    this._beforeTransactionState = null;
    
    // Proxy registry for cache invalidation
    this._proxyRegistry = new Map(); // objectId -> Set of proxies
  }

  /**
   * Add an object to the store
   * @param {Object} obj - The object to add
   * @returns {Object} Result with success, objectId, and entityId
   */
  add(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Cannot add non-object to store');
    }

    // Check if already registered
    let objectId = this._identityManager.getId(obj);
    if (objectId !== undefined) {
      // Check if object exists in DataScript
      const existingEntityId = this._getEntityId(objectId);
      if (existingEntityId !== null) {
        return {
          success: true,
          objectId,
          alreadyExists: true,
          entityId: existingEntityId
        };
      }
      // Object has ID but not in DataScript - continue with insertion
    }

    // Register object if not already registered
    if (objectId === undefined) {
      objectId = this._identityManager.register(obj);
    }

    // Check for circular references
    const hasCircularRef = this._hasCircularReference(obj);

    // Serialize object data
    let serializedData;
    try {
      serializedData = JSON.stringify(obj, this._getCircularReplacer());
    } catch (error) {
      serializedData = JSON.stringify({ 
        _error: 'Serialization failed',
        _type: obj.constructor.name
      });
    }

    // Build transaction data with individual properties
    const txData = [{
      ':db/id': -1,
      ':entity/id': objectId,
      ':entity/type': obj.type || obj.constructor.name,
      ':entity/data': serializedData
    }];
    
    // Add individual properties as separate attributes for querying
    // Skip internal/circular references
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, undefined, null, and complex objects
      if (typeof value === 'function' || 
          value === undefined || 
          value === null ||
          (typeof value === 'object' && value !== null && !(value instanceof Date))) {
        continue;
      }
      
      // Skip properties that are already handled
      if (key === 'type' || key === 'id') {
        continue;
      }
      
      // Add as entity attribute for querying
      const attrName = `:entity/${key}`;
      txData[0][attrName] = value;
    }

    const result = this._executeTransaction(txData);
    const entityId = result.tempids.get(-1);

    // Invalidate computed property caches in all proxies that might depend on store content
    this._invalidateAllProxyExternalDependencies();

    return {
      success: true,
      objectId,
      entityId,
      hasCircularRef
    };
  }

  /**
   * Add multiple objects in batch
   * @param {Array<Object>} objects - Array of objects to add
   * @returns {Array<Object>} Array of results
   */
  addBatch(objects) {
    if (!Array.isArray(objects)) {
      throw new Error('addBatch requires an array');
    }

    return objects.map(obj => this.add(obj));
  }

  /**
   * Remove an object from the store
   * @param {Object} obj - The object to remove
   * @returns {Object} Result with success and removed status
   */
  remove(obj) {
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) {
      return {
        success: false,
        notFound: true
      };
    }

    return this.removeById(objectId);
  }

  /**
   * Remove an object by its ID
   * @param {number} objectId - The object ID
   * @returns {Object} Result with success and removed status
   */
  removeById(objectId) {
    const obj = this._identityManager.getObject(objectId);
    if (!obj) {
      return {
        success: false,
        notFound: true
      };
    }

    // Find entity in DataScript
    const entityId = this._getEntityId(objectId);
    if (entityId) {
      // Retract the entity - we need to retract specific attributes
      // Get all attributes for this entity
      const entity = this._core.entity(entityId);
      if (entity) {
        const txData = [];
        // Retract each attribute
        for (const attr in entity) {
          if (attr.startsWith(':') && attr !== ':db/id') {
            txData.push(['-', entityId, attr, entity[attr]]);
          }
        }
        if (txData.length > 0) {
          this._executeTransaction(txData);
        }
      }
    }

    // Unregister from identity manager
    this._identityManager.unregister(obj);

    return {
      success: true,
      objectId,
      removed: true
    };
  }

  /**
   * Remove multiple objects in batch
   * @param {Array<Object>} objects - Array of objects to remove
   * @returns {Array<Object>} Array of results
   */
  removeBatch(objects) {
    if (!Array.isArray(objects)) {
      throw new Error('removeBatch requires an array');
    }

    return objects.map(obj => this.remove(obj));
  }

  /**
   * Update an existing object in the store
   * @param {Object} obj - The object to update
   * @returns {Object} Result with success and update status
   */
  update(obj) {
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) {
      return {
        success: false,
        notFound: true
      };
    }

    // Get entity ID
    const entityId = this._getEntityId(objectId);
    if (!entityId) {
      return {
        success: false,
        notFound: true
      };
    }

    // Serialize updated data
    let serializedData;
    try {
      serializedData = JSON.stringify(obj, this._getCircularReplacer());
    } catch (error) {
      serializedData = JSON.stringify({ 
        _error: 'Serialization failed',
        _type: obj.constructor.name
      });
    }

    // Update in DataScript
    const txData = [
      ['+', entityId, ':entity/data', serializedData],
      ['+', entityId, ':entity/type', obj.type || obj.constructor.name]
    ];
    
    // Update individual properties for querying
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, undefined, null, and complex objects
      if (typeof value === 'function' || 
          value === undefined || 
          value === null ||
          (typeof value === 'object' && value !== null && !(value instanceof Date))) {
        continue;
      }
      
      // Skip properties that are already handled
      if (key === 'type' || key === 'id') {
        continue;
      }
      
      // Update entity attribute
      const attrName = `:entity/${key}`;
      txData.push(['+', entityId, attrName, value]);
    }

    this._executeTransaction(txData);

    // Invalidate computed property caches in registered proxies
    this._invalidateProxyComputedCaches(objectId);

    return {
      success: true,
      objectId,
      updated: true
    };
  }

  /**
   * Get an object by its ID
   * @param {number} objectId - The object ID
   * @returns {Object|undefined} The object or undefined
   */
  getObject(objectId) {
    return this._identityManager.getObject(objectId);
  }

  /**
   * Check if an object exists in the store
   * @param {Object} obj - The object to check
   * @returns {boolean} True if exists
   */
  has(obj) {
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) return false;
    
    const entityId = this._getEntityId(objectId);
    return entityId !== null;
  }

  /**
   * Get all objects in the store
   * @returns {Array<Object>} Array of all objects
   */
  getAllObjects() {
    return this._identityManager.getAllObjects();
  }

  /**
   * Get the number of objects in the store
   * @returns {number} The count of objects
   */
  size() {
    return this._identityManager.size();
  }

  /**
   * Clear all objects from the store
   */
  clear() {
    // Re-initialize with empty database but same schema
    const schema = this._core.schema;
    // Create new connection with same schema
    this._core.conn = createConn(schema);
    
    // Clear identity manager
    this._identityManager.clear();
  }

  /**
   * Execute a transaction with automatic rollback on failure
   * @param {Function} fn - The transaction function
   * @returns {Object} Result with success and data or error
   */
  transaction(fn) {
    if (this._inTransaction) {
      // Handle nested transaction
      try {
        const result = fn();
        return {
          success: true,
          data: result
        };
      } catch (error) {
        throw error; // Propagate to parent transaction
      }
    }

    // Start transaction
    this._inTransaction = true;
    this._transactionOps = [];
    
    // Save current state for potential rollback
    const beforeDb = this._core.db();
    const beforeObjectIds = new Set(this._identityManager.getAllIds());

    try {
      const result = fn();
      
      // Commit successful
      this._inTransaction = false;
      this._transactionOps = [];
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // Rollback on failure
      this._rollback(beforeDb, beforeObjectIds);
      
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Query objects using a filter function
   * @param {Object} options - Query options with type and where clause
   * @returns {Array<Object>} Array of matching objects
   */
  queryObjects(options = {}) {
    const allObjects = this.getAllObjects();
    
    let results = allObjects;
    
    // Filter by type
    if (options.type) {
      results = results.filter(obj => 
        obj.type === options.type || 
        obj.constructor.name === options.type
      );
    }
    
    // Apply where clause
    if (options.where && typeof options.where === 'function') {
      results = results.filter(options.where);
    }
    
    return results;
  }

  /**
   * Execute a DataScript query
   * @param {Object} querySpec - DataScript query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    return this._core.q(querySpec);
  }

  /**
   * Register a proxy for an object to enable computed property cache invalidation
   * @param {Object} obj - The object
   * @param {Object} proxy - The proxy instance
   */
  registerProxy(obj, proxy) {
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) {
      throw new Error('Object must be in store before registering proxy');
    }

    if (!this._proxyRegistry.has(objectId)) {
      this._proxyRegistry.set(objectId, new Set());
    }
    
    this._proxyRegistry.get(objectId).add(proxy);
  }

  /**
   * Unregister a proxy for an object
   * @param {Object} obj - The object
   * @param {Object} proxy - The proxy instance
   */
  unregisterProxy(obj, proxy) {
    const objectId = this._identityManager.getId(obj);
    if (objectId === undefined) {
      return;
    }

    const proxies = this._proxyRegistry.get(objectId);
    if (proxies) {
      proxies.delete(proxy);
      if (proxies.size === 0) {
        this._proxyRegistry.delete(objectId);
      }
    }
  }

  // Private helper methods

  _getEntityId(objectId) {
    const results = this._core.q({
      find: ['?e'],
      where: [['?e', ':entity/id', objectId]]
    });
    
    return results.length > 0 ? results[0][0] : null;
  }

  _executeTransaction(txData) {
    if (this._inTransaction) {
      this._transactionOps.push(txData);
    }
    
    return this._core.transact(txData);
  }

  _rollback(beforeDb, beforeObjectIds) {
    // Restore database state by resetting the connection
    // DataScript is immutable, so we can just reset to the previous DB
    this._core.conn._db = beforeDb;
    
    // Remove any objects that were added during the failed transaction
    const currentIds = this._identityManager.getAllIds();
    for (const id of currentIds) {
      if (!beforeObjectIds.has(id)) {
        this._identityManager.unregisterById(id);
      }
    }
    
    this._inTransaction = false;
    this._transactionOps = [];
  }

  _invalidateProxyComputedCaches(objectId) {
    const proxies = this._proxyRegistry.get(objectId);
    if (!proxies) {
      return;
    }

    // For direct object updates, clear all computed property caches for that specific object
    for (const proxy of proxies) {
      if (proxy.clearAllComputedCache) {
        proxy.clearAllComputedCache();
      }
    }
  }

  /**
   * Invalidate computed property caches in all proxies that might depend on external store data
   * @private
   */
  _invalidateAllProxyExternalDependencies() {
    // Iterate through all registered proxies and invalidate external dependencies
    for (const proxies of this._proxyRegistry.values()) {
      for (const proxy of proxies) {
        if (proxy._invalidateExternalDependentProperties) {
          proxy._invalidateExternalDependentProperties();
        }
      }
    }
  }

  _hasCircularReference(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') {
      return false;
    }
    
    if (seen.has(obj)) {
      return true;
    }
    
    seen.add(obj);
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (this._hasCircularReference(obj[key], seen)) {
          return true;
        }
      }
    }
    
    return false;
  }

  _getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }
}