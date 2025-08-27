/**
 * ToolDiscoveryService Interface - Port for tool discovery
 * Following Clean Architecture - defines the contract for tool discovery
 */

export class ToolDiscoveryService {
  /**
   * Discover relevant tools for a task
   * @param {string} taskDescription - The task description
   * @returns {Promise<Array>} Array of discovered tools with confidence scores
   */
  async discoverTools(taskDescription) {
    throw new Error('ToolDiscoveryService.discoverTools() must be implemented');
  }

  /**
   * Check if a specific tool is available
   * @param {string} toolName - The name of the tool
   * @returns {Promise<boolean>} True if tool is available
   */
  async isToolAvailable(toolName) {
    throw new Error('ToolDiscoveryService.isToolAvailable() must be implemented');
  }

  /**
   * Get detailed information about a tool
   * @param {string} toolName - The name of the tool
   * @returns {Promise<Object|null>} Tool information or null if not found
   */
  async getToolInfo(toolName) {
    throw new Error('ToolDiscoveryService.getToolInfo() must be implemented');
  }
}