/**
 * EntityTypeRegistry - Immutable registry for entity type definitions
 * Per implementation plan Phase 4 Step 4.2
 * Provides entity type registration, lookup, validation, and inheritance management
 */

import { EntityType } from './EntityType.js';

export class EntityTypeRegistry {
  constructor(initialTypes = []) {
    // Fail fast validation
    if (initialTypes !== null && initialTypes !== undefined && !Array.isArray(initialTypes)) {
      throw new Error('Initial types must be an array');
    }
    if (Array.isArray(initialTypes) && !initialTypes.every(t => t instanceof EntityType)) {
      throw new Error('All initial types must be EntityType instances');
    }

    // Initialize types map
    const typesMap = new Map();
    
    // Register initial types
    if (Array.isArray(initialTypes)) {
      for (const type of initialTypes) {
        typesMap.set(type.name, type);
      }
    }

    // Create immutable wrapper for the Map
    this._types = this._createImmutableMap(typesMap);
    
    // Freeze the instance
    Object.freeze(this);
  }

  /**
   * Create an immutable wrapper around a Map
   */
  _createImmutableMap(map) {
    return new Proxy(map, {
      get(target, prop) {
        if (prop === 'set' || prop === 'delete' || prop === 'clear') {
          throw new TypeError(`Cannot ${prop} on immutable Map`);
        }
        return typeof target[prop] === 'function' 
          ? target[prop].bind(target)
          : target[prop];
      }
    });
  }

  /**
   * Register a new entity type
   */
  registerType(type) {
    // Fail fast validation
    if (!type) {
      throw new Error('Type is required');
    }
    if (!(type instanceof EntityType)) {
      throw new Error('Type must be an EntityType instance');
    }

    // Create new map with the type added
    const newTypes = new Map(this._types);
    newTypes.set(type.name, type);
    
    // Create new registry instance
    const newRegistry = Object.create(Object.getPrototypeOf(this));
    newRegistry._types = this._createImmutableMap.call(newRegistry, newTypes);
    
    return Object.freeze(newRegistry);
  }

  /**
   * Unregister an entity type
   */
  unregisterType(typeName) {
    if (!this._types.has(typeName)) {
      return this; // No change needed
    }

    // Create new map without the type
    const newTypes = new Map(this._types);
    newTypes.delete(typeName);
    
    // Create new registry instance
    const newRegistry = Object.create(Object.getPrototypeOf(this));
    newRegistry._types = this._createImmutableMap.call(newRegistry, newTypes);
    
    return Object.freeze(newRegistry);
  }

  /**
   * Register multiple types at once
   */
  registerBatch(types) {
    // Fail fast validation
    if (!Array.isArray(types)) {
      throw new Error('Types must be an array');
    }
    if (!types.every(t => t instanceof EntityType)) {
      throw new Error('All types must be EntityType instances');
    }

    // Create new map with all types added
    const newTypes = new Map(this._types);
    for (const type of types) {
      newTypes.set(type.name, type);
    }
    
    // Create new registry instance
    const newRegistry = Object.create(Object.getPrototypeOf(this));
    newRegistry._types = this._createImmutableMap.call(newRegistry, newTypes);
    
    return Object.freeze(newRegistry);
  }

  /**
   * Clear all types
   */
  clear() {
    const newRegistry = Object.create(Object.getPrototypeOf(this));
    newRegistry._types = this._createImmutableMap.call(newRegistry, new Map());
    return Object.freeze(newRegistry);
  }

  /**
   * Get a type by name
   */
  getType(name) {
    return this._types.get(name);
  }

  /**
   * Check if a type exists
   */
  hasType(name) {
    return this._types.has(name);
  }

  /**
   * Get the count of registered types
   */
  getTypeCount() {
    return this._types.size;
  }

  /**
   * Get all type names
   */
  getTypeNames() {
    return Array.from(this._types.keys());
  }

  /**
   * Get all types
   */
  getAllTypes() {
    return Array.from(this._types.values());
  }

  /**
   * Find types matching a predicate
   */
  findTypes(predicate) {
    return this.getAllTypes().filter(predicate);
  }

  /**
   * Validate an entity against a registered type
   */
  validateEntity(typeName, entity) {
    const type = this._types.get(typeName);
    
    if (!type) {
      return {
        isValid: false,
        errors: [{
          type: 'unknown_type',
          message: `Unknown entity type: ${typeName}`
        }]
      };
    }

    return type.validate(entity);
  }

  /**
   * Batch validate multiple entities
   */
  validateBatch(entities) {
    return entities.map(({ type, entity }) => 
      this.validateEntity(type, entity)
    );
  }

  /**
   * Get the inheritance chain for a type
   */
  getInheritanceChain(typeName) {
    const type = this._types.get(typeName);
    if (!type) {
      return [];
    }

    const chain = [];
    let current = type;
    
    while (current) {
      chain.push(current);
      current = current.parent;
    }
    
    return chain;
  }

  /**
   * Get all subtypes of a given type
   */
  getSubtypes(typeName) {
    const parentType = this._types.get(typeName);
    if (!parentType) {
      return [];
    }

    const subtypes = [];
    
    for (const type of this._types.values()) {
      // Check if type has parentType in its inheritance chain
      let current = type.parent;
      while (current) {
        if (current === parentType) {
          subtypes.push(type);
          break;
        }
        current = current.parent;
      }
    }
    
    return subtypes;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const types = this.getAllTypes();
    const typesWithInheritance = types.filter(t => t.parent !== null).length;
    
    let totalRequired = 0;
    let totalOptional = 0;
    
    for (const type of types) {
      totalRequired += type.required.length;
      totalOptional += type.optional.length;
    }
    
    return {
      totalTypes: types.length,
      typesWithInheritance,
      averageRequiredFields: types.length > 0 ? totalRequired / types.length : 0,
      averageOptionalFields: types.length > 0 ? totalOptional / types.length : 0
    };
  }

  /**
   * String representation
   */
  toString() {
    return `EntityTypeRegistry(${this._types.size} types)`;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      types: this.getAllTypes().map(t => t.toJSON())
    };
  }
}