/**
 * ModuleJsonSchemaValidator - Validates module.json files using @legion/schema
 * 
 * Uses the schema package to validate module.json files before loading or database storage.
 */

import { createValidator } from '@legion/schema';
import { MODULE_JSON_SCHEMA } from './ModuleJsonSchema.js';

export class ModuleJsonSchemaValidator {
  constructor(options = {}) {
    this.options = options;
    
    // Create a clean schema without external references
    const cleanSchema = this.cleanSchema(MODULE_JSON_SCHEMA);
    
    // Create validator from JSON Schema
    try {
      this.validator = createValidator(cleanSchema);
    } catch (error) {
      console.error('Failed to create validator:', error.message);
      // Fall back to basic validation
      this.validator = null;
    }
  }
  
  /**
   * Clean schema to remove external references that cause issues
   * @private
   */
  cleanSchema(schema) {
    // Create a deep copy and remove problematic fields
    const cleaned = JSON.parse(JSON.stringify(schema));
    
    // Remove top-level meta fields
    delete cleaned.$schema;
    delete cleaned.$id;
    
    // Walk through and replace external $ref
    const replaceRefs = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      for (const key in obj) {
        if (key === '$ref' && typeof obj[key] === 'string' && obj[key].startsWith('http')) {
          // Replace with a permissive schema
          obj.type = 'object';
          obj.additionalProperties = true;
          delete obj.$ref;
        } else if (typeof obj[key] === 'object') {
          replaceRefs(obj[key]);
        }
      }
      return obj;
    };
    
    replaceRefs(cleaned);
    
    // Make dependencies more flexible - it can be either an object with specific properties
    // or an object with dependency names as keys
    if (cleaned.properties && cleaned.properties.dependencies) {
      // Remove strict additionalProperties: false from dependencies to allow any keys
      if (cleaned.properties.dependencies.additionalProperties === false) {
        delete cleaned.properties.dependencies.additionalProperties;
      }
      
      // Allow patternProperties for dependency names
      if (!cleaned.properties.dependencies.patternProperties) {
        cleaned.properties.dependencies.patternProperties = {
          "^[A-Z][A-Z0-9_]*$": {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["string", "number", "boolean", "object", "array"]
              },
              description: {
                type: "string"
              },
              required: {
                type: "boolean"
              },
              default: {}
            }
          }
        };
      }
    }
    
    // Make version field accept both string and number (will be sanitized to string for DB)
    if (cleaned.properties && cleaned.properties.version) {
      cleaned.properties.version = {
        oneOf: [
          { type: "string" },
          { type: "number" }
        ],
        description: cleaned.properties.version.description || "Module version"
      };
    }
    
    return cleaned;
  }

  /**
   * Validate a module.json object
   * @param {Object} moduleJson - The parsed module.json object
   * @returns {{ valid: boolean, errors: Array, warnings: Array, data: Object }}
   */
  validate(moduleJson) {
    // If we have a validator, use it
    if (this.validator) {
      try {
        const result = this.validator.validate(moduleJson);
        
        if (result.valid) {
          // Perform additional semantic validation
          const semanticResult = this.performSemanticValidation(result.data);
          
          return {
            valid: true,
            errors: [],
            warnings: semanticResult.warnings || [],
            data: result.data
          };
        } else {
          // Format validation errors
          const errors = this.formatValidationErrors(result.errors);
          
          return {
            valid: false,
            errors,
            warnings: [],
            data: null
          };
        }
      } catch (error) {
        return {
          valid: false,
          errors: [{
            path: '/',
            message: `Validation error: ${error.message}`
          }],
          warnings: [],
          data: null
        };
      }
    }
    
    // Fallback to basic validation if validator is not available
    return this.performBasicValidation(moduleJson);
  }

  /**
   * Format validation errors into our error format
   * @private
   */
  formatValidationErrors(errors) {
    if (!errors) return [];
    
    // Handle array of error objects from ZodValidator
    if (Array.isArray(errors)) {
      return errors.map(err => ({
        path: err.path || '/',
        message: err.message || 'Validation error',
        code: err.code
      }));
    }
    
    // Handle ZodError object if passed directly
    if (errors.errors) {
      return errors.errors.map(err => ({
        path: '/' + err.path.join('/'),
        message: err.message,
        code: err.code
      }));
    }
    
    return [{
      path: '/',
      message: String(errors)
    }];
  }

  /**
   * Perform semantic validation beyond schema validation
   * @private
   */
  performSemanticValidation(moduleJson) {
    const warnings = [];

    // Check for unused dependencies
    if (moduleJson.dependencies && moduleJson.initialization?.config) {
      const configString = JSON.stringify(moduleJson.initialization.config);
      
      for (const dep of Object.keys(moduleJson.dependencies)) {
        if (!configString.includes(`\${${dep}}`)) {
          warnings.push({
            path: `/dependencies/${dep}`,
            message: `Dependency '${dep}' is declared but not used in initialization config`
          });
        }
      }
    }

    // Check for duplicate tool names
    if (moduleJson.tools && Array.isArray(moduleJson.tools)) {
      const toolNames = new Set();
      
      moduleJson.tools.forEach((tool, index) => {
        if (toolNames.has(tool.name)) {
          warnings.push({
            path: `/tools/${index}/name`,
            message: `Duplicate tool name '${tool.name}'`
          });
        } else {
          toolNames.add(tool.name);
        }
      });
    }

    // Warn about absolute paths
    if (moduleJson.package && moduleJson.package.startsWith('/')) {
      warnings.push({
        path: '/package',
        message: 'Package path is absolute - consider using relative paths for portability'
      });
    }

    return { warnings };
  }

  /**
   * Basic validation fallback if Zod is not available
   * @private
   */
  performBasicValidation(moduleJson) {
    const errors = [];

    // Check required fields
    if (!moduleJson.name || typeof moduleJson.name !== 'string') {
      errors.push({
        path: '/name',
        message: 'Module name is required and must be a string'
      });
    }

    if (!moduleJson.description || typeof moduleJson.description !== 'string') {
      errors.push({
        path: '/description',
        message: 'Module description is required and must be a string'
      });
    }

    // Validate tools
    if (moduleJson.tools) {
      if (!Array.isArray(moduleJson.tools)) {
        errors.push({
          path: '/tools',
          message: 'Tools must be an array'
        });
      } else {
        moduleJson.tools.forEach((tool, index) => {
          if (!tool.name) {
            errors.push({
              path: `/tools/${index}/name`,
              message: 'Tool name is required'
            });
          }
          if (!tool.description) {
            errors.push({
              path: `/tools/${index}/description`,
              message: 'Tool description is required'
            });
          }
          if (!tool.function) {
            errors.push({
              path: `/tools/${index}/function`,
              message: 'Tool function is required'
            });
          }
        });
      }
    }

    const semanticResult = this.performSemanticValidation(moduleJson);

    return {
      valid: errors.length === 0,
      errors,
      warnings: semanticResult.warnings || [],
      data: errors.length === 0 ? moduleJson : null
    };
  }

  /**
   * Validate a module.json file before database insertion
   * @param {Object} moduleJson - The module.json to validate
   * @returns {{ valid: boolean, errors: Array, sanitized: Object }}
   */
  validateForDatabase(moduleJson) {
    const result = this.validate(moduleJson);
    
    if (!result.valid) {
      return {
        valid: false,
        errors: result.errors,
        sanitized: null
      };
    }

    // Sanitize data for database insertion
    const sanitized = this.sanitizeForDatabase(result.data);
    
    return {
      valid: true,
      errors: [],
      warnings: result.warnings,
      sanitized
    };
  }

  /**
   * Sanitize module.json data for database storage
   * @private
   */
  sanitizeForDatabase(moduleJson) {
    const sanitized = { ...moduleJson };
    
    // Ensure proper types for database fields
    if (sanitized.version && typeof sanitized.version !== 'string') {
      sanitized.version = String(sanitized.version);
    }
    
    // Ensure arrays are properly formatted
    if (sanitized.dependencies && !Array.isArray(sanitized.dependencies)) {
      // Convert object dependencies to array of keys for database
      if (typeof sanitized.dependencies === 'object') {
        sanitized.dependencies = Object.keys(sanitized.dependencies);
      }
    }
    
    // Add metadata if not present
    if (!sanitized.createdAt) {
      sanitized.createdAt = new Date();
    }
    
    if (!sanitized.status) {
      sanitized.status = 'active';
    }
    
    return sanitized;
  }

  /**
   * Clear any caches
   */
  clearCache() {
    // No cache in this implementation, but kept for API compatibility
  }

  /**
   * Get validator statistics
   */
  getStats() {
    return {
      validatorType: this.validator ? 'zod' : 'basic',
      schemaLoaded: !!this.validator
    };
  }
}

export default ModuleJsonSchemaValidator;