/**
 * Base class for individual tools that can be called by LLMs
 * This is a copy of the OpenAITool from @jsenvoy/core to avoid circular dependencies
 */
class OpenAITool {
  constructor() {
    this.name = '';
    this.description = '';
    this.parameters = {};
  }

  /**
   * Execute the tool with given arguments
   * @param {Object} args - The arguments for the tool
   * @returns {Promise<*>} The result of the tool execution
   * @throws {Error} Must be implemented by subclass
   */
  async execute(args) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Get the tool description in OpenAI function format
   * @returns {Object} The tool description
   */
  getDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters
      }
    };
  }

  /**
   * Validate arguments against the parameter schema
   * @param {Object} args - The arguments to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateArgs(args) {
    // Basic validation - can be extended
    if (this.parameters.required) {
      for (const param of this.parameters.required) {
        if (!(param in args)) {
          throw new Error(`Missing required parameter: '${param}'`);
        }
      }
    }
    return true;
  }
}

module.exports = OpenAITool;