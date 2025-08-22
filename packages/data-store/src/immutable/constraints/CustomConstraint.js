/**
 * CustomConstraint - User-defined constraint with custom validation logic
 * Per design §4.8: Built-in constraint for custom business rules
 * 
 * Allows users to define arbitrary validation logic as a function.
 * The function receives the store root and edge, and must return a ConstraintResult.
 */

import { Constraint } from './Constraint.js';
import { ConstraintResult } from './ConstraintResult.js';

// Use WeakMap to store instance data externally since objects are frozen
const instanceData = new WeakMap();

/**
 * Constraint that executes user-defined validation logic
 */
export class CustomConstraint extends Constraint {
  constructor(id, relationName, description, validationFunction) {
    // Validate the validation function first
    CustomConstraint._validateFunctionStatic(validationFunction);
    
    // Call parent constructor
    super(id, relationName, description);
    
    // Store instance data in WeakMap since object is frozen
    instanceData.set(this, { validationFunction });
  }
  
  // Private getter to access WeakMap data
  get _validationFunction() {
    return instanceData.get(this).validationFunction;
  }

  /**
   * Validate an edge using the custom validation function
   */
  validate(storeRoot, edge) {
    try {
      // Execute the custom validation function
      const result = this._validationFunction(storeRoot, edge);
      
      // Validate the result type
      if (!(result instanceof ConstraintResult)) {
        throw new Error('Validation function must return a ConstraintResult');
      }
      
      return result;
    } catch (error) {
      // Wrap any errors from the validation function
      if (error.message === 'Validation function must return a ConstraintResult') {
        throw error;
      }
      throw new Error(`Custom validation failed: ${error.message}`);
    }
  }

  /**
   * String representation
   */
  toString() {
    return `CustomConstraint(${this.id}, ${this.relationName}, "${this.description}")`;
  }

  // === PRIVATE METHODS ===

  /**
   * Validate the validation function parameter (static version)
   */
  static _validateFunctionStatic(validationFunction) {
    if (!validationFunction) {
      throw new Error('Validation function is required');
    }
    
    if (typeof validationFunction !== 'function') {
      throw new Error('Validation function must be a function');
    }
  }
}