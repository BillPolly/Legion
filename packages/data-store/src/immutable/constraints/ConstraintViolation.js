/**
 * ConstraintViolation - Represents a constraint validation failure
 * Per design §4.2: Violation reporting for constraint system
 * 
 * Immutable violation record that captures details about constraint failures,
 * including the offending edge and contextual metadata.
 */

import { Edge } from '../../Edge.js';

/**
 * Immutable representation of a constraint violation
 * Contains all information needed to understand and report the violation
 */
export class ConstraintViolation {
  constructor(constraintId, message, edge, metadata = {}) {
    // Validate constructor parameters
    this._validateConstructorParams(constraintId, message, edge);

    this._constraintId = constraintId;
    this._message = message;
    this._edge = edge;
    this._metadata = Object.freeze({ ...metadata });
    
    // Make completely immutable
    Object.freeze(this);
  }

  /**
   * Get the ID of the constraint that was violated
   */
  get constraintId() {
    return this._constraintId;
  }

  /**
   * Get the human-readable violation message
   */
  get message() {
    return this._message;
  }

  /**
   * Get the edge that caused the violation
   */
  get edge() {
    return this._edge;
  }

  /**
   * Get additional metadata about the violation
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * Get context (alias for metadata for error handling API compatibility)
   */
  get context() {
    return this._metadata;
  }

  /**
   * Get the severity level of this violation
   * Defaults to 'error' if not specified in metadata
   */
  getSeverity() {
    return this._metadata.severity || 'error';
  }

  /**
   * Check equality with another violation
   */
  equals(other) {
    if (!(other instanceof ConstraintViolation)) {
      return false;
    }
    return this._constraintId === other._constraintId &&
           this._message === other._message &&
           this._edge.equals(other._edge);
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `ConstraintViolation(${this._constraintId}: "${this._message}")`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(constraintId, message, edge) {
    if (!constraintId || typeof constraintId !== 'string') {
      throw new Error('Constraint id is required');
    }
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required');
    }
    if (!edge) {
      throw new Error('Edge is required');
    }
    if (!(edge instanceof Edge)) {
      throw new Error('Edge must be an Edge instance');
    }
  }
}