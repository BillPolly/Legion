/**
 * Simplified ModuleFactory for tool-system
 * Provides backward compatibility with module-loader's ModuleFactory
 */

import { ResourceManager } from './ResourceManager.js';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

export class ModuleFactory {
  constructor(resourceManager) {
    // Support both new ResourceManager and old one
    this.resourceManager = resourceManager || new ResourceManager();
    this.moduleCache = new Map();
  }

  /**
   * Create a module instance from a module class or definition
   * @param {string|Function|Object} moduleOrPath - Module class, path, or definition
   * @param {Object} config - Optional configuration
   * @returns {Promise<Module>} Module instance
   */
  async create(moduleOrPath, config = {}) {
    // If it's a string path, load the module
    if (typeof moduleOrPath === 'string') {
      moduleOrPath = await this.loadModule(moduleOrPath);
    }

    // If it's a class with static create method, use it
    if (moduleOrPath.create && typeof moduleOrPath.create === 'function') {
      return await moduleOrPath.create(this.resourceManager);
    }

    // If it's a constructor function
    if (typeof moduleOrPath === 'function') {
      // Check if it expects ResourceManager
      const instance = new moduleOrPath(config, this.resourceManager);
      
      // Call initialize if it exists
      if (instance.initialize && typeof instance.initialize === 'function') {
        await instance.initialize();
      }
      
      return instance;
    }

    // If it's a module definition object (JSON module)
    if (typeof moduleOrPath === 'object' && moduleOrPath.name) {
      return this.createFromDefinition(moduleOrPath, config);
    }

    throw new Error('Invalid module: must be a class, path, or definition object');
  }

  /**
   * Load a module from a file path
   * @param {string} modulePath - Path to module file
   * @returns {Promise<Module>} Module class or definition
   */
  async loadModule(modulePath) {
    // Check cache
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath);
    }

    // Check if it's a JSON module
    if (modulePath.endsWith('.json')) {
      const content = await fs.readFile(modulePath, 'utf-8');
      const definition = JSON.parse(content);
      this.moduleCache.set(modulePath, definition);
      return definition;
    }

    // Load JavaScript module
    const moduleUrl = pathToFileURL(path.resolve(modulePath)).href;
    const module = await import(moduleUrl);
    
    // Get the default export or the first named export
    const ModuleClass = module.default || Object.values(module)[0];
    
    this.moduleCache.set(modulePath, ModuleClass);
    return ModuleClass;
  }

  /**
   * Create module from JSON definition
   * @param {Object} definition - Module definition
   * @param {Object} config - Configuration
   * @returns {Module} Module instance
   */
  async createFromDefinition(definition, config) {
    // Import Module from compatibility layer
    const { Module } = await import('./compatibility.js');
    
    // Create a dynamic module class
    class DynamicModule extends Module {
      constructor() {
        super(definition.name, config);
        
        // Add tools from definition
        if (definition.tools) {
          for (const toolDef of definition.tools) {
            this.registerTool(this.createToolFromDefinition(toolDef));
          }
        }
      }

      async createToolFromDefinition(toolDef) {
        const { Tool } = await import('./modules/Tool.js');
        
        return new Tool({
          name: toolDef.name,
          description: toolDef.description,
          inputSchema: toolDef.inputSchema,
          execute: async (input) => {
            // Simple execution based on definition
            // This is a simplified version - real implementation would be more complex
            return {
              success: true,
              data: input
            };
          }
        });
      }
    }

    return new DynamicModule();
  }

  /**
   * Register a module class for later instantiation
   * @param {string} name - Module name
   * @param {Function} moduleClass - Module class
   */
  registerModule(name, moduleClass) {
    this.moduleCache.set(name, moduleClass);
  }

  /**
   * Get a registered module class
   * @param {string} name - Module name
   * @returns {Function} Module class
   */
  getModule(name) {
    return this.moduleCache.get(name);
  }

  /**
   * Clear the module cache
   */
  clearCache() {
    this.moduleCache.clear();
  }
}

export default ModuleFactory;