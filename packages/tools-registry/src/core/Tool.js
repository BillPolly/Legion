/**
 * Tool - Base class for all Legion tools
 * 
 * Provides a standard interface for tool implementation
 * Following CLEAN architecture principles
 * 
 * CRITICAL: Tools should provide schemas as METADATA ONLY.
 * ALL validation happens here in the base class using @legion/schema
 */

import { SimpleEmitter } from './SimpleEmitter.js';
import { createValidator } from '@legion/schema';

export class Tool extends SimpleEmitter {
  // Static schema validator - validates that schemas themselves are properly formed
  static schemaValidator = createValidator({
    type: 'object',
    properties: {
      type: { type: 'string' },
      properties: { type: 'object' },
      required: { type: 'array', items: { type: 'string' } },
      description: { type: 'string' }
    },
    required: ['type']
  });

  constructor(moduleOrConfig, toolName = null) {
    super();
    
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      this.module = moduleOrConfig;
      this.toolName = toolName;
      const metadata = this.module.getToolMetadata(toolName);
      
      if (!metadata) {
        throw new Error(`Tool metadata not found for '${toolName}' in module '${this.module.name}'`);
      }
      
      this.name = metadata.name;
      this.description = metadata.description;
      this.inputSchema = metadata.inputSchema || { type: 'object', properties: {} };
      this.outputSchema = metadata.outputSchema || { type: 'object', properties: {} };
      this.category = metadata.category;
      this.tags = metadata.tags || [];
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const config = moduleOrConfig || {};
      this.module = null;
      this.toolName = null;
      this.name = config.name || null;
      this.description = config.description || null;
      
      // Schemas are METADATA ONLY - not validation objects!
      this.inputSchema = config.inputSchema || config.schema?.input || { 
        type: 'object', 
        properties: {} 
      };
      this.outputSchema = config.outputSchema || config.schema?.output || { 
        type: 'object', 
        properties: {} 
      };
      this.category = config.category;
      this.tags = config.tags || [];
    }
    
    // Validate that the schemas themselves are properly formed
    this._validateSchemas();
    
    // EventEmitter compatibility - track listeners by event name
    this._eventListeners = new Map();
  }

  /**
   * Validate that this tool's schemas are properly formed
   * This is SCHEMA validation, not input validation
   */
  _validateSchemas() {
    // Validate input schema structure
    const inputValidation = Tool.schemaValidator.validate(this.inputSchema);
    if (!inputValidation.valid) {
      throw new Error(`Tool ${this.name} has invalid input schema: ${inputValidation.errors.map(e => e.message).join(', ')}`);
    }

    // Validate output schema structure  
    const outputValidation = Tool.schemaValidator.validate(this.outputSchema);
    if (!outputValidation.valid) {
      throw new Error(`Tool ${this.name} has invalid output schema: ${outputValidation.errors.map(e => e.message).join(', ')}`);
    }
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
      // VALIDATE INPUT - This is the ONLY place input validation happens
      const validation = this.validateInput(params);
      if (!validation.valid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

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
   * This is INPUT validation using @legion/schema
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result with valid flag and errors
   */
  validateInput(params) {
    try {
      // Create validator from input schema and validate parameters
      const validator = createValidator(this.inputSchema);
      const result = validator.validate(params);
      
      return {
        valid: result.valid,
        errors: result.valid ? [] : result.errors.map(e => e.message)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Schema validation failed: ${error.message}`]
      };
    }
  }
  
  /**
   * Validate input parameters - backwards compatibility alias for validateInput()
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result with valid flag and errors/warnings
   */
  validate(params) {
    const result = this.validateInput(params);
    return {
      valid: result.valid,
      errors: result.errors,
      warnings: [] // Legacy tests expect warnings array
    };
  }
  
  /**
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    // NEW PATTERN: Delegate to module for complete metadata
    if (this.module && this.toolName) {
      return this.module.getToolMetadata(this.toolName);
    }
    
    // OLD PATTERN: Return basic metadata for backwards compatibility
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    };
  }
  
  /**
   * Serialize tool for actor space message serialization
   * Returns a clean representation without circular references
   * @returns {Object} Clean tool representation for serialization
   */
  serialize() {
    // Return simple string representation for display
    return `Tool: ${this.name} - ${this.description}`;
  }
}