/**
 * Tool class
 * Represents an individual tool that can be executed
 */

// Lazy load schema package if available
let createValidator;
try {
  const schemaModule = await import('@legion/schema');
  createValidator = schemaModule.createValidator;
} catch (e) {
  // Schema package not available, validation will be skipped
  createValidator = null;
}

export class Tool {
  constructor({ name, description, execute, getMetadata, schema, inputSchema }) {
    this.name = name;
    this.description = description || 'No description available';
    this._execute = execute;
    this._getMetadata = getMetadata;
    this.subscribers = new Set();  // Store subscribers
    
    // Handle new descriptive schema format
    if (schema && typeof schema === 'object' && (schema.input || schema.output)) {
      // New descriptive schema format
      this.schema = schema;
      
      // Create validator from input schema if available
      if (schema.input && createValidator) {
        this.validator = createValidator(schema.input);
      } else {
        this.validator = null;
      }
    } else if (schema) {
      // Legacy: schema is already a validator object (has validate method)
      this.validator = schema;
      this.schema = null; // No descriptive schema available
    } else if (inputSchema && createValidator) {
      // Legacy: inputSchema provided directly
      this.schema = null; // No descriptive schema available
      
      // Check if inputSchema is a Zod schema (has _def property)
      if (inputSchema && typeof inputSchema === 'object' && inputSchema._def) {
        // This is a Zod schema - store it directly and create a custom validator
        this.validator = {
          zodSchema: inputSchema,
          jsonSchema: inputSchema, // Keep original Zod schema
          validate: (data) => {
            const result = inputSchema.safeParse(data);
            if (result.success) {
              return { valid: true, data: result.data, errors: null };
            } else {
              return { valid: false, data: null, errors: result.error.errors };
            }
          }
        };
      } else {
        // If inputSchema is provided as JSON schema, create validator
        this.validator = createValidator(inputSchema);
      }
    } else {
      this.validator = null;
      this.schema = null;
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
      
      // Wrap result in ToolResult format if it's not already wrapped
      if (result && typeof result === 'object' && 'success' in result) {
        // Already in ToolResult format
        return result;
      }
      
      // Wrap in success format
      return {
        success: true,
        data: result
      };
      
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
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return this._getMetadata();
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