/**
 * Base class for individual tools that can be called by LLMs
 */
class ModularTool {
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
   * Get the tool description in standard function format
   * @returns {Object} The tool description
   */
  getDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: JSON.parse(JSON.stringify(this.parameters))
      }
    };
  }
}

module.exports = { ModularTool };