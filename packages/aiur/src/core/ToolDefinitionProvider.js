/**
 * ToolDefinitionProvider - Centralized tool definition generation for MCP
 * 
 * Combines context tools and dynamically loaded module tools into a single
 * unified tool definition list for the MCP server.
 */

import { ContextManager } from './ContextManager.js';
import { ModuleLoader } from './ModuleLoader.js';

export class ToolDefinitionProvider {
  constructor(contextManager, moduleLoader) {
    this.contextManager = contextManager;
    this.moduleLoader = moduleLoader;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<ToolDefinitionProvider>} Initialized ToolDefinitionProvider instance
   */
  static async create(resourceManager) {
    // Create context manager and module loader
    const contextManager = await ContextManager.create(resourceManager);
    const moduleLoader = await ModuleLoader.create(resourceManager);
    
    return new ToolDefinitionProvider(contextManager, moduleLoader);
  }

  /**
   * Initialize the provider by loading all modules
   * @returns {Promise<void>}
   */
  async initialize() {
    // Load all modules to populate tool definitions
    await this.moduleLoader.loadAllModules();
  }

  /**
   * Get all tool definitions for MCP server
   * @returns {Array} Complete array of MCP tool definitions
   */
  getAllToolDefinitions() {
    const allTools = [];

    // Add context management tools
    const contextTools = this.contextManager.getToolDefinitions();
    allTools.push(...contextTools);

    // Add dynamically loaded module tools
    const moduleTools = this.moduleLoader.getModuleToolDefinitions();
    allTools.push(...moduleTools);

    return allTools;
  }

  /**
   * Check if a tool exists
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool exists
   */
  toolExists(toolName) {
    return this.contextManager.isContextTool(toolName) || 
           this.moduleLoader.isModuleTool(toolName);
  }

  /**
   * Get tool type for routing
   * @param {string} toolName - Name of the tool
   * @returns {string} Tool type: 'context', 'module', or 'unknown'
   */
  getToolType(toolName) {
    if (this.contextManager.isContextTool(toolName)) {
      return 'context';
    }
    if (this.moduleLoader.isModuleTool(toolName)) {
      return 'module';
    }
    return 'unknown';
  }

  /**
   * Execute a tool by routing to the appropriate handler
   * @param {string} toolName - Name of the tool
   * @param {Object} resolvedArgs - Already resolved arguments
   * @returns {Promise<Object>} MCP-formatted response
   */
  async executeTool(toolName, resolvedArgs) {
    const toolType = this.getToolType(toolName);

    switch (toolType) {
      case 'context':
        return await this.contextManager.executeContextTool(toolName, resolvedArgs);
      
      case 'module':
        // Module tools return raw results, need to format for MCP
        const result = await this.moduleLoader.executeModuleTool(toolName, resolvedArgs);
        return this._formatModuleToolResponse(result);
      
      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${toolName}`
          }],
          isError: true,
        };
    }
  }

  /**
   * Format module tool response for MCP compatibility
   * @param {Object} result - Raw module tool result
   * @returns {Object} MCP-formatted response
   * @private
   */
  _formatModuleToolResponse(result) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }],
      isError: !result.success,
    };
  }

  /**
   * Get statistics about loaded tools
   * @returns {Object} Tool statistics
   */
  getToolStatistics() {
    const contextTools = this.contextManager.getToolDefinitions();
    const moduleTools = this.moduleLoader.getModuleToolDefinitions();
    const modules = this.moduleLoader.getLoadedModulesInfo();

    return {
      total: contextTools.length + moduleTools.length,
      context: contextTools.length,
      modules: moduleTools.length,
      loadedModules: modules.length,
      moduleDetails: modules
    };
  }

  /**
   * Get detailed tool information for debugging
   * @returns {Object} Detailed tool information
   */
  getDetailedToolInfo() {
    const contextTools = this.contextManager.getToolDefinitions().map(tool => ({
      ...tool,
      type: 'context',
      source: 'ContextManager'
    }));

    const moduleTools = this.moduleLoader.getModuleToolDefinitions().map(tool => ({
      ...tool,
      type: 'module',
      source: 'ModuleLoader'
    }));

    return {
      contextTools,
      moduleTools,
      allTools: [...contextTools, ...moduleTools]
    };
  }
}