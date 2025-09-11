/**
 * Service for managing tool calling operations
 */
class ToolCallingService {
  constructor() {
    this.registeredTools = new Map();
  }

  /**
   * Register a new tool
   * @param {string} toolName 
   * @param {Function} handler 
   */
  registerTool(toolName, handler) {
    this.registeredTools.set(toolName, handler);
  }

  /**
   * Execute a tool call
   * @param {string} toolName 
   * @param {Object} params 
   */
  async executeTool(toolName, params) {
    const handler = this.registeredTools.get(toolName);
    if (!handler) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return await handler(params);
  }
}

export default ToolCallingService;