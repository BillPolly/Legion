/**
 * Tool class
 * Represents an individual tool that can be executed
 */

export class Tool {
  constructor({ name, execute, getMetadata }) {
    this.name = name;
    this._execute = execute;
    this._getMetadata = getMetadata;
  }
  
  /**
   * Execute the tool
   * @param {Object} input - JSON input
   * @returns {Promise<Object>} JSON output
   */
  async execute(input) {
    try {
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
   * Get tool metadata
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return this._getMetadata();
  }
}