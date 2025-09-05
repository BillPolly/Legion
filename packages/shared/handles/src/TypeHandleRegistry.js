/**
 * TypeHandleRegistry - Global registry for handle type metadata
 * 
 * Manages registration and lookup of handle types, provides auto-registration
 * from handle classes, and maintains the global type registry.
 */

import { TypeHandle } from './TypeHandle.js';

export class TypeHandleRegistry {
  constructor() {
    this.types = new Map(); // typeName -> TypeHandle instance
  }

  /**
   * Register a new handle type
   * @param {string} typeName - Name of the handle type
   * @param {Object} metadata - Type metadata (methods, attributes, docs)
   * @returns {TypeHandle} Created TypeHandle instance
   */
  registerType(typeName, metadata) {
    if (this.types.has(typeName)) {
      throw new Error(`Type ${typeName} already registered`);
    }

    this._validateMetadata(metadata);

    const typeHandle = new TypeHandle(typeName, metadata);
    this.types.set(typeName, typeHandle);
    
    return typeHandle;
  }

  /**
   * Get TypeHandle for a registered type
   * @param {string} typeName - Name of the type
   * @returns {TypeHandle|null} TypeHandle or null if not found
   */
  getTypeHandle(typeName) {
    return this.types.get(typeName) || null;
  }

  /**
   * Check if a type is registered
   * @param {string} typeName - Name of the type
   * @returns {boolean} True if type exists
   */
  hasType(typeName) {
    return this.types.has(typeName);
  }

  /**
   * List all registered type names
   * @returns {Array<string>} Array of type names
   */
  listTypeNames() {
    return Array.from(this.types.keys());
  }

  /**
   * List all registered TypeHandle instances
   * @returns {Array<TypeHandle>} Array of TypeHandle instances
   */
  listAllTypes() {
    return Array.from(this.types.values());
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    return {
      totalTypes: this.types.size,
      typeNames: this.listTypeNames()
    };
  }

  /**
   * Auto-register type from handle class
   * @param {Function} HandleClass - Handle class with static metadata methods
   * @returns {TypeHandle} Created TypeHandle instance
   */
  autoRegisterFromClass(HandleClass) {
    if (typeof HandleClass.getTypeName !== 'function') {
      throw new Error('Handle class must implement getTypeName() static method');
    }

    const typeName = HandleClass.getTypeName();
    
    let metadata;
    if (typeof HandleClass.getTypeMetadata === 'function') {
      metadata = HandleClass.getTypeMetadata();
    } else {
      // Extract metadata from class if not provided
      metadata = this._extractMetadataFromClass(HandleClass);
    }

    return this.registerType(typeName, metadata);
  }

  /**
   * Unregister a type
   * @param {string} typeName - Name of the type to unregister
   * @returns {boolean} True if type was unregistered, false if not found
   */
  unregisterType(typeName) {
    return this.types.delete(typeName);
  }

  /**
   * Clear all registered types
   */
  clear() {
    this.types.clear();
  }

  /**
   * Get or create global registry singleton
   * @returns {TypeHandleRegistry} Global registry instance
   */
  static getGlobalRegistry() {
    if (!global.TypeHandleRegistry || !(global.TypeHandleRegistry instanceof TypeHandleRegistry)) {
      global.TypeHandleRegistry = new TypeHandleRegistry();
    }
    
    return global.TypeHandleRegistry;
  }

  /**
   * Validate type metadata
   * @private
   * @param {Object} metadata - Metadata to validate
   */
  _validateMetadata(metadata) {
    if (!metadata) {
      throw new Error('Type metadata is required');
    }

    if (!metadata.methods || typeof metadata.methods !== 'object') {
      throw new Error('Type metadata must include methods object');
    }
  }

  /**
   * Extract metadata from handle class (auto-discovery)
   * @private
   * @param {Function} HandleClass - Handle class to analyze
   * @returns {Object} Extracted metadata
   */
  _extractMetadataFromClass(HandleClass) {
    const methods = {};
    const attributes = {};

    // Get prototype methods (exclude constructor and Actor methods)
    const prototype = HandleClass.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype)
      .filter(name => name !== 'constructor' && typeof prototype[name] === 'function');

    // Convert methods to metadata format
    methodNames.forEach(name => {
      methods[name] = {
        params: [], // TODO: Extract parameter info via reflection
        returns: 'any', // TODO: Extract return type info
        documentation: `Auto-generated method: ${name}`
      };
    });

    // Get property descriptors for attributes
    const descriptors = Object.getOwnPropertyDescriptors(prototype);
    Object.keys(descriptors).forEach(name => {
      const descriptor = descriptors[name];
      if (descriptor.get || descriptor.set) {
        attributes[name] = {
          type: 'any', // TODO: Extract type info
          readonly: !descriptor.set,
          documentation: `Auto-generated attribute: ${name}`
        };
      }
    });

    return {
      methods,
      attributes,
      documentation: {
        description: `Auto-generated type for ${HandleClass.name}`,
        examples: []
      },
      version: '1.0.0'
    };
  }
}