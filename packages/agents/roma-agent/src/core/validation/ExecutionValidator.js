/**
 * ExecutionValidator - Provides validation framework for task execution
 * 
 * Features:
 * - Pre-execution validation (task requirements, tool availability, context)
 * - Post-execution verification (output schema, file creation, custom validators)
 * - Schema validation for inputs and outputs
 * - Tool existence validation
 * - Context requirement checking
 */

import { Logger } from '../../utils/Logger.js';
import { readFile } from 'fs/promises';
import { access, constants } from 'fs/promises';

export class ExecutionValidator {
  constructor(options = {}) {
    this.preValidators = [];
    this.postValidators = [];
    this.logger = options.logger || new Logger('ExecutionValidator');
    this.toolRegistry = options.toolRegistry || null;
    this.enableStrictValidation = options.enableStrictValidation !== false;
    this.customValidators = new Map();
    
    // Register default validators
    this.registerDefaultValidators();
  }

  /**
   * Set tool registry for tool validation
   * @param {Object} toolRegistry - Tool registry instance
   */
  setToolRegistry(toolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Validate task before execution
   * @param {Object} task - Task to validate
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Validation result
   */
  async validateBeforeExecution(task, context) {
    const errors = [];
    const warnings = [];
    
    try {
      this.logger.debug('Starting pre-execution validation', {
        taskId: task.id || 'unknown',
        hasDescription: !!task.description,
        hasPrompt: !!task.prompt,
        hasOperation: !!task.operation,
        hasTool: !!(task.tool || task.toolName)
      });

      // Basic task structure validation
      const structureResult = await this.validateTaskStructure(task);
      errors.push(...structureResult.errors);
      warnings.push(...structureResult.warnings);

      // Tool validation
      if (task.tool || task.toolName) {
        const toolResult = await this.validateToolExists(task.tool || task.toolName);
        if (!toolResult.exists) {
          errors.push(`Tool not found: ${task.tool || task.toolName}`);
        } else if (toolResult.warnings) {
          warnings.push(...toolResult.warnings);
        }
      }

      // Context requirements validation
      if (task.requires && Array.isArray(task.requires)) {
        const contextResult = await this.validateContextRequirements(task.requires, context);
        errors.push(...contextResult.errors);
        warnings.push(...contextResult.warnings);
      }

      // Input parameter validation
      if (task.inputSchema && (task.params || task.parameters || task.inputs)) {
        const inputResult = await this.validateInputParameters(task);
        errors.push(...inputResult.errors);
        warnings.push(...inputResult.warnings);
      }

      // Custom pre-validators
      for (const validator of this.preValidators) {
        try {
          const result = await validator(task, context);
          if (result && result.errors) {
            errors.push(...result.errors);
          }
          if (result && result.warnings) {
            warnings.push(...result.warnings);
          }
        } catch (validatorError) {
          errors.push(`Pre-validator ${validator.name || 'unknown'} failed: ${validatorError.message}`);
        }
      }

      const valid = errors.length === 0;
      
      this.logger.debug('Pre-execution validation completed', {
        valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        valid,
        errors,
        warnings,
        phase: 'pre-execution'
      };

    } catch (error) {
      this.logger.error('Pre-execution validation failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        valid: false,
        errors: [`Validation process failed: ${error.message}`],
        warnings,
        phase: 'pre-execution'
      };
    }
  }

  /**
   * Validate task after execution
   * @param {Object} task - Original task
   * @param {*} result - Execution result
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Validation result
   */
  async validateAfterExecution(task, result, context) {
    const checks = [];
    const errors = [];
    const warnings = [];
    
    try {
      this.logger.debug('Starting post-execution validation', {
        taskId: task.id || 'unknown',
        hasResult: result !== null && result !== undefined,
        resultType: typeof result
      });

      // Output schema validation
      if (task.outputSchema) {
        const schemaResult = await this.validateSchema(result, task.outputSchema);
        checks.push({ 
          name: 'output_schema', 
          passed: schemaResult.valid,
          details: schemaResult
        });
        
        if (!schemaResult.valid) {
          errors.push(`Output schema validation failed: ${schemaResult.errors.join(', ')}`);
        }
      }

      // File creation validation
      if (task.createsFiles && Array.isArray(task.createsFiles)) {
        for (const filePath of task.createsFiles) {
          const fileResult = await this.validateFileExists(filePath);
          checks.push({ 
            name: `file_${filePath}`, 
            passed: fileResult.exists,
            details: fileResult
          });
          
          if (!fileResult.exists) {
            errors.push(`Expected file not created: ${filePath}`);
          }
        }
      }

      // Result validation based on task type
      if (task.tool || task.toolName) {
        const toolResult = await this.validateToolResult(result, task);
        checks.push({
          name: 'tool_result_format',
          passed: toolResult.valid,
          details: toolResult
        });
        
        if (!toolResult.valid) {
          errors.push(`Tool result validation failed: ${toolResult.errors.join(', ')}`);
        }
      }

      // Custom post-validators
      if (task.validators && Array.isArray(task.validators)) {
        for (const validator of task.validators) {
          try {
            const passed = await validator(result, context, task);
            checks.push({ 
              name: validator.name || 'custom_validator', 
              passed: Boolean(passed),
              details: { result: passed }
            });
            
            if (!passed) {
              errors.push(`Custom validator failed: ${validator.name || 'unknown'}`);
            }
          } catch (validatorError) {
            checks.push({ 
              name: validator.name || 'custom_validator', 
              passed: false,
              details: { error: validatorError.message }
            });
            errors.push(`Custom validator error: ${validatorError.message}`);
          }
        }
      }

      // Registered custom validators
      for (const [name, validator] of this.customValidators) {
        try {
          const validatorResult = await validator(result, context, task);
          checks.push({
            name: name,
            passed: validatorResult.valid || false,
            details: validatorResult
          });
          
          if (!validatorResult.valid) {
            errors.push(`${name} validation failed: ${validatorResult.message || 'unknown error'}`);
          }
        } catch (validatorError) {
          checks.push({
            name: name,
            passed: false,
            details: { error: validatorError.message }
          });
          errors.push(`${name} validator error: ${validatorError.message}`);
        }
      }

      // Global post-validators
      for (const validator of this.postValidators) {
        try {
          const validatorResult = await validator(task, result, context);
          if (validatorResult && validatorResult.errors) {
            errors.push(...validatorResult.errors);
          }
          if (validatorResult && validatorResult.warnings) {
            warnings.push(...validatorResult.warnings);
          }
          if (validatorResult && validatorResult.checks) {
            checks.push(...validatorResult.checks);
          }
        } catch (validatorError) {
          errors.push(`Post-validator ${validator.name || 'unknown'} failed: ${validatorError.message}`);
        }
      }

      const valid = checks.length === 0 || checks.every(c => c.passed);
      
      this.logger.debug('Post-execution validation completed', {
        valid,
        checkCount: checks.length,
        passedChecks: checks.filter(c => c.passed).length,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        valid,
        checks,
        errors,
        warnings,
        phase: 'post-execution'
      };

    } catch (error) {
      this.logger.error('Post-execution validation failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        valid: false,
        checks,
        errors: [`Validation process failed: ${error.message}`],
        warnings,
        phase: 'post-execution'
      };
    }
  }

  /**
   * Validate task structure
   * @param {Object} task - Task to validate
   * @returns {Object} Validation result
   */
  async validateTaskStructure(task) {
    const errors = [];
    const warnings = [];

    // Must have at least one execution instruction
    if (!task.description && !task.prompt && !task.operation && !task.tool && !task.toolName && !task.execute && !task.fn) {
      errors.push('Task must have description, prompt, operation, tool, or executable function');
    }

    // Check for required ID
    if (!task.id && !task.taskId) {
      warnings.push('Task has no ID - one will be generated automatically');
    }

    // Validate atomic flag usage
    if (task.atomic !== undefined && typeof task.atomic !== 'boolean') {
      warnings.push('atomic flag should be boolean');
    }

    // Check for conflicting execution methods
    const executionMethods = [
      task.tool || task.toolName,
      task.execute || task.fn,
      task.prompt || task.description || task.operation
    ].filter(Boolean);

    if (executionMethods.length > 1) {
      warnings.push('Task has multiple execution methods - precedence is tool > function > LLM');
    }

    // Validate dependencies format
    if (task.dependencies) {
      if (!Array.isArray(task.dependencies)) {
        errors.push('dependencies must be an array');
      } else {
        task.dependencies.forEach((dep, index) => {
          if (typeof dep !== 'string' && (!dep.id && !dep.taskId)) {
            errors.push(`dependency at index ${index} must be string or have id/taskId`);
          }
        });
      }
    }

    // Validate subtasks format (for recursive execution)
    if (task.subtasks) {
      if (!Array.isArray(task.subtasks)) {
        errors.push('subtasks must be an array');
      } else if (task.atomic === true) {
        warnings.push('atomic task has subtasks - atomic flag will be ignored');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate tool exists and is accessible
   * @param {string} toolName - Name of tool to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateToolExists(toolName) {
    if (!this.toolRegistry) {
      return {
        exists: false,
        warnings: ['No tool registry available for validation'],
        error: 'Tool registry not configured'
      };
    }

    try {
      const tool = await this.toolRegistry.getTool(toolName);
      
      if (!tool) {
        return {
          exists: false,
          error: `Tool '${toolName}' not found in registry`
        };
      }

      // Validate tool has execute method
      if (typeof tool.execute !== 'function') {
        return {
          exists: true,
          warnings: [`Tool '${toolName}' exists but has no execute method`],
          error: 'Tool not executable'
        };
      }

      // Check if tool has schema information
      const warnings = [];
      if (!tool.inputSchema && !tool.schema) {
        warnings.push(`Tool '${toolName}' has no input schema - parameter validation will be limited`);
      }

      return {
        exists: true,
        tool: tool,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        exists: false,
        error: `Tool validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate context requirements
   * @param {Array} requirements - Required context keys
   * @param {Object} context - Execution context
   * @returns {Object} Validation result
   */
  async validateContextRequirements(requirements, context) {
    const errors = [];
    const warnings = [];

    for (const requirement of requirements) {
      if (typeof requirement === 'string') {
        // Simple key check
        if (!this.hasContextValue(context, requirement)) {
          errors.push(`Missing required context: ${requirement}`);
        }
      } else if (typeof requirement === 'object') {
        // Complex requirement with type checking
        const { key, type, optional = false } = requirement;
        
        if (!this.hasContextValue(context, key)) {
          if (!optional) {
            errors.push(`Missing required context: ${key}`);
          } else {
            warnings.push(`Optional context missing: ${key}`);
          }
        } else if (type) {
          const value = this.getContextValue(context, key);
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== type) {
            errors.push(`Context ${key} has wrong type: expected ${type}, got ${actualType}`);
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate input parameters against schema
   * @param {Object} task - Task with input parameters and schema
   * @returns {Object} Validation result
   */
  async validateInputParameters(task) {
    const errors = [];
    const warnings = [];

    const params = task.params || task.parameters || task.inputs || {};
    const schema = task.inputSchema;

    if (!schema) {
      return { errors, warnings };
    }

    try {
      const schemaResult = await this.validateSchema(params, schema);
      if (!schemaResult.valid) {
        errors.push(...schemaResult.errors.map(e => `Input parameter validation: ${e}`));
      }
      if (schemaResult.warnings) {
        warnings.push(...schemaResult.warnings.map(w => `Input parameter warning: ${w}`));
      }
    } catch (error) {
      errors.push(`Input parameter validation failed: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate data against JSON schema
   * @param {*} data - Data to validate
   * @param {Object} schema - JSON schema
   * @returns {Promise<Object>} Validation result
   */
  async validateSchema(data, schema) {
    try {
      // Basic schema validation implementation
      // In a real implementation, this would use a proper JSON schema validator
      const errors = [];
      const warnings = [];

      if (schema.type) {
        const actualType = Array.isArray(data) ? 'array' : typeof data;
        if (actualType !== schema.type) {
          errors.push(`Type mismatch: expected ${schema.type}, got ${actualType}`);
        }
      }

      if (schema.required && (data === null || data === undefined)) {
        errors.push('Value is required but was null/undefined');
      }

      if (schema.properties && typeof data === 'object' && data !== null) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (propSchema.required && !(key in data)) {
            errors.push(`Required property missing: ${key}`);
          }
          
          if (key in data && propSchema.type) {
            const propValue = data[key];
            const propType = Array.isArray(propValue) ? 'array' : typeof propValue;
            if (propType !== propSchema.type) {
              errors.push(`Property ${key}: expected ${propSchema.type}, got ${propType}`);
            }
          }
        }
      }

      if (schema.minLength && typeof data === 'string' && data.length < schema.minLength) {
        errors.push(`String too short: minimum length ${schema.minLength}, got ${data.length}`);
      }

      if (schema.maxLength && typeof data === 'string' && data.length > schema.maxLength) {
        errors.push(`String too long: maximum length ${schema.maxLength}, got ${data.length}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Schema validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Validation result
   */
  async validateFileExists(filePath) {
    try {
      await access(filePath, constants.F_OK);
      
      // Try to get file stats for additional information
      try {
        const stats = await readFile(filePath, 'utf8');
        return {
          exists: true,
          size: stats.length,
          readable: true
        };
      } catch (readError) {
        return {
          exists: true,
          readable: false,
          warning: 'File exists but cannot be read'
        };
      }
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Validate tool execution result format
   * @param {*} result - Tool execution result
   * @param {Object} task - Original task
   * @returns {Object} Validation result
   */
  async validateToolResult(result, task) {
    const errors = [];
    const warnings = [];

    // Standard tool result should have success field
    if (result && typeof result === 'object') {
      if ('success' in result) {
        if (typeof result.success !== 'boolean') {
          warnings.push('Tool result has success field but it is not boolean');
        }
        
        if (result.success === false && !result.error && !result.message) {
          warnings.push('Tool result indicates failure but provides no error information');
        }
      } else {
        warnings.push('Tool result has no success field - assuming success if no exception thrown');
      }

      // Check for common result fields
      if (!result.result && !result.data && !result.output && !result.content) {
        warnings.push('Tool result has no data fields (result, data, output, content)');
      }
    } else if (result === null || result === undefined) {
      warnings.push('Tool returned null/undefined result');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Register a custom validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }

    this.customValidators.set(name, validator);
    this.logger.debug('Custom validator registered', { name });
  }

  /**
   * Add pre-execution validator
   * @param {Function} validator - Validator function
   */
  addPreValidator(validator) {
    if (typeof validator !== 'function') {
      throw new Error('Pre-validator must be a function');
    }
    this.preValidators.push(validator);
  }

  /**
   * Add post-execution validator
   * @param {Function} validator - Validator function
   */
  addPostValidator(validator) {
    if (typeof validator !== 'function') {
      throw new Error('Post-validator must be a function');
    }
    this.postValidators.push(validator);
  }

  /**
   * Check if context has a value
   * @param {Object} context - Context object
   * @param {string} key - Key to check (supports dot notation)
   * @returns {boolean} Whether value exists
   */
  hasContextValue(context, key) {
    if (!context) return false;
    
    // Check common context methods
    if (typeof context.has === 'function') {
      return context.has(key);
    }
    
    if (typeof context.getSharedState === 'function') {
      return context.getSharedState(key) !== undefined;
    }
    
    // Fallback to direct property access with dot notation
    const parts = key.split('.');
    let current = context;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    
    return current !== undefined;
  }

  /**
   * Get value from context
   * @param {Object} context - Context object
   * @param {string} key - Key to get (supports dot notation)
   * @returns {*} Value or undefined
   */
  getContextValue(context, key) {
    if (!context) return undefined;
    
    // Check common context methods
    if (typeof context.get === 'function') {
      return context.get(key);
    }
    
    if (typeof context.getSharedState === 'function') {
      return context.getSharedState(key);
    }
    
    // Fallback to direct property access with dot notation
    const parts = key.split('.');
    let current = context;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Register default validators
   * @private
   */
  registerDefaultValidators() {
    // File content validator
    this.registerValidator('file_content', async (result, context, task) => {
      if (task.expectedFileContent && task.createsFiles) {
        for (const filePath of task.createsFiles) {
          try {
            const content = await readFile(filePath, 'utf8');
            const expected = task.expectedFileContent[filePath];
            
            if (expected && !content.includes(expected)) {
              return {
                valid: false,
                message: `File ${filePath} does not contain expected content`
              };
            }
          } catch (error) {
            return {
              valid: false,
              message: `Cannot read file ${filePath}: ${error.message}`
            };
          }
        }
      }
      
      return { valid: true };
    });

    // Result type validator
    this.registerValidator('result_type', async (result, context, task) => {
      if (task.expectedResultType) {
        const actualType = Array.isArray(result) ? 'array' : typeof result;
        
        if (actualType !== task.expectedResultType) {
          return {
            valid: false,
            message: `Expected result type ${task.expectedResultType}, got ${actualType}`
          };
        }
      }
      
      return { valid: true };
    });

    // Non-empty result validator
    this.registerValidator('non_empty', async (result, context, task) => {
      if (task.requireNonEmptyResult) {
        if (result === null || result === undefined || result === '') {
          return {
            valid: false,
            message: 'Result is empty but non-empty result is required'
          };
        }
        
        if (Array.isArray(result) && result.length === 0) {
          return {
            valid: false,
            message: 'Result array is empty but non-empty result is required'
          };
        }
        
        if (typeof result === 'object' && Object.keys(result).length === 0) {
          return {
            valid: false,
            message: 'Result object is empty but non-empty result is required'
          };
        }
      }
      
      return { valid: true };
    });
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation statistics
   */
  getStats() {
    return {
      customValidators: this.customValidators.size,
      preValidators: this.preValidators.length,
      postValidators: this.postValidators.length,
      strictValidation: this.enableStrictValidation,
      hasToolRegistry: !!this.toolRegistry
    };
  }

  /**
   * Clear all custom validators
   */
  clearValidators() {
    this.customValidators.clear();
    this.preValidators = [];
    this.postValidators = [];
    this.logger.debug('All custom validators cleared');
  }
}

export default ExecutionValidator;