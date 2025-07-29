/**
 * ModuleLoader - Simple, single entry point for loading Legion modules
 * 
 * This is the ONE object that should be used to load modules.
 * No factories, no managers, no complex hierarchy - just load modules.
 */

import { ModuleFactory } from './module/ModuleFactory.js';
import ResourceManager from './resources/ResourceManager.js';

export class ModuleLoader {
  /**
   * Create a simple module loader
   * @param {ResourceManager} resourceManager - Optional resource manager (creates one if not provided)
   */
  constructor(resourceManager = null) {
    this.resourceManager = resourceManager || new ResourceManager();
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    this.loadedModules = new Map();
  }

  /**
   * Initialize the loader (loads environment if needed)
   */
  async initialize() {
    if (!this.resourceManager.initialized) {
      await this.resourceManager.initialize();
    }
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
   * Clear all loaded modules
   */
  clear() {
    this.loadedModules.clear();
  }
}

export default ModuleLoader;