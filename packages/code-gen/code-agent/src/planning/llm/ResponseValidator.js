/**
 * ResponseValidator - Validates LLM responses against JSON schemas
 * 
 * This class provides schema validation for LLM responses to ensure they match
 * the expected format and structure for each planner type.
 */

class ResponseValidator {
  constructor(schema) {
    this.schema = schema;
  }

  /**
   * Validate a response against the schema
   * @param {Object} response - Response to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validate(response) {
    try {
      const errors = [];
      
      // Basic null/undefined check
      if (!response) {
        return { isValid: false, errors: ['Response is null or undefined'] };
      }

      // Validate against schema
      this.validateObject(response, this.schema, '', errors);
      
      return {
        isValid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }

  /**
   * Validate an object against a schema recursively
   * @param {*} obj - Object to validate
   * @param {Object} schema - Schema to validate against
   * @param {string} path - Current path in object for error reporting
   * @param {Array} errors - Array to collect errors
   */
  validateObject(obj, schema, path, errors) {
    // Check type with special handling for arrays
    if (schema.type) {
      if (schema.type === 'array' && !Array.isArray(obj)) {
        errors.push(`${path}: Expected type array, got ${typeof obj}`);
        return;
      } else if (schema.type !== 'array' && typeof obj !== schema.type) {
        errors.push(`${path}: Expected type ${schema.type}, got ${typeof obj}`);
        return;
      }
    }

    // Check required properties
    if (schema.required && schema.type === 'object') {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in obj)) {
          errors.push(`${path}: Missing required property '${requiredProp}'`);
        }
      }
    }

    // Check enum values
    if (schema.enum && !schema.enum.includes(obj)) {
      errors.push(`${path}: Value '${obj}' not in allowed values: ${schema.enum.join(', ')}`);
    }

    // Validate properties
    if (schema.properties && typeof obj === 'object') {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in obj) {
          const propPath = path ? `${path}.${propName}` : propName;
          this.validateObject(obj[propName], propSchema, propPath, errors);
        }
      }
    }

    // Validate array items
    if (schema.type === 'array' && Array.isArray(obj)) {
      if (schema.items) {
        obj.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          this.validateObject(item, schema.items, itemPath, errors);
        });
      }
    }

    // Check array length constraints
    if (schema.type === 'array' && Array.isArray(obj)) {
      if (schema.minItems && obj.length < schema.minItems) {
        errors.push(`${path}: Array must have at least ${schema.minItems} items, got ${obj.length}`);
      }
      if (schema.maxItems && obj.length > schema.maxItems) {
        errors.push(`${path}: Array must have at most ${schema.maxItems} items, got ${obj.length}`);
      }
    }

    // Check string length constraints
    if (schema.type === 'string' && typeof obj === 'string') {
      if (schema.minLength && obj.length < schema.minLength) {
        errors.push(`${path}: String must be at least ${schema.minLength} characters, got ${obj.length}`);
      }
      if (schema.maxLength && obj.length > schema.maxLength) {
        errors.push(`${path}: String must be at most ${schema.maxLength} characters, got ${obj.length}`);
      }
    }

    // Check number constraints
    if (schema.type === 'number' && typeof obj === 'number') {
      if (schema.minimum !== undefined && obj < schema.minimum) {
        errors.push(`${path}: Number must be >= ${schema.minimum}, got ${obj}`);
      }
      if (schema.maximum !== undefined && obj > schema.maximum) {
        errors.push(`${path}: Number must be <= ${schema.maximum}, got ${obj}`);
      }
    }
  }

  /**
   * Get the schema this validator uses
   * @returns {Object} Schema object
   */
  getSchema() {
    return this.schema;
  }
}

export { ResponseValidator };