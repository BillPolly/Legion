/**
 * Service for validating incoming requests
 */
/**
 * Service for validating API requests against schemas
 */
export class RequestValidationService {
  constructor() {
    this.schemas = new Map();
    this.validationResults = new Map();
  }

  /**
   * Register a validation schema for a path
   * @param {string} path - API endpoint path
   * @param {object} schema - Validation schema object
   * @throws {Error} If schema is invalid or path already registered
   */
  registerSchema(path, schema) {
    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('Path must be a non-empty string');
    }
    if (!schema || typeof schema.validate !== 'function') {
      throw new Error('Invalid schema object - must have validate() method');
    }
    if (this.schemas.has(path)) {
      throw new Error(`Schema already registered for path: ${path}`);
    }
    this.schemas.set(path, schema);
  }

  /**
   * Validate request data against registered schema
   * @param {string} path - API endpoint path
   * @param {object} data - Request data to validate
   * @returns {object} Validation result
   * @throws {Error} If schema not found or validation fails
   */
  validateRequest(path, data) {
    const schema = this.schemas.get(path);
    if (!schema) {
      throw new Error(`No schema found for path: ${path}`);
    }

    try {
      const result = schema.validate(data);
      this.validationResults.set(path, {
        timestamp: Date.now(),
        success: true,
        data
      });
      return result;
    } catch (error) {
      this.validationResults.set(path, {
        timestamp: Date.now(),
        success: false,
        error: error.message
      });
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Get validation history for a path
   * @param {string} path - API endpoint path
   * @returns {object|null} Last validation result or null
   */
  getValidationHistory(path) {
    return this.validationResults.get(path) || null;
  }

  /**
   * Remove registered schema
   * @param {string} path - API endpoint path
   * @throws {Error} If schema not found
   */
  removeSchema(path) {
    if (!this.schemas.has(path)) {
      throw new Error(`No schema found for path: ${path}`);
    }
    this.schemas.delete(path);
    this.validationResults.delete(path);
  }

  /**
   * Clear all validation history
   */
  clearHistory() {
    this.validationResults.clear();
  }
}
