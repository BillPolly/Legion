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
    console.log('[ToolDefinitionProvider.getAllToolDefinitions] Starting...');

    // Add context management tools
    const contextTools = this.contextManager.getToolDefinitions();
    console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Context tools: ${contextTools.length}`);
    allTools.push(...contextTools);

    // Add dynamically loaded module tools
    const moduleTools = this.moduleLoader.getModuleToolDefinitions();
    console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Module tools: ${moduleTools.length}`);
    allTools.push(...moduleTools);

    // Add debug tools if they exist
    if (this._debugTools) {
      console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Debug tools: ${this._debugTools.length}`);
      allTools.push(...this._debugTools);
    } else {
      console.log('[ToolDefinitionProvider.getAllToolDefinitions] No debug tools!');
    }

    console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Total tools: ${allTools.length}`);
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
            const result = await this.contextManager.executeContextTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (contextError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureContextError(contextError, 'execute-tool', { toolName, args: resolvedArgs });
            }
            throw contextError;
          }
        
        case 'module':
          try {
            const result = await this.moduleLoader.executeModuleTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (moduleError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureToolError(moduleError, toolName, resolvedArgs);
            }
            throw moduleError;
          }
        
        case 'debug':
          try {
            const result = await this._debugTool.executeDebugTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
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
  /**
   * CENTRALIZED formatter - converts ALL Legion tool responses to MCP format
   * This is the ONLY place where Legion format gets converted to MCP format
   * 
   * Legion format: {success: true, message: "...", data: {...}}
   * MCP format: {content: [{type: "text", text: "JSON string"}], isError: false}
   */
  _formatToolResponse(result) {
    // Get logManager from resource manager if available
    const logManager = this._resourceManager?.get('logManager');
    
    if (logManager) {
      logManager.logInfo('Formatting tool response from Legion to MCP format', {
        source: 'ToolDefinitionProvider',
        operation: 'format-response',
        resultType: typeof result,
        hasSuccess: result && typeof result === 'object' && 'success' in result
      });
    }
    
    // If already in MCP format, return as-is (should not happen now)
    if (result && typeof result === 'object' && Array.isArray(result.content)) {
      if (logManager) {
        logManager.logInfo('Response already in MCP format, returning as-is', {
          source: 'ToolDefinitionProvider',
          operation: 'format-response-bypass'
        });
      }
      return result;
    }
    
    // Convert Legion format to proper MCP format
    // For Legion responses, always JSON stringify the entire result
    // This ensures consistent format that MCP clients can parse
    let textContent;
    if (typeof result === 'string') {
      textContent = result;
    } else {
      // Use compact JSON to avoid escaping issues
      textContent = JSON.stringify(result);
    }
    
    const mcpResponse = {
      content: [{
        type: "text",
        text: textContent
      }],
      isError: Boolean(result && typeof result === 'object' && result.success === false)
    };
    
    if (logManager) {
      logManager.logInfo('Successfully converted Legion format to MCP format', {
        source: 'ToolDefinitionProvider',
        operation: 'format-response-complete',
        isError: mcpResponse.isError,
        textLength: mcpResponse.content[0].text.length
      });
    }
    
    return mcpResponse;
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