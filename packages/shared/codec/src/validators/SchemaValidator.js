/**
 * SchemaValidator - JSON Schema validation using AJV
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export class SchemaValidator {
  constructor(options = {}) {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      ...options
    });
    
    // Add format validation (date, time, uri, etc.)
    addFormats(this.ajv);
    
    // Compiled schema cache
    this.compiledSchemas = new Map();
  }

  /**
   * Add a schema definition to the validator
   * @param {string} schemaId - Unique identifier for the schema
   * @param {object} schema - JSON schema definition
   */
  addSchema(schemaId, schema) {
    try {
      // Remove existing schema from both AJV and our cache
      if (this.compiledSchemas.has(schemaId)) {
        this.ajv.removeSchema(schemaId);
        this.compiledSchemas.delete(schemaId);
      }
      
      const compiledSchema = this.ajv.compile(schema);
      this.compiledSchemas.set(schemaId, {
        schema,
        compiled: compiledSchema
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to compile schema '${schemaId}': ${error.message}`);
    }
  }

  /**
   * Validate data against a schema
   * @param {string} schemaId - Schema identifier
   * @param {any} data - Data to validate
   * @returns {{ success: boolean, errors: array, data: any }}
   */
  validate(schemaId, data) {
    const schemaInfo = this.compiledSchemas.get(schemaId);
    
    if (!schemaInfo) {
      return {
        success: false,
        errors: [`Schema '${schemaId}' not found`],
        data: null
      };
    }

    const valid = schemaInfo.compiled(data);
    
    if (valid) {
      return {
        success: true,
        errors: [],
        data
      };
    } else {
      const errors = schemaInfo.compiled.errors.map(error => ({
        path: error.instancePath || error.schemaPath,
        message: error.message,
        value: error.data,
        schema: error.schema
      }));

      return {
        success: false,
        errors,
        data
      };
    }
  }

  /**
   * Get all registered schema IDs
   * @returns {string[]} Array of schema identifiers
   */
  getSchemaIds() {
    return Array.from(this.compiledSchemas.keys());
  }

  /**
   * Get schema definition by ID
   * @param {string} schemaId - Schema identifier
   * @returns {object|null} Schema definition or null if not found
   */
  getSchema(schemaId) {
    const schemaInfo = this.compiledSchemas.get(schemaId);
    return schemaInfo ? schemaInfo.schema : null;
  }

  /**
   * Remove a schema from the validator
   * @param {string} schemaId - Schema identifier
   * @returns {boolean} True if schema was removed
   */
  removeSchema(schemaId) {
    return this.compiledSchemas.delete(schemaId);
  }

  /**
   * Clear all schemas
   */
  clear() {
    this.compiledSchemas.clear();
  }
}