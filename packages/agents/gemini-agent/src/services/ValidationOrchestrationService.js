import { EnhancedValidator } from '../utils/EnhancedValidator.js';

/**
 * Service for orchestrating various validation operations
 */
export class ValidationOrchestrationService {
  constructor() {
    this.validator = EnhancedValidator;
  }

  /**
   * Validates a complete tool execution request
   * @param {Object} request - The tool execution request
   * @returns {Object} Validation result with status and errors
   */
  validateToolRequest(request) {
    const result = {
      isValid: true,
      errors: []
    };

    if (!this.validator.validateToolCall(request)) {
      result.isValid = false;
      result.errors.push('Invalid tool call format');
    }

    return result;
  }

  /**
   * Validates complex nested data structures
   * @param {Object} data - Data to validate
   * @returns {Object} Validation result
   */
  validateComplexData(data) {
    return {
      isValid: this.validator.validateComplexStructure(data),
      errors: []
    };
  }
}
