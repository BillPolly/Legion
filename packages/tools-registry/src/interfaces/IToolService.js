/**
 * IToolService - Interface for Tool Management
 * 
 * Clean Architecture: Application Layer Interface
 * Defines contract for tool operations without implementation details
 */

export class IToolService {
  /**
   * Get tool by name
   * @param {string} toolName - Name of tool to retrieve
   * @returns {Promise<Object>} Executable tool with metadata
   */
  async getTool(toolName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get tool by database ID
   * @param {string} toolId - Database ID of tool
   * @returns {Promise<Object>} Executable tool with metadata
   */
  async getToolById(toolId) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get multiple tools by names
   * @param {string[]} toolNames - Names of tools to retrieve
   * @returns {Promise<Object>} Object with tools array and errors array
   */
  async getTools(toolNames) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * List all available tools
   * @param {Object} options - Listing options (filters, pagination)
   * @returns {Promise<Array>} Array of tool metadata
   */
  async listTools(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Register tools from a loaded module
   * @param {string} moduleName - Name of module
   * @param {Object} moduleInstance - Loaded module instance
   * @returns {Promise<Object>} Registration result with counts and errors
   */
  async registerModuleTools(moduleName, moduleInstance) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get tool with its perspectives
   * @param {string} toolName - Name of tool
   * @returns {Promise<Object>} Tool with perspectives metadata
   */
  async getToolWithPerspectives(toolName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clear tool from cache
   * @param {string} toolName - Name of tool to clear
   * @returns {Promise<Object>} Clear result
   */
  async clearTool(toolName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Clear all tools for a module
   * @param {string} moduleName - Name of module
   * @returns {Promise<Object>} Clear result with count
   */
  async clearModuleTools(moduleName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Verify tool metadata integrity
   * @param {string} toolName - Name of tool to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyToolMetadata(toolName) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get tool statistics
   * @returns {Promise<Object>} Tool statistics
   */
  async getToolStatistics() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Execute tool with parameters
   * @param {string} toolName - Name of tool to execute
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, parameters) {
    throw new Error('Method must be implemented by concrete class');
  }
}