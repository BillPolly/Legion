/**
 * EntityTypeConstraint - Enforces entity type requirements on relationships
 * Per design §4.7: Built-in constraint for entity type validation
 * 
 * Validates that source and/or target entities of a relationship have
 * the correct entity types as specified in the constraint configuration.
 */

import { Constraint } from './Constraint.js';
import { ConstraintResult } from './ConstraintResult.js';
import { ConstraintViolation } from './ConstraintViolation.js';

// Use WeakMap to store instance data externally since objects are frozen
const instanceData = new WeakMap();

/**
 * Constraint that enforces entity types for relationship endpoints
 */
export class EntityTypeConstraint extends Constraint {
  constructor(id, relationName, entityTypes) {
    // Validate parameters first
    EntityTypeConstraint._validateParametersStatic(entityTypes);
    
    // Generate description from entity types
    const desc = EntityTypeConstraint._generateDescription(relationName, entityTypes);
    
    // Call parent constructor
    super(id, relationName, desc);
    
    // Store instance data in WeakMap since object is frozen
    instanceData.set(this, {
      sourceType: entityTypes?.source || null,
      targetType: entityTypes?.target || null
    });
  }
  
  // Private getters to access WeakMap data
  get _sourceType() {
    return instanceData.get(this).sourceType;
  }
  
  get _targetType() {
    return instanceData.get(this).targetType;
  }

  /**
   * Get the entity type requirements
   */
  getEntityTypes() {
    return {
      source: this._sourceType,
      target: this._targetType
    };
  }

  /**
   * Validate an edge against entity type constraints
   */
  validate(storeRoot, edge) {
    const violations = [];
    
    // Check source entity type if specified
    if (this._sourceType !== null) {
      const sourceType = this._getEntityType(storeRoot, edge.src);
      
      if (sourceType === null) {
        violations.push(new ConstraintViolation(
          this.id,
          `Unknown entity type for source "${edge.src}"`,
          edge,
          { expected: this._sourceType, actual: null, position: 'source' }
        ));
      } else if (!this._isTypeCompatible(storeRoot, sourceType, this._sourceType)) {
        violations.push(new ConstraintViolation(
          this.id,
          `Expected source type ${this._sourceType} but got ${sourceType}`,
          edge,
          { expected: this._sourceType, actual: sourceType, position: 'source' }
        ));
      }
    }
    
    // Check target entity type if specified
    if (this._targetType !== null) {
      const targetType = this._getEntityType(storeRoot, edge.dst);
      
      if (targetType === null) {
        violations.push(new ConstraintViolation(
          this.id,
          `Unknown entity type for target "${edge.dst}"`,
          edge,
          { expected: this._targetType, actual: null, position: 'target' }
        ));
      } else if (!this._isTypeCompatible(storeRoot, targetType, this._targetType)) {
        violations.push(new ConstraintViolation(
          this.id,
          `Expected target type ${this._targetType} but got ${targetType}`,
          edge,
          { expected: this._targetType, actual: targetType, position: 'target' }
        ));
      }
    }
    
    // Return result based on violations
    if (violations.length > 0) {
      return ConstraintResult.failure(this.id, violations);
    }
    
    return ConstraintResult.success(this.id);
  }

  /**
   * String representation
   */
  toString() {
    const parts = [];
    if (this._sourceType) parts.push(`source:${this._sourceType}`);
    if (this._targetType) parts.push(`target:${this._targetType}`);
    
    return `EntityTypeConstraint(${this.id}, ${this.relationName}, ${parts.join(', ')})`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters (static version)
   */
  static _validateParametersStatic(entityTypes) {
    // Must have entity types configuration
    if (!entityTypes || typeof entityTypes !== 'object') {
      throw new Error('Entity types configuration is required');
    }
    
    // At least one type must be specified
    if (!entityTypes.source && !entityTypes.target) {
      throw new Error('At least one entity type must be specified');
    }
    
    // Validate source type if specified
    if (entityTypes.source !== undefined && entityTypes.source !== null) {
      if (typeof entityTypes.source !== 'string') {
        throw new Error('Entity type must be a string');
      }
    }
    
    // Validate target type if specified
    if (entityTypes.target !== undefined && entityTypes.target !== null) {
      if (typeof entityTypes.target !== 'string') {
        throw new Error('Entity type must be a string');
      }
    }
  }

  /**
   * Get entity type from store
   */
  _getEntityType(storeRoot, entityId) {
    // Try to get entity metadata from store
    const metadata = storeRoot.getEntityMetadata?.(entityId);
    
    if (!metadata || !metadata.type) {
      return null;
    }
    
    return metadata.type;
  }

  /**
   * Check if actual type is compatible with expected type (including inheritance)
   */
  _isTypeCompatible(storeRoot, actualTypeName, expectedTypeName) {
    // Exact match
    if (actualTypeName === expectedTypeName) {
      return true;
    }
    
    // Check if storeRoot has entity type registry for inheritance check
    const registry = storeRoot.getEntityTypeRegistry?.();
    if (!registry) {
      // No registry, so only exact match works
      return false;
    }
    
    // Get the actual EntityType object
    const actualType = registry.getType(actualTypeName);
    if (!actualType) {
      // Type not found in registry
      return false;
    }
    
    // Check if actual type is a subtype of expected
    if (typeof actualType.isSubtypeOf === 'function') {
      return actualType.isSubtypeOf(expectedTypeName);
    }
    
    // Fallback to exact match only
    return false;
  }

  /**
   * Generate description from entity types
   */
  static _generateDescription(relationName, entityTypes) {
    const parts = [];
    
    if (entityTypes?.source) {
      parts.push(`source type ${entityTypes.source}`);
    }
    
    if (entityTypes?.target) {
      parts.push(`target type ${entityTypes.target}`);
    }
    
    return `${relationName} requires ${parts.join(' and ')}`;
  }
}