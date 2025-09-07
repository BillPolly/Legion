import { z } from 'zod';
import { SchemaConverter } from './SchemaConverter.js';

/**
 * ZodValidator - Wrapper class that validates data using Zod schemas generated from JSON Schema
 * 
 * Provides both object and function interfaces for validation
 */
export class ZodValidator {
  /**
   * Create a new validator
   * @param {Object} jsonSchema - JSON Schema to use for validation
   * @param {Object} options - Validator options
   */
  constructor(jsonSchema, options = {}) {
    this.jsonSchema = jsonSchema;
    this.options = {
      coerceTypes: options.coerceTypes || false,
      strictMode: options.strictMode !== false,
      customFormats: options.customFormats || {},
      abortEarly: options.abortEarly || false,
      includeStack: options.includeStack || false
    };

    // Create converter and convert schema
    this.converter = new SchemaConverter({
      coerceTypes: this.options.coerceTypes,
      strictMode: this.options.strictMode,
      customFormats: this.options.customFormats
    });

    this.zodSchema = this.converter.convert(jsonSchema);
  }

  /**
   * Validate data against the schema
   * @param {*} data - Data to validate
   * @returns {Object} Validation result with { valid, data, errors }
   */
  validate(data) {
    try {
      const result = this.zodSchema.parse(data);
      return {
        valid: true,
        data: result,
        errors: null
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Filter out actor framework property errors
        const filteredErrors = this.filterActorFrameworkErrors(error);
        
        if (filteredErrors.length === 0) {
          // If only actor framework errors, treat as valid
          return {
            valid: true,
            data: data,
            errors: null
          };
        }
        
        return {
          valid: false,
          data: null,
          errors: this.formatZodErrors({ errors: filteredErrors })
        };
      }
      // Re-throw non-validation errors
      throw error;
    }
  }

  /**
   * Validate data asynchronously
   * @param {*} data - Data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateAsync(data) {
    try {
      const result = await this.zodSchema.parseAsync(data);
      return {
        valid: true,
        data: result,
        errors: null
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Filter out actor framework property errors
        const filteredErrors = this.filterActorFrameworkErrors(error);
        
        if (filteredErrors.length === 0) {
          // If only actor framework errors, treat as valid
          return {
            valid: true,
            data: data,
            errors: null
          };
        }
        
        return {
          valid: false,
          data: null,
          errors: this.formatZodErrors({ errors: filteredErrors })
        };
      }
      throw error;
    }
  }

  /**
   * Safe validate without throwing
   * @param {*} data - Data to validate
   * @returns {Object} Safe parse result
   */
  safeParse(data) {
    const result = this.zodSchema.safeParse(data);
    
    if (result.success) {
      return {
        valid: true,
        data: result.data,
        errors: null
      };
    } else {
      // Filter out actor framework property errors
      const filteredErrors = this.filterActorFrameworkErrors(result.error);
      
      if (filteredErrors.length === 0) {
        // If only actor framework errors, treat as valid
        return {
          valid: true,
          data: data,
          errors: null
        };
      }
      
      return {
        valid: false,
        data: null,
        errors: this.formatZodErrors({ errors: filteredErrors })
      };
    }
  }

  /**
   * Check if data is valid without returning parsed data
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  isValid(data) {
    const result = this.zodSchema.safeParse(data);
    if (result.success) {
      return true;
    }
    
    // Check if errors are only about actor framework properties
    const filteredErrors = this.filterActorFrameworkErrors(result.error);
    return filteredErrors.length === 0;
  }

  /**
   * Filter out actor framework property errors from validation errors
   * @private
   * @param {z.ZodError} zodError - Zod error object
   * @returns {Array} Filtered error array
   */
  filterActorFrameworkErrors(zodError) {
    return zodError.errors.filter(err => {
      const errorMessage = err.message.toLowerCase();
      const errorPath = err.path ? err.path.join('.') : '';
      
      // Skip errors that are about the actor framework properties
      if (errorMessage.includes('unrecognized key') && 
          (errorMessage.includes("'receive'") || errorMessage.includes("'create'"))) {
        return false;
      }
      
      // Skip errors where the path ends with receive or CREATE
      if (errorPath.endsWith('receive') || errorPath.endsWith('CREATE')) {
        return false;
      }
      
      // Skip errors about expected object/string but received function (for receive/CREATE)
      if ((errorMessage.includes('expected object') || errorMessage.includes('expected string')) && 
          errorMessage.includes('received function') &&
          (errorPath.includes('receive') || errorPath.includes('CREATE'))) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Format Zod errors into a more readable structure
   * @private
   */
  formatZodErrors(zodError) {
    const errors = zodError.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      expected: err.expected,
      received: err.received,
      ...(this.options.includeStack && { stack: err })
    }));

    if (this.options.abortEarly && errors.length > 0) {
      return [errors[0]];
    }

    return errors;
  }

  /**
   * Get the underlying Zod schema
   * @returns {z.ZodSchema} The Zod schema
   */
  getZodSchema() {
    return this.zodSchema;
  }

  /**
   * Get the original JSON Schema
   * @returns {Object} The JSON Schema
   */
  getJsonSchema() {
    return this.jsonSchema;
  }

  /**
   * Update the JSON Schema and regenerate Zod schema
   * @param {Object} jsonSchema - New JSON Schema
   */
  updateSchema(jsonSchema) {
    this.jsonSchema = jsonSchema;
    this.converter.clearCache();
    this.zodSchema = this.converter.convert(jsonSchema);
  }

  /**
   * Create a function that validates data
   * @returns {Function} Validation function
   */
  toFunction() {
    return (data) => this.validate(data);
  }

  /**
   * Create an async function that validates data
   * @returns {Function} Async validation function
   */
  toAsyncFunction() {
    return (data) => this.validateAsync(data);
  }

  /**
   * Create a predicate function
   * @returns {Function} Predicate function that returns boolean
   */
  toPredicate() {
    return (data) => this.isValid(data);
  }
}

/**
 * Create a validator instance
 * @param {Object} jsonSchema - JSON Schema
 * @param {Object} options - Options
 * @returns {ZodValidator} Validator instance
 */
export function createValidator(jsonSchema, options) {
  return new ZodValidator(jsonSchema, options);
}

/**
 * Create a validation function directly
 * @param {Object} jsonSchema - JSON Schema
 * @param {Object} options - Options
 * @returns {Function} Validation function
 */
export function createValidatorFunction(jsonSchema, options) {
  const validator = new ZodValidator(jsonSchema, options);
  return validator.toFunction();
}

/**
 * Create an async validation function
 * @param {Object} jsonSchema - JSON Schema
 * @param {Object} options - Options
 * @returns {Function} Async validation function
 */
export function createAsyncValidatorFunction(jsonSchema, options) {
  const validator = new ZodValidator(jsonSchema, options);
  return validator.toAsyncFunction();
}

/**
 * Create a predicate function
 * @param {Object} jsonSchema - JSON Schema
 * @param {Object} options - Options
 * @returns {Function} Predicate function
 */
export function createPredicate(jsonSchema, options) {
  const validator = new ZodValidator(jsonSchema, options);
  return validator.toPredicate();
}

export default ZodValidator;