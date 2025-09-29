import { QueryEngine } from './QueryEngine.js';
import { PatternTranslator } from './PatternTranslator.js';

/**
 * KGEntityProxy - A proxy wrapper for objects in the KG-DataScript system
 * 
 * Provides transparent access to object properties while maintaining integration
 * with the live store and identity management system. Objects accessed through
 * this proxy maintain their identity and relationship to the underlying DataScript
 * database while providing a natural JavaScript object interface.
 */
export class KGEntityProxy {
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
      throw new Error('Object must be added to store before creating proxy');
    }

    // Store references
    this._target = target;
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
    this._store.registerProxy(this._target, this);

    // Create and return the proxy
    return new Proxy(this, {
      // Property access
      get(proxyTarget, property, receiver) {
        // Handle special proxy methods
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners' ||
            property === '_computedProperties' || property === '_computedCache' || property === '_dependencyGraph') {
          return proxyTarget[property];
        }

        // Handle proxy instance checks
        if (property === Symbol.toStringTag) {
          return 'KGEntityProxy';
        }

        // Handle constructor checks
        if (property === 'constructor') {
          return KGEntityProxy;
        }

        // Handle proxy methods
        if (property === 'getTarget' || property === 'getStore' || property === 'getIdentityManager' || 
            property === 'isInStore' || property === 'query' || property === 'queryPatterns' ||
            property === 'onChange' || property === 'onPropertyChange' || property === '_notifyChange' ||
            property === 'defineComputed' || property === 'removeComputed' || property === 'clearComputedCache' ||
            property === 'clearAllComputedCache' || property === '_getComputedProperty' ||
            property === '_invalidateComputedProperties' || property === '_analyzeDependencies' ||
            property === '_hasExternalDependencies' || property === '_invalidateExternalDependentProperties' || property === 'destroy') {
          return proxyTarget[property];
        }

        // Check for computed properties first
        if (proxyTarget._computedProperties.has(property)) {
          return proxyTarget._getComputedProperty(property);
        }

        // All other properties come from the target object
        return proxyTarget._target[property];
      },

      // Property modification
      set(proxyTarget, property, value, receiver) {
        // Don't allow modification of internal proxy properties
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners' ||
            property === '_computedProperties' || property === '_computedCache' || property === '_dependencyGraph') {
          throw new Error('Cannot modify internal proxy properties');
        }

        // Don't allow setting computed properties directly
        if (proxyTarget._computedProperties.has(property)) {
          throw new Error(`Cannot set computed property: ${property}`);
        }

        // Get old value for change notification
        const oldValue = proxyTarget._target[property];
        const hadProperty = property in proxyTarget._target;

        // Set on the target object
        proxyTarget._target[property] = value;

        // Invalidate dependent computed properties
        proxyTarget._invalidateComputedProperties(property);

        // Notify of changes (only if value actually changed)
        if (!hadProperty) {
          proxyTarget._notifyChange({
            type: 'property-added',
            property,
            newValue: value,
            target: proxyTarget._target,
            proxy: receiver,
            timestamp: Date.now()
          });
        } else if (oldValue !== value) {
          proxyTarget._notifyChange({
            type: 'property-changed',
            property,
            oldValue,
            newValue: value,
            target: proxyTarget._target,
            proxy: receiver,
            timestamp: Date.now()
          });
        }

        // Update store (batch updates to improve performance)
        if (!proxyTarget._pendingStoreUpdate) {
          proxyTarget._pendingStoreUpdate = true;
          // Use nextTick to batch multiple simultaneous updates
          process.nextTick(() => {
            if (proxyTarget._pendingStoreUpdate) {
              proxyTarget._store.update(proxyTarget._target);
              proxyTarget._pendingStoreUpdate = false;
            }
          });
        }

        return true;
      },

      // Property deletion
      deleteProperty(proxyTarget, property) {
        // Don't allow deletion of internal proxy properties
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners' ||
            property === '_computedProperties' || property === '_computedCache' || property === '_dependencyGraph') {
          throw new Error('Cannot delete internal proxy properties');
        }

        // Don't allow deleting computed properties directly
        if (proxyTarget._computedProperties.has(property)) {
          throw new Error(`Cannot delete computed property: ${property}. Use removeComputed() instead.`);
        }

        // Get old value for change notification
        const oldValue = proxyTarget._target[property];
        const hadProperty = property in proxyTarget._target;

        delete proxyTarget._target[property];

        // Invalidate dependent computed properties
        proxyTarget._invalidateComputedProperties(property);

        // Notify of deletion
        if (hadProperty) {
          proxyTarget._notifyChange({
            type: 'property-deleted',
            property,
            oldValue,
            target: proxyTarget._target,
            proxy: proxyTarget,
            timestamp: Date.now()
          });

          // Update store
          proxyTarget._store.update(proxyTarget._target);
        }

        return true;
      },

      // Property enumeration
      ownKeys(proxyTarget) {
        return Object.keys(proxyTarget._target);
      },

      // Property existence checks
      has(proxyTarget, property) {
        // Internal properties exist on the proxy
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners') {
          return true;
        }

        return property in proxyTarget._target;
      },

      // Property descriptor access
      getOwnPropertyDescriptor(proxyTarget, property) {
        // Internal properties are not enumerable
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners') {
          return {
            value: proxyTarget[property],
            writable: false,
            enumerable: false,
            configurable: false
          };
        }

        return Object.getOwnPropertyDescriptor(proxyTarget._target, property);
      },

      // Property descriptor modification
      defineProperty(proxyTarget, property, descriptor) {
        // Don't allow modification of internal proxy properties
        if (property === '_target' || property === '_store' || property === '_identityManager' ||
            property === '_changeListeners' || property === '_propertyListeners') {
          throw new Error('Cannot define internal proxy properties');
        }

        Object.defineProperty(proxyTarget._target, property, descriptor);
        return true;
      },

      // Object.getPrototypeOf() support
      getPrototypeOf(proxyTarget) {
        return Object.getPrototypeOf(proxyTarget._target);
      },

      // Object.setPrototypeOf() support
      setPrototypeOf(proxyTarget, prototype) {
        Object.setPrototypeOf(proxyTarget._target, prototype);
        return true;
      },

      // Object.isExtensible() support
      isExtensible(proxyTarget) {
        return Object.isExtensible(proxyTarget._target);
      },

      // Object.preventExtensions() support
      preventExtensions(proxyTarget) {
        Object.preventExtensions(proxyTarget._target);
        return true;
      }
    });
  }

  // Instance method to get the underlying target (in case needed)
  getTarget() {
    return this._target;
  }

  // Instance method to get the store reference
  getStore() {
    return this._store;
  }

  // Instance method to get the identity manager
  getIdentityManager() {
    return this._identityManager;
  }

  // Instance method to check if object is still in store
  isInStore() {
    const objectId = this._identityManager.getId(this._target);
    return objectId !== undefined;
  }

  // Entity-perspective query method
  query(querySpec, options = {}) {
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

  // Legacy pattern query method for backward compatibility
  queryPatterns(patterns, options = {}) {
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
    return this.query(datalogQuery, options);
  }

  // Notification System Methods

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
   * Notify all registered listeners of a change
   * @private
   * @param {Object} change - Change event object
   */
  _notifyChange(change) {
    // Notify general change listeners
    this._changeListeners.forEach(listener => {
      try {
        // Handle both sync and async listeners
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

  // Computed Properties Methods

  /**
   * Define a computed property with a getter function
   * @param {string} propertyName - Name of the computed property
   * @param {Function} getter - Function to compute the property value
   */
  defineComputed(propertyName, getter) {
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

    // Check for reserved internal properties first
    const reservedProperties = [
      '_target', '_store', '_identityManager', '_changeListeners', '_propertyListeners',
      '_computedProperties', '_computedCache', '_dependencyGraph', 'constructor', 'prototype'
    ];

    if (reservedProperties.includes(propertyName)) {
      throw new Error(`Cannot define computed property: ${propertyName} is a reserved property`);
    }

    // Check if property name conflicts with proxy methods
    const reservedMethods = [
      'getTarget', 'getStore', 'getIdentityManager', 'isInStore', 'query', 'queryPatterns',
      'onChange', 'onPropertyChange', 'defineComputed', 'removeComputed', 'clearComputedCache',
      'clearAllComputedCache', '_notifyChange', '_getComputedProperty', '_invalidateComputedProperties',
      'destroy'
    ];

    if (reservedMethods.includes(propertyName)) {
      throw new Error(`Cannot define computed property: ${propertyName} is a reserved method`);
    }

    // Check if property already exists
    if (propertyName in this._target) {
      throw new Error(`Cannot define computed property: ${propertyName} already exists`);
    }

    // Build dependency graph by analyzing which properties the getter accesses
    const dependencies = this._analyzeDependencies(getter);
    
    // Check if the computed property has external dependencies (store access, etc.)
    const hasExternalDependencies = this._hasExternalDependencies(getter);
    
    // Check for circular dependencies
    // If any of our dependencies are computed properties that depend on us, that's a cycle
    for (const dep of dependencies) {
      if (this._computedProperties.has(dep)) {
        const depComputedProp = this._computedProperties.get(dep);
        if (depComputedProp.dependencies.has(propertyName)) {
          throw new Error(`Circular dependency detected in computed property: ${propertyName}`);
        }
      }
    }
    
    // Also check if any existing computed property depends on this property name
    // and this property depends on that computed property (indirect circular dependency)
    for (const [existingPropName, existingProp] of this._computedProperties) {
      if (existingProp.dependencies.has(propertyName)) {
        // existingProp depends on the property we're defining
        // Check if we depend on existingProp
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
  }

  /**
   * Remove a computed property
   * @param {string} propertyName - Name of the computed property to remove
   */
  removeComputed(propertyName) {
    if (!this._computedProperties.has(propertyName)) {
      return;
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
  }

  /**
   * Clear the cache for a specific computed property
   * @param {string} propertyName - Name of the computed property to clear
   */
  clearComputedCache(propertyName) {
    if (this._computedCache.has(propertyName)) {
      this._computedCache.delete(propertyName);
    }
  }

  /**
   * Clear all computed property caches
   */
  clearAllComputedCache() {
    this._computedCache.clear();
  }

  /**
   * Destroy the proxy and clean up resources
   */
  destroy() {
    // Unregister from store
    this._store.unregisterProxy(this._target, this);
    
    // Clear all listeners
    this._changeListeners.clear();
    this._propertyListeners.clear();
    
    // Clear computed properties
    this._computedProperties.clear();
    this._computedCache.clear();
    this._dependencyGraph.clear();
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
      // Also provides access to store, _target, and other proxy context
      const context = new Proxy(this._target, {
        get: (target, prop) => {
          // Provide access to store for computed properties that query data
          if (prop === 'store') {
            return this._store;
          }
          // Provide access to the target object itself
          if (prop === '_target') {
            return this._target;
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
          target: this._target,
          proxy: this,
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
   * Check if a computed property has external dependencies (store access, _target access, or nested object properties)
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
    // This indicates accessing properties of referenced objects that could be updated externally
    const nestedPropertyRegex = /this\.([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    if (nestedPropertyRegex.test(funcString)) {
      return true;
    }
    
    return false;
  }

  /**
   * Invalidate computed properties that have external dependencies or depend on properties with external dependencies
   * This is called by the store when operations might affect external data
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
    // This handles the chain where budgetUtilization depends on teamCost which has external dependencies
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
}