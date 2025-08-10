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
   * @returns {JsonModule} Module instance
   */
  async createFromDefinition(definition, config) {
    // Validate the module definition using schema-based validator
    const { ModuleJsonSchemaValidator } = await import('./validation/ModuleJsonSchemaValidator.js');
    const validator = new ModuleJsonSchemaValidator();
    const validation = validator.validate(definition);

    if (!validation.valid) {
      const errorMessages = validation.errors.map(err => `${err.path}: ${err.message}`);
      throw new Error(`Invalid module.json definition:\n${errorMessages.join('\n')}`);
    }

    // Log warnings if present
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn(`Module '${definition.name}' validation warnings:`);
      validation.warnings.forEach(warning => {
        console.warn(`  ${warning.path}: ${warning.message}`);
        if (warning.suggestion) {
          console.warn(`    Suggestion: ${warning.suggestion}`);
        }
      });
    }
    
    // Import JsonModule for dynamic module creation
    const { JsonModule } = await import('./modules/JsonModule.js');
    
    // Add base path to definition for relative imports
    if (!definition.basePath && definition.package) {
      // Try to infer base path from current working directory or module path
      definition.basePath = process.cwd();
    }
    
    // Create JsonModule instance
    const module = new JsonModule(definition, config, this.resourceManager);
    
    // Initialize the module (loads implementation and creates tools)
    await module.initialize();
    
    return module;
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