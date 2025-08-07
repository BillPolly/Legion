/**
 * SchemaValidator - JSON Schema-based validation for tool parameters
 * 
 * Provides detailed schema validation with support for:
 * - Type checking (string, number, boolean, object, array)
 * - Required/optional fields
 * - Nested objects and arrays
 * - Pattern matching for strings
 * - Min/max constraints
 * - Enum values
 */

import { ValidationResult } from './PlanValidator.js';

/**
 * Schema validator class
 */
export class SchemaValidator {
  constructor(options = {}) {
    this.strictTypes = options.strictTypes !== false;
    this.allowExtraProperties = options.allowExtraProperties || false;
    this.coerceTypes = options.coerceTypes || false;
    this.debugMode = options.debugMode || false;
  }

  /**
   * Validate parameters against a schema
   * @param {Object} params - Parameters to validate
   * @param {Object} schema - Schema definition
   * @param {string} stepId - Step ID for error reporting
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validate(params, schema, stepId) {
    const result = new ValidationResult();
    
    // Convert simple schema format to detailed format
    const detailedSchema = this.normalizeSchema(schema);
    
    // Validate the parameters
    this.validateObject(params, detailedSchema, '', result, stepId);
    
    return result;
  }

  /**
   * Normalize schema from simple format to detailed format
   * Simple format: { path: 'string', count: 'number?' }
   * Detailed format: { path: { type: 'string', required: true }, count: { type: 'number', required: false } }
   */
  normalizeSchema(schema) {
    const normalized = {};
    
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        // Simple format: 'string' or 'string?'
        const isOptional = value.endsWith('?');
        const baseType = value.replace('?', '');
        
        normalized[key] = {
          type: this.parseType(baseType),
          required: !isOptional
        };
      } else if (typeof value === 'object') {
        // Already in detailed format or nested object
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * Parse type string into detailed type information
   */
  parseType(typeStr) {
    // Handle array types: Array<string>, string[], etc.
    if (typeStr.startsWith('Array<') && typeStr.endsWith('>')) {
      const innerType = typeStr.slice(6, -1);
      return {
        type: 'array',
        items: this.parseType(innerType)
      };
    }
    
    if (typeStr.endsWith('[]')) {
      const innerType = typeStr.slice(0, -2);
      return {
        type: 'array',
        items: this.parseType(innerType)
      };
    }
    
    // Handle union types: string|number
    if (typeStr.includes('|')) {
      const types = typeStr.split('|').map(t => t.trim());
      return {
        type: 'union',
        types: types.map(t => this.parseType(t))
      };
    }
    
    // Handle object types with properties
    if (typeStr.startsWith('{') && typeStr.endsWith('}')) {
      // Parse object structure: {name: string, age: number}
      // This is simplified - real implementation would need proper parsing
      return {
        type: 'object',
        properties: {}
      };
    }
    
    // Basic types
    return {
      type: typeStr.toLowerCase()
    };
  }

  /**
   * Validate an object against a schema
   */
  validateObject(obj, schema, path, result, stepId) {
    // Check required fields
    for (const [field, fieldSchema] of Object.entries(schema)) {
      const fieldPath = path ? `${path}.${field}` : field;
      
      if (fieldSchema.required && !(field in obj)) {
        result.addError(
          'MISSING_REQUIRED_FIELD',
          `Required field '${fieldPath}' is missing`,
          stepId,
          { 
            field: fieldPath,
            expectedType: fieldSchema.type
          }
        );
        continue;
      }
      
      if (field in obj) {
        this.validateField(obj[field], fieldSchema, fieldPath, result, stepId);
      }
    }
    
    // Check for extra properties
    if (!this.allowExtraProperties) {
      const schemaFields = Object.keys(schema);
      for (const field of Object.keys(obj)) {
        if (!schemaFields.includes(field)) {
          const fieldPath = path ? `${path}.${field}` : field;
          result.addWarning(
            'EXTRA_PROPERTY',
            `Unexpected property '${fieldPath}'`,
            stepId,
            { 
              field: fieldPath,
              allowedFields: schemaFields
            }
          );
        }
      }
    }
  }

  /**
   * Validate a single field against its schema
   */
  validateField(value, fieldSchema, path, result, stepId) {
    // Extract type info from fieldSchema
    let type;
    if (typeof fieldSchema === 'string') {
      // Simple string type like 'string' or 'number'
      type = fieldSchema;
    } else if (fieldSchema && typeof fieldSchema === 'object') {
      // Complex schema with type property
      type = fieldSchema.type || fieldSchema;
    } else {
      type = 'any';
    }
    
    // Handle null/undefined
    if (value === null || value === undefined) {
      if (fieldSchema.required) {
        result.addError(
          'NULL_VALUE',
          `Field '${path}' cannot be null or undefined`,
          stepId,
          { field: path }
        );
      }
      return;
    }
    
    // Type validation
    if (typeof type === 'string') {
      this.validateSimpleType(value, type, path, result, stepId, fieldSchema);
    } else if (typeof type === 'object' && type.type) {
      // Handle parsed type objects
      if (typeof type.type === 'string') {
        this.validateSimpleType(value, type.type, path, result, stepId, fieldSchema);
      } else {
        this.validateComplexType(value, type, path, result, stepId, fieldSchema);
      }
    } else if (typeof type === 'object') {
      this.validateComplexType(value, type, path, result, stepId, fieldSchema);
    }
    
    // Additional constraints
    this.validateConstraints(value, fieldSchema, path, result, stepId);
  }

  /**
   * Validate simple types
   */
  validateSimpleType(value, type, path, result, stepId, fieldSchema) {
    const actualType = this.getActualType(value);
    
    switch (type.toLowerCase()) {
      case 'string':
        if (actualType !== 'string') {
          if (this.coerceTypes && value != null) {
            // Try to coerce to string
            return;
          }
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be a string, got ${actualType}`,
            stepId,
            { field: path, expected: 'string', actual: actualType }
          );
        }
        break;
        
      case 'number':
        if (actualType !== 'number') {
          if (this.coerceTypes && !isNaN(Number(value))) {
            // Can be coerced to number
            return;
          }
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be a number, got ${actualType}`,
            stepId,
            { field: path, expected: 'number', actual: actualType }
          );
        }
        break;
        
      case 'boolean':
        if (actualType !== 'boolean') {
          if (this.coerceTypes && (value === 'true' || value === 'false')) {
            // Can be coerced to boolean
            return;
          }
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be a boolean, got ${actualType}`,
            stepId,
            { field: path, expected: 'boolean', actual: actualType }
          );
        }
        break;
        
      case 'object':
        if (actualType !== 'object') {
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be an object, got ${actualType}`,
            stepId,
            { field: path, expected: 'object', actual: actualType }
          );
        } else if (fieldSchema.properties) {
          // Validate nested object
          this.validateObject(value, fieldSchema.properties, path, result, stepId);
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be an array, got ${actualType}`,
            stepId,
            { field: path, expected: 'array', actual: actualType }
          );
        }
        break;
        
      case 'any':
        // Any type is allowed
        break;
        
      default:
        if (type !== actualType && this.strictTypes) {
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be ${type}, got ${actualType}`,
            stepId,
            { field: path, expected: type, actual: actualType }
          );
        }
    }
  }

  /**
   * Validate complex types (arrays, unions, etc.)
   */
  validateComplexType(value, typeInfo, path, result, stepId, fieldSchema) {
    switch (typeInfo.type) {
      case 'array':
        if (!Array.isArray(value)) {
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be an array`,
            stepId,
            { field: path, expected: 'array', actual: this.getActualType(value) }
          );
        } else if (typeInfo.items) {
          // Validate array items
          value.forEach((item, index) => {
            this.validateField(
              item,
              typeInfo.items,
              `${path}[${index}]`,
              result,
              stepId
            );
          });
        }
        break;
        
      case 'union':
        // Check if value matches any of the union types
        let matchFound = false;
        const errors = [];
        
        for (const unionType of typeInfo.types) {
          const tempResult = new ValidationResult();
          this.validateField(value, unionType, path, tempResult, stepId);
          
          if (tempResult.valid) {
            matchFound = true;
            break;
          }
          errors.push(...tempResult.errors);
        }
        
        if (!matchFound) {
          result.addError(
            'UNION_TYPE_MISMATCH',
            `Field '${path}' does not match any of the expected types`,
            stepId,
            { 
              field: path,
              expectedTypes: typeInfo.types.map(t => t.type || t),
              actual: this.getActualType(value)
            }
          );
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          result.addError(
            'TYPE_MISMATCH',
            `Field '${path}' must be an object`,
            stepId,
            { field: path, expected: 'object', actual: this.getActualType(value) }
          );
        } else if (typeInfo.properties) {
          this.validateObject(value, typeInfo.properties, path, result, stepId);
        }
        break;
    }
  }

  /**
   * Validate additional constraints (min, max, pattern, enum, etc.)
   */
  validateConstraints(value, fieldSchema, path, result, stepId) {
    // Enum constraint
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      result.addError(
        'ENUM_MISMATCH',
        `Field '${path}' must be one of: ${fieldSchema.enum.join(', ')}`,
        stepId,
        { 
          field: path,
          allowedValues: fieldSchema.enum,
          actual: value
        }
      );
    }
    
    // String constraints
    if (typeof value === 'string') {
      if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
        result.addError(
          'STRING_TOO_SHORT',
          `Field '${path}' must be at least ${fieldSchema.minLength} characters`,
          stepId,
          { field: path, minLength: fieldSchema.minLength, actual: value.length }
        );
      }
      
      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        result.addError(
          'STRING_TOO_LONG',
          `Field '${path}' must be at most ${fieldSchema.maxLength} characters`,
          stepId,
          { field: path, maxLength: fieldSchema.maxLength, actual: value.length }
        );
      }
      
      if (fieldSchema.pattern) {
        const regex = new RegExp(fieldSchema.pattern);
        if (!regex.test(value)) {
          result.addError(
            'PATTERN_MISMATCH',
            `Field '${path}' does not match pattern: ${fieldSchema.pattern}`,
            stepId,
            { field: path, pattern: fieldSchema.pattern, actual: value }
          );
        }
      }
    }
    
    // Number constraints
    if (typeof value === 'number') {
      if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
        result.addError(
          'NUMBER_TOO_SMALL',
          `Field '${path}' must be at least ${fieldSchema.minimum}`,
          stepId,
          { field: path, minimum: fieldSchema.minimum, actual: value }
        );
      }
      
      if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
        result.addError(
          'NUMBER_TOO_LARGE',
          `Field '${path}' must be at most ${fieldSchema.maximum}`,
          stepId,
          { field: path, maximum: fieldSchema.maximum, actual: value }
        );
      }
    }
    
    // Array constraints
    if (Array.isArray(value)) {
      if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
        result.addError(
          'ARRAY_TOO_SHORT',
          `Field '${path}' must have at least ${fieldSchema.minItems} items`,
          stepId,
          { field: path, minItems: fieldSchema.minItems, actual: value.length }
        );
      }
      
      if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
        result.addError(
          'ARRAY_TOO_LONG',
          `Field '${path}' must have at most ${fieldSchema.maxItems} items`,
          stepId,
          { field: path, maxItems: fieldSchema.maxItems, actual: value.length }
        );
      }
    }
  }

  /**
   * Get the actual type of a value
   */
  getActualType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}