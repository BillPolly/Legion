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
    
    // Get the shared ModuleManager from ResourceManager (created in AiurServer)
    const moduleManager = resourceManager.get('moduleManager');
    if (!moduleManager) {
      throw new Error('ModuleManager not found in ResourceManager. It should be created in AiurServer startup.');
    }
    
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
    // Make sure we use the registered instance to ensure everyone shares the same one
    this.moduleManager = this._resourceManager.get('moduleManager');
    
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
      path.join(basePath, 'packages/code-gen'),
      path.join(basePath, 'packages/railway/src'),
      path.join(basePath, 'packages/playwright/src'),
      path.join(basePath, 'packages/node-runner/src'),
      path.join(basePath, 'packages/log-manager/src'),
      path.join(basePath, 'packages/conan-the-deployer/src'),
      path.join(basePath, 'packages/llm/src'),
      path.join(basePath, 'packages/llm-planner/src'),
      path.join(basePath, 'packages/plan-executor/src')
    ];

    // Discover available modules
    await this.moduleManager.discoverModules(moduleDirectories);
    
    // Create module handler and operation tools
    this.moduleHandler = await ModuleHandler.create(this._resourceManager);
    this.moduleOperationTools = new ModuleOperationTools(this.moduleHandler);
    
    // Set up event listeners for module changes
    this._setupModuleEventListeners();
  }

  /**
   * Get all tool definitions for MCP server
   * @returns {Promise<Array>} Complete array of MCP tool definitions
   */
  async getAllToolDefinitions() {
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

    // No forced refresh needed - we use events to stay updated

    // Add dynamically loaded module tools
    const moduleTools = await this._getModuleToolDefinitions();
    console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Module tools: ${moduleTools.length}`);
    allTools.push(...moduleTools);


    console.log(`[ToolDefinitionProvider.getAllToolDefinitions] Total tools: ${allTools.length}`);
    return allTools;
  }

  /**
   * Check if a tool exists
   * @param {string} toolName - Name of the tool to check
   * @returns {Promise<boolean>} True if tool exists
   */
  async toolExists(toolName) {
    return this.contextManager.isContextTool(toolName) || 
           (this.moduleOperationTools && this.moduleOperationTools.isModuleTool(toolName)) ||
           await this._isModuleTool(toolName);
  }

  /**
   * Get tool type for routing
   * @param {string} toolName - Name of the tool
   * @returns {Promise<string>} Tool type: 'context', 'module', 'moduleOp', or 'unknown'
   */
  async getToolType(toolName) {
    if (this.contextManager.isContextTool(toolName)) {
      return 'context';
    }
    if (this.moduleOperationTools && this.moduleOperationTools.isModuleTool(toolName)) {
      return 'moduleOp';
    }
    if (await this._isModuleTool(toolName)) {
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
    const toolType = await this.getToolType(toolName);

    try {
      switch (toolType) {
        case 'context':
          try {
            const result = await this.contextManager.executeContextTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (contextError) {
            throw contextError;
          }
        
        case 'moduleOp':
          try {
            const result = await this.moduleOperationTools.executeModuleTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (moduleOpError) {
            throw moduleOpError;
          }
        
        case 'module':
          try {
            const result = await this._executeModuleTool(toolName, resolvedArgs);
            return this._formatToolResponse(result);
          } catch (moduleError) {
            throw moduleError;
          }
        
        default:
          const error = new Error(`Unknown tool: ${toolName}`);
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    } catch (error) {
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
   * Return raw tool response without any formatting
   * The UI should handle formatting for display
   */
  _formatToolResponse(result) {
    // Just return the raw result - no formatting!
    // The debug UI will handle formatting for display
    return result;
  }

  /**
   * Get statistics about loaded tools
   * @returns {Object} Tool statistics
   */
  getToolStatistics() {
    const contextTools = this.contextManager.getToolDefinitions();
    const moduleTools = this._getModuleToolDefinitions();
    const modules = this._getLoadedModulesInfo();

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

    const moduleTools = this._getModuleToolDefinitions().map(tool => ({
      ...tool,
      type: 'module',
      source: 'Legion ModuleManager'
    }));


    return {
      contextTools,
      moduleTools,
      allTools: [...contextTools, ...moduleTools]
    };
  }


  /**
   * Set up event listeners for module loading/unloading
   * @private
   */
  _setupModuleEventListeners() {
    try {
      console.log('[ToolDefinitionProvider] Setting up module event listeners...');
      
      // Listen for module loading events from ModuleHandler
      if (this.moduleHandler && typeof this.moduleHandler.on === 'function') {
        this.moduleHandler.on('module-loaded', (moduleName) => {
          console.log(`[ToolDefinitionProvider] Received module-loaded event: ${moduleName}`);
          this._invalidateToolCache();
        });
        
        this.moduleHandler.on('module-unloaded', (moduleName) => {
          console.log(`[ToolDefinitionProvider] Received module-unloaded event: ${moduleName}`);
          this._invalidateToolCache();
        });
        
        console.log('[ToolDefinitionProvider] ✓ Event listeners registered on ModuleHandler');
      } else {
        console.log('[ToolDefinitionProvider] ModuleHandler does not support events, trying ModuleManager...');
      }
      
      // Also try listening on ModuleManager
      if (this.moduleManager && typeof this.moduleManager.on === 'function') {
        this.moduleManager.on('module-loaded', (moduleName) => {
          console.log(`[ToolDefinitionProvider] Received module-loaded event from ModuleManager: ${moduleName}`);
          this._invalidateToolCache();
        });
        
        this.moduleManager.on('module-unloaded', (moduleName) => {
          console.log(`[ToolDefinitionProvider] Received module-unloaded event from ModuleManager: ${moduleName}`);
          this._invalidateToolCache();
        });
        
        console.log('[ToolDefinitionProvider] ✓ Event listeners registered on ModuleManager');
      } else {
        console.log('[ToolDefinitionProvider] ModuleManager does not support events');
      }
      
      // Listen for events from ResourceManager if available
      if (this._resourceManager && typeof this._resourceManager.on === 'function') {
        this._resourceManager.on('module-changed', () => {
          console.log('[ToolDefinitionProvider] Received module-changed event from ResourceManager');
          this._invalidateToolCache();
        });
        
        console.log('[ToolDefinitionProvider] ✓ Event listeners registered on ResourceManager');
      }
      
    } catch (error) {
      console.error('[ToolDefinitionProvider] Error setting up event listeners:', error);
    }
  }
  
  /**
   * Invalidate the tool cache (for future caching implementation)
   * @private
   */
  _invalidateToolCache() {
    console.log('[ToolDefinitionProvider] Tool cache invalidated - tools will be refreshed on next request');
    // For now, just log. In the future, we could implement caching here
    // and clear the cache when modules change
  }

  /**
   * Get all tool definitions from loaded modules
   * @returns {Promise<Array>} Array of MCP tool definitions
   * @private
   */
  async _getModuleToolDefinitions() {
    const definitions = [];
    
    console.log('[ToolDefinitionProvider._getModuleToolDefinitions] === DEBUGGING MODULE MANAGER ===');
    console.log('[ToolDefinitionProvider] this.moduleManager:', !!this.moduleManager);
    console.log('[ToolDefinitionProvider] resourceManager has moduleManager:', this._resourceManager.has('moduleManager'));
    
    // Compare the instances
    const rmModuleManager = this._resourceManager.get('moduleManager');
    console.log('[ToolDefinitionProvider] this.moduleManager === resourceManager.moduleManager:', this.moduleManager === rmModuleManager);
    
    // Get modules from both sources: Legion's ModuleManager and our custom storage
    const loadedModules = this.moduleManager.getLoadedModules();
    const customModules = this.moduleManager._loadedModules ? Array.from(this.moduleManager._loadedModules.values()) : [];
    
    console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion loaded modules: ${loadedModules.length}, Custom modules: ${customModules.length}`);
    
    // Debug loaded modules
    loadedModules.forEach((module, index) => {
      console.log(`[ToolDefinitionProvider] Module ${index}:`, {
        name: module.name || 'unnamed',
        hasInstance: !!module.instance,
        hasGetTools: module.instance && typeof module.instance.getTools === 'function'
      });
    });
    
    // Process Legion's loaded modules
    for (const entry of loadedModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        try {
          const toolsResult = moduleInstance.getTools();
          // Handle both synchronous arrays and async promises
          const tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
          
          if (Array.isArray(tools)) {
            console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion module ${entry.name} has ${tools.length} tools`);
            
            for (const tool of tools) {
              this._addToolDefinitions(tool, definitions);
            }
          } else {
            console.warn(`[ToolDefinitionProvider._getModuleToolDefinitions] Legion module ${entry.name} getTools() returned non-array:`, typeof tools);
          }
        } catch (error) {
          console.error(`[ToolDefinitionProvider._getModuleToolDefinitions] Error getting tools from module ${entry.name}:`, error);
        }
      }
    }
    
    // Process our custom loaded modules (like ModuleManagerModule)
    for (const entry of customModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        try {
          const toolsResult = moduleInstance.getTools();
          // Handle both synchronous arrays and async promises
          const tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
          
          if (Array.isArray(tools)) {
            console.log(`[ToolDefinitionProvider._getModuleToolDefinitions] Custom module ${entry.name} has ${tools.length} tools`);
            
            for (const tool of tools) {
              this._addToolDefinitions(tool, definitions);
            }
          } else {
            console.warn(`[ToolDefinitionProvider._getModuleToolDefinitions] Custom module ${entry.name} getTools() returned non-array:`, typeof tools);
          }
        } catch (error) {
          console.error(`[ToolDefinitionProvider._getModuleToolDefinitions] Error getting tools from custom module ${entry.name}:`, error);
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
   * @returns {Promise<boolean>} True if it's a module tool
   * @private
   */
  async _isModuleTool(toolName) {
    // Check both Legion's loaded modules and our custom modules
    const loadedModules = this.moduleManager.getLoadedModules();
    const customModules = this.moduleManager._loadedModules ? Array.from(this.moduleManager._loadedModules.values()) : [];
    
    // Check Legion's loaded modules
    for (const entry of loadedModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        try {
          const toolsResult = moduleInstance.getTools();
          const tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
          
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              if (this._toolProvidesFunction(tool, toolName)) {
                return true;
              }
            }
          }
        } catch (error) {
          // Continue checking other modules
        }
      }
    }
    
    // Check our custom loaded modules
    for (const entry of customModules) {
      const moduleInstance = entry.instance;
      if (moduleInstance && moduleInstance.getTools) {
        try {
          const toolsResult = moduleInstance.getTools();
          const tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
          
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              if (this._toolProvidesFunction(tool, toolName)) {
                return true;
              }
            }
          }
        } catch (error) {
          // Continue checking other modules
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
        try {
          const toolsResult = moduleInstance.getTools();
          const tools = toolsResult && typeof toolsResult.then === 'function' 
            ? await toolsResult 
            : toolsResult;
          
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              if (this._toolProvidesFunction(tool, toolName)) {
                targetTool = tool;
                break;
              }
            }
            if (targetTool) break;
          }
        } catch (error) {
          // Continue checking other modules
        }
      }
    }
    
    // If not found, check our custom loaded modules
    if (!targetTool) {
      for (const entry of customModules) {
        const moduleInstance = entry.instance;
        if (moduleInstance && moduleInstance.getTools) {
          try {
            const toolsResult = moduleInstance.getTools();
            const tools = toolsResult && typeof toolsResult.then === 'function' 
              ? await toolsResult 
              : toolsResult;
            
            if (Array.isArray(tools)) {
              for (const tool of tools) {
                if (this._toolProvidesFunction(tool, toolName)) {
                  targetTool = tool;
                  break;
                }
              }
              if (targetTool) break;
            }
          } catch (error) {
            // Continue checking other modules
          }
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
    
    // Execute using Legion tool
    // Multi-function tools like FileOperationsTool need invoke() with toolCall format
    // Single-function tools need run() or execute() with parsed args
    if (typeof targetTool.invoke === 'function') {
      // Multi-function tool - use invoke with full toolCall
      return await targetTool.invoke(toolCall);
    } else if (typeof targetTool.run === 'function') {
      // Single-function tool with run method - pass parsed args
      const parsedArgs = typeof resolvedArgs === 'string' ? JSON.parse(resolvedArgs) : resolvedArgs;
      return await targetTool.run(parsedArgs);
    } else if (typeof targetTool.execute === 'function') {
      // Single-function tool with execute method - pass parsed args
      const parsedArgs = typeof resolvedArgs === 'string' ? JSON.parse(resolvedArgs) : resolvedArgs;
      return await targetTool.execute(parsedArgs);
    } else {
      throw new Error(`Tool ${toolName} does not have invoke(), run() or execute() method`);
    }
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

}