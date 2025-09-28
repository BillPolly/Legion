/**
 * MetaDataSource - DataSource for meta-level operations on prototypes
 * 
 * This DataSource provides the query/subscribe/update interface for MetaHandle operations.
 * It translates Handle operations into prototype introspection and modification.
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { validateDataSourceInterface } from '../DataSource.js';

export class MetaDataSource {
  /**
   * Create a MetaDataSource for prototype operations
   * 
   * @param {Function} prototypeClass - The prototype/class to wrap
   */
  constructor(prototypeClass) {
    if (typeof prototypeClass !== 'function') {
      throw new Error('prototypeClass must be a constructor function or class');
    }
    
    this._prototype = prototypeClass;
    this._subscriptions = new Map();
    
    // Validate that we implement the DataSource interface
    validateDataSourceInterface(this, 'MetaDataSource');
  }
  
  /**
   * Query prototype information
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    const { type, filter } = querySpec;
    
    // Return results as array for consistency with DataSource interface
    switch (type) {
      case 'prototype-members':
        return [this._getPrototypeMembers(filter)];
        
      case 'methods':
        return this._getMethods();
        
      case 'properties':
        return this._getProperties();
        
      case 'inheritance-chain':
        return this._getInheritanceChain();
        
      case 'descriptors':
        return [this._getPropertyDescriptors()];
        
      case 'metadata':
        return [this._getMetadata()];
        
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  
  /**
   * Subscribe to prototype changes
   * CRITICAL: Synchronous setup - no await!
   * 
   * @param {Object} querySpec - Subscription query
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    // Create subscription synchronously
    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        // Synchronous cleanup
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    // Track subscription synchronously
    this._subscriptions.set(subscriptionId, subscription);
    
    return subscription;
  }
  
  /**
   * Get schema describing the prototype structure
   * CRITICAL: Synchronous - no await!
   * 
   * @returns {Object} Schema object
   */
  getSchema() {
    return {
      type: 'meta',
      prototypeType: 'class',
      name: this._prototype.name,
      queryTypes: [
        'prototype-members',
        'methods',
        'properties',
        'inheritance-chain',
        'descriptors',
        'metadata'
      ],
      updateTypes: [
        'add-method',
        'modify-property',
        'add-property',
        'remove-method',
        'remove-property'
      ],
      capabilities: {
        query: true,
        subscribe: true,
        update: true,
        introspection: true
      }
    };
  }
  
  /**
   * Update prototype (add/modify methods and properties)
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    const { type, name, method, descriptor, value } = updateSpec;
    let result;
    
    try {
      switch (type) {
        case 'add-method':
          result = this._addMethod(name, method);
          break;
          
        case 'modify-property':
          result = this._modifyProperty(name, descriptor);
          break;
          
        case 'add-property':
          result = this._addProperty(name, value, descriptor);
          break;
          
        case 'remove-method':
          result = this._removeMethod(name);
          break;
          
        case 'remove-property':
          result = this._removeProperty(name);
          break;
          
        default:
          throw new Error(`Unknown update type: ${type}`);
      }
      
      // Notify subscribers synchronously
      const change = {
        type,
        name,
        timestamp: Date.now(),
        success: true
      };
      
      this._notifySubscribers(change);
      
      return {
        success: true,
        change
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Create query builder for prototype queries
   * CRITICAL: Synchronous - no await!
   * 
   * @param {Handle} sourceHandle - Source MetaHandle
   * @returns {Object} Query builder
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }
    
    // Return a basic query builder for meta operations
    // Full implementation would support chaining and projections
    return {
      _sourceHandle: sourceHandle,
      _querySpec: {},
      
      type(queryType) {
        this._querySpec.type = queryType;
        return this;
      },
      
      filter(filterValue) {
        this._querySpec.filter = filterValue;
        return this;
      },
      
      execute() {
        return this._sourceHandle.query(this._querySpec);
      }
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
    const proto = this._prototype.prototype || this._prototype;
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    
    for (const [name, descriptor] of Object.entries(descriptors)) {
      // Skip constructor
      if (name === 'constructor') continue;
      
      // Categorize member
      if (typeof descriptor.value === 'function') {
        if (!filter || filter === 'methods') {
          members.methods.push(name);
        }
      } else {
        if (!filter || filter === 'properties') {
          members.properties.push(name);
        }
      }
      
      // Store descriptor
      members.descriptors[name] = descriptor;
    }
    
    return members;
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
    
    return true;
  }
  
  /**
   * Notify all subscribers of changes
   * @private
   */
  _notifySubscribers(change) {
    // Invoke all subscription callbacks synchronously
    for (const subscription of this._subscriptions.values()) {
      try {
        subscription.callback(change);
      } catch (error) {
        // Log error but continue notifying other subscribers
        console.warn('MetaDataSource subscription callback error:', error);
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
}