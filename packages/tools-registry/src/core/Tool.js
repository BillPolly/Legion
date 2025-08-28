/**
 * Tool - Base class for all Legion tools
 * 
 * Provides a standard interface for tool implementation
 * Following CLEAN architecture principles
 */

import { SimpleEmitter } from './SimpleEmitter.js';

export class Tool extends SimpleEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || null;
    this.description = config.description || null;
    this.schema = config.schema || {
      input: { type: 'object', properties: {} },
      output: { type: 'object', properties: {} }
    };
    
    // Aliases for schema compatibility
    this.inputSchema = this.schema.input;
    this.outputSchema = this.schema.output;
    
    // EventEmitter compatibility - track listeners by event name
    this._eventListeners = new Map();
  }
  
  /**
   * EventEmitter-compatible on method
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   */
  on(eventName, listener) {
    if (!this._eventListeners.has(eventName)) {
      this._eventListeners.set(eventName, new Set());
    }
    this._eventListeners.get(eventName).add(listener);
    
    // Subscribe once for this event type if not already subscribed
    if (!this._eventSubscriber) {
      this._eventSubscriber = this.subscribe((name, data) => {
        if (this._eventListeners.has(name)) {
          for (const listener of this._eventListeners.get(name)) {
            listener(data);
          }
        }
      });
    }
    
    return this;
  }
  
  /**
   * EventEmitter-compatible off method
   * @param {string} eventName - Name of the event
   * @param {Function} listener - Event listener function
   */
  off(eventName, listener) {
    if (this._eventListeners.has(eventName)) {
      this._eventListeners.get(eventName).delete(listener);
      if (this._eventListeners.get(eventName).size === 0) {
        this._eventListeners.delete(eventName);
      }
    }
    return this;
  }
  
  /**
   * Emit a progress event
   * Tools can call this to emit progress updates
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} data - Additional data
   */
  progress(message, percentage = 0, data = {}) {
    this.emit('progress', { message, percentage, data });
  }
  
  /**
   * Emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.emit('info', { message, data });
  }
  
  /**
   * Emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warning(message, data = {}) {
    this.emit('warning', { message, data });
  }
  
  /**
   * Emit an error event
   * @param {string} message - Error message
   * @param {Object} data - Additional data
   */
  error(message, data = {}) {
    this.emit('error', { message, data });
  }
  
  /**
   * Execute the tool with given parameters - PUBLIC API
   * 
   * This is the main interface for tool execution. It always returns a consistent format:
   * {
   *   success: boolean,    // true if execution succeeded
   *   data: Object,        // the actual tool results
   *   error?: string       // error message if execution failed
   * }
   * 
   * TOOL DEVELOPERS: Do NOT override this method. Instead, implement _execute() below.
   * 
   * @param {Object} params - Tool parameters
   * @returns {Promise<{success: boolean, data: Object, error?: string}>} Standardized tool result
   */
  async execute(params) {
    try {
      // Call the tool-specific implementation method
      if (this._execute && typeof this._execute === 'function') {
        const result = await this._execute(params);
        
        // Wrap direct results in standard format
        return {
          success: true,
          data: result
        };
      }
      
      // Backward compatibility: if tool overrides execute() directly
      // This path should be deprecated in favor of _execute()
      throw new Error(`Tool ${this.name} must implement _execute() method`);
      
    } catch (error) {
      // Standardize error format
      return {
        success: false,
        error: error.message,
        data: error.cause || {}
      };
    }
  }
  
  /**
   * Tool implementation method - IMPLEMENT THIS IN YOUR TOOL
   * 
   * This is where tool developers implement their core logic. This method should:
   * 1. Take the input parameters
   * 2. Perform the tool's operation  
   * 3. Return the direct results (no wrapping needed)
   * 4. Throw an error if something goes wrong
   * 
   * The execute() method will automatically wrap your results in the standard format.
   * 
   * EXAMPLE:
   * ```javascript
   * async _execute({filePath}) {
   *   const content = await fs.readFile(filePath, 'utf-8');
   *   return {
   *     content: content,
   *     path: filePath,
   *     size: content.length
   *   };
   * }
   * ```
   * 
   * DO NOT return {success: true, data: ...} - just return the data directly!
   * 
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Direct tool results (will be wrapped automatically)
   */
  async _execute(params) {
    throw new Error(`Tool ${this.name} must implement _execute() method`);
  }
  
  /**
   * Validate input parameters against schema
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result with success flag and errors
   */
  validateInput(params) {
    // Basic validation - can be extended with proper JSON schema validation
    if (!this.inputSchema || !this.inputSchema.required) {
      return { success: true };
    }
    
    const errors = [];
    
    // Check required fields
    for (const field of this.inputSchema.required) {
      if (!(field in params)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check field types if properties defined
    if (this.inputSchema.properties) {
      for (const [field, schema] of Object.entries(this.inputSchema.properties)) {
        if (field in params) {
          const value = params[field];
          const expectedType = schema.type;
          
          if (expectedType && !this.checkType(value, expectedType)) {
            errors.push(`Invalid type for ${field}: expected ${expectedType}`);
          }
        }
      }
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if value matches expected type
   * @param {*} value - Value to check
   * @param {string} expectedType - Expected type
   * @returns {boolean} True if type matches
   */
  checkType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }
  
  /**
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    };
  }
}