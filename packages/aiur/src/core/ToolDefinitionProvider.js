/**
 * ToolDefinitionProvider - Centralized tool definition generation for MCP
 * 
 * Combines context tools and dynamically loaded Legion module tools into a single
 * unified tool definition list for the MCP server.
 */

import { ContextManager } from './ContextManager.js';
import { ModuleManager, ModuleFactory } from '@legion/module-loader';
import { ModuleHandler } from './ModuleHandler.js';
import { ModuleOperationTools } from '../tools/ModuleOperationTools.js';
import path from 'path';

export class ToolDefinitionProvider {
  constructor(contextManager, moduleManager) {
    this.contextManager = contextManager;
    this.moduleManager = moduleManager;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<ToolDefinitionProvider>} Initialized ToolDefinitionProvider instance
   */
  static async create(resourceManager) {
    // Create context manager
    const contextManager = await ContextManager.create(resourceManager);
    
    // Create Legion ModuleManager directly
    const moduleFactory = new ModuleFactory(resourceManager);
    const moduleManager = new ModuleManager(moduleFactory, {
      searchDepth: 3,
      autoDiscover: false
    });
    
    const provider = new ToolDefinitionProvider(contextManager, moduleManager);
    provider._resourceManager = resourceManager; // Store for later use
    return provider;
  }

  /**
   * Initialize the provider by loading all modules
   * @returns {Promise<void>}
   */
  async initialize() {
    // Store module manager in resource manager FIRST for module handler
    this._resourceManager.register('moduleManager', this.moduleManager);
    
    // Discover and load essential modules
    const currentPath = process.cwd();
    // Navigate to Legion root from wherever we are
    let basePath = currentPath;
    if (currentPath.includes('/packages/')) {
      // We're inside a package, go up to Legion root
      basePath = currentPath.substring(0, currentPath.lastIndexOf('/packages/'));
    }
      
    const moduleDirectories = [
      path.join(basePath, 'packages/general-tools/src'),
      path.join(basePath, 'packages/apps'),
      path.join(basePath, 'packages/code-gen')
    ];

    // Discover available modules
    await this.moduleManager.discoverModules(moduleDirectories);
    
    // Create module handler and operation tools
    this.moduleHandler = await ModuleHandler.create(this._resourceManager);
    this.moduleOperationTools = new ModuleOperationTools(this.moduleHandler);
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

    // Add module operation tools
    if (this.moduleOperationTools) {
      const moduleOpTools = this.moduleOperationTools.getToolDefinitions();
      console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Module operation tools: ${moduleOpTools.length}`);
      allTools.push(...moduleOpTools);
    }

    // Add dynamically loaded module tools
    const moduleTools = this._getModuleToolDefinitions();
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
           (this.moduleOperationTools && this.moduleOperationTools.isModuleTool(toolName)) ||
           this._isModuleTool(toolName) ||
           this.isDebugTool(toolName);
  }

  /**
   * Get tool type for routing
   * @param {string} toolName - Name of the tool
   * @returns {string} Tool type: 'context', 'module', 'moduleOp', 'debug', or 'unknown'
   */
  getToolType(toolName) {
    if (this.contextManager.isContextTool(toolName)) {
      return 'context';
    }
    if (this.moduleOperationTools && this.moduleOperationTools.isModuleTool(toolName)) {
      return 'moduleOp';
    }
    if (this._isModuleTool(toolName)) {
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
        
        case 'moduleOp':
          try {
            const result = await this.moduleOperationTools.executeModuleTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (moduleOpError) {
            if (errorBroadcastService) {
              errorBroadcastService.captureToolError(moduleOpError, toolName, resolvedArgs);
            }
            throw moduleOpError;
          }
        
        case 'module':
          try {
            const result = await this._executeModuleTool(toolName, resolvedArgs);
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
    const moduleTools = this._getModuleToolDefinitions();
    const debugTools = this._debugTools || [];
    const modules = this._getLoadedModulesInfo();

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

    const moduleTools = this._getModuleToolDefinitions().map(tool => ({
      ...tool,
      type: 'module',
      source: 'Legion ModuleManager'
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
   * Get all tool definitions from loaded modules
   * @returns {Array} Array of MCP tool definitions
   * @private
   */
  _getModuleToolDefinitions() {
    const definitions = [];
    
    // Get modules from both sources: Legion's ModuleManager and our custom storage
    const loadedModules = this.moduleManager.getLoadedModules();
    const customModules = this.moduleManager._loadedModules ? Array.from(this.moduleManager._loadedModules.values()) : [];
    
    console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion loaded modules: ${loadedModules.length}, Custom modules: ${customModules.length}`);
    
    // Process Legion's loaded modules
    for (const entry of loadedModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        if (Array.isArray(tools)) {
          console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion module ${entry.name} has ${tools.length} tools`);
          
          for (const tool of tools) {
            this._addToolDefinitions(tool, definitions);
          }
        } else {
          console.warn(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion module ${entry.name} getTools() returned non-array:`, typeof tools);
        }
      }
    }
    
    // Process our custom loaded modules (like ModuleManagerModule)
    for (const entry of customModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        if (Array.isArray(tools)) {
          console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Custom module ${entry.name} has ${tools.length} tools`);
          
          for (const tool of tools) {
            this._addToolDefinitions(tool, definitions);
          }
        } else {
          console.warn(`[ToolDefinitionProvider._getModuleToolDefinitions] Custom module ${entry.name} getTools() returned non-array:`, typeof tools);
        }
      }
    }
    
    console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Returning ${definitions.length} tool definitions:`, definitions.map(d => d.name));
    return definitions;
  }
  
  /**
   * Helper method to add tool definitions from a tool
   * @param {Object} tool - The tool to extract definitions from
   * @param {Array} definitions - Array to add definitions to
   * @private
   */
  _addToolDefinitions(tool, definitions) {
    // Handle multi-function tools
    if (tool.getAllToolDescriptions) {
      const allDescs = tool.getAllToolDescriptions();
      // Fix: Ensure allDescs is iterable before using for...of
      if (Array.isArray(allDescs)) {
        for (const desc of allDescs) {
          definitions.push({
            name: desc.function.name,
            description: desc.function.description,
            inputSchema: desc.function.parameters
          });
        }
      } else {
        console.warn(`[ToolDefinitionProvider] Tool ${tool.name} getAllToolDescriptions() returned non-array:`, typeof allDescs);
      }
    } else if (tool.getToolDescription) {
      // Single function tool
      const desc = tool.getToolDescription();
      if (desc && desc.function) {
        definitions.push({
          name: desc.function.name,
          description: desc.function.description,
          inputSchema: desc.function.parameters
        });
      } else {
        console.warn(`[ToolDefinitionProvider] Tool ${tool.name} getToolDescription() returned invalid data:`, desc);
      }
    }
  }

  /**
   * Check if a tool is from a loaded module
   * @param {string} toolName - Name of the tool
   * @returns {boolean} True if it's a module tool
   * @private
   */
  _isModuleTool(toolName) {
    // Check both Legion's loaded modules and our custom modules
    const loadedModules = this.moduleManager.getLoadedModules();
    const customModules = this.moduleManager._loadedModules ? Array.from(this.moduleManager._loadedModules.values()) : [];
    
    // Check Legion's loaded modules
    for (const entry of loadedModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        for (const tool of tools) {
          if (this._toolProvidesFunction(tool, toolName)) {
            return true;
          }
        }
      }
    }
    
    // Check our custom loaded modules
    for (const entry of customModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        for (const tool of tools) {
          if (this._toolProvidesFunction(tool, toolName)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Helper method to check if a tool provides a specific function
   * @param {Object} tool - The tool to check
   * @param {string} toolName - The function name to look for
   * @returns {boolean} True if the tool provides this function
   * @private
   */
  _toolProvidesFunction(tool, toolName) {
    // Check multi-function tools
    if (tool.getAllToolDescriptions) {
      const allDescs = tool.getAllToolDescriptions();
      return allDescs.some(desc => desc.function.name === toolName);
    } else if (tool.getToolDescription) {
      // Single function tool
      const desc = tool.getToolDescription();
      return desc.function.name === toolName;
    }
    return false;
  }

  /**
   * Execute a tool from a loaded module
   * @param {string} toolName - Name of the tool
   * @param {Object} resolvedArgs - Already resolved arguments
   * @returns {Promise<Object>} Tool execution result
   * @private
   */
  async _executeModuleTool(toolName, resolvedArgs) {
    // Check both Legion's loaded modules and our custom modules
    const loadedModules = this.moduleManager.getLoadedModules();
    const customModules = this.moduleManager._loadedModules ? Array.from(this.moduleManager._loadedModules.values()) : [];
    
    // Find the tool in loaded modules
    let targetTool = null;
    
    // Check Legion's loaded modules first
    for (const entry of loadedModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        const tools = moduleInstance.getTools();
        for (const tool of tools) {
          if (this._toolProvidesFunction(tool, toolName)) {
            targetTool = tool;
            break;
          }
        }
        if (targetTool) break;
      }
    }
    
    // If not found, check our custom loaded modules
    if (!targetTool) {
      for (const entry of customModules) {
        const moduleInstance = entry.instance;
        if (moduleInstance && moduleInstance.getTools) {
          const tools = moduleInstance.getTools();
          for (const tool of tools) {
            if (this._toolProvidesFunction(tool, toolName)) {
              targetTool = tool;
              break;
            }
          }
          if (targetTool) break;
        }
      }
    }
    
    if (!targetTool) {
      throw new Error(`Tool ${toolName} not found in any loaded module`);
    }

    // Execute the tool directly using Legion format
    const toolCall = {
      id: `aiur-${Date.now()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(resolvedArgs)
      }
    };
    
    // Execute using Legion tool and return the raw result
    return await targetTool.safeInvoke(toolCall);
  }

  /**
   * Get loaded modules information
   * @returns {Array} Array of loaded module info
   * @private
   */
  _getLoadedModulesInfo() {
    const loadedModules = this.moduleManager.getLoadedModules();
    return loadedModules.map(entry => {
      const module = entry.instance;
      return {
        name: entry.name,
        description: module?.description || module?.getDescription?.() || 'No description',
        toolCount: module?.getTools ? module.getTools().length : 0,
        type: entry.metadata?.type || 'unknown',
        status: entry.metadata?.status || 'loaded'
      };
    });
  }

  /**
   * Load a module instance that was created using direct instantiation
   * @param {Object} moduleInstance - Already instantiated module
   * @returns {Promise<Object>} Module load result
   * @private
   */
  async _loadModuleInstance(moduleInstance) {
    // Initialize the module if it has an initialize method
    if (typeof moduleInstance.initialize === 'function') {
      try {
        await moduleInstance.initialize();
      } catch (error) {
        console.warn(`[ToolDefinitionProvider] Failed to initialize module ${moduleInstance.name}:`, error);
      }
    }
    
    // Register the tools from the created module
    const tools = moduleInstance.getTools();
    console.log(`[ToolDefinitionProvider] Module ${moduleInstance.name} provides ${tools.length} tools`);
    
    // Store the loaded module in our ModuleManager
    const entry = {
      name: moduleInstance.name,
      instance: moduleInstance,
      metadata: {
        type: 'direct',
        status: 'loaded'
      }
    };
    
    // Add to loaded modules using the proper API
    // Since ModuleManager doesn't have a direct way to add loaded modules,
    // we'll store it in a way that our _getModuleToolDefinitions can find it
    if (!this.moduleManager._loadedModules) {
      this.moduleManager._loadedModules = new Map();
    }
    this.moduleManager._loadedModules.set(moduleInstance.name, entry);
    
    return {
      moduleName: moduleInstance.name,
      toolsRegistered: tools.length,
      tools: tools.map(t => t.name || 'unknown')
    };
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