/**
 * Tool class
 * Represents an individual tool that can be executed
 */

import { EventEmitter } from 'events';

// Lazy load schema package if available
let createValidator;
try {
  const schemaModule = await import('@legion/schema');
  createValidator = schemaModule.createValidator;
} catch (e) {
  // Schema package not available, validation will be skipped
  createValidator = null;
}

export class Tool extends EventEmitter {
  constructor({ name, description, execute, getMetadata, schema, inputSchema }) {
    super();
    this.name = name;
    this.description = description || 'No description available';
    this._execute = execute;
    this._getMetadata = getMetadata;
    
    // Support both direct validator object and JSON schema
    if (schema) {
      // If schema is already a validator object (has validate method)
      this.validator = schema;
    } else if (inputSchema && createValidator) {
      // If inputSchema is provided as JSON schema, create validator
      this.validator = createValidator(inputSchema);
    } else {
      this.validator = null;
    }
  }
  
  /**
   * Execute the tool with optional validation
   * @param {Object} input - JSON input
   * @returns {Promise<Object>} JSON output
   */
  async execute(input) {
    try {
      // Validate input if validator is available
      if (this.validator) {
        const validation = this.validator.validate(input);
        if (!validation.valid) {
          const errorMessage = validation.errors 
            ? JSON.stringify(validation.errors) 
            : 'Invalid input';
          throw new Error(`Validation failed: ${errorMessage}`);
        }
        input = validation.data || input; // Use validated/coerced data
      }
      
      // Call the provided execute function
      const result = await this._execute(input);
      
      // For this implementation, we allow tools to return results directly
      // The framework layer will handle success/error wrapping if needed
      return result;
      
    } catch (error) {
      // If the tool throws, wrap in standard error format
      if (error.success === false) {
        return error; // Already in correct format
      }
      
      return {
        success: false,
        data: {
          errorMessage: error.message || 'Tool execution failed',
          code: 'EXECUTION_ERROR',
          stackTrace: error.stack,
          tool: this.name,
          timestamp: Date.now()
        }
      };
    }
  }
  
  /**
   * Alias for execute to match module-loader API
   * @param {Object} input - JSON input
   * @returns {Promise<Object>} JSON output
   */
  async run(input) {
    return this.execute(input);
  }
  
  /**
   * Emit a progress event
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} data - Additional data
   */
  progress(message, percentage = 0, data = {}) {
    this.emit('progress', { 
      tool: this.name,
      message, 
      percentage, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit an error event
   * @param {string} message - Error message
   * @param {Object} data - Additional error data
   */
  error(message, data = {}) {
    this.emit('error', { 
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.emit('info', { 
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warning(message, data = {}) {
    this.emit('warning', { 
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return this._getMetadata();
  }
}