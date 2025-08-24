/**
 * Tool - Base class for all Legion tools
 * 
 * Provides a standard interface for tool implementation
 * Following CLEAN architecture principles
 */

export class Tool {
  constructor(config = {}) {
    this.name = config.name || null;
    this.description = config.description || null;
    this.schema = config.schema || {
      input: { type: 'object', properties: {} },
      output: { type: 'object', properties: {} }
    };
    
    // Aliases for schema compatibility
    this.inputSchema = this.schema.input;
    this.outputSchema = this.schema.output;
  }
  
  /**
   * Execute the tool with given parameters
   * Must be implemented by subclasses
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params) {
    throw new Error(`Tool ${this.name} must implement execute() method`);
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