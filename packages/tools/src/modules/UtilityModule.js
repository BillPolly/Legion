/**
 * Utility Module
 * Provides utility operations like expression evaluation, data validation, etc.
 */

import { ModuleDefinition } from './ModuleDefinition.js';
import { ModuleInstance } from './ModuleInstance.js';
import { Tool } from './Tool.js';

/**
 * UtilityModuleDefinition
 */
export class UtilityModuleDefinition extends ModuleDefinition {
  static async create(config) {
    const instance = new UtilityModuleInstance(this, config);
    await instance.initialize();
    return instance;
  }

  static getMetadata() {
    return {
      name: 'UtilityModule',
      description: 'Utility operations module',
      version: '1.0.0',
      tools: {
        expression_evaluator: {
          description: 'Evaluate mathematical and logical expressions with variables',
          input: { 
            expression: 'string', 
            variables: 'object?',
            expectedType: 'string?' 
          },
          output: { 
            result: 'any', 
            type: 'string', 
            success: 'boolean',
            error: 'string?'
          }
        },
        data_validator: {
          description: 'Validate data against expected criteria',
          input: { 
            data: 'any', 
            criteria: 'object',
            mode: 'string?' 
          },
          output: { 
            valid: 'boolean', 
            errors: 'array?',
            summary: 'string'
          }
        },
        curl: {
          description: 'Make HTTP GET requests like curl command - perfect for testing APIs',
          input: { 
            url: 'string',
            headers: 'object?'
          },
          output: { 
            body: 'any', 
            status: 'number', 
            statusText: 'string', 
            headers: 'object',
            success: 'boolean'
          }
        }
      }
    };
  }
}

/**
 * UtilityModuleInstance
 */
export class UtilityModuleInstance extends ModuleInstance {
  constructor(moduleDefinition, config) {
    super(moduleDefinition, config);
  }

  async initialize() {
    this.createTools();
  }

  /**
   * Safe expression evaluator using Function constructor
   * Supports basic math, comparisons, and logical operations
   */
  evaluateExpression(expression, variables = {}) {
    try {
      // Whitelist of allowed operations and functions
      const allowedOperators = /^[0-9+\-*/()\s<>=!&|.a-zA-Z_$]+$/;
      const allowedMath = ['Math.abs', 'Math.max', 'Math.min', 'Math.round', 'Math.floor', 'Math.ceil'];
      
      if (!allowedOperators.test(expression)) {
        throw new Error('Expression contains invalid characters');
      }

      // Replace variables in expression
      let processedExpression = expression;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        processedExpression = processedExpression.replace(regex, JSON.stringify(value));
      }

      // Create a safe evaluation context
      const safeContext = {
        Math: {
          abs: Math.abs,
          max: Math.max,
          min: Math.min,
          round: Math.round,
          floor: Math.floor,
          ceil: Math.ceil,
          sqrt: Math.sqrt,
          pow: Math.pow
        }
      };

      // Build context string
      const contextKeys = Object.keys(safeContext);
      const contextValues = Object.values(safeContext);

      // Create and execute function
      const func = new Function(...contextKeys, `return (${processedExpression})`);
      const result = func(...contextValues);

      return {
        success: true,
        result: result,
        type: typeof result,
        processedExpression
      };

    } catch (error) {
      return {
        success: false,
        result: null,
        type: 'error',
        error: error.message
      };
    }
  }

  /**
   * Validate data against criteria
   */
  validateData(data, criteria, mode = 'strict') {
    const errors = [];
    
    try {
      // Type validation
      if (criteria.type) {
        const actualType = typeof data;
        if (actualType !== criteria.type) {
          errors.push(`Expected type ${criteria.type}, got ${actualType}`);
        }
      }

      // Value validation
      if (criteria.equals !== undefined) {
        if (data !== criteria.equals) {
          errors.push(`Expected value ${criteria.equals}, got ${data}`);
        }
      }

      // Range validation for numbers
      if (typeof data === 'number') {
        if (criteria.min !== undefined && data < criteria.min) {
          errors.push(`Value ${data} is below minimum ${criteria.min}`);
        }
        if (criteria.max !== undefined && data > criteria.max) {
          errors.push(`Value ${data} is above maximum ${criteria.max}`);
        }
      }

      // String validation
      if (typeof data === 'string') {
        if (criteria.minLength !== undefined && data.length < criteria.minLength) {
          errors.push(`String length ${data.length} is below minimum ${criteria.minLength}`);
        }
        if (criteria.maxLength !== undefined && data.length > criteria.maxLength) {
          errors.push(`String length ${data.length} is above maximum ${criteria.maxLength}`);
        }
        if (criteria.pattern && !new RegExp(criteria.pattern).test(data)) {
          errors.push(`String does not match pattern ${criteria.pattern}`);
        }
        if (criteria.contains && !data.includes(criteria.contains)) {
          errors.push(`String does not contain required text: ${criteria.contains}`);
        }
      }

      // Array validation
      if (Array.isArray(data)) {
        if (criteria.minItems !== undefined && data.length < criteria.minItems) {
          errors.push(`Array length ${data.length} is below minimum ${criteria.minItems}`);
        }
        if (criteria.maxItems !== undefined && data.length > criteria.maxItems) {
          errors.push(`Array length ${data.length} is above maximum ${criteria.maxItems}`);
        }
      }

      const valid = errors.length === 0;
      return {
        success: true,
        data: {
          valid,
          errors: errors.length > 0 ? errors : null,
          summary: valid ? 'Validation passed' : `Validation failed: ${errors.length} error(s)`
        }
      };

    } catch (error) {
      return {
        success: false,
        data: {
          valid: false,
          errors: [error.message],
          summary: `Validation error: ${error.message}`
        }
      };
    }
  }

  createTools() {
    // Expression Evaluator Tool
    this.tools.expression_evaluator = new Tool({
      name: 'expression_evaluator',
      execute: async (input) => {
        const { expression, variables = {}, expectedType } = input;
        
        if (!expression) {
          return {
            success: false,
            data: {
              result: null,
              type: 'error',
              error: 'Expression is required'
            }
          };
        }

        const evaluation = this.evaluateExpression(expression, variables);
        
        // Check expected type if provided
        if (expectedType && evaluation.success && typeof evaluation.result !== expectedType) {
          evaluation.success = false;
          evaluation.error = `Expected result type ${expectedType}, got ${typeof evaluation.result}`;
        }

        return {
          success: evaluation.success,
          data: {
            result: evaluation.result,
            type: evaluation.type,
            success: evaluation.success,
            error: evaluation.error,
            processedExpression: evaluation.processedExpression
          }
        };
      },
      getMetadata: () => UtilityModuleDefinition.getMetadata().tools.expression_evaluator
    });

    // Data Validator Tool
    this.tools.data_validator = new Tool({
      name: 'data_validator',
      execute: async (input) => {
        const { data, criteria, mode = 'strict' } = input;
        
        if (!criteria) {
          return {
            success: false,
            data: {
              valid: false,
              errors: ['Criteria is required'],
              summary: 'Validation error: Missing criteria'
            }
          };
        }

        const validation = this.validateData(data, criteria, mode);
        return validation;
      },
      getMetadata: () => UtilityModuleDefinition.getMetadata().tools.data_validator
    });

    // Curl Tool (HTTP GET)
    this.tools.curl = new Tool({
      name: 'curl',
      execute: async (input) => {
        const { url, headers = {} } = input;
        
        if (!url) {
          return {
            success: false,
            data: {
              body: null,
              status: 0,
              statusText: 'Bad Request',
              headers: {},
              success: false,
              error: 'URL is required'
            }
          };
        }

        try {
          // Use native fetch for HTTP requests
          const response = await fetch(url, {
            method: 'GET',
            headers: headers
          });

          const body = await response.text();
          let parsedBody = body;
          
          // Try to parse as JSON if possible
          try {
            parsedBody = JSON.parse(body);
          } catch {
            // Keep as text if not JSON
          }

          return {
            success: true,
            data: {
              body: parsedBody,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              success: response.ok
            }
          };

        } catch (error) {
          return {
            success: false,
            data: {
              body: null,
              status: 0,
              statusText: 'Network Error',
              headers: {},
              success: false,
              error: error.message
            }
          };
        }
      },
      getMetadata: () => UtilityModuleDefinition.getMetadata().tools.curl
    });
  }
}