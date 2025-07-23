/**
 * LegionModuleAdapter - Adapter to integrate Legion modules with Aiur's ToolRegistry
 * 
 * This adapter allows Legion modules to be loaded dynamically into Aiur,
 * converting Legion tool format to MCP-compatible format.
 */

import { ModuleFactory } from '@legion/module-loader';
import { ResourceManager } from '@legion/module-loader';

export class LegionModuleAdapter {
  constructor(toolRegistry, handleRegistry) {
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.resourceManager = null;
    this.moduleFactory = null;
    this.loadedModules = new Map();
  }

  /**
   * Initialize the adapter with ResourceManager
   */
  async initialize() {
    // Create and initialize ResourceManager
    this.resourceManager = new ResourceManager();
    await this.resourceManager.initialize();
    
    // Create ModuleFactory with the ResourceManager
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    
    // Register self-referential dependencies for modules that need them
    this.resourceManager.register('resourceManager', this.resourceManager);
    this.resourceManager.register('moduleFactory', this.moduleFactory);
  }

  /**
   * Load a Legion module and register its tools with Aiur
   * @param {string|Class} moduleIdentifier - Module class or path to module
   * @param {Object} dependencies - Optional dependencies to inject
   */
  async loadModule(moduleIdentifier, dependencies = {}) {
    if (!this.moduleFactory) {
      await this.initialize();
    }

    // Register any provided dependencies
    for (const [name, value] of Object.entries(dependencies)) {
      this.resourceManager.register(name, value);
    }

    let module;
    
    // Handle different module loading scenarios
    if (typeof moduleIdentifier === 'string') {
      // Load from path (auto-detect Module.js or module.json)
      module = await this.moduleFactory.createModuleAuto(moduleIdentifier);
    } else if (typeof moduleIdentifier === 'function') {
      // Load from class
      module = this.moduleFactory.createModule(moduleIdentifier);
    } else {
      throw new Error('Module identifier must be a path string or module class');
    }

    // Get tools from the module
    const tools = module.getTools();
    
    // Convert and register each tool
    for (const tool of tools) {
      const mcpTools = this._convertToMCPTools(tool, module);
      // mcpTools can be an array (for multi-function tools) or a single tool
      const toolsToRegister = Array.isArray(mcpTools) ? mcpTools : [mcpTools];
      for (const mcpTool of toolsToRegister) {
        this.toolRegistry.registerTool(mcpTool);
      }
    }

    // Store the loaded module
    this.loadedModules.set(module.name, module);
    
    return {
      moduleName: module.name,
      toolsRegistered: tools.length,
      tools: tools.map(t => t.name)
    };
  }

  /**
   * Convert a Legion tool to MCP-compatible format
   * @private
   * @param {Object} legionTool - The Legion tool to convert
   * @param {Object} module - The module that contains this tool
   * @returns {Object|Array} Single tool or array of tools for multi-function
   */
  _convertToMCPTools(legionTool, module) {
    // Handle tools that expose multiple functions
    if (legionTool.getAllToolDescriptions) {
      const allDescs = legionTool.getAllToolDescriptions();
      
      // Create individual MCP tools for each function
      return allDescs.map(desc => ({
        name: desc.function.name,
        description: desc.function.description,
        inputSchema: desc.function.parameters,
        category: 'legion',
        tags: ['imported', 'legion-module', legionTool.name],
        _module: module, // Store module reference
        _legionTool: legionTool, // Store original tool reference
        execute: async (args) => {
          // Create a mock tool call for Legion format
          const toolCall = {
            id: `aiur-${Date.now()}`,
            type: 'function',
            function: {
              name: desc.function.name,
              arguments: JSON.stringify(args)
            }
          };
          
          // Execute using Legion tool
          const result = await legionTool.safeInvoke(toolCall);
          
          // Convert ToolResult to Aiur format
          return {
            success: result.success,
            ...result.data,
            ...(result.error ? { error: result.error } : {})
          };
        }
      }));
    }
    
    // Single function tool - must have getToolDescription
    if (!legionTool.getToolDescription) {
      throw new Error(`Tool ${legionTool.name} must have either getToolDescription or getAllToolDescriptions method`);
    }
    
    const toolDesc = legionTool.getToolDescription();
    const functionDef = toolDesc.function;
    
    return {
      name: functionDef.name,
      description: functionDef.description,
      inputSchema: functionDef.parameters,
      category: 'legion',
      tags: ['imported', 'legion-module'],
      _module: module, // Store module reference
      _legionTool: legionTool, // Store original tool reference
      execute: async (args) => {
        // Create a mock tool call for Legion format
        const toolCall = {
          id: `aiur-${Date.now()}`,
          type: 'function',
          function: {
            name: functionDef.name,
            arguments: JSON.stringify(args)
          }
        };
        
        // Execute using Legion tool
        const result = await legionTool.safeInvoke(toolCall);
        
        // Convert ToolResult to Aiur format
        return {
          success: result.success,
          ...result.data,
          ...(result.error ? { error: result.error } : {})
        };
      }
    };
  }

  /**
   * List all loaded modules
   */
  listLoadedModules() {
    return Array.from(this.loadedModules.entries()).map(([name, module]) => ({
      name,
      tools: module.getTools().map(t => t.name)
    }));
  }

  /**
   * Unload a module and remove its tools
   */
  async unloadModule(moduleName) {
    const module = this.loadedModules.get(moduleName);
    if (!module) {
      throw new Error(`Module not found: ${moduleName}`);
    }

    // Clean up the module
    if (module.cleanup) {
      await module.cleanup();
    }

    // Remove tools from registry
    const tools = module.getTools();
    for (const tool of tools) {
      const toolDesc = tool.getToolDescription();
      this.toolRegistry.unregisterTool(toolDesc.function.name);
    }

    // Remove from loaded modules
    this.loadedModules.delete(moduleName);
  }
}