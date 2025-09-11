import { ValidationUtils } from '../utils/ValidationUtils.js';

/**
 * Service for handling validation operations
 */
export class ValidationService {
  constructor() {
    this.utils = ValidationUtils;
  }

  /**
   * Validates request parameters
   * @param {Object} requestParams - Parameters to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} - Validation result and any errors
   */
  validateRequest(requestParams, schema) {
    const isValid = this.utils.validateInput(requestParams, schema);
    return {
      valid: isValid,
      errors: isValid ? [] : ['Invalid request parameters']
    };
  }
}
