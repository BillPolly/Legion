/**
 * RelationshipType and registry for managing attribute names
 * Per design §1: Attributes have forward/backward names
 */

import { ForwardAttribute, BackwardAttribute } from './Attribute.js';

/**
 * RelationshipType represents a relationship with forward and backward attribute names
 * Per design §1.1: Every relationship type R has two attribute names
 */
export class RelationshipType {
  constructor(forwardName, backwardName) {
    if (forwardName === null || forwardName === undefined) {
      throw new Error('Forward name is required');
    }
    if (backwardName === null || backwardName === undefined) {
      throw new Error('Backward name is required');
    }
    if (typeof forwardName !== 'string') {
      throw new Error('Forward name must be a string');
    }
    if (typeof backwardName !== 'string') {
      throw new Error('Backward name must be a string');
    }
    if (forwardName === '') {
      throw new Error('Forward name cannot be empty');
    }
    if (backwardName === '') {
      throw new Error('Backward name cannot be empty');
    }

    this._forwardName = forwardName;
    this._backwardName = backwardName;
    this._name = forwardName; // Type name is the forward name
    
    // Create attributes immediately to avoid freezing issues
    this._forwardAttribute = new ForwardAttribute(forwardName, backwardName);
    this._backwardAttribute = new BackwardAttribute(forwardName, backwardName);
    
    Object.freeze(this);
  }

  get name() {
    return this._name;
  }

  get forwardName() {
    return this._forwardName;
  }

  get backwardName() {
    return this._backwardName;
  }

  /**
   * Get forward attribute
   */
  getForwardAttribute() {
    return this._forwardAttribute;
  }

  /**
   * Get backward attribute
   */
  getBackwardAttribute() {
    return this._backwardAttribute;
  }

  /**
   * Get both attributes
   */
  getAttributes() {
    return [this.getForwardAttribute(), this.getBackwardAttribute()];
  }

  /**
   * Get attribute by name
   */
  getAttributeByName(name) {
    if (name === this._forwardName) {
      return this.getForwardAttribute();
    }
    if (name === this._backwardName) {
      return this.getBackwardAttribute();
    }
    return null;
  }

  /**
   * Check if this type has an attribute with the given name
   */
  hasAttribute(name) {
    return name === this._forwardName || name === this._backwardName;
  }

  /**
   * Get kernel relation names for this type
   * Per design §1.2: Forward A[src,dst] and Backward A_inv[dst,src]
   */
  getKernelRelationNames() {
    return [
      this._forwardName,        // Forward relation
      `${this._forwardName}_inv` // Backward relation with _inv suffix
    ];
  }

  /**
   * Check if kernel relation belongs to this type
   */
  hasKernelRelation(relationName) {
    return relationName === this._forwardName || 
           relationName === `${this._forwardName}_inv`;
  }

  /**
   * Check equality
   */
  equals(other) {
    if (!(other instanceof RelationshipType)) {
      return false;
    }
    return this._forwardName === other._forwardName &&
           this._backwardName === other._backwardName;
  }

  /**
   * String representation
   */
  toString() {
    return `RelationshipType(${this._forwardName}, ${this._backwardName})`;
  }

  /**
   * Static factory method
   */
  static create(forwardName, backwardName) {
    return new RelationshipType(forwardName, backwardName);
  }

  /**
   * Create symmetric relationship type (same forward and backward name)
   */
  static symmetric(name) {
    return new RelationshipType(name, name);
  }
}

/**
 * Registry for managing relationship types
 * Maps type names to RelationshipType instances
 */
export class RelationshipTypeRegistry {
  constructor() {
    this._types = new Map(); // typeName -> RelationshipType
    this._attributeToType = new Map(); // attributeName -> RelationshipType
    this._kernelRelationToAttribute = new Map(); // kernelRelationName -> Attribute
  }

  /**
   * Register a relationship type
   */
  register(type) {
    if (!type) {
      throw new Error('Relationship type is required');
    }
    if (!(type instanceof RelationshipType)) {
      throw new Error('Must be a RelationshipType instance');
    }

    const typeName = type.name;
    if (this._types.has(typeName)) {
      throw new Error(`Relationship type '${typeName}' is already registered`);
    }

    // Register type
    this._types.set(typeName, type);

    // Register attribute name mappings
    const forward = type.getForwardAttribute();
    const backward = type.getBackwardAttribute();
    
    this._attributeToType.set(forward.name, type);
    this._attributeToType.set(backward.name, type);

    // Register kernel relation mappings
    this._kernelRelationToAttribute.set(forward.kernelRelationName, forward);
    this._kernelRelationToAttribute.set(backward.kernelRelationName, backward);
  }

  /**
   * Register relationship type with convenience method
   */
  registerType(forwardName, backwardName) {
    const type = new RelationshipType(forwardName, backwardName);
    this.register(type);
    return type;
  }

  /**
   * Get relationship type by name
   */
  getType(typeName) {
    const type = this._types.get(typeName);
    if (!type) {
      throw new Error(`Relationship type '${typeName}' not found`);
    }
    return type;
  }

  /**
   * Check if type is registered
   */
  hasType(typeName) {
    return this._types.has(typeName);
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
   * Get attribute by name
   */
  getAttributeByName(attributeName) {
    const type = this._attributeToType.get(attributeName);
    if (!type) {
      throw new Error(`Attribute '${attributeName}' not found`);
    }
    return type.getAttributeByName(attributeName);
  }

  /**
   * Check if attribute is registered
   */
  hasAttribute(attributeName) {
    return this._attributeToType.has(attributeName);
  }

  /**
   * Get all attribute names
   */
  getAttributeNames() {
    return Array.from(this._attributeToType.keys());
  }

  /**
   * Get attribute by kernel relation name
   */
  getAttributeByKernelRelation(kernelRelationName) {
    const attribute = this._kernelRelationToAttribute.get(kernelRelationName);
    if (!attribute) {
      throw new Error(`Kernel relation '${kernelRelationName}' not found`);
    }
    return attribute;
  }

  /**
   * Check if kernel relation is registered
   */
  hasKernelRelation(kernelRelationName) {
    return this._kernelRelationToAttribute.has(kernelRelationName);
  }

  /**
   * Get all kernel relation names
   */
  getKernelRelationNames() {
    return Array.from(this._kernelRelationToAttribute.keys());
  }

  /**
   * Remove relationship type
   */
  removeType(typeName) {
    const type = this._types.get(typeName);
    if (!type) {
      return; // Silently handle non-existent types
    }

    // Remove from types map
    this._types.delete(typeName);

    // Remove attribute mappings
    const forward = type.getForwardAttribute();
    const backward = type.getBackwardAttribute();
    
    this._attributeToType.delete(forward.name);
    this._attributeToType.delete(backward.name);

    // Remove kernel relation mappings
    this._kernelRelationToAttribute.delete(forward.kernelRelationName);
    this._kernelRelationToAttribute.delete(backward.kernelRelationName);
  }

  /**
   * Clear all types
   */
  clear() {
    this._types.clear();
    this._attributeToType.clear();
    this._kernelRelationToAttribute.clear();
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      typeCount: this._types.size,
      attributeCount: this._attributeToType.size,
      kernelRelationCount: this._kernelRelationToAttribute.size
    };
  }
}