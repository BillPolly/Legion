/**
 * Base class for modules that contain related tools
 */
class Module {
  constructor() {
    this.name = '';
    this.tools = [];
  }

  /**
   * Register a tool with this module
   * @param {string} name - Tool name
   * @param {Tool} tool - Tool instance
   */
  registerTool(name, tool) {
    this.tools.push(tool);
  }

  /**
   * Get all tools provided by this module
   * @returns {Array<Tool>} Array of tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Initialize the module
   * @returns {Promise<Module>} The initialized module
   */
  async initialize() {
    return this;
  }

  /**
   * Clean up module resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Override in subclasses if cleanup is needed
  }
}

export { Module };