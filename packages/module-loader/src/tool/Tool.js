import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Tool - A clean, minimal base class for Legion tools
 * 
 * This base class provides:
 * - Direct event emission without complex delegation
 * - Simple execute() method for tool logic
 * - Zod schema validation for inputs
 * - Standardized event format
 * 
 * @example
 * ```javascript
 * import { Tool } from '@legion/module-loader';
 * import { z } from 'zod';
 * 
 * class MyTool extends Tool {
 *   constructor() {
 *     super({
 *       name: 'my_tool',
 *       description: 'Does something useful',
 *       inputSchema: z.object({
 *         input: z.string().describe('The input value')
 *       })
 *     });
 *   }
 *   
 *   async execute(params) {
 *     this.emit('event', {
 *       type: 'progress',
 *       message: 'Starting processing...',
 *       data: { percentage: 0 }
 *     });
 *     
 *     const result = await doSomething(params.input);
 *     
 *     this.emit('event', {
 *       type: 'progress',
 *       message: 'Complete',
 *       data: { percentage: 100 }
 *     });
 *     
 *     return result;
 *   }
 * }
 * ```
 */
class Tool extends EventEmitter {
  /**
   * Create a new tool
   * @param {Object} config - Tool configuration
   * @param {string} config.name - Tool name (required)
   * @param {string} config.description - Tool description (required)
   * @param {z.ZodSchema} config.inputSchema - Zod schema for input validation (optional)
   */
  constructor(config = {}) {
    super();
    
    // Support legacy pattern where properties are set after construction
    if (config.name || config.description) {
      this.name = config.name;
      this.description = config.description;
      this.inputSchema = config.inputSchema || z.any();
    } else {
      // Legacy support: allow setting properties after construction
      this.name = '';
      this.description = '';
      this.inputSchema = z.any();
    }
  }
  
  /**
   * Execute the tool with the given parameters
   * This method must be implemented by subclasses
   * 
   * @param {Object} params - Tool parameters (validated against inputSchema)
   * @returns {Promise<*>} Tool execution result
   * @throws {Error} If not implemented by subclass
   */
  async execute(params) {
    throw new Error(`execute() must be implemented by ${this.constructor.name}`);
  }
  
  /**
   * Validate and execute the tool
   * This method handles input validation and standardizes error responses
   * 
   * @param {Object} params - Raw tool parameters
   * @returns {Promise<*>} Tool execution result
   * @throws {Error} If validation fails or execution fails
   */
  async run(params = {}) {
    try {
      // Validate input parameters if schema is defined
      let validatedParams = params;
      if (this.inputSchema && this.inputSchema !== z.any()) {
        validatedParams = this.inputSchema.parse(params);
      }
      
      // Execute the tool
      const result = await this.execute(validatedParams);
      
      return result;
      
    } catch (error) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const validationError = new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
        validationError.name = 'ValidationError';
        validationError.zodErrors = error.errors;
        
        // Emit validation error event
        this.emit('event', {
          type: 'error',
          tool: this.name,
          message: validationError.message,
          data: { zodErrors: error.errors },
          timestamp: new Date().toISOString()
        });
        
        throw validationError;
      }
      
      // Emit general error event
      this.emit('event', {
        type: 'error',
        tool: this.name,
        message: error.message,
        data: { 
          errorType: error.constructor.name,
          stack: error.stack 
        },
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
  
  /**
   * Override EventEmitter's emit to ensure consistent event format
   * 
   * @param {string} eventType - Event type (should be 'event' for tool events)
   * @param {Object} eventData - Event data
   * @returns {boolean} True if event had listeners
   */
  emit(eventType, eventData) {
    // For 'event' type, ensure consistent format
    if (eventType === 'event') {
      const event = {
        type: eventData.type || 'info',
        tool: eventData.tool || this.name,
        message: eventData.message || '',
        data: eventData.data || {},
        timestamp: eventData.timestamp || new Date().toISOString()
      };
      
      return super.emit('event', event);
    }
    
    // For other event types, pass through
    return super.emit(eventType, eventData);
  }
  
  /**
   * Helper method to emit a progress event
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} additionalData - Additional data to include
   */
  progress(message, percentage = null, additionalData = {}) {
    const data = { ...additionalData };
    if (percentage !== null) {
      data.percentage = percentage;
    }
    
    this.emit('event', {
      type: 'progress',
      message,
      data
    });
  }
  
  /**
   * Helper method to emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.emit('event', {
      type: 'info',
      message,
      data
    });
  }
  
  /**
   * Helper method to emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warning(message, data = {}) {
    this.emit('event', {
      type: 'warning',
      message,
      data
    });
  }
  
  /**
   * Helper method to emit an error event
   * Note: This is for logging/informational purposes only.
   * For actual errors, throw an Error object in execute()
   * @param {string} message - Error message
   * @param {Object} data - Additional data
   */
  error(message, data = {}) {
    this.emit('event', {
      type: 'error',
      message,
      data
    });
  }
  
  /**
   * Get tool metadata in a standardized format
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }
}

export default Tool;