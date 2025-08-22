/**
 * Constraint - Abstract base class for data store constraints
 * Per design §4.1: Base constraint interface for validation framework
 * 
 * Abstract constraint that defines the interface for all constraint types.
 * Constraints validate edges against business rules and return results.
 */

/**
 * Abstract base class for all constraints
 * Defines the interface that all constraint implementations must follow
 */
export class Constraint {
  constructor(id, relationName, description) {
    // Validate constructor parameters
    this._validateConstructorParams(id, relationName, description);

    this._id = id;
    this._relationName = relationName;
    this._description = description;
    
    // Make completely immutable
    Object.freeze(this);
  }

  /**
   * Get the unique identifier for this constraint
   */
  get id() {
    return this._id;
  }

  /**
   * Get the relation name this constraint applies to
   */
  get relationName() {
    return this._relationName;
  }

  /**
   * Get the relationship type this constraint applies to (alias for relationName)
   */
  get relationshipType() {
    return this._relationName;
  }

  /**
   * Get the human-readable description of this constraint
   */
  get description() {
    return this._description;
  }

  /**
   * Validate an edge against this constraint
   * Must be implemented by subclasses
   * 
   * @param {ImmutableStoreRoot} storeRoot - Current store state for context
   * @param {Edge} edge - Edge to validate
   * @returns {ConstraintResult} - Validation result
   */
  validate(storeRoot, edge) {
    throw new Error('validate() method must be implemented by subclass');
  }

  /**
   * Check equality with another constraint
   */
  equals(other) {
    if (!(other instanceof Constraint)) {
      return false;
    }
    return this._id === other._id &&
           this._relationName === other._relationName &&
           this._description === other._description;
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `Constraint(${this._id}, ${this._relationName}, "${this._description}")`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(id, relationName, description) {
    if (!id || typeof id !== 'string') {
      throw new Error('Constraint id is required');
    }
    if (!relationName || typeof relationName !== 'string') {
      throw new Error('Relation name is required');
    }
    if (!description || typeof description !== 'string') {
      throw new Error('Description is required');
    }
  }
}