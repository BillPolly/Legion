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
    
    const provider = new ToolDefinitionProvider(contextManager, moduleLoader);
    provider._resourceManager = resourceManager; // Store for later use
    return provider;
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

    // Add debug tools if they exist
    if (this._debugTools) {
      allTools.push(...this._debugTools);
    }

    return allTools;
  }

  /**
   * Check if a tool exists
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool exists
   */
  toolExists(toolName) {
    return this.contextManager.isContextTool(toolName) || 
           this.moduleLoader.isModuleTool(toolName) ||
           this.isDebugTool(toolName);
  }

  /**
   * Get tool type for routing
   * @param {string} toolName - Name of the tool
   * @returns {string} Tool type: 'context', 'module', 'debug', or 'unknown'
   */
  getToolType(toolName) {
    if (this.contextManager.isContextTool(toolName)) {
      return 'context';
    }
    if (this.moduleLoader.isModuleTool(toolName)) {
      return 'module';
    }
    if (this.isDebugTool(toolName)) {
      return 'debug';
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
    const errorBroadcastService = this._getErrorBroadcastService();

    try {
      switch (toolType) {
        case 'context':
          try {
            return await this.contextManager.executeContextTool(toolName, resolvedArgs);
          } catch (contextError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureContextError(contextError, 'execute-tool', { toolName, args: resolvedArgs });
            }
            throw contextError;
          }
        
        case 'module':
          try {
            // Module tools return raw results, need to format for MCP
            const result = await this.moduleLoader.executeModuleTool(toolName, resolvedArgs);
            return this._formatModuleToolResponse(result);
          } catch (moduleError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureToolError(moduleError, toolName, resolvedArgs);
            }
            throw moduleError;
          }
        
        case 'debug':
          try {
            // Debug tools return already formatted MCP responses
            return await this._debugTool.executeDebugTool(toolName, resolvedArgs);
          } catch (debugError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureToolError(debugError, toolName, resolvedArgs);
            }
            throw debugError;
          }
        
        default:
          const error = new Error(`Unknown tool: ${toolName}`);
          if (errorBroadcastService) {
            errorBroadcastService.captureToolError(error, toolName, resolvedArgs);
          }
          return {
            content: [{
              type: "text",
              text: `Unknown tool: ${toolName}`
            }],
            isError: true,
          };
      }
    } catch (error) {
      // Capture and broadcast the error
      if (errorBroadcastService) {
        errorBroadcastService.captureToolError(error, toolName, resolvedArgs);
      }
      
      // Re-throw to maintain original behavior
      throw error;
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
    const debugTools = this._debugTools || [];
    const modules = this.moduleLoader.getLoadedModulesInfo();

    return {
      total: contextTools.length + moduleTools.length + debugTools.length,
      context: contextTools.length,
      modules: moduleTools.length,
      debug: debugTools.length,
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

    const debugTools = (this._debugTools || []).map(tool => ({
      ...tool,
      type: 'debug',
      source: 'DebugTool'
    }));

    return {
      contextTools,
      moduleTools,
      debugTools,
      allTools: [...contextTools, ...moduleTools, ...debugTools]
    };
  }

  /**
   * Check if a tool is a debug tool
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool is a debug tool
   */
  isDebugTool(toolName) {
    if (!this._debugTools) return false;
    return this._debugTools.some(tool => tool.name === toolName);
  }

  /**
   * Set the debug tool instance for execution
   * @param {DebugTool} debugTool - The debug tool instance
   */
  setDebugTool(debugTool) {
    this._debugTool = debugTool;
  }

  /**
   * Get error broadcast service if available
   * @private
   * @returns {ErrorBroadcastService|null}
   */
  _getErrorBroadcastService() {
    try {
      // Try to get from resource manager if available
      if (this._resourceManager) {
        return this._resourceManager.get('errorBroadcastService');
      }
    } catch (error) {
      // Service not available yet
    }
    return null;
  }
}