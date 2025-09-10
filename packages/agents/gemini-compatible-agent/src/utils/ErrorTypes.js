/**
 * Standardized error types for the application
 */
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_ERROR: 'RESOURCE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TOOL_ERROR: 'TOOL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Custom error class with additional context
 */
export class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} type - Error type from ErrorTypes
   * @param {Object} [context] - Additional error context
   */
  constructor(message, type = ErrorTypes.UNKNOWN_ERROR, context = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Creates a formatted error object for logging
   * @returns {Object} Formatted error object
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}
