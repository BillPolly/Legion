import { BaseHandle, TypeHandleRegistry } from '@legion/handles';
import { QueryEngine } from './QueryEngine.js';

/**
 * KGEntityHandle - Handle-based wrapper for objects in the KG-DataScript system
 * 
 * Provides transparent access to object properties while maintaining integration
 * with the live store and identity management system. Objects accessed through
 * this handle maintain their identity and relationship to the underlying DataScript
 * database while providing Actor framework integration and remote capabilities.
 */
export class KGEntityHandle extends BaseHandle {
  constructor(target, store, identityManager) {
    // Validate inputs
    if (target === null || target === undefined) {
      throw new Error('Object cannot be null or undefined');
    }

    if (typeof target !== 'object') {
      throw new Error('Target must be an object');
    }

    if (!store) {
      throw new Error('Store is required');
    }

    if (!identityManager) {
      throw new Error('IdentityManager is required');
    }

    // Verify object is in store
    const objectId = identityManager.getId(target);
    if (!objectId) {
      throw new Error('Object must be added to store before creating handle');
    }

    // Initialize BaseHandle
    super('KGEntity', target);
    
    // Store references
    this._store = store;
    this._identityManager = identityManager;
    
    // Notification system
    this._changeListeners = new Set();
    this._propertyListeners = new Map(); // property -> Set of listeners
    
    // Computed properties system
    this._computedProperties = new Map(); // property name -> { getter, dependencies, cache }
    this._computedCache = new Map(); // property name -> { value, valid }
    this._dependencyGraph = new Map(); // property -> Set of dependent computed properties

    // Register with store for cache invalidation on updates
    this._store.registerProxy(target, this);
    
    // Set entity-specific attributes
    this.setAttribute('objectId', objectId);
    this.setAttribute('entityType', target.type || 'Unknown');
    
    // Auto-register type if not already registered
    this._ensureTypeRegistered();
  }

  /**
   * Get a property value
   * @param {string} property - Property name to get
   * @returns {Promise<any>} Property value
   */
  async get(property) {
    return await this.callMethod('get', [property]);
  }

  /**
   * Set a property value
   * @param {string} property - Property name to set
   * @param {any} value - Value to set
   * @returns {Promise<boolean>} Success status
   */
  async set(property, value) {
    return await this.callMethod('set', [property, value]);
  }

  /**
   * Delete a property
   * @param {string} property - Property name to delete
   * @returns {Promise<boolean>} Success status
   */
  async delete(property) {
    return await this.callMethod('delete', [property]);
  }

  /**
   * Check if a property exists
   * @param {string} property - Property name to check
   * @returns {Promise<boolean>} True if property exists
   */
  async has(property) {
    return await this.callMethod('has', [property]);
  }

  /**
   * Get all property names
   * @returns {Promise<Array<string>>} Property names
   */
  async keys() {
    return await this.callMethod('keys', []);
  }

  /**
   * Entity-perspective query method
   * @param {Object} querySpec - Datalog query specification
   * @param {Object} options - Query options (offset, limit)
   * @returns {Promise<Array>} Query results
   */
  async query(querySpec, options = {}) {
    return await this.callMethod('query', [querySpec, options]);
  }

  /**
   * Legacy pattern query method for backward compatibility
   * @param {Array} patterns - Array of [subject, predicate, object] patterns
   * @param {Object} options - Query options (offset, limit)
   * @returns {Promise<Array>} Query results
   */
  async queryPatterns(patterns, options = {}) {
    return await this.callMethod('queryPatterns', [patterns, options]);
  }

  /**
   * Check if object is still in store
   * @returns {Promise<boolean>} True if object is in store
   */
  async isInStore() {
    return await this.callMethod('isInStore', []);
  }

  /**
   * Add a change listener for all property changes on this object
   * @param {Function} listener - Change listener function
   * @returns {Function} Unsubscribe function
   */
  onChange(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    this._changeListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this._changeListeners.delete(listener);
    };
  }

  /**
   * Add a listener for specific property changes
   * @param {string} propertyName - Property name to watch ('*' for all)
   * @param {Function} listener - Change listener function
   * @returns {Function} Unsubscribe function
   */
  onPropertyChange(propertyName, listener) {
    if (typeof propertyName !== 'string') {
      throw new Error('Property name must be a string');
    }

    if (propertyName === '') {
      throw new Error('Property name cannot be empty');
    }

    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    if (!this._propertyListeners.has(propertyName)) {
      this._propertyListeners.set(propertyName, new Set());
    }

    this._propertyListeners.get(propertyName).add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this._propertyListeners.get(propertyName);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this._propertyListeners.delete(propertyName);
        }
      }
    };
  }

  /**
   * Define a computed property with a getter function
   * @param {string} propertyName - Name of the computed property
   * @param {Function} getter - Function to compute the property value
   * @returns {Promise<boolean>} Success status
   */
  async defineComputed(propertyName, getter) {
    return await this.callMethod('defineComputed', [propertyName, getter]);
  }

  /**
   * Remove a computed property
   * @param {string} propertyName - Name of the computed property to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeComputed(propertyName) {
    return await this.callMethod('removeComputed', [propertyName]);
  }

  /**
   * Clear the cache for a specific computed property
   * @param {string} propertyName - Name of the computed property to clear
   * @returns {Promise<boolean>} Success status
   */
  async clearComputedCache(propertyName) {
    return await this.callMethod('clearComputedCache', [propertyName]);
  }

  /**
   * Clear all computed property caches
   * @returns {Promise<boolean>} Success status
   */
  async clearAllComputedCache() {
    return await this.callMethod('clearAllComputedCache', []);
  }

  /**
   * Get the underlying target object reference
   * @returns {Promise<Object>} The target object
   */
  async getTarget() {
    return await this.callMethod('getTarget', []);
  }

  /**
   * Get the store reference
   * @returns {Promise<Object>} The store
   */
  async getStore() {
    return await this.callMethod('getStore', []);
  }

  /**
   * Get the identity manager reference
   * @returns {Promise<Object>} The identity manager
   */
  async getIdentityManager() {
    return await this.callMethod('getIdentityManager', []);
  }

  /**
   * Destroy the handle and clean up resources
   * @returns {Promise<boolean>} Success status
   */
  async destroy() {
    return await this.callMethod('destroy', []);
  }

  // Internal implementation methods (prefixed with _)

  async _get(property) {
    // Check for computed properties first
    if (this._computedProperties.has(property)) {
      return this._getComputedProperty(property);
    }

    // Return property from target object
    return this.data[property];
  }

  async _set(property, value) {
    // Don't allow setting computed properties directly
    if (this._computedProperties.has(property)) {
      throw new Error(`Cannot set computed property: ${property}`);
    }

    // Get old value for change notification
    const oldValue = this.data[property];
    const hadProperty = property in this.data;

    // Set on the target object
    this.data[property] = value;

    // Clear cache for the updated property's get method and related methods
    const getCacheKey = `method:get:${JSON.stringify([property])}`;
    const hasCacheKey = `method:has:${JSON.stringify([property])}`;
    const keysCacheKey = `method:keys:${JSON.stringify([])}`;
    this.cache.delete(getCacheKey);
    this.cache.delete(hasCacheKey);
    this.cache.delete(keysCacheKey);

    // Invalidate dependent computed properties
    this._invalidateComputedProperties(property);

    // Notify of changes (only if value actually changed)
    if (!hadProperty) {
      this._notifyChange({
        type: 'property-added',
        property,
        newValue: value,
        target: this.data,
        handle: this,
        timestamp: Date.now()
      });
    } else if (oldValue !== value) {
      this._notifyChange({
        type: 'property-changed',
        property,
        oldValue,
        newValue: value,
        target: this.data,
        handle: this,
        timestamp: Date.now()
      });
    }

    // Update store (batch updates to improve performance)
    if (!this._pendingStoreUpdate) {
      this._pendingStoreUpdate = true;
      // Use nextTick to batch multiple simultaneous updates
      process.nextTick(() => {
        if (this._pendingStoreUpdate) {
          this._store.update(this.data);
          this._pendingStoreUpdate = false;
        }
      });
    }

    return true;
  }

  async _delete(property) {
    // Don't allow deleting computed properties directly
    if (this._computedProperties.has(property)) {
      throw new Error(`Cannot delete computed property: ${property}. Use removeComputed() instead.`);
    }

    // Get old value for change notification
    const oldValue = this.data[property];
    const hadProperty = property in this.data;

    delete this.data[property];

    // Clear cache for the deleted property's get method and related methods
    const getCacheKey = `method:get:${JSON.stringify([property])}`;
    const hasCacheKey = `method:has:${JSON.stringify([property])}`;
    const keysCacheKey = `method:keys:${JSON.stringify([])}`;
    this.cache.delete(getCacheKey);
    this.cache.delete(hasCacheKey);
    this.cache.delete(keysCacheKey);

    // Invalidate dependent computed properties
    this._invalidateComputedProperties(property);

    // Notify of deletion
    if (hadProperty) {
      this._notifyChange({
        type: 'property-deleted',
        property,
        oldValue,
        target: this.data,
        handle: this,
        timestamp: Date.now()
      });

      // Update store
      this._store.update(this.data);
    }

    return true;
  }

  async _has(property) {
    return property in this.data || this._computedProperties.has(property);
  }

  async _keys() {
    const regularKeys = Object.keys(this.data);
    const computedKeys = Array.from(this._computedProperties.keys());
    return [...regularKeys, ...computedKeys];
  }

  async _query(querySpec, options = {}) {
    // Validate query specification
    if (!querySpec) {
      throw new Error('Query specification is required');
    }

    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    if (!querySpec.find || !Array.isArray(querySpec.find) || querySpec.find.length === 0) {
      throw new Error('Query must have a find clause with at least one variable');
    }

    if (!querySpec.where || !Array.isArray(querySpec.where) || querySpec.where.length === 0) {
      throw new Error('Query must have a where clause with at least one pattern');
    }

    // Get QueryEngine from the store or create one
    let queryEngine;
    if (this._store.queryEngine) {
      queryEngine = this._store.queryEngine;
    } else {
      // Create a QueryEngine instance
      queryEngine = new QueryEngine(this._store._core, this._store, this._identityManager);
    }

    // Execute the query through the QueryEngine
    let results = queryEngine.queryWithObjects(querySpec);

    // Apply options if provided
    if (options.offset && options.offset > 0) {
      results = results.slice(options.offset);
    }

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async _queryPatterns(patterns, options = {}) {
    // Validate patterns
    if (!patterns) {
      throw new Error('Patterns are required');
    }

    if (!Array.isArray(patterns)) {
      throw new Error('Patterns must be an array');
    }

    if (patterns.length === 0) {
      throw new Error('At least one pattern is required');
    }

    // Validate each pattern
    for (const pattern of patterns) {
      if (!Array.isArray(pattern) || pattern.length !== 3) {
        throw new Error('Each pattern must be an array of exactly 3 elements [subject, predicate, object]');
      }
    }

    // For MVP: extract the target type from patterns and query all objects of that type
    // This provides backward compatibility while working with our storage format
    let targetType = null;
    let targetVariable = null;

    // Look for type patterns
    for (const pattern of patterns) {
      const [subject, predicate, object] = pattern;
      if (predicate === 'type' && !object.startsWith('?')) {
        targetType = object;
        targetVariable = subject;
        break;
      }
    }

    if (!targetType || !targetVariable) {
      throw new Error('Pattern queries must include a type constraint like ["?var", "type", "typename"]');
    }

    // Create a simple query for objects of the target type
    const datalogQuery = {
      find: [targetVariable],
      where: [
        ['?e', ':entity/type', targetType],
        ['?e', ':entity/id', targetVariable]
      ]
    };

    // Execute through the query method (which uses QueryEngine's object hydration)
    return await this._query(datalogQuery, options);
  }

  async _isInStore() {
    const objectId = this._identityManager.getId(this.data);
    return objectId !== undefined;
  }

  async _defineComputed(propertyName, getter) {
    // Validate property name
    if (typeof propertyName !== 'string') {
      throw new Error('Property name must be a string');
    }

    if (propertyName === '') {
      throw new Error('Property name cannot be empty');
    }

    // Validate getter function
    if (typeof getter !== 'function') {
      throw new Error('Computed property must have a getter function');
    }

    // Check for reserved internal properties
    const reservedProperties = [
      'data', '_store', '_identityManager', '_changeListeners', '_propertyListeners',
      '_computedProperties', '_computedCache', '_dependencyGraph', 'constructor', 'prototype'
    ];

    if (reservedProperties.includes(propertyName)) {
      throw new Error(`Cannot define computed property: ${propertyName} is a reserved property`);
    }

    // Check if property name conflicts with handle methods
    const reservedMethods = [
      'get', 'set', 'delete', 'has', 'keys', 'query', 'queryPatterns', 'isInStore',
      'onChange', 'onPropertyChange', 'defineComputed', 'removeComputed', 
      'clearComputedCache', 'clearAllComputedCache', 'getTarget', 'getStore', 
      'getIdentityManager', 'destroy', 'callMethod', 'getAttribute', 'setAttribute'
    ];

    if (reservedMethods.includes(propertyName)) {
      throw new Error(`Cannot define computed property: ${propertyName} is a reserved method`);
    }

    // Check if property already exists
    if (propertyName in this.data) {
      throw new Error(`Cannot define computed property: ${propertyName} already exists`);
    }

    // Build dependency graph by analyzing which properties the getter accesses
    const dependencies = this._analyzeDependencies(getter);
    
    // Check if the computed property has external dependencies (store access, etc.)
    const hasExternalDependencies = this._hasExternalDependencies(getter);
    
    // Check for circular dependencies
    for (const dep of dependencies) {
      if (this._computedProperties.has(dep)) {
        const depComputedProp = this._computedProperties.get(dep);
        if (depComputedProp.dependencies.has(propertyName)) {
          throw new Error(`Circular dependency detected in computed property: ${propertyName}`);
        }
      }
    }
    
    // Also check indirect circular dependencies
    for (const [existingPropName, existingProp] of this._computedProperties) {
      if (existingProp.dependencies.has(propertyName)) {
        if (dependencies.has(existingPropName)) {
          throw new Error(`Circular dependency detected in computed property: ${propertyName}`);
        }
      }
    }

    // Add the computed property
    this._computedProperties.set(propertyName, { getter, dependencies, hasExternalDependencies, cache: null });

    // Update dependency graph
    for (const dep of dependencies) {
      if (!this._dependencyGraph.has(dep)) {
        this._dependencyGraph.set(dep, new Set());
      }
      this._dependencyGraph.get(dep).add(propertyName);
    }

    return true;
  }

  async _removeComputed(propertyName) {
    if (!this._computedProperties.has(propertyName)) {
      return true;
    }

    const computedProp = this._computedProperties.get(propertyName);
    
    // Remove from dependency graph
    for (const dep of computedProp.dependencies) {
      const dependents = this._dependencyGraph.get(dep);
      if (dependents) {
        dependents.delete(propertyName);
        if (dependents.size === 0) {
          this._dependencyGraph.delete(dep);
        }
      }
    }

    // Remove computed property and cache
    this._computedProperties.delete(propertyName);
    this._computedCache.delete(propertyName);

    return true;
  }

  async _clearComputedCache(propertyName) {
    if (this._computedCache.has(propertyName)) {
      this._computedCache.delete(propertyName);
    }
    return true;
  }

  async _clearAllComputedCache() {
    this._computedCache.clear();
    return true;
  }

  async _getTarget() {
    return this.data;
  }

  async _getStore() {
    return this._store;
  }

  async _getIdentityManager() {
    return this._identityManager;
  }

  async _destroy() {
    // Unregister from store
    this._store.unregisterProxy(this.data, this);
    
    // Clear all listeners
    this._changeListeners.clear();
    this._propertyListeners.clear();
    
    // Clear computed properties
    this._computedProperties.clear();
    this._computedCache.clear();
    this._dependencyGraph.clear();

    return true;
  }

  /**
   * Notify all registered listeners of a change
   * @private
   * @param {Object} change - Change event object
   */
  _notifyChange(change) {
    // Emit through BaseHandle's subscription system
    this.emit(change.type, change);

    // Also notify direct listeners for backward compatibility
    this._changeListeners.forEach(listener => {
      try {
        const result = listener(change);
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('Error in async change listener:', error);
          });
        }
      } catch (error) {
        console.error('Error in change listener:', error);
      }
    });

    // Notify property-specific listeners
    const propertyListeners = this._propertyListeners.get(change.property);
    if (propertyListeners) {
      propertyListeners.forEach(listener => {
        try {
          const result = listener(change);
          if (result && typeof result.catch === 'function') {
            result.catch(error => {
              console.error('Error in async property change listener:', error);
            });
          }
        } catch (error) {
          console.error('Error in property change listener:', error);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this._propertyListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          const result = listener(change);
          if (result && typeof result.catch === 'function') {
            result.catch(error => {
              console.error('Error in async wildcard listener:', error);
            });
          }
        } catch (error) {
          console.error('Error in wildcard listener:', error);
        }
      });
    }
  }

  /**
   * Get the value of a computed property (with caching)
   * @private
   * @param {string} propertyName - Name of the computed property
   * @returns {*} The computed property value
   */
  _getComputedProperty(propertyName) {
    const computedProp = this._computedProperties.get(propertyName);
    if (!computedProp) {
      return undefined;
    }

    // For properties with external dependencies, don't use cache to ensure fresh data
    if (!computedProp.hasExternalDependencies) {
      // Check if value is cached and valid
      const cached = this._computedCache.get(propertyName);
      if (cached) {
        return cached.value;
      }
    }

    try {
      // Create a context object that gives access to both regular properties and computed properties
      const context = new Proxy(this.data, {
        get: (target, prop) => {
          // Provide access to store for computed properties that query data
          if (prop === 'store') {
            return this._store;
          }
          // Provide access to the target object itself
          if (prop === '_target') {
            return this.data;
          }
          // If it's a computed property, get its value recursively
          if (this._computedProperties.has(prop)) {
            return this._getComputedProperty(prop);
          }
          // Otherwise return the regular property
          return target[prop];
        }
      });
      
      // Call getter function with the context
      const value = computedProp.getter.call(context);
      
      // Cache the result only if it doesn't have external dependencies
      if (!computedProp.hasExternalDependencies) {
        this._computedCache.set(propertyName, { value });
      }
      
      return value;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Invalidate computed properties that depend on the changed property
   * @private
   * @param {string} propertyName - Name of the property that changed
   */
  _invalidateComputedProperties(propertyName) {
    const dependentProperties = this._dependencyGraph.get(propertyName);
    if (!dependentProperties) {
      return;
    }

    const invalidatedProperties = [];

    for (const dependentProp of dependentProperties) {
      // Get old value before invalidating cache
      const oldValue = this._computedCache.has(dependentProp) 
        ? this._computedCache.get(dependentProp).value 
        : undefined;

      // Clear cache
      this._computedCache.delete(dependentProp);

      // Get new value
      const newValue = this._getComputedProperty(dependentProp);

      // Only notify if value actually changed
      if (oldValue !== newValue) {
        invalidatedProperties.push({
          property: dependentProp,
          oldValue,
          newValue
        });

        // Notify listeners about computed property change
        this._notifyChange({
          type: 'computed-changed',
          property: dependentProp,
          oldValue,
          newValue,
          target: this.data,
          handle: this,
          timestamp: Date.now()
        });
      }
    }

    // Recursively invalidate properties that depend on the invalidated computed properties
    for (const invalidated of invalidatedProperties) {
      this._invalidateComputedProperties(invalidated.property);
    }
  }

  /**
   * Analyze which properties a getter function depends on
   * @private
   * @param {Function} getter - The getter function to analyze
   * @returns {Set<string>} Set of property names the function depends on
   */
  _analyzeDependencies(getter) {
    const dependencies = new Set();
    
    // Convert function to string and analyze property accesses
    const funcString = getter.toString();
    
    // Look for this.propertyName patterns
    const thisPropertyRegex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;
    
    while ((match = thisPropertyRegex.exec(funcString)) !== null) {
      const propertyName = match[1];
      
      // Add all property dependencies (both regular properties and computed properties)
      dependencies.add(propertyName);
    }
    
    return dependencies;
  }

  /**
   * Check if a computed property has external dependencies
   * @private
   * @param {Function} getter - The getter function to analyze
   * @returns {boolean} True if the function has external dependencies
   */
  _hasExternalDependencies(getter) {
    const funcString = getter.toString();
    
    // Check for store access or _target access
    if (funcString.includes('store.') || funcString.includes('_target') || 
        funcString.includes('this.store') || funcString.includes('this._target')) {
      return true;
    }
    
    // Check for nested property access patterns like this.property.nestedProperty
    const nestedPropertyRegex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    if (nestedPropertyRegex.test(funcString)) {
      return true;
    }
    
    return false;
  }

  /**
   * Invalidate computed properties that have external dependencies
   * @private
   */
  _invalidateExternalDependentProperties() {
    const propertiesToInvalidate = new Set();
    
    // Find all computed properties with external dependencies
    for (const [propName, computedProp] of this._computedProperties) {
      if (computedProp.hasExternalDependencies) {
        propertiesToInvalidate.add(propName);
      }
    }
    
    // Also find properties that depend on properties with external dependencies
    const findDependentProperties = (propName) => {
      const dependents = this._dependencyGraph.get(propName);
      if (dependents) {
        for (const dependent of dependents) {
          if (!propertiesToInvalidate.has(dependent)) {
            propertiesToInvalidate.add(dependent);
            // Recursively find dependencies of this dependent property
            findDependentProperties(dependent);
          }
        }
      }
    };
    
    // For each property with external dependencies, find all properties that depend on it
    for (const propName of propertiesToInvalidate) {
      findDependentProperties(propName);
    }
    
    // Clear caches for all identified properties
    for (const propName of propertiesToInvalidate) {
      this._computedCache.delete(propName);
    }
  }

  /**
   * Ensure KGEntityHandle type is registered
   * @private
   */
  _ensureTypeRegistered() {
    const registry = TypeHandleRegistry.getGlobalRegistry();
    
    if (!registry.hasType('KGEntity')) {
      registry.registerType('KGEntity', this._getTypeMetadata());
    }
  }

  /**
   * Get type metadata for KGEntityHandle
   * @private
   * @returns {Object} Type metadata
   */
  _getTypeMetadata() {
    return {
      methods: {
        get: {
          params: ['property:string'],
          returns: 'any',
          cacheable: true,
          ttl: 1000, // Cache for 1 second
          documentation: 'Get a property value from the entity'
        },
        set: {
          params: ['property:string', 'value:any'],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Set a property value on the entity'
        },
        delete: {
          params: ['property:string'],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Delete a property from the entity'
        },
        has: {
          params: ['property:string'],
          returns: 'boolean',
          cacheable: true,
          ttl: 1000,
          documentation: 'Check if a property exists on the entity'
        },
        keys: {
          params: [],
          returns: 'array',
          cacheable: true,
          ttl: 1000,
          documentation: 'Get all property names from the entity'
        },
        query: {
          params: ['querySpec:object', 'options:object'],
          returns: 'array',
          cacheable: true,
          ttl: 5000, // Cache queries for 5 seconds
          documentation: 'Execute a Datalog query from entity perspective'
        },
        queryPatterns: {
          params: ['patterns:array', 'options:object'],
          returns: 'array',
          cacheable: true,
          ttl: 5000,
          documentation: 'Execute pattern-based queries (legacy compatibility)'
        },
        isInStore: {
          params: [],
          returns: 'boolean',
          cacheable: true,
          ttl: 1000,
          documentation: 'Check if entity is still in the DataScript store'
        },
        defineComputed: {
          params: ['propertyName:string', 'getter:function'],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Define a computed property with getter function'
        },
        removeComputed: {
          params: ['propertyName:string'],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Remove a computed property'
        },
        clearComputedCache: {
          params: ['propertyName:string'],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Clear cache for a specific computed property'
        },
        clearAllComputedCache: {
          params: [],
          returns: 'boolean',
          cacheable: false,
          documentation: 'Clear all computed property caches'
        },
        getTarget: {
          params: [],
          returns: 'object',
          cacheable: true,
          documentation: 'Get the underlying target object'
        },
        getStore: {
          params: [],
          returns: 'object',
          cacheable: true,
          documentation: 'Get the DataScript store reference'
        },
        getIdentityManager: {
          params: [],
          returns: 'object',
          cacheable: true,
          documentation: 'Get the identity manager reference'
        },
        destroy: {
          params: [],
          returns: 'boolean',
          cacheable: false,
          sideEffects: ['handle-destroyed'],
          documentation: 'Destroy handle and clean up resources'
        }
      },
      attributes: {
        objectId: {
          type: 'string',
          readonly: true,
          documentation: 'Unique identifier for the entity in the store'
        },
        entityType: {
          type: 'string',
          readonly: true,
          documentation: 'Type of the entity'
        }
      },
      documentation: {
        description: 'Handle for KG-DataScript entities with property access, queries, and computed properties',
        examples: [
          'const value = await handle.get("name")',
          'await handle.set("age", 25)',
          'const results = await handle.query({find: ["?x"], where: [["?x", ":name", "John"]]})',
          'handle.onChange(change => console.log("Changed:", change))'
        ]
      },
      version: '1.0.0'
    };
  }

  /**
   * Static method to get type name for auto-registration
   * @returns {string} Type name
   */
  static getTypeName() {
    return 'KGEntity';
  }

  /**
   * Static method to get type metadata for auto-registration
   * @returns {Object} Type metadata
   */
  static getTypeMetadata() {
    // Create a dummy instance to get metadata
    const dummyTarget = { type: 'test' };
    const dummyStore = {
      registerProxy: () => {},
      unregisterProxy: () => {}
    };
    const dummyIdentityManager = {
      getId: () => 'test-id'
    };
    
    return new KGEntityHandle(dummyTarget, dummyStore, dummyIdentityManager)._getTypeMetadata();
  }
}