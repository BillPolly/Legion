/**
 * ModuleInstance base class
 * Base class for module instances that hold and provide tools
 */

export class ModuleInstance {
  constructor(moduleDefinition, config) {
    this.moduleDefinition = moduleDefinition;
    this.config = config;
    this.tools = {};
  }
  
  /**
   * Create the tools (to be implemented by subclass)
   */
  createTools() {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * Async initialization (can be overridden)
   */
  async initialize() {
    // Override in subclass if async setup needed
  }
  
  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Tool} The requested tool
   */
  getTool(name) {
    const tool = this.tools[name];
    if (!tool) {
      throw new Error(`Tool '${name}' not found in module`);
    }
    return tool;
  }
  
  /**
   * List available tool names
   * @returns {string[]} Array of tool names
   */
  listTools() {
    return Object.keys(this.tools);
  }
  
  /**
   * Optional: cleanup resources
   */
  async cleanup() {
    // Close connections, cleanup resources
    // Override in subclass if needed
  }
}