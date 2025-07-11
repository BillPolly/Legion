/**
 * Base class for modules that contain related tools
 */
class OpenAIModule {
  constructor() {
    this.name = '';
    this.tools = [];
  }

  /**
   * Get all tools provided by this module
   * @returns {Array<OpenAITool>} Array of tools
   */
  getTools() {
    return this.tools;
  }
}

module.exports = { OpenAIModule };