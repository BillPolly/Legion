/**
 * Tool class
 * Represents an individual tool that can be executed
 * 
 * Standard Result Format:
 * {
 *   success: boolean,
 *   data: any,        // The actual result data when successful
 *   error?: {         // Error details when unsuccessful
 *     code: string,
 *     message: string,
 *     details?: any
 *   }
 * }
 */

import { EventEmitter } from 'events';

export class Tool extends EventEmitter {
  constructor({ name, description, execute, getMetadata, schema, inputSchema, outputSchema }) {
    super();
    this.name = name;
    this.description = description || 'No description available';
    this._execute = execute;
    this._getMetadata = getMetadata;
    this.subscribers = new Set();  // Store subscribers
    
    // Store schemas as plain JSON Schema only - no validation here
    this.inputSchema = inputSchema || schema || null;
    this.outputSchema = outputSchema || null;
  }
  
  /**
   * Execute the tool - no validation, just execution
   * @param {Object} input - JSON input
   * @returns {Promise<Object>} Standardized result: {success, data, error?}
   */
  async execute(input) {
    try {
      // Call the provided execute function directly - no validation
      let result = await this._execute(input);
      
      // Standardize the result format
      result = this._standardizeResult(result);
      
      return result;
      
    } catch (error) {
      // If the tool throws, wrap in standard error format
      return this._createErrorResult(error);
    }
  }
  
  /**
   * Standardize result format to {success, data, error?}
   * @private
   */
  _standardizeResult(result) {
    // If already in standard format
    if (result && typeof result === 'object' && 'success' in result) {
      // Ensure error format is correct
      if (!result.success && result.error) {
        result.error = this._standardizeError(result.error);
      }
      // Legacy support: move errorMessage to error object
      if (!result.success && result.data && result.data.errorMessage) {
        result.error = {
          code: result.data.code || 'EXECUTION_ERROR',
          message: result.data.errorMessage,
          details: result.data
        };
        delete result.data;
      }
      return result;
    }
    
    // Wrap raw result in success format
    return {
      success: true,
      data: result
    };
  }
  
  /**
   * Create standardized error result
   * @private
   */
  _createErrorResult(error) {
    // If already in standard format
    if (error && error.success === false) {
      return this._standardizeResult(error);
    }
    
    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message || 'Tool execution failed',
        details: {
          tool: this.name,
          stack: error.stack,
          timestamp: Date.now()
        }
      }
    };
  }
  
  /**
   * Standardize error object format
   * @private
   */
  _standardizeError(error) {
    if (typeof error === 'string') {
      return {
        code: 'ERROR',
        message: error
      };
    }
    
    if (error && typeof error === 'object') {
      return {
        code: error.code || 'ERROR',
        message: error.message || error.errorMessage || 'Unknown error',
        details: error.details || error
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred'
    };
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
   * Subscribe to tool events
   * @param {Function} listener - Function to receive all tool events
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.subscribers.add(listener);
    // Return unsubscribe function
    return () => this.subscribers.delete(listener);
  }
  
  /**
   * Internal method to notify all subscribers
   * @param {Object} message - Event message to send to subscribers
   */
  _notify(message) {
    this.subscribers.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Subscriber error:', error);
      }
    });
  }
  
  /**
   * Send a progress event
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} data - Additional data
   */
  progress(message, percentage = 0, data = {}) {
    this._notify({ 
      type: 'progress',
      tool: this.name,
      message, 
      percentage, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Send an error event
   * @param {string} message - Error message
   * @param {Object} data - Additional error data
   */
  error(message, data = {}) {
    this._notify({ 
      type: 'error',
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Send an info event
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this._notify({ 
      type: 'info',
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Send a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warning(message, data = {}) {
    this._notify({ 
      type: 'warning',
      tool: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Get tool metadata including schemas
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    const baseMetadata = this._getMetadata ? this._getMetadata() : {};
    
    return {
      name: this.name,
      description: this.description,
      ...baseMetadata,
      inputSchema: this.inputSchema || null,
      outputSchema: this.outputSchema || null
    };
  }
  
  /**
   * Invoke the tool with a tool call format
   * @param {Object} toolCall - Tool call with name and arguments
   * @returns {Promise<Object>} Tool result
   */
  async invoke(toolCall) {
    try {
      // Handle both formats: {name, arguments} and {function: {name, arguments}}
      const funcCall = toolCall.function || toolCall;
      
      // Parse the arguments JSON string
      let args;
      try {
        args = JSON.parse(funcCall.arguments);
      } catch (error) {
        return {
          success: false,
          data: {
            errorMessage: `Invalid JSON in arguments: ${error.message}`,
            code: 'PARSE_ERROR',
            tool: this.name,
            timestamp: Date.now()
          }
        };
      }
      
      // Call the execute method
      return await this.execute(args);
    } catch (error) {
      return {
        success: false,
        data: {
          errorMessage: error.message || 'Tool invocation failed',
          code: 'INVOKE_ERROR',
          tool: this.name,
          timestamp: Date.now()
        }
      };
    }
  }
}