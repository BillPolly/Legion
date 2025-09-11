import { pull, q, retractEntity } from '../../datascript/index.js';
import { Subscription } from './subscription.js';
import { ReactiveEngine } from './reactor.js';
import { PropertyTypeDetector } from './property-type-detector.js';
import { QueryTypeDetector } from './query-type-detector.js';

// Direct imports - circular imports will be resolved by ES modules
import { StreamProxy } from './stream-proxy.js';
import { CollectionProxy } from './collection-proxy.js';

// Private state storage for proxy instances
const proxyStates = new WeakMap();

/**
 * EntityProxy - Reactive handle to an entity within the DataStore
 * 
 * Provides a lightweight interface to entities in the immutable DataScript database.
 * Acts as a reactive handle that reflects current database state.
 */
export class EntityProxy {
  constructor(entityId, store, dataStoreProxy = null) {
    // Validate inputs
    if (!entityId && entityId !== 0) {
      throw new Error('Entity ID is required');
    }
    
    if (typeof entityId !== 'number') {
      throw new Error('Entity ID must be a number');
    }
    
    if (!store) {
      throw new Error('DataStore is required');
    }
    
    // Validate that store is actually a DataStore instance
    if (typeof store !== 'object' || !store.conn || !store.db || typeof store.db !== 'function') {
      throw new Error('DataStore is required');
    }
    
    // Store entity reference and store connection
    this.entityId = entityId;
    this.store = store;
    this.dataStoreProxy = dataStoreProxy;
    
    // Initialize PropertyTypeDetector for this EntityProxy
    this._propertyTypeDetector = new PropertyTypeDetector(store.schema || {});
    
    // Initialize QueryTypeDetector for this EntityProxy
    this._queryTypeDetector = new QueryTypeDetector(store);
    
    // Initialize private state in WeakMap
    proxyStates.set(this, {
      isManuallyInvalidated: false,
      onCleanup: null,
      lastUpdateResult: null,
      subscriptions: new Map(), // subscriptionId -> subscription
      computedProperties: new Map(), // propertyName -> { query, transformer, cachedValue, isValid }
      computedPropertyGetters: new Map(), // propertyName -> getter function
      changeListeners: new Map(), // listenerId -> callback function
      deleteListeners: new Map(), // listenerId -> callback function
      propertyProxies: new Map() // propertyName -> proxy instance (for identity preservation)
    });
    
    // Dynamically create property getters from schema BEFORE freezing
    this._setupDynamicProperties();
    
    // Create a Proxy to intercept property access for unknown attributes
    return new Proxy(this, {
      get(target, property) {
        // If property exists on target, use it
        if (property in target || typeof property === 'symbol') {
          const value = target[property];
          // If it's a method, bind it to the target to preserve 'this' context
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }
        
        // If it's a string property that could be an attribute, handle dynamically
        if (typeof property === 'string') {
          const state = proxyStates.get(target);
          if (!state) return undefined;
          
          // Check if we already have a proxy for this property (for identity preservation)
          if (state.propertyProxies.has(property)) {
            return state.propertyProxies.get(property);
          }
          
          // Handle both full attribute names and short property names
          let attribute = null;
          
          // First, check if property is already a full attribute name (e.g., ':user/score')
          if (property.includes('/') && target.store.schema && property in target.store.schema) {
            attribute = property;
          } else {
            // Try to find attribute in schema that matches this property name (short form)
            for (const schemaAttribute of Object.keys(target.store.schema || {})) {
              const parts = schemaAttribute.split('/');
              if (parts.length === 2 && parts[1] === property) {
                attribute = schemaAttribute;
                break;
              }
            }
          }
          
          // If not found in schema, assume it's an unknown attribute and default to StreamProxy
          if (!attribute) {
            // For unknown attributes, we can't construct a meaningful query, 
            // so return a StreamProxy with undefined value
            const unknownQuery = {
              find: ['?value'],
              where: [
                ['?entity', ':unknown/attribute', '?value'], // Dummy query
                ['?entity', ':db/id', target.entityId]
              ]
            };
            
            if (StreamProxy) {
              const unknownProxy = new StreamProxy(target.store, undefined, unknownQuery);
              state.propertyProxies.set(property, unknownProxy);
              return unknownProxy;
            } else {
              return undefined;
            }
          }
          
          // Get raw value using existing get() method
          const rawValue = target.get(attribute);
          
          // Create appropriate proxy object synchronously
          const proxyObject = target._createPropertyProxySync(attribute, rawValue);
          state.propertyProxies.set(property, proxyObject);
          return proxyObject;
        }
        
        return undefined;
      }
    });
  }

  /**
   * Check if this proxy represents a valid entity in the database
   */
  isValid() {
    const state = proxyStates.get(this);
    if (!state) return false;
    
    // If manually invalidated, always return false
    if (state.isManuallyInvalidated) {
      return false;
    }
    
    try {
      // Check if entity exists in current database state
      const entity = this.store.db().entity(this.entityId);
      return entity !== null && entity !== undefined;
    } catch (error) {
      // If there's an error checking entity existence, consider it invalid
      return false;
    }
  }

  /**
   * Delete this entity from the database and cleanup all resources
   */
  delete() {
    if (!this.isValid()) {
      return; // Already deleted or invalid, nothing to do
    }

    try {
      // Remove entity from database using DataScript retractEntity
      const newDB = retractEntity(this.store.db(), this.entityId);
      
      // Update store's database connection
      this.store.conn._db = newDB;
      
      // Cleanup all proxy resources
      this._cleanupAllResources();
      
      // Invalidate this proxy
      this._invalidate();
      
    } catch (error) {
      console.error(`Error deleting entity ${this.entityId}:`, error);
      // Even if deletion fails, still invalidate the proxy
      this._invalidate();
    }
  }

  /**
   * Cleanup all resources associated with this proxy
   * @private
   */
  _cleanupAllResources() {
    const state = proxyStates.get(this);
    if (!state) return;

    // Deactivate all subscriptions
    for (const subscription of state.subscriptions.values()) {
      subscription.deactivate();
      
      // Remove from store's reactive engine
      if (this.store._reactiveEngine) {
        this.store._reactiveEngine.removeSubscription(subscription.id);
      }
    }
    
    // Clear subscriptions map
    state.subscriptions.clear();
    
    // Clear computed properties
    state.computedProperties.clear();
    state.computedPropertyGetters.clear();
    
    // Clear event listeners (they'll be called one last time in _invalidate)
    // Note: We don't clear them here because _invalidate will trigger delete events
  }

  /**
   * Manually invalidate this proxy
   * Used when the underlying entity is deleted or proxy should be cleaned up
   */
  _invalidate() {
    const state = proxyStates.get(this);
    if (!state) return;
    
    if (!state.isManuallyInvalidated) {
      state.isManuallyInvalidated = true;
      
      // Trigger onDelete events before cleanup
      this._triggerDelete();
      
      // Clear event listeners after triggering delete events
      state.changeListeners.clear();
      state.deleteListeners.clear();
      
      // Call cleanup callback if set
      if (typeof state.onCleanup === 'function') {
        try {
          state.onCleanup();
        } catch (error) {
          // Ignore cleanup errors to prevent cascading failures
        }
      }
    }
  }

  /**
   * Get attribute value reactively from current database state
   * @param {string} attribute - The attribute name (e.g., ':user/name')
   * @returns {*} The attribute value or undefined if not found
   */
  get(attribute) {
    // If proxy is invalid, return undefined for all attributes
    if (!this.isValid()) {
      return undefined;
    }

    // Validate attribute parameter
    if (!attribute || typeof attribute !== 'string' || !attribute.startsWith(':')) {
      return undefined;
    }

    try {
      // Use DataScript pull to get current attribute value
      const result = pull(this.store.db(), [attribute], this.entityId);
      const value = result ? result[attribute] : undefined;
      
      
      if (value === undefined) {
        // Handle special case for many-cardinality refs that might be empty
        const attrSpec = this.store.schema[attribute];
        if (attrSpec && attrSpec.valueType === 'ref' && attrSpec.card === 'many') {
          return []; // Return empty array for unset many-cardinality refs
        }
        return undefined;
      }
      
      // Check if this is a ref attribute that should be converted to proxy objects
      const attrSpec = this.store.schema[attribute];
      if (attrSpec && attrSpec.valueType === 'ref') {
        if (attrSpec.card === 'many') {
          // Many-cardinality ref: convert array of entity IDs to array of proxies
          if (Array.isArray(value)) {
            return value.map(entityId => this._getOrCreateProxy(entityId));
          }
          return []; // Fallback to empty array
        } else {
          // Single ref: convert entity ID to proxy
          if (typeof value === 'number') {
            return this._getOrCreateProxy(value);
          } else if (value && typeof value === 'object' && typeof value.id === 'number') {
            // Component attribute: DataScript returned full entity object with id
            return this._getOrCreateProxy(value.id);
          }
          return undefined;
        }
      }
      
      // Non-ref attribute: return value as-is
      return value;
    } catch (error) {
      // Return undefined if there's any error accessing the attribute
      return undefined;
    }
  }

  /**
   * Get or create proxy for referenced entity (uses store registry)
   * @private
   */
  _getOrCreateProxy(entityId) {
    // Try to get existing proxy from store registry
    let proxy = this.store._getRegisteredProxy(entityId);
    
    if (!proxy) {
      // Create new proxy and register it
      proxy = new EntityProxy(entityId, this.store);
      this.store._registerProxy(entityId, proxy);
    }
    
    return proxy;
  }

  /**
   * Get all attributes for this entity as an object
   * @returns {Object} Object containing all attributes or empty object if entity invalid
   */
  getAll() {
    if (!this.isValid()) {
      return {};
    }

    try {
      // Use DataScript entity to get all attributes
      const entity = this.store.db().entity(this.entityId);
      return entity || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Create appropriate proxy object for a property based on PropertyTypeDetector
   * @private
   * @param {string} attribute - Full attribute name (e.g., ':user/name')
   * @param {*} rawValue - Raw value from DataScript
   * @returns {StreamProxy|EntityProxy|CollectionProxy} Appropriate proxy object
   */
  async _createPropertyProxy(attribute, rawValue) {
    const proxyType = this._propertyTypeDetector.detectProxyType(attribute);
    
    // Ensure proxy classes are loaded using dynamic imports
    if (!StreamProxy || !CollectionProxy) {
      try {
        const [streamProxyModule, collectionProxyModule] = await Promise.all([
          import('./stream-proxy.js'),
          import('./collection-proxy.js')
        ]);
        StreamProxy = streamProxyModule.StreamProxy;
        CollectionProxy = collectionProxyModule.CollectionProxy;
      } catch (error) {
        // If dynamic import fails, fall back to placeholder objects
        if (proxyType === 'StreamProxy') {
          return {
            value: () => rawValue,
            _currentValue: rawValue,
            query: () => { throw new Error('StreamProxy not fully loaded yet'); },
            subscribe: () => { throw new Error('StreamProxy not fully loaded yet'); }
          };
        } else {
          const arrayValue = Array.isArray(rawValue) ? rawValue : (rawValue === undefined ? [] : [rawValue]);
          return {
            value: () => arrayValue,
            length: arrayValue.length,
            query: () => { throw new Error('CollectionProxy not fully loaded yet'); },
            subscribe: () => { throw new Error('CollectionProxy not fully loaded yet'); }
          };
        }
      }
    }
    
    switch (proxyType) {
      case 'StreamProxy':
        // Create StreamProxy with entity-scoped query for this specific attribute
        const streamQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, rawValue, streamQuery);
        
      case 'CollectionProxy':
        // Create CollectionProxy with entity-scoped query for this specific attribute
        const collectionQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        // Ensure rawValue is an array for CollectionProxy
        let arrayValue;
        if (Array.isArray(rawValue)) {
          arrayValue = rawValue;
        } else if (rawValue === undefined) {
          arrayValue = [];
        } else {
          arrayValue = [rawValue];
        }
        return new CollectionProxy(this.store, arrayValue, collectionQuery);
        
      case 'EntityProxy':
        // For single references, if rawValue is available, create EntityProxy
        if (rawValue !== undefined && rawValue !== null) {
          if (typeof rawValue === 'number') {
            return this._getOrCreateProxy(rawValue);
          } else if (rawValue instanceof EntityProxy) {
            // rawValue is already an EntityProxy from get() method, return it directly
            return rawValue;
          } else if (rawValue && typeof rawValue === 'object' && typeof rawValue.id === 'number') {
            return this._getOrCreateProxy(rawValue.id);
          }
        }
        // For missing single references, return StreamProxy with undefined value
        const undefinedQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, undefined, undefinedQuery);
        
      default:
        // Fallback to StreamProxy for unknown types
        const defaultQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, rawValue, defaultQuery);
    }
  }

  /**
   * Create appropriate proxy type synchronously - assumes proxy classes are loaded
   * @private 
   * @param {string} attribute - Full attribute name (e.g., ':user/name')
   * @param {any} rawValue - Raw value from DataScript query
   * @returns {StreamProxy|EntityProxy|CollectionProxy} - Appropriate proxy type
   */
  _createPropertyProxySync(attribute, rawValue) {
    const proxyType = this._propertyTypeDetector.detectProxyType(attribute);
    
    switch (proxyType) {
      case 'StreamProxy':
        // Create StreamProxy with entity-scoped query for this specific attribute
        const streamQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, rawValue, streamQuery);
        
      case 'CollectionProxy':
        // Create CollectionProxy with entity-scoped query for this specific attribute
        const collectionQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        // Ensure rawValue is an array for CollectionProxy
        let arrayValue;
        if (Array.isArray(rawValue)) {
          arrayValue = rawValue;
        } else if (rawValue === undefined) {
          arrayValue = [];
        } else {
          arrayValue = [rawValue];
        }
        return new CollectionProxy(this.store, arrayValue, collectionQuery);
        
      case 'EntityProxy':
        // For single references, if rawValue is available, create EntityProxy
        if (rawValue !== undefined && rawValue !== null) {
          if (typeof rawValue === 'number') {
            return this._getOrCreateProxy(rawValue);
          } else if (rawValue instanceof EntityProxy) {
            // rawValue is already an EntityProxy from get() method, return it directly
            return rawValue;
          } else if (rawValue && typeof rawValue === 'object' && typeof rawValue.id === 'number') {
            return this._getOrCreateProxy(rawValue.id);
          }
        }
        // For missing single references, return StreamProxy with undefined value
        const undefinedQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, undefined, undefinedQuery);
        
      default:
        // Fallback to StreamProxy for unknown types
        const defaultQuery = {
          find: ['?value'],
          where: [
            ['?entity', attribute, '?value'],
            ['?entity', ':db/id', this.entityId]
          ]
        };
        return new StreamProxy(this.store, rawValue, defaultQuery);
    }
  }

  /**
   * Setup dynamic property getters based on schema
   * @private
   */
  _setupDynamicProperties() {
    // Only set up properties if we have a schema
    if (!this.store.schema) return;
    
    // Create getters for each attribute in the schema
    for (const [attribute, spec] of Object.entries(this.store.schema)) {
      // Extract property name from attribute (e.g., ':user/name' -> 'name')
      const parts = attribute.split('/');
      if (parts.length !== 2) continue; // Skip malformed attributes
      
      const propertyName = parts[1];
      
      // Skip if property already exists (e.g., from base class methods)
      if (propertyName in this) continue;
      
      // Define getter that returns appropriate proxy object
      // Use arrow function to preserve 'this' context
      Object.defineProperty(this, propertyName, {
        get: () => {
          const state = proxyStates.get(this);
          if (!state) return undefined;
          
          // Check if we already have a proxy for this property (for identity preservation)
          if (state.propertyProxies.has(propertyName)) {
            return state.propertyProxies.get(propertyName);
          }
          
          // Get raw value using existing get() method
          const rawValue = this.get(attribute);
          
          // Create appropriate proxy object
          const proxyObject = this._createPropertyProxySync(attribute, rawValue);
          
          // Cache the proxy for identity preservation
          state.propertyProxies.set(propertyName, proxyObject);
          
          return proxyObject;
        },
        enumerable: true,
        configurable: true
      });
    }
  }

  /**
   * Invalidate all property proxy caches when entity data changes
   * @private
   */
  _invalidatePropertyProxies() {
    const state = proxyStates.get(this);
    if (state) {
      // Before clearing the cache, refresh existing proxy instances
      for (const [propertyName, proxyInstance] of state.propertyProxies) {
        try {
          // For StreamProxy instances, update their current value
          if (proxyInstance && proxyInstance._currentValue !== undefined) {
            const attribute = this._getAttributeFromProperty(propertyName);
            if (attribute) {
              const newRawValue = this.get(attribute);
              proxyInstance._currentValue = newRawValue;
            }
          }
          // For CollectionProxy instances, update their current items  
          else if (proxyInstance && proxyInstance._currentItems !== undefined) {
            const attribute = this._getAttributeFromProperty(propertyName);
            if (attribute) {
              const newRawValue = this.get(attribute);
              const arrayValue = Array.isArray(newRawValue) ? newRawValue : (newRawValue === undefined ? [] : [newRawValue]);
              proxyInstance._currentItems = arrayValue;
            }
          }
        } catch (error) {
          // If refreshing fails, just continue - the proxy will be recreated when accessed next
          console.warn('Failed to refresh proxy instance:', error);
        }
      }
      
      // Clear the cache so new instances are created on next access
      state.propertyProxies.clear();
    }
  }

  /**
   * Get attribute name from property name by searching schema
   * @private
   */
  _getAttributeFromProperty(propertyName) {
    if (!this.store.schema) return null;
    
    for (const schemaAttribute of Object.keys(this.store.schema)) {
      const parts = schemaAttribute.split('/');
      if (parts.length === 2 && parts[1] === propertyName) {
        return schemaAttribute;
      }
    }
    return null;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const validityStatus = this.isValid() ? 'valid' : 'invalid';
    return `EntityProxy(id=${this.entityId}, ${validityStatus})`;
  }

  /**
   * JSON representation (useful for serialization)
   */
  toJSON() {
    return {
      type: 'EntityProxy',
      entityId: this.entityId,
      isValid: this.isValid()
    };
  }

  /**
   * Check if this proxy refers to the same entity as another proxy
   */
  equals(otherProxy) {
    return otherProxy instanceof EntityProxy && 
           otherProxy.entityId === this.entityId &&
           otherProxy.store === this.store;
  }

  /**
   * Update this entity with new attribute values
   * @param {Object} updateData - Object containing attribute updates
   * @returns {Object} Update result with transaction info
   */
  update(updateData) {
    // Validate input
    this._validateUpdateData(updateData);
    
    // Check if proxy is valid
    if (!this.isValid()) {
      throw new Error('Cannot update invalid entity');
    }
    
    // Create transaction data with proper handling of many-cardinality attributes
    const txData = [];
    
    // First, retract existing values for many-cardinality attributes to ensure replacement semantics
    for (const [attr, newValue] of Object.entries(updateData)) {
      const attrSpec = this.store.schema[attr];
      if (attrSpec && attrSpec.card === 'many') {
        // For many-cardinality attributes, first retract all existing values
        const existingValues = this.get(attr) || [];
        if (Array.isArray(existingValues) && existingValues.length > 0) {
          // If existing values are proxies, get their entity IDs
          const existingEntityIds = existingValues.map(val => 
            val instanceof EntityProxy ? val.entityId : val
          );
          
          // Retract existing values
          for (const existingValue of existingEntityIds) {
            txData.push(['-', this.entityId, attr, existingValue]);
          }
        }
      }
    }
    
    // Then add the update as a map transaction
    txData.push({
      ':db/id': this.entityId,
      ...updateData
    });
    
    // Perform transaction through store
    const result = this.store.conn.transact(txData);
    
    // Return transaction result (but also return proxy for chaining in some tests)
    const updateResult = {
      entityId: this.entityId,
      dbAfter: result.dbAfter,
      tempids: result.tempids,
      tx: result.tx
    };
    
    // Store last update result in private state
    const state = proxyStates.get(this);
    if (state) {
      state.lastUpdateResult = updateResult;
      
      // Invalidate all computed properties after update
      this._invalidateAllComputedProperties();
      
      // Invalidate property proxy caches since entity data has changed
      this._invalidatePropertyProxies();
      
      // Trigger onChange events
      this._triggerChange({
        type: 'update',
        attributes: Object.keys(updateData),
        updateData,
        result: updateResult
      });
    }
    
    return updateResult;
  }
  
  /**
   * Get the last update result (for method chaining tests)
   * @private - Only for testing method chaining
   */
  _getLastUpdateResult() {
    const state = proxyStates.get(this);
    return state ? state.lastUpdateResult : null;
  }

  /**
   * Validate update data
   * @private
   */
  _validateUpdateData(updateData) {
    if (!updateData) {
      throw new Error('Update data is required');
    }
    
    if (typeof updateData !== 'object' || Array.isArray(updateData)) {
      throw new Error('Update data must be an object');
    }
    
    // Validate attribute names
    for (const attr of Object.keys(updateData)) {
      if (attr === ':db/id') {
        throw new Error('Cannot update :db/id through proxy');
      }
      
      if (!attr.startsWith(':')) {
        throw new Error(`Attributes must start with ':'. Found: ${attr}`);
      }
    }
  }

  /**
   * Execute an entity-rooted query with ?this bound to this entity
   * @param {Object} querySpec - Datalog query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    // Validate query
    this._validateQuery(querySpec);
    
    // Check if proxy is valid
    if (!this.isValid()) {
      throw new Error('Cannot query invalid entity');
    }

    // Validate query attributes against schema
    if (!this._validateQueryAttributes(querySpec)) {
      // Malformed query - return StreamProxy with null
      return new StreamProxy(this.store, null, querySpec);
    }

    try {
      // Handle optional update field
      let tempids = null;
      let dbToQuery = this.store.db(); // Default to current database
      
      if (querySpec.update) {
        // Execute update through DataStoreProxy if available
        const dataStoreProxy = this.dataStoreProxy;
        if (dataStoreProxy) {
          const txResult = dataStoreProxy._executeUpdate(querySpec.update);
          tempids = txResult.tempids;
          // Use the updated database for the query
          dbToQuery = dataStoreProxy.dataStore.db();
        } else {
          throw new Error('Cannot execute updates without DataStoreProxy');
        }
      }
      
      // Prepare query spec - remove update field if present
      let processedQuerySpec = { ...querySpec };
      delete processedQuerySpec.update;
      
      // Bind tempids to query variables if needed
      if (tempids && this.dataStoreProxy) {
        processedQuerySpec = this.dataStoreProxy._bindTempids(processedQuerySpec, tempids);
      }
      
      // Bind ?this variable to this entity's ID
      const boundQuery = this._bindThisVariable(processedQuerySpec);
      
      // Execute query against the appropriate database (updated if there was an update)
      const results = q(boundQuery, dbToQuery);
      
      // Determine appropriate proxy type based on query and results
      const proxyType = this._queryTypeDetector.detectProxyType(boundQuery, results);
      
      // Create and return appropriate proxy object
      return this._createQueryResultProxy(proxyType, boundQuery, results);
    } catch (error) {
      // For query errors, return appropriate empty proxy based on expected result type
      console.error(`Query execution error for entity ${this.entityId}:`, error);
      
      try {
        // Try to detect proxy type from query structure even without results
        const proxyType = this._queryTypeDetector.detectProxyType(querySpec, []);
        return this._createQueryResultProxy(proxyType, querySpec, []);
      } catch (detectionError) {
        // Fallback to StreamProxy with null value for complete failures
        return new StreamProxy(this.store, null, querySpec, this.dataStoreProxy);
      }
    }
  }

  /**
   * Validate query structure
   * @private
   */
  _validateQuery(querySpec) {
    if (!querySpec) {
      throw new Error('Query is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query must be an object');
    }
    
    if (!querySpec.find || !querySpec.where) {
      throw new Error('Query must have find and where clauses');
    }
    
    if (!Array.isArray(querySpec.find) || !Array.isArray(querySpec.where)) {
      throw new Error('Find and where clauses must be arrays');
    }
  }

  /**
   * Validate query attributes against schema
   * @private
   */
  _validateQueryAttributes(querySpec) {
    if (!this.store.schema) return true; // No schema to validate against
    
    const whereClause = querySpec.where || [];
    for (const clause of whereClause) {
      if (Array.isArray(clause) && clause.length >= 2) {
        const attribute = clause[1];
        if (typeof attribute === 'string') {
          // Check for malformed attributes
          if (!attribute.startsWith(':') && !attribute.startsWith('?')) {
            return false; // Not a valid attribute or variable
          }
          
          // If it's an attribute (starts with ':'), check schema
          if (attribute.startsWith(':') && !this.store.schema[attribute]) {
            return false; // Invalid attribute not in schema
          }
          
          // Check for obviously malformed attributes like '???'
          if (attribute === '???' || attribute.match(/^\?{2,}/)) {
            return false; // Malformed attribute
          }
        }
      }
    }
    return true;
  }

  /**
   * Bind ?this variable to this entity's ID in query
   * @private
   */
  _bindThisVariable(querySpec) {
    // Deep clone to avoid mutations
    const boundQuery = JSON.parse(JSON.stringify(querySpec));
    
    // Special handling: if find clause contains ?this as the only variable,
    // we need to ensure it returns the entity that matches both the constraints
    // AND this entity's ID
    if (boundQuery.find && boundQuery.find.length === 1 && boundQuery.find[0] === '?this') {
      // Replace ?this with the entity ID directly in find clause
      // This ensures we return this specific entity if it matches the constraints
      boundQuery.find = [this.entityId];
      
      // Replace ?this references in where clauses with this entity's ID
      boundQuery.where = boundQuery.where.map(clause => {
        if (Array.isArray(clause)) {
          return clause.map(term => term === '?this' ? this.entityId : term);
        }
        return clause;
      });
    } else {
      // Standard binding - replace ?this in where clauses only
      const boundWhere = boundQuery.where.map(clause => {
        if (Array.isArray(clause)) {
          // Handle different clause types
          if (clause.length >= 3 && typeof clause[0] !== 'function') {
            // Regular datom pattern: [e, a, v] or [e, a, v, tx]
            return clause.map(term => {
              if (term === '?this') {
                return this.entityId;
              }
              return term;
            });
          } else if (clause.length >= 2 && typeof clause[0] === 'function') {
            // Predicate clause: [predicate-fn, ...vars]
            return clause.map((term, index) => {
              if (index === 0) return term; // Keep predicate function as-is
              if (term === '?this') {
                return this.entityId;
              }
              return term;
            });
          } else if (clause.length === 2 && typeof clause[0] === 'string' && clause[0].startsWith('(')) {
            // Function expression clause: ['(> ?age 18)', '?result']
            // Replace ?this in the function expression string and bind it as a predicate
            const functionExpr = clause[0].replace(/\?this/g, this.entityId);
            // Convert to proper predicate format - DataScript expects [predicate-expr result-var]
            return [functionExpr, clause[1]];
          }
        }
        return clause;
      });
      
      boundQuery.where = boundWhere;
    }

    return boundQuery;
  }

  /**
   * Create appropriate proxy object for query results
   * @private
   */
  _createQueryResultProxy(proxyType, querySpec, results) {
    if (proxyType === 'StreamProxy') {
      // Extract single value from results
      const value = this._extractSingleValueFromResults(results);
      return new StreamProxy(this.store, value, querySpec, this.dataStoreProxy);
    } else if (proxyType === 'CollectionProxy') {
      // Extract collection from results and convert entities to EntityProxy instances
      const items = this._extractCollectionFromResults(results, querySpec);
      return new CollectionProxy(this.store, items, querySpec, this.dataStoreProxy);
    } else if (proxyType === 'EntityProxy') {
      // Extract single entity ID and create EntityProxy
      const entityId = this._extractSingleEntityIdFromResults(results);
      if (entityId !== null && entityId !== undefined) {
        return new EntityProxy(entityId, this.store, this.dataStoreProxy);
      } else {
        // Return StreamProxy with null for missing entity reference
        return new StreamProxy(this.store, null, querySpec, this.dataStoreProxy);
      }
    } else {
      // Fallback to StreamProxy
      const value = this._extractSingleValueFromResults(results);
      return new StreamProxy(this.store, value, querySpec, this.dataStoreProxy);
    }
  }

  /**
   * Extract single value from DataScript query results
   * @private
   */
  _extractSingleValueFromResults(results) {
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
  _extractCollectionFromResults(results, querySpec) {
    if (!results || results.length === 0) {
      return [];
    }
    
    // Analyze query to determine if result should be entity proxies
    const analysis = this._queryTypeDetector.analyzeQuery(querySpec);
    
    if (querySpec.find.length === 1) {
      // Single variable query - check if it's entity results
      const variable = querySpec.find[0];
      
      // Check if this variable represents entities in the query
      const isEntityQuery = this._queryTypeDetector._isEntityVariable(variable, querySpec.where);
      
      if (isEntityQuery) {
        // Convert entity IDs to EntityProxy instances
        return results.map(result => {
          const entityId = Array.isArray(result) ? result[0] : result;
          if (typeof entityId === 'number') {
            return new EntityProxy(entityId, this.store);
          }
          return entityId;
        });
      }
    }
    
    // For multi-variable queries, return tuples as-is
    if (querySpec.find.length > 1) {
      return results.map(result => Array.isArray(result) ? result : [result]);
    }
    
    // For scalar queries, extract first value from each result tuple
    return results.map(result => Array.isArray(result) ? result[0] : result);
  }

  /**
   * Extract single entity ID from DataScript query results
   * @private
   */
  _extractSingleEntityIdFromResults(results) {
    if (!results || results.length === 0) {
      return null;
    }
    
    // Single result with entity ID
    if (results.length === 1 && results[0].length === 1) {
      const value = results[0][0];
      return (typeof value === 'number') ? value : null;
    }
    
    // Multiple results - return first entity ID
    const firstResult = results[0];
    if (firstResult && firstResult.length > 0) {
      const value = firstResult[0];
      return (typeof value === 'number') ? value : null;
    }
    
    return null;
  }

  /**
   * Subscribe to entity changes or entity-rooted query results
   * @param {Object|Function} querySpecOrCallback - Datalog query specification or callback function for general entity changes
   * @param {Function} [callback] - Callback function for query results (when first param is querySpec)
   * @returns {Function} Unsubscribe function
   */
  subscribe(querySpecOrCallback, callback) {
    if (!this.isValid()) {
      throw new Error('Cannot subscribe to invalid entity');
    }

    // Handle two usage patterns:
    // 1. subscribe(callback) - general entity change subscription
    // 2. subscribe(querySpec, callback) - entity-rooted query subscription
    
    if (typeof querySpecOrCallback === 'function' && !callback) {
      // Pattern 1: Direct entity change subscription
      return this._subscribeToEntityChanges(querySpecOrCallback);
    } else if (typeof querySpecOrCallback === 'object' && typeof callback === 'function') {
      // Pattern 2: Entity-rooted query subscription
      return this._subscribeToQuery(querySpecOrCallback, callback);
    } else {
      throw new Error('Invalid subscription parameters. Use subscribe(callback) or subscribe(querySpec, callback)');
    }
  }

  /**
   * Subscribe to general entity changes
   * @param {Function} callback - Callback function for entity changes
   * @returns {Function} Unsubscribe function
   */
  _subscribeToEntityChanges(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const state = proxyStates.get(this);
    if (!state) {
      throw new Error('Cannot subscribe to invalid entity proxy');
    }

    // Initialize subscriber set if needed
    if (!state.entitySubscribers) {
      state.entitySubscribers = new Set();
    }

    // Add callback to subscriber set
    state.entitySubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      if (state.entitySubscribers) {
        state.entitySubscribers.delete(callback);
      }
    };
  }

  /**
   * Subscribe to entity-rooted query results
   * @param {Object} querySpec - Datalog query specification
   * @param {Function} callback - Callback function for results
   * @returns {Function} Unsubscribe function
   */
  _subscribeToQuery(querySpec, callback) {
    // Validate parameters
    this._validateQuery(querySpec);
    
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Generate unique subscription ID
    const subscriptionId = `${this.entityId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create subscription
    const subscription = new Subscription(subscriptionId, querySpec, callback, this.entityId);
    
    // Store subscription in proxy state
    const state = proxyStates.get(this);
    if (state) {
      state.subscriptions.set(subscriptionId, subscription);
    }
    
    // Register with store's reactive engine if available
    if (this.store._reactiveEngine) {
      this.store._reactiveEngine.addSubscription(subscription);
    }
    
    // Return unsubscribe function
    return () => {
      this._unsubscribe(subscriptionId);
    };
  }

  /**
   * Unsubscribe from a specific subscription
   * @private
   */
  _unsubscribe(subscriptionId) {
    const state = proxyStates.get(this);
    if (!state) return;

    const subscription = state.subscriptions.get(subscriptionId);
    if (subscription) {
      // Deactivate subscription
      subscription.deactivate();
      
      // Remove from proxy state
      state.subscriptions.delete(subscriptionId);
      
      // Remove from store's reactive engine if available
      if (this.store._reactiveEngine) {
        this.store._reactiveEngine.removeSubscription(subscriptionId);
      }
    }
  }

  /**
   * Get count of active subscriptions for this proxy
   * @private - For testing
   */
  _getActiveSubscriptionCount() {
    const state = proxyStates.get(this);
    if (!state) return 0;
    
    let activeCount = 0;
    for (const subscription of state.subscriptions.values()) {
      if (subscription.isActive()) {
        activeCount++;
      }
    }
    return activeCount;
  }

  /**
   * Execute initial query for a subscription (for testing)
   * @private - For testing
   */
  _executeInitialQuery(subscriptionId) {
    const state = proxyStates.get(this);
    if (!state) return;

    const subscription = state.subscriptions.get(subscriptionId);
    if (subscription && subscription.isActive()) {
      try {
        // Execute the query
        const results = this.query(subscription.query);
        
        // Notify with initial results
        subscription.notify(results, { initial: true });
      } catch (error) {
        console.error(`Error executing initial query for subscription ${subscriptionId}:`, error);
      }
    }
  }

  /**
   * Trigger a specific subscription manually (for testing)
   * @private - For testing
   */
  _triggerSubscription(subscriptionId, results, changes) {
    const state = proxyStates.get(this);
    if (!state) return;

    // Don't trigger subscriptions if proxy is invalid
    if (!this.isValid()) return;

    // If subscriptionId is a string but not a real ID, trigger all subscriptions
    if (typeof subscriptionId === 'string' && !state.subscriptions.has(subscriptionId)) {
      for (const subscription of state.subscriptions.values()) {
        if (subscription.isActive()) {
          try {
            subscription.notify(results, changes);
          } catch (error) {
            // Ignore callback errors
          }
        }
      }
      return;
    }

    const subscription = state.subscriptions.get(subscriptionId);
    if (subscription && subscription.isActive()) {
      subscription.notify(results, changes);
    }
  }

  /**
   * Define a computed property based on an entity-rooted query
   * @param {string} propertyName - Name of the computed property
   * @param {Object} querySpec - Datalog query specification
   * @param {Function} transformer - Function to transform query results to property value
   */
  computed(propertyName, querySpec, transformer) {
    // Validate parameters
    if (!propertyName || typeof propertyName !== 'string') {
      throw new Error('Property name is required and must be a string');
    }
    
    if (!querySpec) {
      throw new Error('Query is required');
    }
    
    this._validateQuery(querySpec);
    
    if (!transformer) {
      throw new Error('Transformer function is required');
    }
    
    if (typeof transformer !== 'function') {
      throw new Error('Transformer must be a function');
    }
    
    if (!this.isValid()) {
      throw new Error('Cannot define computed property on invalid entity');
    }

    const state = proxyStates.get(this);
    if (!state) return;

    // Check if property already exists
    if (state.computedProperties.has(propertyName)) {
      throw new Error(`Computed property '${propertyName}' already exists`);
    }

    // Store computed property definition
    state.computedProperties.set(propertyName, {
      query: querySpec,
      transformer,
      cachedValue: undefined,
      isValid: false
    });

    // Create getter function
    const getter = () => this._getComputedProperty(propertyName);
    state.computedPropertyGetters.set(propertyName, getter);

    // Define property on this instance using Object.defineProperty
    // We can't modify the frozen object directly, but we can define new properties
    try {
      Object.defineProperty(this, propertyName, {
        get: getter,
        enumerable: true,
        configurable: true
      });
    } catch (error) {
      // If we can't define the property directly, store the getter for manual access
      console.warn(`Could not define computed property '${propertyName}' directly:`, error.message);
    }
  }

  /**
   * Get computed property value (with caching)
   * @private
   */
  _getComputedProperty(propertyName) {
    const state = proxyStates.get(this);
    if (!state) return undefined;

    const propDef = state.computedProperties.get(propertyName);
    if (!propDef) return undefined;

    // Return cached value if still valid
    if (propDef.isValid) {
      return propDef.cachedValue;
    }

    try {
      // Execute query and transform result
      const queryResults = this.query(propDef.query);
      const transformedValue = propDef.transformer(queryResults);
      
      // Cache the result
      propDef.cachedValue = transformedValue;
      propDef.isValid = true;
      
      return transformedValue;
    } catch (error) {
      console.error(`Error computing property '${propertyName}':`, error);
      return undefined;
    }
  }

  /**
   * Invalidate computed property cache
   * @param {string} propertyName - Name of property to invalidate
   * @private - For testing
   */
  _invalidateComputedProperty(propertyName) {
    const state = proxyStates.get(this);
    if (!state) return;

    const propDef = state.computedProperties.get(propertyName);
    if (propDef) {
      propDef.isValid = false;
      propDef.cachedValue = undefined;
    }
  }

  /**
   * Invalidate all computed properties
   * @private
   */
  _invalidateAllComputedProperties() {
    const state = proxyStates.get(this);
    if (!state) return;

    for (const propDef of state.computedProperties.values()) {
      propDef.isValid = false;
      propDef.cachedValue = undefined;
    }
  }

  /**
   * Remove a computed property
   * @param {string} propertyName - Name of property to remove
   * @returns {boolean} True if property was removed, false if not found
   */
  removeComputed(propertyName) {
    const state = proxyStates.get(this);
    if (!state) return false;

    if (!state.computedProperties.has(propertyName)) {
      return false;
    }

    // Remove from storage
    state.computedProperties.delete(propertyName);
    state.computedPropertyGetters.delete(propertyName);

    try {
      // Try to delete property descriptor
      delete this[propertyName];
    } catch (error) {
      // Ignore errors - property might not be deletable
    }

    return true;
  }

  /**
   * Add a relationship to this entity
   * @param {string} attribute - Relationship attribute (e.g., ':user/friends')
   * @param {EntityProxy|number} target - Target entity (proxy or entity ID)
   */
  addRelation(attribute, target) {
    // Validate parameters
    this._validateRelationshipParams(attribute, target);
    
    if (!this.isValid()) {
      throw new Error('Cannot modify relationships on invalid entity');
    }

    // Get entity ID from target
    const targetEntityId = target instanceof EntityProxy ? target.entityId : target;
    
    // Check if relationship already exists to avoid duplicates
    const currentValue = this.get(attribute);
    const attrSpec = this.store.schema[attribute];
    
    if (attrSpec && attrSpec.card === 'many') {
      // Many-cardinality: check if target is already in array
      if (Array.isArray(currentValue)) {
        const exists = currentValue.some(item => {
          const itemId = item instanceof EntityProxy ? item.entityId : item;
          return itemId === targetEntityId;
        });
        if (exists) {
          return; // Already exists, no need to add
        }
      }
    } else {
      // Single cardinality: check if already set to this value
      if (currentValue) {
        const currentId = currentValue instanceof EntityProxy ? currentValue.entityId : currentValue;
        if (currentId === targetEntityId) {
          return; // Already set to this value
        }
      }
    }
    
    // Perform transaction to add relationship
    this.store.conn.transact([
      ['+', this.entityId, attribute, targetEntityId]
    ]);
    
    // Invalidate computed properties since data changed
    this._invalidateAllComputedProperties();
    
    // Invalidate property proxy caches since data has changed
    this._invalidatePropertyProxies();
    
    // Trigger onChange event
    this._triggerChange({
      type: 'relationAdded',
      attribute,
      targetEntityId,
      target
    });
  }

  /**
   * Remove a relationship from this entity
   * @param {string} attribute - Relationship attribute (e.g., ':user/friends')
   * @param {EntityProxy|number} target - Target entity (proxy or entity ID)
   */
  removeRelation(attribute, target) {
    // Validate parameters
    this._validateRelationshipParams(attribute, target);
    
    if (!this.isValid()) {
      throw new Error('Cannot modify relationships on invalid entity');
    }

    // Get entity ID from target
    const targetEntityId = target instanceof EntityProxy ? target.entityId : target;
    
    // Perform transaction to remove relationship
    this.store.conn.transact([
      ['-', this.entityId, attribute, targetEntityId]
    ]);
    
    // Invalidate computed properties since data changed
    this._invalidateAllComputedProperties();
    
    // Invalidate property proxy caches since data has changed
    this._invalidatePropertyProxies();
    
    // Trigger onChange event
    this._triggerChange({
      type: 'relationRemoved',
      attribute,
      targetEntityId,
      target
    });
  }

  /**
   * Validate relationship management parameters
   * @private
   */
  _validateRelationshipParams(attribute, target) {
    if (!attribute) {
      throw new Error('Attribute is required');
    }
    
    if (typeof attribute !== 'string' || !attribute.startsWith(':')) {
      throw new Error('Attribute must start with \':\' and be a string');
    }
    
    if (!target && target !== 0) {
      throw new Error('Target entity is required');
    }
    
    if (!(target instanceof EntityProxy) && typeof target !== 'number') {
      throw new Error('Target must be EntityProxy or entity ID');
    }
    
    // Check if attribute is actually a reference type in schema
    const attrSpec = this.store.schema[attribute];
    if (attrSpec && attrSpec.valueType !== 'ref') {
      throw new Error('Attribute must be a reference type (valueType: \'ref\')');
    }
  }

  /**
   * Register a callback for entity change events
   * @param {Function} callback - Callback function to call when entity changes
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    if (!this.isValid()) {
      throw new Error('Cannot add event listener to invalid entity');
    }

    const state = proxyStates.get(this);
    if (!state) return () => {};

    // Generate unique listener ID
    const listenerId = `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store callback
    state.changeListeners.set(listenerId, callback);
    
    // Return unsubscribe function
    return () => {
      state.changeListeners.delete(listenerId);
    };
  }

  /**
   * Register a callback for entity deletion events
   * @param {Function} callback - Callback function to call when entity is deleted
   * @returns {Function} Unsubscribe function
   */
  onDelete(callback) {
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    if (!this.isValid()) {
      throw new Error('Cannot add event listener to invalid entity');
    }

    const state = proxyStates.get(this);
    if (!state) return () => {};

    // Generate unique listener ID
    const listenerId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store callback
    state.deleteListeners.set(listenerId, callback);
    
    // Return unsubscribe function
    return () => {
      state.deleteListeners.delete(listenerId);
    };
  }

  /**
   * Trigger change events (for testing and internal use)
   * @private
   */
  _triggerChange(changeInfo) {
    if (!this.isValid()) return;

    const state = proxyStates.get(this);
    if (!state) return;

    // Notify all change listeners
    for (const callback of state.changeListeners.values()) {
      try {
        callback(changeInfo);
      } catch (error) {
        console.error('Error in onChange listener:', error);
      }
    }
  }

  /**
   * Trigger delete events (for testing and internal use)
   * @private
   */
  _triggerDelete() {
    const state = proxyStates.get(this);
    if (!state) return;

    // Notify all delete listeners
    for (const callback of state.deleteListeners.values()) {
      try {
        callback();
      } catch (error) {
        console.error('Error in onDelete listener:', error);
      }
    }
  }

  /**
   * Get total count of event listeners (for testing)
   * @private
   */
  _getEventListenerCount() {
    const state = proxyStates.get(this);
    if (!state) return 0;
    
    return state.changeListeners.size + state.deleteListeners.size;
  }

  /**
   * Test helper method to set cleanup callback
   * @private - Only for testing
   */
  _setCleanupCallback(callback) {
    const state = proxyStates.get(this);
    if (state) {
      state.onCleanup = callback;
    }
  }

  /**
   * Get JavaScript representation of entity with expanded references
   * Part of unified proxy architecture - Phase 2, Step 2.3
   * 
   * @param {Object} options - Options for value extraction
   * @param {number} options.depth - Maximum depth for reference expansion (default: 10)
   * @param {boolean} options.includeRefs - Whether to expand references (default: true)
   * @param {Set} options._visited - Internal: Track visited entities to prevent infinite loops
   * @returns {Object} Plain JavaScript object representation
   */
  value(options = {}) {
    const {
      depth = 10,
      includeRefs = true,
      _visited = new Set()
    } = options;
    
    // Prevent infinite loops from circular references
    if (_visited.has(this.entityId)) {
      return this.entityId; // Return just the ID for circular refs
    }
    _visited.add(this.entityId);
    
    // Start with entityId
    const result = {
      entityId: this.entityId
    };
    
    // Get entity data from database
    const db = this.store.db();
    const entityData = db.entity(this.entityId);
    
    if (!entityData) {
      return result; // Entity doesn't exist
    }
    
    // Process each attribute
    for (const [attr, value] of Object.entries(entityData)) {
      // Skip internal attributes
      if (attr === 'id' || attr === ':db/id') {
        continue;
      }
      
      // Get schema info for this attribute
      const schemaInfo = this.store.schema[attr];
      
      if (!schemaInfo) {
        // Unknown attribute - include as-is
        result[attr] = value;
        continue;
      }
      
      // Handle based on value type
      if (schemaInfo.valueType === 'ref') {
        if (!includeRefs || depth <= 0) {
          // Don't expand references
          result[attr] = value;
        } else if (schemaInfo.card === 'many') {
          // Multi-valued reference
          if (Array.isArray(value) && value.length > 0) {
            result[attr] = value.map(refId => {
              // Check if this creates a circular reference
              if (_visited.has(refId)) {
                return refId; // Just return the ID
              }
              
              // Create proxy for referenced entity and get its value
              const refProxy = new EntityProxy(refId, this.store);
              return refProxy.value({
                depth: depth - 1,
                includeRefs,
                _visited // Pass same set to detect circular references
              });
            });
          }
        } else {
          // Single-valued reference
          if (value != null) {
            // Check if this creates a circular reference
            if (_visited.has(value)) {
              result[attr] = value; // Just return the ID
            } else {
              // Create proxy for referenced entity and get its value
              const refProxy = new EntityProxy(value, this.store);
              result[attr] = refProxy.value({
                depth: depth - 1,
                includeRefs,
                _visited // Pass same set to detect circular references
              });
            }
          }
        }
      } else if (schemaInfo.valueType === 'instant' && value instanceof Date) {
        // Clone Date objects
        result[attr] = new Date(value.getTime());
      } else if (schemaInfo.card === 'many' && Array.isArray(value)) {
        // Multi-valued scalar - clone array
        result[attr] = [...value];
      } else {
        // Regular scalar value
        result[attr] = value;
      }
    }
    
    return result;
  }

  /**
   * Clean up proxy resources and subscriptions
   * Does not delete the entity from database - just cleans up the proxy
   */
  destroy() {
    const state = proxyStates.get(this);
    if (!state) {
      return; // Already destroyed or not initialized
    }

    try {
      // Clean up subscription engine if it exists
      if (state.subscriptionEngine) {
        state.subscriptionEngine.destroy();
        state.subscriptionEngine = null;
      }

      // Clear property proxy references (but don't destroy them - they are independent once handed out)
      state.propertyProxies.clear();

      // Clean up entity change subscribers
      if (state.entitySubscribers) {
        state.entitySubscribers.clear();
      }

      // Clean up query subscriptions
      if (state.subscriptions) {
        for (const subscription of state.subscriptions.values()) {
          try {
            if (this.store._reactiveEngine) {
              this.store._reactiveEngine.removeSubscription(subscription.id);
            }
          } catch (error) {
            console.warn('Error removing subscription:', error);
          }
        }
        state.subscriptions.clear();
      }

      // Mark as manually invalidated to prevent further use
      state.isManuallyInvalidated = true;

      // Remove from global proxy states
      proxyStates.delete(this);

    } catch (error) {
      console.error('Error during EntityProxy destroy:', error);
    }
  }

  /**
   * Get subscribers (for compatibility with StreamProxy/CollectionProxy tests)
   * @returns {Set} Set of entity change subscribers
   */
  get _subscribers() {
    const state = proxyStates.get(this);
    if (!state || !state.entitySubscribers) {
      return new Set(); // Return empty set for compatibility
    }
    return state.entitySubscribers;
  }

  /**
   * Notify entity change subscribers (for compatibility with StreamProxy/CollectionProxy tests)
   * @param {*} data - Data to pass to subscribers
   */
  _notifySubscribers(data) {
    const state = proxyStates.get(this);
    if (!state || !state.entitySubscribers) {
      return;
    }

    for (const callback of state.entitySubscribers) {
      try {
        callback(data);
      } catch (error) {
        console.error('EntityProxy subscriber callback error:', error);
      }
    }
  }
}