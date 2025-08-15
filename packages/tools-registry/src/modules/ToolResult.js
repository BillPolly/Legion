/**
 * Standardized result format for tool executions
 * All tools MUST return a ToolResult instance from their invoke method
 */
export class ToolResult {
  /**
   * Creates a new ToolResult
   * @param {boolean} success - Whether the tool execution succeeded
   * @param {Object} data - The result data (can be present for both success and failure)
   * @param {string|null} error - Error message if the execution failed
   */
  constructor(success, data = null, error = null) {
    if (typeof success !== 'boolean') {
      throw new Error('ToolResult success must be a boolean');
    }
    
    this.success = success;
    this.data = data || {};
    this.error = error;
    
    // Ensure error is a string if provided
    if (this.error !== null && typeof this.error !== 'string') {
      this.error = String(this.error);
    }
  }

  /**
   * Creates a successful result
   * @param {Object} data - The success data
   * @returns {ToolResult}
   */
  static success(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Success data must be an object');
    }
    return new ToolResult(true, data, null);
  }

  /**
   * Creates a failure result
   * @param {string} error - The error message
   * @param {Object} data - Optional partial data or error details
   * @returns {ToolResult}
   */
  static failure(error, data = {}) {
    if (!error || typeof error !== 'string') {
      throw new Error('Error message must be a non-empty string');
    }
    return new ToolResult(false, data, error);
  }

  /**
   * Converts the result to a plain object
   * @returns {Object}
   */
  toObject() {
    return {
      success: this.success,
      data: this.data,
      error: this.error
    };
  }

  /**
   * Validates the result against a schema
   * @param {Object} outputSchema - The output schema from tool description
   * @returns {boolean} - Whether the result matches the schema
   */
  validate(outputSchema) {
    if (!outputSchema) {
      return true; // No schema to validate against
    }

    const schema = this.success ? outputSchema.success : outputSchema.failure;
    if (!schema) {
      return true; // No schema for this result type
    }

    try {
      this._validateAgainstSchema(this.data, schema);
      
      // For failures, also validate that error exists
      if (!this.success && !this.error) {
        throw new Error('Failure results must include an error message');
      }
      
      return true;
    } catch (error) {
      console.warn(`ToolResult validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Internal method to validate data against a schema
   * @private
   */
  _validateAgainstSchema(data, schema) {
    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        throw new Error(`Expected object, got ${typeof data}`);
      }

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in data)) {
            throw new Error(`Missing required property: ${prop}`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            this._validatePropertyType(data[key], propSchema, key);
          }
        }
      }
    } else {
      this._validatePropertyType(data, schema, 'data');
    }
  }

  /**
   * Validates a single property against its schema
   * @private
   */
  _validatePropertyType(value, schema, propertyName) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (schema.type && actualType !== schema.type) {
      // Allow null for non-required fields
      if (value === null && !schema.required) {
        return;
      }
      throw new Error(`Property '${propertyName}' should be ${schema.type}, got ${actualType}`);
    }

    if (schema.enum && !schema.enum.includes(value)) {
      throw new Error(`Property '${propertyName}' must be one of: ${schema.enum.join(', ')}`);
    }
  }
}

export default ToolResult;