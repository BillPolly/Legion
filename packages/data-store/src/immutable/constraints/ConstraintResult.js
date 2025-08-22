/**
 * ConstraintResult - Represents the result of constraint validation
 * Per design §4.3: Result aggregation for constraint validation
 * 
 * Immutable result object that captures the outcome of constraint validation,
 * including success/failure status and any violations found.
 */

import { ConstraintViolation } from './ConstraintViolation.js';

/**
 * Immutable result of constraint validation
 * Contains validation status and any violations that were found
 */
export class ConstraintResult {
  constructor(constraintId, isValid, violations = []) {
    // Validate constructor parameters
    this._validateConstructorParams(constraintId, isValid, violations);

    this._constraintId = constraintId;
    this._isValid = isValid;
    this._violations = Object.freeze([...violations]);
    
    // Make completely immutable
    Object.freeze(this);
  }

  /**
   * Get the ID of the constraint that was validated
   */
  get constraintId() {
    return this._constraintId;
  }

  /**
   * Check if the validation was successful
   */
  get isValid() {
    return this._isValid;
  }

  /**
   * Get the list of violations (empty if valid)
   */
  get violations() {
    return this._violations;
  }

  /**
   * String representation for debugging
   */
  toString() {
    const status = this._isValid ? 'valid' : 'invalid';
    const violationCount = this._violations.length;
    const violationText = violationCount === 1 ? 'violation' : 'violations';
    
    if (this._isValid) {
      return `ConstraintResult(${this._constraintId}: ${status})`;
    } else {
      return `ConstraintResult(${this._constraintId}: ${status}, ${violationCount} ${violationText})`;
    }
  }

  // === STATIC FACTORY METHODS ===

  /**
   * Create a successful validation result
   */
  static success(constraintId) {
    return new ConstraintResult(constraintId, true, []);
  }

  /**
   * Create a failed validation result with violations
   */
  static failure(constraintId, violations) {
    return new ConstraintResult(constraintId, false, violations);
  }

  /**
   * Combine multiple constraint results into a single result
   * Result is valid only if all input results are valid
   */
  static combine(results) {
    if (!Array.isArray(results)) {
      throw new Error('Results must be an array');
    }

    const allViolations = [];
    let allValid = true;

    for (const result of results) {
      if (!(result instanceof ConstraintResult)) {
        throw new Error('All results must be ConstraintResult instances');
      }
      
      if (!result.isValid) {
        allValid = false;
        allViolations.push(...result.violations);
      }
    }

    return new ConstraintResult('combined', allValid, allViolations);
  }

  // === PRIVATE METHODS ===

  /**
   * Validate constructor parameters
   */
  _validateConstructorParams(constraintId, isValid, violations) {
    if (!constraintId || typeof constraintId !== 'string') {
      throw new Error('Constraint id is required');
    }
    if (typeof isValid !== 'boolean') {
      throw new Error('isValid must be a boolean');
    }
    if (!Array.isArray(violations)) {
      throw new Error('Violations must be an array');
    }
    
    // Validate all violations are correct type
    for (const violation of violations) {
      if (!(violation instanceof ConstraintViolation)) {
        throw new Error('All violations must be ConstraintViolation instances');
      }
    }
  }
}