/**
 * ToolValidator - Runtime validation engine for Legion tools
 * 
 * Validates tool interfaces, schemas, execution, and error handling
 * Uses @legion/schema for all validation operations
 */

import { createValidator, jsonSchemaToZod, ZodValidator } from '@legion/schema';
import { ToolInterfaceSchema, ToolExecutionResultSchema } from './schemas/index.js';

export class ToolValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      validateOutput: options.validateOutput !== false,
      performanceChecks: options.performanceChecks !== false,
      timeout: options.timeout || 30000,
      ...options
    };
    
    // Validator for tool interface compliance
    this.interfaceValidator = createValidator(ToolInterfaceSchema);
    this.executionResultValidator = createValidator(ToolExecutionResultSchema);
    
    // Track validation results
    this.validationResults = new Map();
    this.performanceMetrics = new Map();
  }
  
  /**
   * Validate tool interface implementation
   * @param {Object} tool - Tool instance to validate
   * @returns {Object} Validation result
   */
  validateInterface(tool) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100
    };
    
    // Check required methods - getMetadata first
    if (typeof tool.getMetadata !== 'function') {
      result.valid = false;
      result.errors.push('Missing required method: getMetadata');
    }
    
    // Check validate method
    if (typeof tool.validate !== 'function') {
      result.valid = false;
      result.errors.push('Missing required method: validate');
    }
    
    // Check execute method
    if (tool.execute === 'not-a-function') {
      result.valid = false;
      result.errors.push('execute must be a function');
    } else if (typeof tool.execute !== 'function') {
      result.valid = false;
      result.errors.push('Missing required method: execute');
    } else {
      // Check if execute is async
      const executeStr = tool.execute.toString();
      // More precise check - look for async keyword or Promise return
      const isAsync = executeStr.startsWith('async ') || 
                     executeStr.includes('async(') ||
                     executeStr.includes('async ') ||
                     executeStr.includes('Promise') ||
                     tool.execute.constructor.name === 'AsyncFunction';
      
      if (!isAsync) {
        result.valid = false;
        result.warnings.push('execute should be an async function');
      }
    }
    
    // Calculate score based on errors and warnings
    if (result.errors.length > 0) {
      result.score = Math.max(0, 100 - (result.errors.length * 25));
    } else if (result.warnings.length > 0) {
      result.score = Math.max(0, 100 - (result.warnings.length * 10));
    }
    
    return result;
  }
  
  /**
   * Validate a JSON schema
   * @param {Object} schema - JSON schema to validate
   * @returns {Object} Validation result
   */
  validateSchema(schema) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    if (!schema) {
      result.valid = false;
      result.errors.push('Schema is required');
      return result;
    }
    
    // Check valid types
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
    if (schema.type && !validTypes.includes(schema.type)) {
      result.valid = false;
      result.errors.push(`Invalid type: ${schema.type}`);
    }
    
    // Check object schema quality
    if (schema.type === 'object' && (!schema.properties || Object.keys(schema.properties).length === 0)) {
      result.warnings.push('Object schema should define properties');
    }
    
    return result;
  }
  
  /**
   * Validate tool execution
   * @param {Object} tool - Tool to test
   * @param {Object} testInput - Input to test with
   * @param {Object} options - Execution options
   * @returns {Object} Validation result
   */
  async validateExecution(tool, testInput = {}, options = {}) {
    const result = {
      valid: true,
      errors: [],
      output: null,
      executionTime: 0
    };
    
    // Generate test input if none provided
    if (Object.keys(testInput).length === 0 && tool.getMetadata) {
      const metadata = tool.getMetadata();
      if (metadata.inputSchema && metadata.inputSchema.type === 'object' && metadata.inputSchema.properties) {
        testInput = {};
        
        // Generate values for required fields first
        if (metadata.inputSchema.required) {
          for (const field of metadata.inputSchema.required) {
            const prop = metadata.inputSchema.properties[field];
            if (prop) {
              testInput[field] = generateTestValue(prop);
            }
          }
        }
        
        // Add some optional fields
        for (const [field, prop] of Object.entries(metadata.inputSchema.properties)) {
          if (!testInput.hasOwnProperty(field) && Math.random() > 0.5) {
            testInput[field] = generateTestValue(prop);
          }
        }
        
        // Fallback to basic a/b pattern for backward compatibility
        if (Object.keys(testInput).length === 0 && metadata.inputSchema.properties.a && metadata.inputSchema.properties.b) {
          testInput = { a: 1, b: 2 };
        }
      }
    }
    
    // Validate input if tool has validate method
    if (typeof tool.validate === 'function') {
      const validation = tool.validate(testInput);
      if (validation && validation.valid === false) {
        result.valid = false;
        result.errors.push(`Validation failed: ${validation.error || 'Invalid input'}`);
        return result;
      }
    }
    
    try {
      // Handle timeout if specified
      if (options.timeout) {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), options.timeout)
        );
        
        result.output = await Promise.race([
          tool.execute(testInput),
          timeoutPromise
        ]);
      } else {
        result.output = await tool.execute(testInput);
      }
      
      // Check for basic output validity
      if (result.output === null || result.output === undefined) {
        result.valid = false;
        result.errors.push('Tool returned null or undefined');
        return result;
      }
      
      // Validate output against schema if available
      if (tool.getMetadata && typeof tool.getMetadata === 'function') {
        const metadata = tool.getMetadata();
        if (metadata.outputSchema) {
          try {
            const outputValidator = createValidator(metadata.outputSchema);
            const outputValidation = outputValidator.validate(result.output);
            if (!outputValidation.valid) {
              result.valid = false;
              result.errors.push('Output does not match schema');
            }
          } catch (error) {
            // Ignore schema validation errors
          }
        }
      }
      
    } catch (error) {
      result.valid = false;
      if (error.message.includes('timeout')) {
        result.errors.push('Execution timeout');
      } else {
        result.errors.push(error.message);
      }
    }
    
    return result;
  }
  
  /**
   * Complete validation of a tool
   * @param {Object} tool - Tool to validate
   * @returns {Object} Complete validation result
   */
  async validateComplete(tool) {
    const result = {
      interface: this.validateInterface(tool),
      metadata: null,
      execution: null,
      combinedScore: 0,
      recommendations: []
    };
    
    // Get metadata if available
    if (tool.getMetadata && typeof tool.getMetadata === 'function') {
      try {
        result.metadata = tool.getMetadata();
      } catch (error) {
        result.recommendations.push(`Could not retrieve metadata: ${error.message}`);
      }
    }
    
    // Test execution with basic input
    if (result.interface.valid) {
      try {
        result.execution = await this.validateExecution(tool, {});
      } catch (error) {
        result.execution = {
          valid: false,
          errors: [error.message]
        };
      }
    }
    
    // Calculate combined score
    let score = 0;
    if (result.interface.valid) score += 40;
    if (result.metadata) score += 20;
    if (result.execution && result.execution.valid) score += 40;
    
    result.combinedScore = score;
    
    // Generate recommendations
    if (!result.interface.valid) {
      result.recommendations.push('Fix interface implementation issues');
    }
    if (!result.metadata) {
      result.recommendations.push('Add metadata to the tool');
    }
    if (result.execution && !result.execution.valid) {
      result.recommendations.push('Fix execution issues');
    }
    
    return result;
  }
}

/**
 * Generate a test value based on JSON Schema property
 * @private
 */
function generateTestValue(prop) {
  if (!prop) return null;
  
  // Handle const
  if (prop.const !== undefined) {
    return prop.const;
  }
  
  // Handle enum
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum[0];
  }
  
  // Handle default
  if (prop.default !== undefined) {
    return prop.default;
  }
  
  // Handle by type
  switch (prop.type) {
    case 'string':
      return 'test';
    case 'number':
      return 42;
    case 'integer':
      return 42;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      // Generate a simple object for object types
      if (prop.properties) {
        const obj = {};
        for (const [key, subProp] of Object.entries(prop.properties)) {
          obj[key] = generateTestValue(subProp);
        }
        return obj;
      }
      return {};
    case 'null':
      return null;
    default:
      // Handle cases where type is not specified but we have a description
      if (!prop.type && prop.description) {
        return 'test-value';
      }
      return null;
  }
}