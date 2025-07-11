/**
 * Base class for modules that contain related tools
 */
class Module {
  constructor() {
    this.name = '';
    this.tools = [];
  }

  /**
   * Get all tools provided by this module
   * @returns {Array<ModularTool>} Array of tools
   */
  getTools() {
    return this.tools;
  }
}

export { Module };