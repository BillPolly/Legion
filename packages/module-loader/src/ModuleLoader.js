/**
 * ModuleLoader - Simple, single entry point for loading Legion modules
 * 
 * This is the ONE object that should be used to load modules.
 * No factories, no managers, no complex hierarchy - just load modules.
 */

import { ModuleFactory } from './module/ModuleFactory.js';
import ResourceManager from './resources/ResourceManager.js';
import { getResourceManager } from './resources/getResourceManager.js';

export class ModuleLoader {
  /**
   * Create a simple module loader
   * @param {ResourceManager} resourceManager - Optional resource manager (uses singleton if not provided)
   */
  constructor(resourceManager = null) {
    this.resourceManager = resourceManager; // Will be set in initialize() if null
    this.moduleFactory = null; // Will be created after getting resourceManager
    this.loadedModules = new Map();
    this.toolRegistry = new Map(); // Tool name -> Tool instance mapping
    this._initialized = false;
  }

  /**
   * Initialize the loader (loads environment if needed)
   */
  async initialize() {
    if (this._initialized) {
      return;
    }
    
    // Get the singleton ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = await getResourceManager();
    } else if (!this.resourceManager.initialized) {
      await this.resourceManager.initialize();
    }
    
    // Now create the module factory
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    this._initialized = true;
  }

  /**
   * Load a module from a directory (looks for Module.js or module.json)
   * @param {string} modulePath - Path to module directory
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModule(modulePath) {
    // Check if already loaded
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath);
    }

    // Use ModuleFactory to create the module
    const module = await this.moduleFactory.createModuleAuto(modulePath);
    
    // Store it
    this.loadedModules.set(modulePath, module);
    
    // Register tools from the module
    await this._registerModuleTools(module);
    
    return module;
  }

  /**
   * Load a module from module.json file
   * @param {string} jsonPath - Path to module.json file
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModuleFromJson(jsonPath) {
    // Check if already loaded
    if (this.loadedModules.has(jsonPath)) {
      return this.loadedModules.get(jsonPath);
    }

    // Use ModuleFactory to create the module
    const module = await this.moduleFactory.createJsonModule(jsonPath);
    
    // Store it
    this.loadedModules.set(jsonPath, module);
    
    // Register tools from the module
    await this._registerModuleTools(module);
    
    return module;
  }

  /**
   * Get all loaded modules
   * @returns {Array} Array of loaded modules
   */
  getLoadedModules() {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Get all tools from all loaded modules
   * @returns {Promise<Array>} Array of all tools
   */
  async getAllTools() {
    const allTools = [];
    
    for (const module of this.loadedModules.values()) {
      if (module.getTools) {
        const toolsResult = module.getTools();
        // Handle both sync and async getTools
        const tools = toolsResult && typeof toolsResult.then === 'function' 
          ? await toolsResult 
          : toolsResult;
        
        if (Array.isArray(tools)) {
          allTools.push(...tools);
        }
      }
    }
    
    return allTools;
  }

  /**
   * Get a specific tool by name
   * @param {string} toolName - Name of the tool to get
   * @returns {Object|null} Tool instance or null if not found
   */
  getTool(toolName) {
    return this.toolRegistry.get(toolName) || null;
  }

  /**
   * Get multiple tools by name
   * @param {Array<string>} toolNames - Array of tool names to get
   * @returns {Promise<Array>} Array of tool instances (null for not found)
   */
  async getToolsByName(toolNames) {
    return toolNames.map(name => this.getTool(name));
  }

  /**
   * Get all tool names currently registered
   * @returns {Array<string>} Array of tool names
   */
  getToolNames() {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Check if a tool is registered
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool is registered
   */
  hasTool(toolName) {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Load a module by name from a known module (used by other packages)
   * @param {string} moduleName - Name/identifier of the module
   * @param {Function} ModuleClass - Module class to instantiate
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModuleByName(moduleName, ModuleClass) {
    // Check if already loaded
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    // Use ModuleFactory to create the module
    const module = await this.moduleFactory.createModule(ModuleClass);
    
    // Store it
    this.loadedModules.set(moduleName, module);
    
    // Register tools from the module
    await this._registerModuleTools(module);
    
    return module;
  }

  /**
   * Register tools from a module into the tool registry
   * @private
   * @param {Object} module - Module instance
   */
  async _registerModuleTools(module) {
    if (module.getTools && typeof module.getTools === 'function') {
      const toolsResult = module.getTools();
      // Handle both sync and async getTools
      const tools = toolsResult && typeof toolsResult.then === 'function' 
        ? await toolsResult 
        : toolsResult;
      
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          if (tool && tool.name) {
            this.toolRegistry.set(tool.name, tool);
          }
        }
      }
    }
  }

  /**
   * Clear all loaded modules and tools
   */
  clear() {
    this.loadedModules.clear();
    this.toolRegistry.clear();
  }
  
  /**
   * Get a loaded module by name
   * @param {string} moduleName - Name of the module
   * @returns {Object|null} The module instance or null if not loaded
   */
  getModule(moduleName) {
    return this.loadedModules.get(moduleName) || null;
  }
  
  /**
   * Get names of all loaded modules
   * @returns {Array<string>} Array of loaded module names
   */
  getLoadedModuleNames() {
    return Array.from(this.loadedModules.keys());
  }
  
  /**
   * Check if a module is loaded
   * @param {string} moduleName - Name of the module
   * @returns {boolean} True if module is loaded
   */
  hasModule(moduleName) {
    return this.loadedModules.has(moduleName);
  }

  /**
   * Generate a comprehensive inventory of all loaded modules and their tools
   * @returns {Object} Inventory with modules and tools information
   */
  getModuleAndToolInventory() {
    const inventory = {
      generatedAt: new Date().toISOString(),
      moduleCount: this.loadedModules.size,
      toolCount: this.toolRegistry.size,
      modules: {},
      tools: {}
    };

    // Document each module
    for (const [moduleName, module] of this.loadedModules.entries()) {
      inventory.modules[moduleName] = {
        name: module.name || moduleName,
        description: module.description || 'No description available',
        toolCount: 0,
        tools: []
      };

      // Get tools from this module
      if (module.getTools && typeof module.getTools === 'function') {
        const toolsResult = module.getTools();
        const tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        inventory.modules[moduleName].toolCount = tools.length;
        inventory.modules[moduleName].tools = tools.map(tool => tool.name || 'unnamed');
      }
    }

    // Document each tool
    for (const [toolName, tool] of this.toolRegistry.entries()) {
      inventory.tools[toolName] = {
        name: toolName,
        description: tool.description || 'No description available',
        hasExecute: typeof tool.execute === 'function',
        hasInvoke: typeof tool.invoke === 'function',
        inputSchema: tool.inputSchema ? 'defined' : 'not defined'
      };
    }

    return inventory;
  }
}

export default ModuleLoader;