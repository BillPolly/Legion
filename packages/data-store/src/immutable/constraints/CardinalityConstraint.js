/**
 * CardinalityConstraint - Enforces min/max cardinality on relationships
 * Per design §4.6: Built-in constraint for relationship cardinality
 * 
 * Validates that entities don't exceed specified min/max number of relationships.
 * Can enforce cardinality on either source or target side of relationships.
 */

import { Constraint } from './Constraint.js';
import { ConstraintResult } from './ConstraintResult.js';
import { ConstraintViolation } from './ConstraintViolation.js';

// Use WeakMap to store instance data externally since objects are frozen
const instanceData = new WeakMap();

/**
 * Constraint that enforces cardinality limits on relationships
 */
export class CardinalityConstraint extends Constraint {
  constructor(id, relationName, direction, min, max) {
    // Validate parameters first
    CardinalityConstraint._validateParametersStatic(direction, min, max);
    
    // Generate description based on cardinality
    const desc = CardinalityConstraint._generateDescription(relationName, direction, min, max);
    
    // Call parent constructor
    super(id, relationName, desc);
    
    // Store instance data in WeakMap since object is frozen
    instanceData.set(this, { direction, min, max });
  }
  
  // Private getters to access WeakMap data
  get _direction() {
    return instanceData.get(this).direction;
  }
  
  get _min() {
    return instanceData.get(this).min;
  }
  
  get _max() {
    return instanceData.get(this).max;
  }

  /**
   * Get the cardinality configuration
   */
  getCardinality() {
    return { min: this._min, max: this._max };
  }

  /**
   * Get the direction (source or target)
   */
  getDirection() {
    return this._direction;
  }

  /**
   * Validate an edge against cardinality constraints
   */
  validate(storeRoot, edge) {
    // Get current count for the entity
    const entityId = this._direction === 'source' ? edge.src : edge.dst;
    const currentCount = this._getEntityRelationshipCount(storeRoot, edge.type, entityId);
    
    // Check max cardinality (adding this edge would make it currentCount + 1)
    if (this._max !== null && currentCount >= this._max) {
      const violation = new ConstraintViolation(
        this.id,
        `Adding this edge would exceed maximum cardinality of ${this._max} for ${this._direction} "${entityId}"`,
        edge,
        { 
          direction: this._direction,
          currentCount,
          maxAllowed: this._max
        }
      );
      return ConstraintResult.failure(this.id, [violation]);
    }
    
    return ConstraintResult.success(this.id);
  }

  /**
   * Validate removal of an edge (for min cardinality)
   */
  validateRemoval(storeRoot, edge) {
    // Get current count for the entity
    const entityId = this._direction === 'source' ? edge.src : edge.dst;
    const currentCount = this._getEntityRelationshipCount(storeRoot, edge.type, entityId);
    
    // Debug logging
    // console.log(`validateRemoval: entityId=${entityId}, direction=${this._direction}, currentCount=${currentCount}, min=${this._min}`);
    
    // Check min cardinality (removing this edge would make it currentCount - 1)
    const countAfterRemoval = currentCount - 1;
    if (this._min !== null && countAfterRemoval < this._min) {
      const violation = new ConstraintViolation(
        this.id,
        `Removing this edge would violate minimum cardinality of ${this._min} for ${this._direction} "${entityId}"`,
        edge,
        {
          direction: this._direction,
          currentCount,
          countAfterRemoval,
          minRequired: this._min
        }
      );
      return ConstraintResult.failure(this.id, [violation]);
    }
    
    return ConstraintResult.success(this.id);
  }

  /**
   * String representation
   */
  toString() {
    const range = this._formatCardinalityRange();
    return `CardinalityConstraint(${this.id}, ${this.relationName}, ${this._direction}: ${range})`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters (static version)
   */
  static _validateParametersStatic(direction, min, max) {
    // Validate direction
    if (direction !== 'source' && direction !== 'target') {
      throw new Error('Direction must be "source" or "target"');
    }
    
    // Validate min
    if (min !== null && min !== undefined) {
      if (typeof min !== 'number') {
        throw new Error('Min cardinality must be a number or null');
      }
      if (min < 0) {
        throw new Error('Min cardinality must be non-negative');
      }
    }
    
    // Validate max
    if (max !== null && max !== undefined) {
      if (typeof max !== 'number') {
        throw new Error('Max cardinality must be a number or null');
      }
      if (max < 0) {
        throw new Error('Max cardinality must be non-negative');
      }
    }
    
    // At least one must be specified
    if ((min === null || min === undefined) && (max === null || max === undefined)) {
      throw new Error('At least one of min or max cardinality must be specified');
    }
    
    // Max must be >= min if both specified
    if (min !== null && max !== null && max < min) {
      throw new Error('Max cardinality must be greater than or equal to min');
    }
  }

  /**
   * Get the count of relationships for an entity
   */
  _getEntityRelationshipCount(storeRoot, relationName, entityId) {
    // Count edges where entity appears in the specified direction
    let count = 0;
    
    if (this._direction === 'source') {
      // Get all edges where entityId is the source, then filter by type
      const allEdgesFromSource = storeRoot.getEdgesBySource(entityId);
      // console.log(`  _getEntityRelationshipCount source: entityId=${entityId}, edges:`, allEdgesFromSource?.size);
      for (const edge of allEdgesFromSource) {
        if (edge.type === relationName) {
          count++;
        }
      }
    } else {
      // Get all edges where entityId is the target, then filter by type
      const allEdgesToTarget = storeRoot.getEdgesByDestination(entityId);
      // console.log(`  _getEntityRelationshipCount target: entityId=${entityId}, edges:`, allEdgesToTarget?.size);
      for (const edge of allEdgesToTarget) {
        if (edge.type === relationName) {
          count++;
        }
      }
    }
    
    return count;
  }

  /**
   * Format cardinality range for display
   */
  _formatCardinalityRange() {
    if (this._min !== null && this._max !== null) {
      return `${this._min}-${this._max}`;
    } else if (this._min !== null) {
      return `${this._min}+`;
    } else {
      return `0-${this._max}`;
    }
  }

  /**
   * Generate description from parameters
   */
  static _generateDescription(relationName, direction, min, max) {
    let range;
    if (min !== null && max !== null) {
      range = `${min}-${max}`;
    } else if (min !== null) {
      range = `at least ${min}`;
    } else {
      range = `at most ${max}`;
    }
    
    return `${direction} cardinality ${range} for ${relationName}`;
  }
}