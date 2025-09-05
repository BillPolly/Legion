/**
 * BaseValidator - Integration with @legion/schema for extended JSON Schema validation
 * 
 * Provides base validation functionality using the existing Legion schema infrastructure
 * while handling extended schema properties (x-format, x-parsing)
 */

import { createValidator } from '@legion/schema';
import { SchemaExtensions } from './SchemaExtensions.js';

export class BaseValidator {
  /**
   * Create a base validator for extended JSON Schema
   * @param {Object} extendedSchema - Extended JSON Schema with x-format and x-parsing
   * @param {Object} options - Validation options
   */
  constructor(extendedSchema, options = {}) {
    // Validate the extended schema structure
    SchemaExtensions.validateExtendedSchema(extendedSchema);
    
    this.extendedSchema = extendedSchema;
    this.options = {
      coerceTypes: false,
      strictMode: true,
      ...options
    };
    
    // Extract pure JSON Schema for @legion/schema validation
    this.baseSchema = this.extractBaseSchema();
    
    // Create validator using @legion/schema
    this.legionValidator = createValidator(this.baseSchema, {
      coerceTypes: this.options.coerceTypes,
      strictMode: this.options.strictMode
    });
  }

  /**
   * Extract pure JSON Schema from extended schema
   * Removes all x-format and x-parsing extensions
   * @returns {Object} Pure JSON Schema
   */
  extractBaseSchema() {
    const baseSchema = this._deepCloneWithoutExtensions(this.extendedSchema);
    return baseSchema;
  }

  /**
   * Validate data against the base JSON Schema
   * @param {*} data - Data to validate
   * @returns {Object} Validation result {success, data?, errors?}
   */
  validateData(data) {
    try {
      const validationResult = this.legionValidator.validate(data);
      
      if (validationResult.valid) {
        return {
          success: true,
          data: validationResult.data
        };
      } else {
        return {
          success: false,
          errors: validationResult.errors.map(error => ({
            type: 'validation',
            field: error.instancePath || error.schemaPath,
            message: error.message,
            received: error.data,
            expected: error.schema
          }))
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'validation',
          message: error.message,
          field: null
        }]
      };
    }
  }

  /**
   * Get format specifications for a specific format
   * @param {string} format - Format name
   * @returns {Object} Format specifications
   */
  getFormatSpecs(format) {
    return SchemaExtensions.getFormatSpecs(this.extendedSchema, format);
  }

  /**
   * Get parsing configuration from x-parsing
   * @returns {Object} Parsing configuration
   */
  getParsingConfig() {
    const xParsing = this.extendedSchema['x-parsing'];
    
    if (!xParsing) {
      // Return default parsing configuration
      return {
        'format-detection': {
          enabled: true,
          strategies: ['json', 'xml', 'delimited', 'tagged', 'markdown'],
          'fallback-order': ['json', 'xml', 'delimited']
        },
        'error-recovery': {
          mode: 'lenient',
          'auto-repair': true,
          'partial-results': true
        }
      };
    }
    
    return { ...xParsing };
  }

  /**
   * Get supported formats from x-format specification
   * @returns {string[]} Array of supported format names
   */
  getSupportedFormats() {
    const xFormat = this.extendedSchema['x-format'];
    
    if (!xFormat) {
      // Return all supported formats
      return ['json', 'xml', 'delimited', 'tagged', 'markdown'];
    }
    
    return Object.keys(xFormat);
  }

  /**
   * Deep clone object while removing extension properties
   * @private
   */
  _deepCloneWithoutExtensions(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCloneWithoutExtensions(item));
    }
    
    const cloned = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip extension properties
      if (key.startsWith('x-')) {
        continue;
      }
      
      // Recursively process nested objects
      if (typeof value === 'object' && value !== null) {
        cloned[key] = this._deepCloneWithoutExtensions(value);
      } else {
        cloned[key] = value;
      }
    }
    
    return cloned;
  }
}