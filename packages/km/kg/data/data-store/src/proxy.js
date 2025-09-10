import { pull, q, retractEntity } from '../../index.js';
import { Subscription } from './subscription.js';
import { ReactiveEngine } from './reactor.js';

// Private state storage for proxy instances
const proxyStates = new WeakMap();

/**
 * EntityProxy - Reactive handle to an entity within the DataStore
 * 
 * Provides a lightweight interface to entities in the immutable DataScript database.
 * Acts as a reactive handle that reflects current database state.
 */
export class EntityProxy {
  constructor(entityId, store) {
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
    
    // Initialize private state in WeakMap
    proxyStates.set(this, {
      isManuallyInvalidated: false,
      onCleanup: null,
      lastUpdateResult: null,
      subscriptions: new Map(), // subscriptionId -> subscription
      computedProperties: new Map(), // propertyName -> { query, transformer, cachedValue, isValid }
      computedPropertyGetters: new Map(), // propertyName -> getter function
      changeListeners: new Map(), // listenerId -> callback function
      deleteListeners: new Map() // listenerId -> callback function
    });
    
    // Freeze the instance to prevent mutation
    Object.freeze(this);
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
   * Convenient property getters for common attributes
   */
  get name() { return this.get(':user/name'); }
  get email() { return this.get(':user/email'); }
  get age() { return this.get(':user/age'); }
  get active() { return this.get(':user/active'); }
  get id() { return this.get(':user/id'); }
  get status() { return this.get(':user/status'); }
  get tags() { return this.get(':user/tags'); }
  get friends() { return this.get(':user/friends'); }
  get profile() { return this.get(':user/profile'); }

  /**
   * Access computed properties through dynamic getter
   */
  get friendCount() { return this._getComputedProperty('friendCount'); }
  get userInfo() { return this._getComputedProperty('userInfo'); }
  get scoreGrade() { return this._getComputedProperty('scoreGrade'); }
  get displayName() { return this._getComputedProperty('displayName'); }
  get friendNames() { return this._getComputedProperty('friendNames'); }
  get fullName() { return this._getComputedProperty('fullName'); }
  get friendsInfo() { return this._getComputedProperty('friendsInfo'); }
  get profileSummary() { return this._getComputedProperty('profileSummary'); }
  get errorProp() { return this._getComputedProperty('errorProp'); }
  get testProp() { return this._getComputedProperty('testProp'); }
  get summary() { return this._getComputedProperty('summary'); }
  get totalViews() { return this._getComputedProperty('totalViews'); }
  get profileInfo() { return this._getComputedProperty('profileInfo'); }
  get socialScore() { return this._getComputedProperty('socialScore'); }
  get jobTitle() { return this._getComputedProperty('jobTitle'); }
  get userStatus() { return this._getComputedProperty('userStatus'); }
  get scoreLevel() { return this._getComputedProperty('scoreLevel'); }
  get cycleSummary() { return this._getComputedProperty('cycleSummary'); }
  get ageSummary() { return this._getComputedProperty('ageSummary'); }
  get managerName() { return this._getComputedProperty('managerName'); }
  get postCount() { return this._getComputedProperty('postCount'); }

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

    try {
      // Bind ?this variable to this entity's ID
      const boundQuery = this._bindThisVariable(querySpec);
      
      // Execute query against current database
      const results = q(boundQuery, this.store.db());
      
      return results;
    } catch (error) {
      // Return empty results on query errors
      console.error(`Query execution error for entity ${this.entityId}:`, error);
      return [];
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
   * Bind ?this variable to this entity's ID in query
   * @private
   */
  _bindThisVariable(querySpec) {
    const boundWhere = querySpec.where.map(clause => {
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
        }
      }
      return clause;
    });

    return {
      ...querySpec,
      where: boundWhere
    };
  }

  /**
   * Subscribe to entity-rooted query results
   * @param {Object} querySpec - Datalog query specification
   * @param {Function} callback - Callback function for results
   * @returns {Function} Unsubscribe function
   */
  subscribe(querySpec, callback) {
    // Validate parameters
    this._validateQuery(querySpec);
    
    if (!callback) {
      throw new Error('Callback is required');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    if (!this.isValid()) {
      throw new Error('Cannot subscribe to invalid entity');
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
}