/**
 * Utility functions for validation operations
 */

export class ValidationUtils {
  /**
   * Validates input parameters against schema
   * @param {Object} input - Input to validate
   * @param {Object} schema - Schema to validate against
   * @returns {boolean} - Validation result
   */
  static validateInput(input, schema) {
    if (!input || !schema) return false;
    try {
      // Basic schema validation
      for (const [key, value] of Object.entries(schema)) {
        if (!(key in input)) return false;
        if (typeof input[key] !== value.type) return false;
      }
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }
}
