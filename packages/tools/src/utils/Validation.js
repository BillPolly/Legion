/**
 * Validation utilities for the tool architecture
 */

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a single parameter
 * @param {string} name - Parameter name
 * @param {any} value - Parameter value
 * @param {Object} schema - Validation schema
 */
export function validateParameter(name, value, schema) {
  // Check if required parameter is missing
  if (schema.required && (value === undefined || value === null)) {
    throw new ValidationError(`Required parameter "${name}" is missing`);
  }

  // Skip type checking if parameter is optional and not provided
  if (!schema.required && (value === undefined || value === null)) {
    return;
  }

  // Type checking
  if (schema.type && value !== undefined && value !== null) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== schema.type) {
      throw new ValidationError(`Parameter "${name}" must be of type ${schema.type}, got ${actualType}`);
    }
  }
}

/**
 * Validate configuration against a schema
 * @param {Object} config - Configuration object
 * @param {Object} schema - Validation schema
 * @returns {Object} Validated configuration with defaults applied
 */
export function validateConfiguration(config, schema) {
  const result = { ...config };

  for (const [key, rules] of Object.entries(schema)) {
    try {
      validateParameter(key, config[key], rules);
      
      // Apply default value if parameter is missing and default is provided
      if ((config[key] === undefined || config[key] === null) && rules.default !== undefined) {
        result[key] = rules.default;
      }
    } catch (error) {
      throw new ValidationError(`Configuration validation failed: ${error.message}`);
    }
  }

  return result;
}

/**
 * Validate an opaque handle
 * @param {Object} handle - Handle to validate
 * @param {string} expectedType - Expected handle type (optional)
 */
export function validateHandle(handle, expectedType = null) {
  if (!handle || typeof handle !== 'object') {
    throw new ValidationError('Invalid handle: must be an object');
  }

  if (!handle._id || !handle._type) {
    throw new ValidationError('Invalid handle: missing _id or _type');
  }

  if (expectedType && handle._type !== expectedType) {
    throw new ValidationError(`Invalid handle type: expected ${expectedType}, got ${handle._type}`);
  }
}