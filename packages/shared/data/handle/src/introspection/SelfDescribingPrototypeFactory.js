/**
 * SelfDescribingPrototypeFactory - Factory that creates MetaHandles and is itself queryable as a Handle
 * 
 * This factory manufactures MetaHandles (prototypes wrapped as Handles) and maintains
 * a registry of all created prototypes. The factory itself can be queried and updated
 * as a Handle, demonstrating true meta-circularity.
 * 
 * Key Features:
 * - Creates prototypes wrapped as MetaHandles
 * - Maintains registry of all prototype handles
 * - Factory is queryable/updatable as a Handle
 * - Supports subscription to prototype creation events
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

import { MetaHandle } from './MetaHandle.js';
import { Handle } from '../Handle.js';

export class SelfDescribingPrototypeFactory {
  /**
   * Create a new SelfDescribingPrototypeFactory
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.baseClass - Base class for created prototypes (default: Handle)
   */
  constructor(options = {}) {
    // Registry of all created prototype handles
    // Map: typeName -> MetaHandle
    this._prototypeRegistry = new Map();
    
    // Base class for created prototypes (default to Handle)
    this._baseClass = options.baseClass || Handle;
    
    // Subscriptions for prototype creation events
    this._subscriptions = new Map();
    this._subscriptionId = 0;
    
    // Create a Handle wrapper for this factory (for meta-circularity)
    this._factoryHandle = null; // Will be created lazily via asHandle()
  }
  
  /**
   * Create a new prototype and return it as a MetaHandle
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Name for the new prototype type
   * @param {Function} baseClass - Base class to extend (optional)
   * @param {Object} options - Additional options for the prototype
   * @returns {MetaHandle} MetaHandle wrapping the new prototype
   */
  createPrototype(typeName, baseClass, options = {}) {
    if (!typeName || typeof typeName !== 'string') {
      throw new Error('Prototype type name must be a non-empty string');
    }
    
    if (this._prototypeRegistry.has(typeName)) {
      throw new Error(`Prototype with name '${typeName}' already exists`);
    }
    
    // Use provided base class or factory default
    const BaseClass = baseClass || this._baseClass;
    
    // Check if base class is Handle or extends Handle
    const extendsHandle = BaseClass === Handle || BaseClass.prototype instanceof Handle;
    
    // Create the prototype class dynamically
    const PrototypeClass = extendsHandle
      ? class extends BaseClass {
          constructor(dataSource, ...args) {
            // Handle classes require a DataSource as first parameter
            super(dataSource, ...args);
            
            // Store type name on instance
            this._typeName = typeName;
          }
          
          // Add type identification
          static getTypeName() {
            return typeName;
          }
          
          getTypeName() {
            return typeName;
          }
        }
      : class extends BaseClass {
          constructor(...args) {
            super(...args);
            
            // Store type name on instance
            this._typeName = typeName;
          }
          
          // Add type identification
          static getTypeName() {
            return typeName;
          }
          
          getTypeName() {
            return typeName;
          }
        };
    
    // Set the class name for better debugging
    Object.defineProperty(PrototypeClass, 'name', {
      value: typeName,
      writable: false
    });
    
    // Create a MetaDataSource for this prototype
    const metaDataSource = new MetaDataSource(PrototypeClass, {
      typeName,
      ...options
    });
    
    // Wrap the prototype in a MetaHandle
    const metaHandle = new MetaHandle(metaDataSource, PrototypeClass);
    
    // Register the MetaHandle
    this._prototypeRegistry.set(typeName, metaHandle);
    
    // Notify subscribers of prototype creation
    this._notifySubscribers({
      type: 'prototype-created',
      typeName,
      metaHandle
    });
    
    return metaHandle;
  }
  
  /**
   * Wrap an existing prototype class as a MetaHandle
   * This is for integrating with existing prototype systems like PrototypeFactory
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Name for the prototype type
   * @param {Function} PrototypeClass - Existing prototype class to wrap
   * @param {Object} options - Additional options
   * @returns {MetaHandle} MetaHandle wrapping the existing prototype
   */
  wrapExistingPrototype(typeName, PrototypeClass, options = {}) {
    if (!typeName || typeof typeName !== 'string') {
      throw new Error('Prototype type name must be a non-empty string');
    }
    
    if (this._prototypeRegistry.has(typeName)) {
      throw new Error(`Prototype with name '${typeName}' already exists`);
    }
    
    if (!PrototypeClass || typeof PrototypeClass !== 'function') {
      throw new Error('PrototypeClass must be a constructor function');
    }
    
    // Create a MetaDataSource for this existing prototype
    const metaDataSource = new MetaDataSource(PrototypeClass, {
      typeName,
      ...options
    });
    
    // Create MetaHandle wrapping this prototype
    const metaHandle = new MetaHandle(metaDataSource, PrototypeClass);
    
    // Register in our registry
    this._prototypeRegistry.set(typeName, metaHandle);
    
    // Notify subscribers of prototype creation
    this._notifySubscribers({
      type: 'prototype-created',
      typeName,
      metaHandle
    });
    
    return metaHandle;
  }
  
  /**
   * Get an existing prototype handle by type name
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Name of the prototype type
   * @returns {MetaHandle|undefined} MetaHandle or undefined if not found
   */
  getPrototypeHandle(typeName) {
    return this._prototypeRegistry.get(typeName);
  }
  
  /**
   * Check if a prototype exists
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Name of the prototype type
   * @returns {boolean} True if prototype exists
   */
  hasPrototype(typeName) {
    return this._prototypeRegistry.has(typeName);
  }
  
  /**
   * Get all registered prototype type names
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Array<string>} Array of type names
   */
  getPrototypeNames() {
    return Array.from(this._prototypeRegistry.keys());
  }
  
  /**
   * Get all registered MetaHandles
   * CRITICAL: Must be synchronous - no await!
   * 
   * @returns {Array<MetaHandle>} Array of MetaHandles
   */
  getAllPrototypes() {
    return Array.from(this._prototypeRegistry.values());
  }
  
  /**
   * Remove a prototype from the registry
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Name of the prototype type
   * @returns {boolean} True if prototype was removed
   */
  removePrototype(typeName) {
    const existed = this._prototypeRegistry.has(typeName);
    
    if (existed) {
      this._prototypeRegistry.delete(typeName);
      
      // Notify subscribers of prototype removal
      this._notifySubscribers({
        type: 'prototype-removed',
        typeName
      });
    }
    
    return existed;
  }
  
  /**
   * Get factory as a Handle for meta-circularity
   * CRITICAL: Must be synchronous - no await!
   * 
   * The factory itself becomes queryable and updatable as a Handle,
   * enabling queries like "list all prototypes" and updates like
   * "create new prototype".
   * 
   * @returns {Handle} Handle wrapping this factory
   */
  asHandle() {
    // Create the factory handle lazily on first access
    if (!this._factoryHandle) {
      this._factoryHandle = new FactoryHandle(this);
    }
    
    return this._factoryHandle;
  }
  
  /**
   * Subscribe to factory events
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification for subscription
   * @param {Function} callback - Callback function for notifications
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
    return subscription;
  }
  
  /**
   * Notify all subscribers of an event
   * @private
   */
  _notifySubscribers(event) {
    for (const subscription of this._subscriptions.values()) {
      try {
        // Check if event matches subscription query
        if (this._eventMatchesQuery(event, subscription.querySpec)) {
          subscription.callback(event);
        }
      } catch (error) {
        console.warn('Error in factory subscription callback:', error);
      }
    }
  }
  
  /**
   * Check if event matches subscription query
   * @private
   */
  _eventMatchesQuery(event, querySpec) {
    // Match on event type
    if (querySpec.type && event.type !== querySpec.type) {
      return false;
    }
    
    // Match on prototype name if specified
    if (querySpec.typeName && event.typeName !== querySpec.typeName) {
      return false;
    }
    
    // If no specific filters, match all events
    return true;
  }
}

/**
 * FactoryHandle - Handle wrapper for SelfDescribingPrototypeFactory
 * 
 * Makes the factory itself queryable and updatable as a Handle.
 * This enables meta-circular operations like querying the factory
 * for all prototypes or creating new prototypes through Handle updates.
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */
class FactoryHandle extends Handle {
  /**
   * Create a FactoryHandle wrapping a SelfDescribingPrototypeFactory
   * 
   * @param {SelfDescribingPrototypeFactory} factory - The factory to wrap
   */
  constructor(factory) {
    // Create a DataSource for the factory
    const dataSource = new FactoryDataSource(factory);
    
    // Initialize Handle with FactoryDataSource
    super(dataSource);
    
    // Store reference to factory and DataSource
    this._factory = factory;
    this._dataSource = dataSource;
  }
  
  /**
   * Query factory through Handle interface
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification
   * @returns {*} Query result
   */
  query(querySpec) {
    return this._dataSource.query(querySpec);
  }
  
  /**
   * Get metadata about this FactoryHandle
   * 
   * @returns {Object} Metadata object
   */
  get metadata() {
    return {
      handleType: 'factory',
      prototypeCount: this._factory._prototypeRegistry.size
    };
  }
  
  /**
   * Get the wrapped factory
   * 
   * @returns {SelfDescribingPrototypeFactory} The wrapped factory
   */
  getFactory() {
    return this._factory;
  }
}

/**
 * FactoryDataSource - DataSource implementation for factory introspection
 * 
 * Provides query, subscribe, and update operations for the factory.
 * All operations are synchronous per the DataSource contract.
 */
class FactoryDataSource {
  constructor(factory) {
    this._factory = factory;
  }
  
  /**
   * Query factory state
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    switch (querySpec.type) {
      case 'list-prototypes':
        return this._factory.getPrototypeNames();
        
      case 'get-prototype':
        if (!querySpec.typeName) {
          throw new Error('typeName required for get-prototype query');
        }
        return this._factory.getPrototypeHandle(querySpec.typeName);
        
      case 'has-prototype':
        if (!querySpec.typeName) {
          throw new Error('typeName required for has-prototype query');
        }
        return this._factory.hasPrototype(querySpec.typeName);
        
      case 'prototype-count':
        return this._factory._prototypeRegistry.size;
        
      case 'all-prototypes':
        return this._factory.getAllPrototypes();
        
      default:
        throw new Error(`Unknown factory query type: ${querySpec.type}`);
    }
  }
  
  /**
   * Subscribe to factory changes
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    return this._factory.subscribe(querySpec, callback);
  }
  
  /**
   * Get factory schema
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    return {
      version: '1.0.0',
      type: 'factory',
      attributes: {
        prototypeCount: { valueType: 'number' },
        prototypes: { valueType: 'array' }
      },
      operations: {
        'list-prototypes': {
          description: 'List all registered prototype names',
          returns: 'array'
        },
        'get-prototype': {
          description: 'Get a specific prototype handle',
          parameters: { typeName: 'string' },
          returns: 'MetaHandle'
        },
        'create-prototype': {
          description: 'Create a new prototype',
          parameters: { typeName: 'string', baseClass: 'function' },
          returns: 'MetaHandle'
        }
      }
    };
  }
  
  /**
   * Update factory state (create/remove prototypes)
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    switch (updateSpec.type) {
      case 'create-prototype':
        if (!updateSpec.typeName) {
          throw new Error('typeName required for create-prototype update');
        }
        return this._factory.createPrototype(
          updateSpec.typeName,
          updateSpec.baseClass,
          updateSpec.options
        );
        
      case 'remove-prototype':
        if (!updateSpec.typeName) {
          throw new Error('typeName required for remove-prototype update');
        }
        return this._factory.removePrototype(updateSpec.typeName);
        
      default:
        throw new Error(`Unknown factory update type: ${updateSpec.type}`);
    }
  }
  
  /**
   * Create query builder for factory
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    // Factory queries are simple enough not to need a builder
    // Return null to indicate no builder available
    return null;
  }
}

/**
 * MetaDataSource - DataSource implementation for prototype introspection
 * 
 * Provides query, subscribe, and update operations for prototype metadata.
 * All operations are synchronous per the DataSource contract.
 */
class MetaDataSource {
  constructor(PrototypeClass, options = {}) {
    this._prototype = PrototypeClass;
    this._typeName = options.typeName;
    this._subscriptions = new Map();
    this._subscriptionId = 0;
  }
  
  /**
   * Query prototype metadata
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    const { type, filter } = querySpec;
    
    switch (type) {
      case 'prototype-members':
        return this._getPrototypeMembers(filter);
        
      case 'methods':
        return this._getMethods();
        
      case 'properties':
        return this._getProperties();
        
      case 'inheritance-chain':
        return this._getInheritanceChain();
        
      case 'instances':
        // Can't track instances at DataSource level - return empty array
        return [];
        
      default:
        throw new Error(`Unknown meta query type: ${type}`);
    }
  }
  
  /**
   * Subscribe to prototype changes
   * CRITICAL: Must be synchronous - no await!
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }
    
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };
    
    this._subscriptions.set(subscriptionId, subscription);
    
    return subscription;
  }
  
  /**
   * Get prototype schema
   * CRITICAL: Must be synchronous - no await!
   */
  getSchema() {
    return {
      version: '1.0.0',
      type: 'prototype',
      typeName: this._typeName,
      operations: {
        'prototype-members': {
          description: 'Get all prototype members (methods and properties)',
          returns: 'object'
        },
        'methods': {
          description: 'Get all methods defined on prototype',
          returns: 'array'
        },
        'properties': {
          description: 'Get all properties defined on prototype',
          returns: 'array'
        },
        'inheritance-chain': {
          description: 'Get prototype inheritance chain',
          returns: 'array'
        }
      }
    };
  }
  
  /**
   * Update prototype (add/modify methods)
   * CRITICAL: Must be synchronous - no await!
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }
    
    const { type, name, method, descriptor } = updateSpec;
    
    switch (type) {
      case 'add-method':
        return this._addMethod(name, method);
        
      case 'modify-property':
        return this._modifyProperty(name, descriptor);
        
      default:
        throw new Error(`Unknown meta update type: ${type}`);
    }
  }
  
  /**
   * Create query builder for prototype
   * CRITICAL: Must be synchronous - no await!
   */
  queryBuilder(sourceHandle) {
    // Prototype queries are simple enough not to need a builder
    return null;
  }
  
  // Private helper methods
  
  _getPrototypeMembers(filter = null) {
    const members = {
      methods: [],
      properties: [],
      descriptors: {}
    };
    
    const descriptors = Object.getOwnPropertyDescriptors(
      this._prototype.prototype || this._prototype
    );
    
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (name === 'constructor') continue;
      
      if (typeof descriptor.value === 'function') {
        members.methods.push(name);
      } else {
        members.properties.push(name);
      }
      
      members.descriptors[name] = descriptor;
    }
    
    // If no filter, return detailed structure
    if (!filter) {
      return members;
    }
    
    // If filter specified, return filtered array
    if (filter === 'methods') {
      return members.methods;
    } else if (filter === 'properties') {
      return members.properties;
    } else if (filter === 'descriptors') {
      return members.descriptors;
    } else {
      // Unknown filter, return full structure
      return members;
    }
  }
  
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
  
  _getInheritanceChain() {
    const chain = [];
    let current = this._prototype;
    
    while (current && current !== Object && current !== Function) {
      chain.push({
        name: current.name || 'Anonymous',
        constructor: current
      });
      
      const proto = Object.getPrototypeOf(current);
      if (proto === current) break;
      current = proto;
    }
    
    return chain;
  }
  
  _addMethod(name, method) {
    if (!name || typeof name !== 'string') {
      throw new Error('Method name must be a non-empty string');
    }
    
    if (!method || typeof method !== 'function') {
      throw new Error('Method must be a function');
    }
    
    const proto = this._prototype.prototype || this._prototype;
    proto[name] = method;
    
    this._notifySubscribers({
      type: 'method-added',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  _modifyProperty(name, descriptor) {
    if (!name || typeof name !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }
    
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('Descriptor must be an object');
    }
    
    const proto = this._prototype.prototype || this._prototype;
    Object.defineProperty(proto, name, descriptor);
    
    this._notifySubscribers({
      type: 'property-modified',
      name,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  _notifySubscribers(event) {
    for (const subscription of this._subscriptions.values()) {
      try {
        subscription.callback(event);
      } catch (error) {
        console.warn('Error in meta subscription callback:', error);
      }
    }
  }
}