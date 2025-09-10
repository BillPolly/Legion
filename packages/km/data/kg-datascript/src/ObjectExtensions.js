/**
 * ObjectExtensions - Extends Object.prototype with KG methods
 * 
 * This class adds convenient methods to all objects for working with
 * the KG system. The extensions are non-enumerable and can be cleanly
 * removed when needed.
 */
export class ObjectExtensions {
  static identityManager = null;
  static serializer = null;
  static idGenerator = null;
  static initialized = false;

  /**
   * Initialize object extensions with required dependencies
   * @param {ObjectIdentityManager} identityManager - Identity manager instance
   * @param {SerializationEngine} serializer - Serializer instance
   * @param {StableIdGenerator} idGenerator - ID generator instance
   */
  static initialize(identityManager, serializer, idGenerator) {
    if (this.initialized) {
      console.warn('ObjectExtensions already initialized, cleaning up first');
      this.cleanup();
    }

    if (!identityManager) {
      throw new Error('ObjectIdentityManager is required for ObjectExtensions');
    }
    if (!serializer) {
      throw new Error('SerializationEngine is required for ObjectExtensions');
    }
    if (!idGenerator) {
      throw new Error('StableIdGenerator is required for ObjectExtensions');
    }

    this.identityManager = identityManager;
    this.serializer = serializer;
    this.idGenerator = idGenerator;

    // Add toTriples method
    Object.defineProperty(Object.prototype, 'toTriples', {
      value: function() {
        return ObjectExtensions._toTriples(this);
      },
      writable: true,
      configurable: true,
      enumerable: false
    });

    // Add getId method
    Object.defineProperty(Object.prototype, 'getId', {
      value: function() {
        return ObjectExtensions._getId(this);
      },
      writable: true,
      configurable: true,
      enumerable: false
    });

    // Add getStableId method
    Object.defineProperty(Object.prototype, 'getStableId', {
      value: function() {
        return ObjectExtensions._getStableId(this);
      },
      writable: true,
      configurable: true,
      enumerable: false
    });

    this.initialized = true;
  }

  /**
   * Remove all object extensions
   */
  static cleanup() {
    if (Object.prototype.toTriples) {
      delete Object.prototype.toTriples;
    }
    if (Object.prototype.getId) {
      delete Object.prototype.getId;
    }
    if (Object.prototype.getStableId) {
      delete Object.prototype.getStableId;
    }

    this.identityManager = null;
    this.serializer = null;
    this.idGenerator = null;
    this.initialized = false;
  }

  /**
   * Implementation of toTriples method
   * @private
   */
  static _toTriples(obj) {
    // Handle primitives
    if (obj === null || obj === undefined) {
      return [];
    }

    // Skip primitives that box to objects
    if (typeof obj !== 'object') {
      return [];
    }

    // Check if object has its own toTriples property
    if (obj.hasOwnProperty('toTriples') && typeof obj.toTriples !== 'function') {
      // Object has own property that shadows the prototype method
      return [];
    }

    // Auto-register if not already registered
    let objId = this.identityManager.getId(obj);
    if (!objId) {
      objId = this.identityManager.register(obj);
    }

    // Use serializer to convert to triples
    return this.serializer.serialize(obj);
  }

  /**
   * Implementation of getId method
   * @private
   */
  static _getId(obj) {
    // Handle primitives
    if (obj === null || obj === undefined) {
      return null;
    }

    // Skip primitives that box to objects
    if (typeof obj !== 'object') {
      return null;
    }

    // Check if object has its own getId property
    if (obj.hasOwnProperty('getId') && typeof obj.getId !== 'function') {
      // Object has own property that shadows the prototype method
      return null;
    }

    // Return the registered ID or null
    return this.identityManager.getId(obj) || null;
  }

  /**
   * Implementation of getStableId method
   * @private
   */
  static _getStableId(obj) {
    // Handle primitives
    if (obj === null || obj === undefined) {
      return null;
    }

    // Skip primitives that box to objects
    if (typeof obj !== 'object') {
      return null;
    }

    // Check if object has its own getStableId property
    if (obj.hasOwnProperty('getStableId') && typeof obj.getStableId !== 'function') {
      // Object has own property that shadows the prototype method
      return null;
    }

    // Generate stable ID
    return this.idGenerator.generateId(obj);
  }

  /**
   * Check if extensions are initialized
   * @returns {boolean} True if initialized
   */
  static isInitialized() {
    return this.initialized;
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  static getConfig() {
    return {
      initialized: this.initialized,
      hasIdentityManager: !!this.identityManager,
      hasSerializer: !!this.serializer,
      hasIdGenerator: !!this.idGenerator
    };
  }
}