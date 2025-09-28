/**
 * MetaHandle - A Handle whose value IS a prototype/class
 * 
 * MetaHandle makes prototypes queryable, updatable, and subscribable through the unified Handle interface.
 * This achieves true meta-circularity where prototypes themselves are Handles.
 * 
 * Key Features:
 * - Query prototype members (methods, properties, inheritance chain)
 * - Dynamically add/modify methods and properties at runtime
 * - Subscribe to prototype modifications
 * - Create instances from the prototype
 * - Track all instances (via WeakSet)
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { Handle } from '../Handle.js';
import { SimpleObjectDataSource } from '../SimpleObjectDataSource.js';

export class MetaHandle extends Handle {
  /**
   * Create a MetaHandle wrapping a prototype/class
   * 
   * @param {Object} dataSource - DataSource for meta-level operations
   * @param {Function} PrototypeClass - The prototype/class to wrap
   */
  constructor(dataSource, PrototypeClass) {
    super(dataSource);
    
    if (typeof PrototypeClass !== 'function') {
      throw new Error('PrototypeClass must be a constructor function or class');
    }
    
    // Store the prototype being wrapped
    this._prototype = PrototypeClass;
    
    // Track instances created from this prototype
    // Note: Using Set instead of WeakSet to enable querying
    // Instances will be held in memory until explicitly removed
    this._instances = new Set();
    
    // Track prototype modification listeners (synchronous)
    this._modificationListeners = new Set();
  }
  
  /**
   * Get the wrapped prototype class
   * CRITICAL: Synchronous - no await!
   * 
   * @returns {Function} The prototype class
   */
  value() {
    this._validateNotDestroyed();
    return this._prototype;
  }
  
  /**
   * Get the wrapped prototype class (alias for value())
   * CRITICAL: Synchronous - no await!
   * 
   * NOTE: This is different from Handle.getPrototype() which returns introspection!
   * For introspection of MetaHandle itself, MetaHandle inherits Handle.getPrototype()
   * 
   * @returns {Function} The prototype class being wrapped
   */
  getWrappedPrototype() {
    return this.value();
  }
  
  /**
   * Get the type name of this prototype
   * CRITICAL: Synchronous - no await!
   * 
   * @returns {string} The type name
   */
  getTypeName() {
    this._validateNotDestroyed();
    
    // If the prototype has a getTypeName method, use it
    if (typeof this._prototype.getTypeName === 'function') {
      return this._prototype.getTypeName();
    }
    
    // If the prototype has a typeName property, use it
    if (this._prototype.typeName) {
      return this._prototype.typeName;
    }
    
    // Extract entity type from TypedHandle_entityType format
    const name = this._prototype.name;
    if (name && name.startsWith('TypedHandle_')) {
      return name.substring('TypedHandle_'.length);
    }
    
    // Return the full name or Anonymous
    return name || 'Anonymous';
  }
  
  /**
   * Query prototype information
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification
   * @returns {*} Query results
   */
  query(querySpec) {
    this._validateNotDestroyed();
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    const { type, filter } = querySpec;
    
    switch (type) {
      case 'prototype-members':
        return this._getPrototypeMembers(filter);
        
      case 'instances':
        // Return array of all tracked instances
        return Array.from(this._instances);
        
      case 'methods':
        return this._getMethods();
        
      case 'properties':
        return this._getProperties();
        
      case 'inheritance-chain':
        return this._getInheritanceChain();
        
      case 'descriptors':
        return this._getPropertyDescriptors();
        
      case 'metadata':
        return this._getMetadata();
        
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  
  /**
   * Update prototype (add/modify methods and properties)
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Object} updateSpec - Update specification
   * @returns {boolean} Success status
   */
  update(updateSpec) {
    this._validateNotDestroyed();
    
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    const { type, name, method, descriptor, value } = updateSpec;
    
    switch (type) {
      case 'add-method':
        return this._addMethod(name, method);
        
      case 'modify-property':
        return this._modifyProperty(name, descriptor);
        
      case 'add-property':
        return this._addProperty(name, value, descriptor);
        
      case 'remove-method':
        return this._removeMethod(name);
        
      case 'remove-property':
        return this._removeProperty(name);
        
      default:
        throw new Error(`Unknown update type: ${type}`);
    }
  }
  
  /**
   * Subscribe to prototype changes
   * CRITICAL: Synchronous setup - callbacks invoked when changes occur
   * 
   * @param {Object} querySpec - Subscription query
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    this._validateNotDestroyed();
    
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const listener = {
      id: Date.now() + Math.random(),
      querySpec,
      callback
    };
    
    // Track listener synchronously
    this._modificationListeners.add(listener);
    
    // Also track through base Handle's subscription system
    const parentSubscription = super.subscribe(querySpec, callback);
    
    // Return combined subscription that unsubscribes both
    return {
      id: listener.id,
      unsubscribe: () => {
        // Synchronous cleanup of local listener
        this._modificationListeners.delete(listener);
        // Cleanup parent subscription
        parentSubscription.unsubscribe();
      }
    };
  }
  
  /**
   * Create an instance from this prototype
   * CRITICAL: Synchronous - no await!
   * 
   * @param {...any} args - Constructor arguments
   * @returns {*} New instance of the prototype
   */
  createInstance(...args) {
    this._validateNotDestroyed();
    
    // Check if prototype extends Handle
    const extendsHandle = this._prototype.prototype instanceof Handle || this._prototype === Handle;
    
    if (extendsHandle) {
      // Handle-extending classes require a DataSource as first parameter
      // If first arg is already a DataSource, use it; otherwise create a simple one
      const firstArg = args[0];
      const hasDataSource = firstArg && typeof firstArg === 'object' && 
                           typeof firstArg.query === 'function' &&
                           typeof firstArg.subscribe === 'function';
      
      if (hasDataSource) {
        // First arg is already a DataSource, pass all args to constructor
        // This preserves the (dataSource, entityId, options) pattern for TypedHandle
        const instance = new this._prototype(...args);
        this._instances.add(instance);
        return instance;
      } else {
        // No DataSource provided - create a SimpleObjectDataSource for the instance
        const instanceDataSource = new SimpleObjectDataSource();
        
        // Create instance with DataSource as first arg, followed by other args
        const instance = new this._prototype(instanceDataSource, ...args);
        this._instances.add(instance);
        return instance;
      }
    } else {
      // Non-Handle classes don't need DataSource
      const instance = new this._prototype(...args);
      this._instances.add(instance);
      return instance;
    }
  }
  
  /**
   * Get complete introspection information about this prototype
   * CRITICAL: Synchronous - no await!
   * 
   * @returns {Object} Introspection data
   */
  getIntrospectionInfo() {
    this._validateNotDestroyed();
    
    const baseInfo = super.getIntrospectionInfo();
    
    return {
      ...baseInfo,
      metaType: 'MetaHandle',
      prototypeName: this._prototype.name,
      prototypeType: typeof this._prototype,
      methods: this._getMethods(),
      properties: this._getProperties(),
      inheritanceChain: this._getInheritanceChain(),
      modificationListenerCount: this._modificationListeners.size
    };
  }
  
  
  // Private implementation methods
  
  /**
   * Get prototype members (methods and properties)
   * @private
   */
  _getPrototypeMembers(filter = null) {
    const members = {
      methods: [],
      properties: [],
      descriptors: {}
    };
    
    // Get own property descriptors from prototype
    const descriptors = Object.getOwnPropertyDescriptors(this._prototype.prototype || this._prototype);
    
    for (const [name, descriptor] of Object.entries(descriptors)) {
      // Skip constructor
      if (name === 'constructor') continue;
      
      // Categorize member
      if (typeof descriptor.value === 'function') {
        members.methods.push(name);
      } else {
        members.properties.push(name);
      }
      
      // Store descriptor (always store for full picture)
      members.descriptors[name] = descriptor;
    }
    
    // If no filter, return full detailed structure
    if (!filter) {
      return members;
    }
    
    // If filter specified, return structure with filtered results
    if (filter === 'methods') {
      return {
        methods: members.methods,
        properties: [],
        descriptors: {}
      };
    } else if (filter === 'properties') {
      return {
        methods: [],
        properties: members.properties,
        descriptors: {}
      };
    } else if (filter === 'descriptors') {
      return {
        methods: [],
        properties: [],
        descriptors: members.descriptors
      };
    } else {
      // Unknown filter, return full structure
      return members;
    }
  }
  
  /**
   * Get all methods defined on the prototype
   * @private
   */
  _getMethods() {
    const methods = [];
    const proto = this._prototype.prototype || this._prototype;
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (name !== 'constructor' && typeof descriptor.value === 'function') {
        methods.push({
          name,
          isEnumerable: descriptor.enumerable,
          isConfigurable: descriptor.configurable
        });
      }
    }
    
    return methods;
  }
  
  /**
   * Get all properties defined on the prototype
   * @private
   */
  _getProperties() {
    const properties = [];
    const proto = this._prototype.prototype || this._prototype;
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (name !== 'constructor' && typeof descriptor.value !== 'function') {
        properties.push({
          name,
          hasGetter: descriptor.get !== undefined,
          hasSetter: descriptor.set !== undefined,
          isEnumerable: descriptor.enumerable,
          isConfigurable: descriptor.configurable
        });
      }
    }
    
    return properties;
  }
  
  /**
   * Get prototype inheritance chain
   * @private
   */
  _getInheritanceChain() {
    const chain = [];
    let current = this._prototype;
    
    while (current && current !== Object && current !== Function) {
      chain.push({
        name: current.name || 'Anonymous',
        constructor: current
      });
      
      // Move up the prototype chain
      const proto = Object.getPrototypeOf(current);
      if (proto === current) break; // Prevent infinite loop
      current = proto;
    }
    
    return chain;
  }
  
  /**
   * Get all property descriptors
   * @private
   */
  _getPropertyDescriptors() {
    const proto = this._prototype.prototype || this._prototype;
    return Object.getOwnPropertyDescriptors(proto);
  }
  
  /**
   * Get metadata about the prototype
   * @private
   */
  _getMetadata() {
    return {
      name: this._prototype.name,
      isClass: this._isClass(this._prototype),
      isFunction: typeof this._prototype === 'function',
      hasPrototype: this._prototype.prototype !== undefined,
      prototypeChainLength: this._getInheritanceChain().length
    };
  }
  
  /**
   * Add a method to the prototype
   * @private
   */
  _addMethod(name, method) {
    if (!name || typeof name !== 'string') {
      throw new Error('Method name must be a non-empty string');
    }
    
    if (!method || typeof method !== 'function') {
      throw new Error('Method must be a function');
    }
    
    // Add method to prototype
    const proto = this._prototype.prototype || this._prototype;
    proto[name] = method;
    
    // Notify listeners synchronously
    this._notifyModification({
      type: 'method-added',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Modify a property descriptor
   * @private
   */
  _modifyProperty(name, descriptor) {
    if (!name || typeof name !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('Descriptor must be an object');
    }
    
    // Modify property descriptor on prototype
    const proto = this._prototype.prototype || this._prototype;
    Object.defineProperty(proto, name, descriptor);
    
    // Notify listeners synchronously
    this._notifyModification({
      type: 'property-modified',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Add a property to the prototype
   * @private
   */
  _addProperty(name, value, descriptor = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    // Create property descriptor
    const fullDescriptor = {
      value,
      writable: descriptor.writable !== false,
      enumerable: descriptor.enumerable !== false,
      configurable: descriptor.configurable !== false,
      ...descriptor
    };
    
    // Add property to prototype
    const proto = this._prototype.prototype || this._prototype;
    Object.defineProperty(proto, name, fullDescriptor);
    
    // Notify listeners synchronously
    this._notifyModification({
      type: 'property-added',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Remove a method from the prototype
   * @private
   */
  _removeMethod(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Method name must be a non-empty string');
    }
    
    const proto = this._prototype.prototype || this._prototype;
    
    // Check if method exists
    if (!proto.hasOwnProperty(name)) {
      throw new Error(`Method '${name}' does not exist on prototype`);
    }
    
    // Remove method
    delete proto[name];
    
    // Notify listeners synchronously
    this._notifyModification({
      type: 'method-removed',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Remove a property from the prototype
   * @private
   */
  _removeProperty(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    const proto = this._prototype.prototype || this._prototype;
    
    // Check if property exists
    if (!proto.hasOwnProperty(name)) {
      throw new Error(`Property '${name}' does not exist on prototype`);
    }
    
    // Remove property
    delete proto[name];
    
    // Notify listeners synchronously
    this._notifyModification({
      type: 'property-removed',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Notify all modification listeners
   * @private
   */
  _notifyModification(change) {
    // Invoke all listeners synchronously
    for (const listener of this._modificationListeners) {
      try {
        listener.callback(change);
      } catch (error) {
        // Log error but continue notifying other listeners
        console.warn('MetaHandle modification listener error:', error);
      }
    }
  }
  
  /**
   * Check if a function is a class (ES6 class syntax)
   * @private
   */
  _isClass(func) {
    return typeof func === 'function' && /^class\s/.test(Function.prototype.toString.call(func));
  }
  
  /**
   * Clean up MetaHandle resources
   */
  destroy() {
    // Clear modification listeners
    this._modificationListeners.clear();
    
    // Clear instances set
    this._instances.clear();
    
    // Call parent cleanup
    super.destroy();
  }
}