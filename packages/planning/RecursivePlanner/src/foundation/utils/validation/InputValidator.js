/**
 * Input validator class for creating reusable validators
 */

/**
 * Input validator class for creating reusable validators
 */
export class InputValidator {
  constructor() {
    this.rules = [];
  }

  /**
   * Add a validation rule
   * @param {Function} validator - Validation function
   * @param {string} message - Error message if validation fails
   */
  addRule(validator, message) {
    this.rules.push({ validator, message });
    return this;
  }

  /**
   * Validate input against all rules
   * @param {any} input - Input to validate
   * @returns {Object} Validation result with valid flag and errors array
   */
  validate(input) {
    const errors = [];
    
    for (const rule of this.rules) {
      try {
        if (!rule.validator(input)) {
          errors.push(rule.message);
        }
      } catch (error) {
        errors.push(error.message || rule.message);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}