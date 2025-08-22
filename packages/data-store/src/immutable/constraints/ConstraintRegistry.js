/**
 * ConstraintRegistry - Immutable registry for constraint management
 * Per design §4.4: Constraint registration and indexing system
 * 
 * Immutable registry that manages constraints with efficient lookup by relation name.
 * Provides pure functional interface for adding/removing constraints.
 */

import { Constraint } from './Constraint.js';
import { ConstraintResult } from './ConstraintResult.js';

/**
 * Immutable constraint registry with relation-based indexing
 * Manages constraint collections and provides validation coordination
 */
export class ConstraintRegistry {
  constructor(constraints = [], constraintsByRelation = new Map()) {
    // Validate constructor parameters
    this._validateConstructorParams(constraints, constraintsByRelation);

    // Store constraints as frozen array
    this._constraints = Object.freeze([...constraints]);
    
    // Store constraints indexed by relation name as frozen Map
    this._constraintsByRelation = new Map();
    for (const [relationName, constraintSet] of constraintsByRelation) {
      this._constraintsByRelation.set(relationName, new Set(constraintSet));
    }
    Object.freeze(this._constraintsByRelation);
    
    // Create constraint lookup map by ID
    this._constraintById = new Map();
    for (const constraint of this._constraints) {
      this._constraintById.set(constraint.id, constraint);
    }
    Object.freeze(this._constraintById);
    
    // Make completely immutable
    Object.freeze(this);
  }

  // === PURE FUNCTIONAL INTERFACE ===

  /**
   * Return new registry with added constraint (pure function)
   */
  withAddedConstraint(constraint) {
    // Validate input
    if (!constraint) {
      throw new Error('Constraint is required');
    }
    if (!(constraint instanceof Constraint)) {
      throw new Error('Must be a Constraint instance');
    }

    // Check if constraint already exists (optimization)
    if (this._constraintById.has(constraint.id)) {
      const existing = this._constraintById.get(constraint.id);
      if (existing === constraint || existing.equals(constraint)) {
        return this; // Same constraint, return current instance
      }
    }

    // Create new constraints array
    const newConstraints = [...this._constraints];
    
    // Remove existing if same ID (replacement)
    const existingIndex = newConstraints.findIndex(c => c.id === constraint.id);
    if (existingIndex >= 0) {
      newConstraints.splice(existingIndex, 1);
    }
    
    // Add new constraint
    newConstraints.push(constraint);

    // Create new relation-based index
    const newConstraintsByRelation = new Map();
    for (const [relationName, constraintSet] of this._constraintsByRelation) {
      newConstraintsByRelation.set(relationName, new Set(constraintSet));
    }

    // Remove old constraint from relation index if replacing
    if (existingIndex >= 0) {
      const oldConstraint = this._constraints[existingIndex];
      const oldRelationSet = newConstraintsByRelation.get(oldConstraint.relationName);
      if (oldRelationSet) {
        oldRelationSet.delete(oldConstraint);
        if (oldRelationSet.size === 0 && oldConstraint.relationName !== '*') {
          newConstraintsByRelation.delete(oldConstraint.relationName);
        }
      }
    }

    // Add new constraint to relation index
    if (!newConstraintsByRelation.has(constraint.relationName)) {
      newConstraintsByRelation.set(constraint.relationName, new Set());
    }
    newConstraintsByRelation.get(constraint.relationName).add(constraint);

    // Return new registry instance
    return new ConstraintRegistry(newConstraints, newConstraintsByRelation);
  }

  /**
   * Return new registry with removed constraint (pure function)
   */
  withRemovedConstraint(constraintId) {
    // Validate input
    if (!constraintId || typeof constraintId !== 'string') {
      throw new Error('Constraint id is required');
    }

    // Check if constraint exists
    if (!this._constraintById.has(constraintId)) {
      return this; // No change needed
    }

    const constraintToRemove = this._constraintById.get(constraintId);

    // Create new constraints array without the removed constraint
    const newConstraints = this._constraints.filter(c => c.id !== constraintId);

    // Create new relation-based index
    const newConstraintsByRelation = new Map();
    for (const [relationName, constraintSet] of this._constraintsByRelation) {
      const newSet = new Set(constraintSet);
      newSet.delete(constraintToRemove);
      
      // Only keep relation entries that have constraints (except global)
      if (newSet.size > 0 || relationName === '*') {
        newConstraintsByRelation.set(relationName, newSet);
      }
    }

    // Return new registry instance
    return new ConstraintRegistry(newConstraints, newConstraintsByRelation);
  }

  // === READ-ONLY ACCESSORS ===

  /**
   * Get constraint by ID
   */
  getConstraint(constraintId) {
    if (!constraintId || typeof constraintId !== 'string') {
      throw new Error('Constraint id is required');
    }
    return this._constraintById.get(constraintId) || null;
  }

  /**
   * Check if constraint exists
   */
  hasConstraint(constraintId) {
    return this._constraintById.has(constraintId);
  }

  /**
   * Get all constraints for a specific relation
   * Includes global constraints (relation name '*')
   */
  getConstraintsForRelation(relationName) {
    if (relationName === null || relationName === undefined) {
      throw new Error('Relation name is required');
    }

    const constraints = [];
    
    // Add specific constraints for this relation
    const specificConstraints = this._constraintsByRelation.get(relationName);
    if (specificConstraints) {
      constraints.push(...specificConstraints);
    }
    
    // Add global constraints (apply to all relations)
    const globalConstraints = this._constraintsByRelation.get('*');
    if (globalConstraints) {
      constraints.push(...globalConstraints);
    }
    
    return Object.freeze([...constraints]);
  }

  /**
   * Get all constraints
   */
  getAllConstraints() {
    return this._constraints;
  }

  /**
   * Get all relation names
   */
  getRelationNames() {
    return Object.freeze([...this._constraintsByRelation.keys()]);
  }

  /**
   * Get constraint count
   */
  getConstraintCount() {
    return this._constraints.length;
  }

  /**
   * Check if there are global constraints
   */
  hasGlobalConstraints() {
    const globalConstraints = this._constraintsByRelation.get('*');
    return !!(globalConstraints && globalConstraints.size > 0);
  }

  /**
   * Get global constraints
   */
  getGlobalConstraints() {
    const globalConstraints = this._constraintsByRelation.get('*');
    return Object.freeze([...(globalConstraints || [])]);
  }

  // === CONSTRAINT VALIDATION INTEGRATION ===

  /**
   * Validate edge against all applicable constraints
   */
  validateEdge(storeRoot, edge) {
    if (!edge || !edge.type) {
      throw new Error('Edge with type is required');
    }
    
    const applicableConstraints = this.getConstraintsForRelation(edge.type);
    const results = [];
    
    for (const constraint of applicableConstraints) {
      const result = constraint.validate(storeRoot, edge);
      results.push(result);
    }
    
    return results;
  }

  // === STATISTICS AND INTROSPECTION ===

  /**
   * Get comprehensive statistics about the registry
   */
  getStatistics() {
    const stats = {
      totalConstraints: this._constraints.length,
      globalConstraints: this.hasGlobalConstraints() ? this.getGlobalConstraints().length : 0,
      relationCount: this._constraintsByRelation.size,
      constraintsByRelation: {}
    };
    
    for (const [relationName, constraintSet] of this._constraintsByRelation) {
      stats.constraintsByRelation[relationName] = constraintSet.size;
    }
    
    return Object.freeze(stats);
  }

  /**
   * Validate internal registry structure for consistency
   */
  validateStructure() {
    const issues = [];
    
    // Check that all constraints in arrays are also in maps
    for (const constraint of this._constraints) {
      if (!this._constraintById.has(constraint.id)) {
        issues.push(`Constraint ${constraint.id} in array but not in ID map`);
      }
      
      const relationSet = this._constraintsByRelation.get(constraint.relationName);
      if (!relationSet || !relationSet.has(constraint)) {
        issues.push(`Constraint ${constraint.id} not properly indexed by relation ${constraint.relationName}`);
      }
    }
    
    // Check that all constraints in maps are also in array
    for (const constraint of this._constraintById.values()) {
      if (!this._constraints.includes(constraint)) {
        issues.push(`Constraint ${constraint.id} in ID map but not in array`);
      }
    }
    
    return issues;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const constraintCount = this._constraints.length;
    const relationCount = this._constraintsByRelation.size;
    return `ConstraintRegistry(${constraintCount} constraints across ${relationCount} relations)`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(constraints, constraintsByRelation) {
    if (!Array.isArray(constraints)) {
      throw new Error('Constraints must be an array');
    }
    
    for (const constraint of constraints) {
      if (!(constraint instanceof Constraint)) {
        throw new Error('All constraints must be Constraint instances');
      }
    }
    
    if (!(constraintsByRelation instanceof Map)) {
      throw new Error('Constraints by relation must be a Map');
    }
  }
}